import { createRemoteJWKSet, jwtVerify } from "jose"

const forgeJwks = createRemoteJWKSet(
  new URL("https://forge.cdn.prod.atlassian-dev.net/.well-known/jwks.json"),
)

function localIdentity(config) {
  return {
    workspaceExternalKey: config.localWorkspaceId,
    cloudId: config.localCloudId,
    userExternalId: config.localUserId,
    userDisplayName: config.localUserName,
    source: "local",
  }
}

export function createIdentityMiddleware(config) {
  return async function identityMiddleware(req, res, next) {
    try {
      if (config.nodeEnv === "development" && config.localDemoMode) {
        req.identity = localIdentity(config)
        next()
        return
      }

      const authorization = req.get("authorization") ?? ""
      const token = authorization.startsWith("Bearer ")
        ? authorization.slice("Bearer ".length)
        : ""
      if (!token || !config.forgeAppId) {
        res.status(401).json({ error: "A valid Forge invocation token is required." })
        return
      }

      const { payload } = await jwtVerify(token, forgeJwks, {
        audience: config.forgeAppId,
      })
      const installationId = payload.app?.installationId
      if (typeof installationId !== "string" || !installationId) {
        res.status(401).json({ error: "Forge installation context is missing." })
        return
      }

      req.identity = {
        workspaceExternalKey: installationId,
        cloudId:
          typeof payload.context?.cloudId === "string"
            ? payload.context.cloudId
            : null,
        userExternalId: typeof payload.sub === "string" ? payload.sub : "forge-user",
        userDisplayName: "Jira user",
        source: "forge",
      }
      next()
    } catch {
      res.status(401).json({ error: "Forge invocation token is invalid." })
    }
  }
}
