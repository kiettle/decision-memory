-- Integration configuration is global today. Additional scope identifiers can
-- be introduced later without changing the settings value representation.
CREATE TABLE IF NOT EXISTS configuration_scopes (
  id text PRIMARY KEY,
  revision integer NOT NULL DEFAULT 0 CHECK (revision >= 0),
  initialized_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS configuration_values (
  scope_id text NOT NULL REFERENCES configuration_scopes(id) ON DELETE CASCADE,
  key text NOT NULL,
  value text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (scope_id, key)
);
