import { config as loadEnv } from "dotenv"
import { fileURLToPath } from "node:url"

loadEnv({ path: fileURLToPath(new URL("../../../.env", import.meta.url)) })

// Local demo settings are fixed in code. Only integration credentials belong
// in .env; deployment overrides are supplied by the deployment environment.
const nodeEnv = process.env.NODE_ENV ?? "development"
export const config = Object.freeze({
  nodeEnv,
  port: 3011,
  slackPort: 3012,
  webOrigin: "http://localhost:5173",
  appBaseUrl: "http://localhost:5173",
  databaseUrl: process.env.DATABASE_URL || (nodeEnv === "development"
    ? "postgresql://decision_memory:decision_memory@localhost:5434/decision_memory" : undefined),
  forgeAppId: process.env.FORGE_APP_ID,
  localDemoMode: nodeEnv === "development",
  localWorkspaceId: "demo-workspace",
  localCloudId: "demo-cloud",
  localUserId: "demo-user",
  localUserName: "Kiet Le",
  slackBotToken: process.env.SLACK_BOT_TOKEN,
  slackSigningSecret: process.env.SLACK_SIGNING_SECRET,
  slackTeamId: process.env.SLACK_TEAM_ID,
  geminiApiKey: process.env.GEMINI_API_KEY,
  // Optional: create Jira issues from Decisions (Jira Cloud site, account email, API token).
  jiraBaseUrl: process.env.JIRA_BASE_URL,
  jiraEmail: process.env.JIRA_EMAIL,
  jiraApiToken: process.env.JIRA_API_TOKEN,
  geminiModel: "gemini-3.5-flash-lite",
})
