import { createWriteStream } from "node:fs"
import { access, mkdir, readFile, rename, rm } from "node:fs/promises"
import { createRequire } from "node:module"
import { dirname, join } from "node:path"
import { Readable } from "node:stream"
import { pipeline } from "node:stream/promises"
import { setImmediate as yieldToEventLoop } from "node:timers/promises"
import { fileURLToPath, pathToFileURL } from "node:url"

export const EMBEDDING_MODEL = "Xenova/multilingual-e5-small"
export const EMBEDDING_REVISION = "761b726dd34fb83930e26aab4e9ac3899aa1fa78"
export const EMBEDDING_KEY = `${EMBEDDING_MODEL}@${EMBEDDING_REVISION}:q8:wasm1.30.0:tokens-v2`
export const EMBEDDING_DIMENSIONS = 384
export const MODEL_DIRECTORY = fileURLToPath(new URL("../../../.local/models/", import.meta.url))
const modelPath = join(MODEL_DIRECTORY, EMBEDDING_MODEL, EMBEDDING_REVISION)
const modelFiles = ["tokenizer.json", "tokenizer_config.json", "onnx/model_quantized.onnx"]
const require = createRequire(import.meta.url)

export function vectorLiteral(vector) {
  if (!Array.isArray(vector) || vector.length !== EMBEDDING_DIMENSIONS ||
      !vector.every(Number.isFinite) || !vector.some((value) => value !== 0)) {
    throw new Error("Expected a nonzero, finite 384-dimensional embedding.")
  }
  return `[${vector.join(",")}]`
}

async function ensureModelFiles(allowDownload) {
  for (const file of modelFiles) {
    const path = join(modelPath, file)
    try { await access(path); continue } catch { /* Missing cached file. */ }
    if (!allowDownload) throw new Error("Missing local model file.")
    await mkdir(dirname(path), { recursive: true })
    const response = await fetch(`https://huggingface.co/${EMBEDDING_MODEL}/resolve/${EMBEDDING_REVISION}/${file}`)
    if (!response.ok || !response.body) throw new Error(`Model download failed (${response.status}).`)
    const temporary = `${path}.${process.pid}.download`
    try {
      await pipeline(Readable.fromWeb(response.body), createWriteStream(temporary, { flags: "wx" }))
      await rename(temporary, path)
    } finally {
      await rm(temporary, { force: true })
    }
  }
}

// Portable WASM runs on CPU, including macOS 13 where current native ONNX
// binaries cannot load. Runtime can only open files; setup may download weights.
export function createLocalEmbedder({ allowDownload = false } = {}) {
  let loading
  let sequence = Promise.resolve()

  async function load() {
    if (!loading) {
      loading = (async () => {
        await ensureModelFiles(allowDownload)
        const [{ Tokenizer }, ort] = await Promise.all([
          import("@huggingface/tokenizers"), import("onnxruntime-web"),
        ])
        // Load WASM from the installed package, never from a CDN.
        ort.env.wasm.numThreads = 1
        ort.env.wasm.wasmPaths = {
          wasm: require.resolve("onnxruntime-web/ort-wasm-simd-threaded.wasm"),
          mjs: pathToFileURL(require.resolve("onnxruntime-web/ort-wasm-simd-threaded.mjs")).href,
        }
        ort.env.wasm.wasmBinary = await readFile(ort.env.wasm.wasmPaths.wasm)
        const [tokenizerJson, tokenizerConfig, weights] = await Promise.all([
          readFile(join(modelPath, "tokenizer.json"), "utf8"),
          readFile(join(modelPath, "tokenizer_config.json"), "utf8"),
          readFile(join(modelPath, "onnx/model_quantized.onnx")),
        ])
        const tokenizer = new Tokenizer(JSON.parse(tokenizerJson), JSON.parse(tokenizerConfig))
        const session = await ort.InferenceSession.create(weights, { executionProviders: ["wasm"] })
        return { tokenizer, session, ort }
      })().catch((error) => {
        loading = null
        throw new Error("Local embedding model is unavailable. Run npm run setup:local, then retry.", { cause: error })
      })
    }
    return loading
  }

  function embed(text, kind = "query") {
    const run = sequence.then(async () => {
      await yieldToEventLoop()
      const { tokenizer, session, ort } = await load()
      const encoded = Array.isArray(text) ? text
        : tokenizer.encode(`${kind === "query" ? "query" : "passage"}: ${text}`, { add_special_tokens: true }).ids
      // Passage windows are already complete model inputs. Never clip them or
      // decode/re-tokenize them, which can change the reserved token budget.
      if (kind === "passage" && encoded.length > 512) {
        throw new Error("An embedding passage exceeds the 512-token input budget.")
      }
      if (!encoded.length || !encoded.every((id) => Number.isInteger(id) && id >= 0)) {
        throw new Error("An embedding input must contain valid token IDs.")
      }
      const ids = encoded.length > 512 ? [...encoded.slice(0, 511), encoded.at(-1)] : encoded
      const shape = [1, ids.length]
      const feeds = {
        input_ids: new ort.Tensor("int64", BigInt64Array.from(ids.map(BigInt)), shape),
        attention_mask: new ort.Tensor("int64", BigInt64Array.from(ids.map(() => 1n)), shape),
      }
      if (session.inputNames.includes("token_type_ids")) {
        feeds.token_type_ids = new ort.Tensor("int64", BigInt64Array.from(ids.map(() => 0n)), shape)
      }
      const outputs = await session.run(feeds)
      const hidden = outputs.last_hidden_state
      const vector = Array(EMBEDDING_DIMENSIONS).fill(0)
      for (let token = 0; token < ids.length; token++) {
        for (let dimension = 0; dimension < vector.length; dimension++) {
          vector[dimension] += hidden.data[token * vector.length + dimension] / ids.length
        }
      }
      const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0))
      for (let index = 0; index < vector.length; index++) vector[index] /= norm
      vectorLiteral(vector)
      return vector
    })
    sequence = run.catch(() => {})
    return run
  }

  async function dispose() {
    await sequence
    if (loading) await (await loading).session.release()
    loading = null
  }

  async function passages(decision) {
    const { tokenizer } = await load()
    return decisionPassages(decision, tokenizer)
  }

  return { model: EMBEDDING_KEY, prepare: load, passages, embed, dispose }
}

// Cover complete token sequences, reserving the prefix, title context and final
// separator inside the model's 512-token budget. Long titles get their own
// windows in full; only their repeated context header is limited to 96 tokens.
export function decisionPassages(decision, tokenizer) {
  const title = String(decision.title ?? "")
  const content = [
    decision.outcome !== title ? decision.outcome : null,
    decision.why, decision.context,
    ...(decision.appliesTo ?? []), ...(decision.optionsConsidered ?? []),
    decision.owner?.displayName ?? decision.ownerName,
    ...(decision.tags ?? []),
    ...(decision.sources ?? []).flatMap((source) => [
      source.channelName, source.anchorText,
      ...(source.messages ?? []).map((message) => `${message.author}: ${message.text}`),
    ]),
  ].filter(Boolean).join("\n")
  // SentencePiece supplies the next word's leading whitespace. Encoding a
  // trailing space here would add an extra token absent from normal E5 inputs.
  const framing = tokenizer.encode("passage:", { add_special_tokens: true }).ids
  const prefix = framing.slice(0, -1)
  const separator = framing.at(-1)
  const budget = 512 - prefix.length - 1
  const titleTokens = tokenizer.encode(title, { add_special_tokens: false }).ids
  const contentTokens = tokenizer.encode(content, { add_special_tokens: false }).ids
  const passages = []
  function appendWindows(tokens, header = []) {
    // Keep passages focused on a small stretch of evidence rather than pooling
    // an entire long discussion into one vector. The remaining framing still
    // fits inside 512 even for a dense title.
    const capacity = Math.min(256, budget - header.length)
    const overlap = Math.min(64, Math.floor(capacity / 4))
    for (let start = 0; start < tokens.length; start += capacity - overlap) {
      passages.push([...prefix, ...header, ...tokens.slice(start, start + capacity), separator])
      if (start + capacity >= tokens.length) break
    }
  }
  appendWindows(titleTokens)
  appendWindows(contentTokens, titleTokens.slice(0, Math.min(96, budget - 1)))
  if (!passages.length) passages.push([...prefix, separator])
  return passages
}
