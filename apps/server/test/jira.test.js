import assert from "node:assert/strict"
import { once } from "node:events"
import { describe, it } from "node:test"

import { createApp } from "../src/app.js"
import { DomainError } from "../src/domain.js"
import { createJiraClient, issueDescription, createLinkedJiraIssue } from "../src/jira.js"

const config = {
  jiraBaseUrl: "https://acme.atlassian.net/",
  jiraEmail: "kiet@example.com",
  jiraApiToken: "secret-token",
  appBaseUrl: "http://localhost:5173",
}
const decision = {
  id: "11111111-1111-4111-8111-111111111111",
  decisionKey: "DM-111",
  title: "Use PostgreSQL for the Migration Service database",
  why: "The team is already familiar with PostgreSQL.",
  context: "",
  appliesTo: ["Migration Service"],
}

function jiraReturning(handler) {
  const calls = []
  const client = createJiraClient({
    config,
    fetchImpl: async (url, init) => {
      calls.push({ url, init, body: init.body ? JSON.parse(init.body) : null })
      const { status = 200, body = {} } = await handler(url, init)
      return { ok: status < 400, status, json: async () => body }
    },
  })
  return { client, calls }
}

describe("Jira client", () => {
  it("lists projects and only top-level issue types", async () => {
    const { client, calls } = jiraReturning((url) =>
      url.includes("/project/search")
        ? { body: { values: [{ key: "MIG", name: "Migration", id: "1" }] } }
        : { body: { issueTypes: [{ id: 10001, name: "Task", subtask: false }, { id: 10002, name: "Sub-task", subtask: true }] } },
    )
    assert.deepEqual(await client.projects(), [{ key: "MIG", name: "Migration" }])
    assert.deepEqual(await client.issueTypes("MIG"), [{ id: "10001", name: "Task" }])
    assert.equal(calls[0].url, "https://acme.atlassian.net/rest/api/3/project/search?maxResults=100&orderBy=name")
    assert.equal(calls[0].init.headers.authorization, `Basic ${Buffer.from("kiet@example.com:secret-token").toString("base64")}`)
    await assert.rejects(client.issueTypes("../../admin"), (error) => error.code === "JIRA_PROJECT_INVALID")
  })

  it("creates an issue with a one-line summary and a description linking back", async () => {
    const { client, calls } = jiraReturning(() => ({ status: 201, body: { id: "1", key: "MIG-183" } }))
    const issue = await client.createIssue({ projectKey: "MIG", issueTypeId: "10001", summary: "Use PostgreSQL\nfor  migration", decision })
    assert.deepEqual(issue, { key: "MIG-183", url: "https://acme.atlassian.net/browse/MIG-183" })
    const { fields } = calls[0].body
    assert.deepEqual(fields.project, { key: "MIG" })
    assert.deepEqual(fields.issuetype, { id: "10001" })
    assert.equal(fields.summary, "Use PostgreSQL for migration")
    assert.deepEqual(fields.description, issueDescription(decision, `http://localhost:5173/#/decisions/${decision.id}`))
    const text = JSON.stringify(fields.description)
    assert.match(text, /The team is already familiar with PostgreSQL/)
    assert.match(text, /"href":"http:\/\/localhost:5173\/#\/decisions\/11111111/)
    assert.doesNotMatch(text, /Context/, "Empty fields are left out")
  })

  it("explains Jira errors without leaking the token, and handles outages and missing setup", async () => {
    const rejected = jiraReturning(() => ({ status: 400, body: { errorMessages: [], errors: { summary: "Field is required." } } })).client
    await assert.rejects(
      rejected.createIssue({ projectKey: "MIG", issueTypeId: "1", summary: "x", decision }),
      (error) => error instanceof DomainError && error.code === "JIRA_REJECTED" && /Field is required/.test(error.message) && !/secret-token/.test(error.message),
    )
    const offline = createJiraClient({ config, fetchImpl: async () => { throw new Error("ENOTFOUND") } })
    await assert.rejects(offline.projects(), (error) => error.code === "JIRA_UNAVAILABLE")
    const missing = createJiraClient({ config: { appBaseUrl: "x" } })
    assert.equal(missing.enabled, false)
    await assert.rejects(missing.projects(), (error) => error.status === 503 && error.code === "JIRA_NOT_CONFIGURED")
  })
})

describe("Create Jira issue API", () => {
  async function server(t, { repository, jira }) {
    const app = createApp({
      config: { nodeEnv: "development", localDemoMode: true, localWorkspaceId: "fixture" },
      repository,
      jira,
      memorySearch: { enabled: false },
    })
    const listener = app.listen(0, "127.0.0.1")
    await once(listener, "listening")
    t.after(() => new Promise((resolve) => { listener.close(resolve); listener.closeAllConnections() }))
    return `http://127.0.0.1:${listener.address().port}/api`
  }
  const post = (url, body) => fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ requestId: "22222222-2222-4222-8222-222222222222", ...body }) })

  it("creates the issue and saves its key as related work", async (t) => {
    const added = []
    const created = []
    const base = await server(t, {
      repository: {
        getDecision: async () => decision,
        claimJiraIssueRequest: async () => ({ claimed: true }),
        updateJiraIssueRequest: async () => {},
        linkJiraIssueRequest: async () => {
          const reference = { kind: "JIRA", label: "MIG-183", url: "https://acme.atlassian.net/browse/MIG-183" }
          added.push([decision.id, reference])
          return { issue: { key: reference.label, url: reference.url }, decision: { ...decision, references: [reference] } }
        },
      },
      jira: { enabled: true, createIssue: async (input) => { created.push(input); return { key: "MIG-183", url: "https://acme.atlassian.net/browse/MIG-183" } } },
    })
    const response = await post(`${base}/decisions/${decision.id}/jira-issue`, { projectKey: "MIG", issueTypeId: "10001", summary: decision.title })
    assert.equal(response.status, 201)
    const body = await response.json()
    assert.equal(body.issue.key, "MIG-183")
    assert.deepEqual(created, [{ projectKey: "MIG", issueTypeId: "10001", summary: decision.title, decision }])
    assert.deepEqual(added, [[decision.id, { kind: "JIRA", label: "MIG-183", url: "https://acme.atlassian.net/browse/MIG-183" }]])
  })

  it("rejects bad input and unknown Decisions before calling Jira", async (t) => {
    const base = await server(t, {
      repository: { getDecision: async () => null },
      jira: { enabled: true, createIssue: async () => assert.fail("Jira must not be called") },
    })
    assert.equal((await post(`${base}/decisions/${decision.id}/jira-issue`, { projectKey: "mig; drop", issueTypeId: "1", summary: "x" })).status, 400)
    assert.equal((await post(`${base}/decisions/${decision.id}/jira-issue`, { projectKey: "MIG", issueTypeId: "1", summary: "   " })).status, 400)
    assert.equal((await post(`${base}/decisions/${decision.id}/jira-issue`, { projectKey: "MIG", issueTypeId: "1", summary: "x" })).status, 404)
  })

  it("reports Jira as a feature only when it is configured", async (t) => {
    const base = await server(t, {
      repository: { metadata: async () => ({ users: [] }) },
      jira: { enabled: false },
    })
    assert.equal((await (await fetch(`${base}/metadata`)).json()).features.jira, false)
  })
})


describe("Jira retry recovery (owner-approved review fix)", () => {
  function fixture() {
    let record
    let creates = 0
    let failLink = true
    const repository = {
      claimJiraIssueRequest: async () => {
        if (record) return { ...record, claimed: false }
        record = { status: "PENDING" }
        return { ...record, claimed: true }
      },
      updateJiraIssueRequest: async (_identity, _id, update) => { Object.assign(record, update) },
      linkJiraIssueRequest: async () => {
        if (failLink) throw new Error("database unavailable")
        record.status = "LINKED"
        return { issue: record.issue, decision }
      },
    }
    return { repository, jira: { createIssue: async () => { creates++; return { key: "MIG-183", url: "https://acme.atlassian.net/browse/MIG-183" } } },
      creates: () => creates, recover: () => { failLink = false } }
  }
  const input = { projectKey: "MIG", issueTypeId: "10001", summary: decision.title }
  it("preserves partial success and retries linking without another Jira create", async () => {
    const f = fixture()
    const args = { ...f, identity: {}, decision, requestId: "request", input }
    await assert.rejects(createLinkedJiraIssue(args), (error) => error.code === "JIRA_LINK_PENDING" && error.issue.key === "MIG-183")
    f.recover()
    assert.equal((await createLinkedJiraIssue(args)).issue.key, "MIG-183")
    assert.equal((await createLinkedJiraIssue(args)).issue.key, "MIG-183")
    assert.equal(f.creates(), 1, "A retried Jira operation must reuse its receipt, not create another issue")
  })
  it("never repeats creation after an uncertain external result or receipt-write failure", async () => {
    for (const failure of ["external", "receipt"]) {
      const f = fixture()
      if (failure === "external") f.jira.createIssue = async () => { throw new Error("network response lost") }
      else f.repository.updateJiraIssueRequest = async () => { throw new Error("receipt write failed") }
      const args = { ...f, identity: {}, decision, requestId: "request", input }
      await assert.rejects(createLinkedJiraIssue(args), (error) => error.code === (failure === "external" ? "JIRA_OUTCOME_UNKNOWN" : "JIRA_LINK_PENDING"))
      f.jira.createIssue = async () => assert.fail("Unknown Jira outcomes must be reconciled, never recreated")
      await assert.rejects(createLinkedJiraIssue(args), (error) => error.code === "JIRA_OUTCOME_UNKNOWN")
    }
  })
})
