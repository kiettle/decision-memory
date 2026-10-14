CREATE EXTENSION IF NOT EXISTS vector;

CREATE UNIQUE INDEX IF NOT EXISTS decisions_workspace_id_idx ON decisions (workspace_id, id);

CREATE TABLE IF NOT EXISTS decision_search_jobs (
  decision_id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL,
  revision uuid NOT NULL DEFAULT gen_random_uuid(),
  queued_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (workspace_id, decision_id) REFERENCES decisions(workspace_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS decision_embeddings (
  decision_id uuid NOT NULL,
  workspace_id uuid NOT NULL,
  chunk_index integer NOT NULL CHECK (chunk_index >= 0),
  model text NOT NULL,
  revision uuid NOT NULL,
  embedding vector(384) NOT NULL,
  PRIMARY KEY (decision_id, chunk_index),
  FOREIGN KEY (workspace_id, decision_id) REFERENCES decisions(workspace_id, id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS decision_embeddings_workspace_model_idx
  ON decision_embeddings (workspace_id, model, decision_id);
CREATE INDEX IF NOT EXISTS decision_embeddings_cosine_idx
  ON decision_embeddings USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS decision_search_jobs_queued_idx ON decision_search_jobs (queued_at, decision_id);

CREATE OR REPLACE FUNCTION enqueue_decision_search(target uuid) RETURNS void AS $$
  INSERT INTO decision_search_jobs (decision_id, workspace_id)
    SELECT id, workspace_id FROM decisions WHERE id = target
  ON CONFLICT (decision_id) DO UPDATE SET revision = gen_random_uuid(), queued_at = now();
$$ LANGUAGE sql;

CREATE OR REPLACE FUNCTION mark_decision_search_dirty() RETURNS trigger AS $$
BEGIN
  IF TG_OP <> 'INSERT' THEN
    IF TG_TABLE_NAME = 'decisions' THEN
      PERFORM enqueue_decision_search(OLD.id);
    ELSE
      PERFORM enqueue_decision_search(OLD.decision_id);
    END IF;
  END IF;
  IF TG_OP <> 'DELETE' THEN
    IF TG_TABLE_NAME = 'decisions' THEN
      PERFORM enqueue_decision_search(NEW.id);
    ELSE
      PERFORM enqueue_decision_search(NEW.decision_id);
    END IF;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS decisions_search_dirty ON decisions;
CREATE TRIGGER decisions_search_dirty AFTER INSERT OR UPDATE OF
  title, why, context, applies_to, options_considered, owner_id, owner_name
  ON decisions FOR EACH ROW EXECUTE FUNCTION mark_decision_search_dirty();
DROP TRIGGER IF EXISTS sources_search_dirty ON source_snapshots;
CREATE TRIGGER sources_search_dirty AFTER INSERT OR UPDATE OR DELETE
  ON source_snapshots FOR EACH ROW EXECUTE FUNCTION mark_decision_search_dirty();
DROP TRIGGER IF EXISTS tags_search_dirty ON decision_tags;
CREATE TRIGGER tags_search_dirty AFTER INSERT OR UPDATE OR DELETE
  ON decision_tags FOR EACH ROW EXECUTE FUNCTION mark_decision_search_dirty();

CREATE OR REPLACE FUNCTION mark_search_metadata_dirty() RETURNS trigger AS $$
DECLARE target uuid;
BEGIN
  IF TG_TABLE_NAME = 'users' THEN
    FOR target IN SELECT id FROM decisions WHERE owner_id = NEW.id LOOP
      PERFORM enqueue_decision_search(target);
    END LOOP;
  ELSE
    FOR target IN SELECT decision_id FROM decision_tags WHERE tag_id = NEW.id LOOP
      PERFORM enqueue_decision_search(target);
    END LOOP;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS owner_search_dirty ON users;
CREATE TRIGGER owner_search_dirty AFTER UPDATE OF display_name ON users
  FOR EACH ROW EXECUTE FUNCTION mark_search_metadata_dirty();
DROP TRIGGER IF EXISTS tag_name_search_dirty ON tags;
CREATE TRIGGER tag_name_search_dirty AFTER UPDATE OF name ON tags
  FOR EACH ROW EXECUTE FUNCTION mark_search_metadata_dirty();
