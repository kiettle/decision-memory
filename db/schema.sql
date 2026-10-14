CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_key text NOT NULL UNIQUE,
  cloud_id text,
  name text NOT NULL DEFAULT 'Decision Memory Demo',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  external_id text NOT NULL,
  display_name text NOT NULL,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, external_id)
);

CREATE TABLE IF NOT EXISTS decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  decision_key text NOT NULL,
  title text NOT NULL CHECK (length(btrim(title)) > 0),
  why text,
  context text,
  applies_to jsonb NOT NULL DEFAULT '[]'::jsonb,
  options_considered jsonb NOT NULL DEFAULT '[]'::jsonb,
  team text,
  owner_id uuid REFERENCES users(id) ON DELETE SET NULL,
  owner_name text,
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'SUPERSEDED')),
  created_by_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, decision_key)
);

CREATE TABLE IF NOT EXISTS tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, name)
);

CREATE TABLE IF NOT EXISTS decision_tags (
  decision_id uuid NOT NULL REFERENCES decisions(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (decision_id, tag_id)
);

CREATE TABLE IF NOT EXISTS source_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  decision_id uuid NOT NULL REFERENCES decisions(id) ON DELETE CASCADE,
  provider text NOT NULL,
  external_channel_id text,
  external_thread_id text,
  anchor_external_id text,
  anchor_text text,
  permalink text,
  captured_at timestamptz NOT NULL DEFAULT now(),
  messages jsonb NOT NULL DEFAULT '[]'::jsonb,
  source_context jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE decisions ADD COLUMN IF NOT EXISTS owner_name text;
-- A nullable state identifies legacy rows exactly once. Never re-backfill edits.
ALTER TABLE decisions ADD COLUMN IF NOT EXISTS decision_state text;
ALTER TABLE decisions ADD COLUMN IF NOT EXISTS due_date date;
ALTER TABLE decisions ADD COLUMN IF NOT EXISTS outcome text;
ALTER TABLE decisions ADD COLUMN IF NOT EXISTS decided_at timestamptz;
UPDATE decisions SET decision_state = 'DECIDED', outcome = title
  WHERE decision_state IS NULL;
ALTER TABLE decisions ALTER COLUMN decision_state SET DEFAULT 'DECIDED';
ALTER TABLE decisions ALTER COLUMN decision_state SET NOT NULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'decisions_state_check' AND conrelid = 'decisions'::regclass) THEN
    ALTER TABLE decisions ADD CONSTRAINT decisions_state_check CHECK (
      (decision_state = 'PENDING' AND status = 'ACTIVE' AND outcome IS NULL AND decided_at IS NULL)
      OR (decision_state = 'DECIDED' AND length(btrim(outcome)) > 0 AND outcome IS NOT NULL)
    );
  END IF;
END $$;
-- Direct legacy SQL inserts (including the seed) still record a final choice.
CREATE OR REPLACE FUNCTION default_decision_outcome() RETURNS trigger AS $$
BEGIN
  IF NEW.decision_state = 'DECIDED' AND NEW.outcome IS NULL THEN NEW.outcome := NEW.title; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS decisions_default_outcome ON decisions;
CREATE TRIGGER decisions_default_outcome BEFORE INSERT ON decisions
  FOR EACH ROW EXECUTE FUNCTION default_decision_outcome();
CREATE INDEX IF NOT EXISTS decisions_workspace_pending_due_idx
  ON decisions (workspace_id, due_date) WHERE decision_state = 'PENDING';
ALTER TABLE source_snapshots
  ADD COLUMN IF NOT EXISTS source_context jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE source_snapshots ADD COLUMN IF NOT EXISTS anchor_text text;
-- Where the discussion happened, e.g. "migration" for #migration.
ALTER TABLE source_snapshots ADD COLUMN IF NOT EXISTS channel_name text;
UPDATE source_snapshots
  SET channel_name = source_context->>'channelName'
  WHERE channel_name IS NULL AND source_context ? 'channelName';

CREATE TABLE IF NOT EXISTS external_references (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  decision_id uuid NOT NULL REFERENCES decisions(id) ON DELETE CASCADE,
  kind text NOT NULL,
  label text NOT NULL,
  url text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS decision_relations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  from_decision_id uuid NOT NULL REFERENCES decisions(id) ON DELETE CASCADE,
  to_decision_id uuid NOT NULL REFERENCES decisions(id) ON DELETE CASCADE,
  relation_type text NOT NULL CHECK (relation_type IN ('SUPERSEDES')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (from_decision_id <> to_decision_id),
  UNIQUE (workspace_id, from_decision_id, to_decision_id, relation_type)
);

-- Optional human-written explanation of why an earlier decision was replaced.
ALTER TABLE decision_relations ADD COLUMN IF NOT EXISTS replacement_reason text;

CREATE TABLE IF NOT EXISTS slack_interactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  external_event_id text NOT NULL,
  decision_id uuid NOT NULL REFERENCES decisions(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, external_event_id)
);

CREATE TABLE IF NOT EXISTS slack_capture_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  external_event_id text NOT NULL,
  slack_team_id text NOT NULL,
  slack_user_id text,
  source jsonb NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, external_event_id)
);

-- Slack nudges and shares: at most one of each kind per thread. No message
-- text is kept.
CREATE TABLE IF NOT EXISTS slack_nudges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  channel_id text NOT NULL,
  thread_ts text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('RECALL', 'CAPTURE', 'SHARE')),
  decision_id uuid REFERENCES decisions(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, channel_id, thread_ts, kind)
);

CREATE INDEX IF NOT EXISTS decisions_workspace_created_idx
  ON decisions (workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS decisions_workspace_status_idx
  ON decisions (workspace_id, status);
CREATE INDEX IF NOT EXISTS decisions_workspace_team_idx
  ON decisions (workspace_id, team);
CREATE INDEX IF NOT EXISTS decisions_workspace_owner_idx
  ON decisions (workspace_id, owner_id);
CREATE INDEX IF NOT EXISTS source_snapshots_decision_idx
  ON source_snapshots (workspace_id, decision_id);
CREATE INDEX IF NOT EXISTS external_references_decision_idx
  ON external_references (workspace_id, decision_id);
CREATE INDEX IF NOT EXISTS decision_tags_tag_idx
  ON decision_tags (tag_id, decision_id);
CREATE INDEX IF NOT EXISTS decision_relations_from_idx
  ON decision_relations (workspace_id, from_decision_id);
CREATE INDEX IF NOT EXISTS decision_relations_to_idx
  ON decision_relations (workspace_id, to_decision_id);
CREATE INDEX IF NOT EXISTS slack_capture_drafts_workspace_expiry_idx
  ON slack_capture_drafts (workspace_id, expires_at);

-- One durable receipt per browser creation attempt. An uncertain external
-- outcome stays pending so retry cannot issue another Jira create request.
CREATE TABLE IF NOT EXISTS jira_issue_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  decision_id uuid NOT NULL REFERENCES decisions(id) ON DELETE CASCADE,
  request_id uuid NOT NULL,
  input jsonb NOT NULL,
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'REJECTED', 'CREATED', 'LINKED')),
  issue jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, request_id)
);

-- Additive local semantic-search storage and invalidation triggers.
\ir local-search.sql
