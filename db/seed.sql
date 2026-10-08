INSERT INTO workspaces (id, external_key, cloud_id, name)
VALUES (
  '11111111-1111-4111-8111-111111111111',
  'demo-workspace',
  'demo-cloud',
  'Acme Engineering'
)
ON CONFLICT (external_key) DO UPDATE SET name = EXCLUDED.name;

INSERT INTO users (id, workspace_id, external_id, display_name)
VALUES
  ('22222222-2222-4222-8222-222222222221', '11111111-1111-4111-8111-111111111111', 'demo-user', 'Kiet Le'),
  ('22222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111', 'maya-chen', 'Maya Chen'),
  ('22222222-2222-4222-8222-222222222223', '11111111-1111-4111-8111-111111111111', 'alex-rivera', 'Alex Rivera')
ON CONFLICT (workspace_id, external_id) DO UPDATE SET display_name = EXCLUDED.display_name;

INSERT INTO decisions (
  id, workspace_id, decision_key, title, why, context, applies_to,
  options_considered, team, owner_id, owner_name, status, created_by_id, created_at
)
VALUES
  (
    '33333333-3333-4333-8333-333333333301',
    '11111111-1111-4111-8111-111111111111',
    'DM-104',
    'Use object storage for migration backup files',
    'Object storage gives the migration team durable retention, simple lifecycle controls, and safer rollback without adding database load.',
    'The Atlas migration creates large export artifacts that need to remain available throughout rehearsals and the production cutover.',
    '["Atlas migration", "Backup pipeline"]'::jsonb,
    '["PostgreSQL large objects", "Shared NFS volume"]'::jsonb,
    'Platform',
    '22222222-2222-4222-8222-222222222222',
    NULL,
    'ACTIVE',
    '22222222-2222-4222-8222-222222222221',
    '2026-10-04T09:30:00Z'
  ),
  (
    '33333333-3333-4333-8333-333333333302',
    '11111111-1111-4111-8111-111111111111',
    'DM-103',
    'Keep billing orchestration in the existing service',
    'The current service already owns retries, reconciliation, and operational alerts. Moving now would add risk without improving the customer path.',
    'The payments group evaluated extracting billing orchestration during the Q4 reliability work.',
    '["Billing service", "Checkout"]'::jsonb,
    '["Extract a billing workflow service", "Move orchestration to the API gateway"]'::jsonb,
    'Payments',
    '22222222-2222-4222-8222-222222222223',
    NULL,
    'ACTIVE',
    '22222222-2222-4222-8222-222222222221',
    '2026-10-02T14:00:00Z'
  ),
  (
    '33333333-3333-4333-8333-333333333303',
    '11111111-1111-4111-8111-111111111111',
    'DM-102',
    'Store migration exports on the database host',
    'This was the fastest option for the first rehearsal, before storage retention and rollback requirements were clarified.',
    'An early Atlas rehearsal needed a temporary export location.',
    '["Atlas migration"]'::jsonb,
    '[]'::jsonb,
    'Platform',
    '22222222-2222-4222-8222-222222222222',
    NULL,
    'SUPERSEDED',
    '22222222-2222-4222-8222-222222222221',
    '2026-09-24T11:15:00Z'
  ),
  (
    '33333333-3333-4333-8333-333333333304',
    '11111111-1111-4111-8111-111111111111',
    'DM-105',
    'Use signed URLs for generated reporting exports',
    'Short-lived signed URLs keep large reports out of API responses while preserving access control.',
    'Analytics exports may exceed gateway response limits and are downloaded after background generation.',
    '["Reporting", "Export API"]'::jsonb,
    '["Stream files through the API", "Public object URLs"]'::jsonb,
    'Data',
    '22222222-2222-4222-8222-222222222222',
    NULL,
    'ACTIVE',
    '22222222-2222-4222-8222-222222222221',
    '2026-10-05T08:00:00Z'
  ),
  (
    '33333333-3333-4333-8333-333333333305',
    '11111111-1111-4111-8111-111111111111',
    'DM-106',
    'Retry payment webhooks with exponential backoff',
    'Backoff reduces pressure on recovering partners while bounded retries preserve eventual delivery.',
    'Checkout providers occasionally return transient errors or time out during incident recovery.',
    '["Billing service", "Webhook delivery"]'::jsonb,
    '["Immediate retries", "Manual replay only"]'::jsonb,
    'Payments',
    '22222222-2222-4222-8222-222222222223',
    NULL,
    'ACTIVE',
    '22222222-2222-4222-8222-222222222221',
    '2026-10-01T10:00:00Z'
  ),
  (
    '33333333-3333-4333-8333-333333333306',
    '11111111-1111-4111-8111-111111111111',
    'DM-107',
    'Process video transcoding asynchronously',
    'Queue-backed workers prevent long media jobs from consuming request capacity and allow safe retries.',
    'Customer uploads vary widely in size and synchronous transcoding caused gateway timeouts.',
    '["Media pipeline", "Customer uploads"]'::jsonb,
    '["Transcode in the upload request", "Require pre-encoded files"]'::jsonb,
    'Platform',
    '22222222-2222-4222-8222-222222222222',
    NULL,
    'ACTIVE',
    '22222222-2222-4222-8222-222222222221',
    '2026-09-30T12:00:00Z'
  ),
  (
    '33333333-3333-4333-8333-333333333307',
    '11111111-1111-4111-8111-111111111111',
    'DM-108',
    'Archive audit logs to cold storage after 90 days',
    'A tiered policy keeps recent investigations fast and lowers the cost of multi-year compliance retention.',
    'Security needs seven years of audit history but most operational queries cover the latest quarter.',
    '["Audit platform", "Compliance exports"]'::jsonb,
    '["Keep all logs in the hot cluster", "Delete after one year"]'::jsonb,
    'Security',
    '22222222-2222-4222-8222-222222222223',
    NULL,
    'ACTIVE',
    '22222222-2222-4222-8222-222222222221',
    '2026-09-29T16:00:00Z'
  ),
  (
    '33333333-3333-4333-8333-333333333308',
    '11111111-1111-4111-8111-111111111111',
    'DM-109',
    'Set the public API request budget to ten seconds',
    'A shared deadline prevents cascading resource exhaustion and gives clients predictable retry behavior.',
    'Several endpoints inherited inconsistent upstream timeouts after the gateway migration.',
    '["Public API", "API gateway"]'::jsonb,
    '["Per-endpoint unlimited timeouts", "Thirty-second global timeout"]'::jsonb,
    'Platform',
    '22222222-2222-4222-8222-222222222222',
    NULL,
    'ACTIVE',
    '22222222-2222-4222-8222-222222222221',
    '2026-09-28T09:00:00Z'
  ),
  (
    '33333333-3333-4333-8333-333333333309',
    '11111111-1111-4111-8111-111111111111',
    'DM-110',
    'Keep customer uploads out of PostgreSQL',
    'Object storage scales independently and avoids inflating database backups with binary payloads.',
    'The support portal is adding screenshots and diagnostic bundles to customer cases.',
    '["Support portal", "Customer uploads"]'::jsonb,
    '["PostgreSQL bytea", "Shared application disk"]'::jsonb,
    'Customer Experience',
    '22222222-2222-4222-8222-222222222223',
    NULL,
    'ACTIVE',
    '22222222-2222-4222-8222-222222222221',
    '2026-09-27T13:00:00Z'
  )
ON CONFLICT (workspace_id, decision_key) DO NOTHING;

INSERT INTO tags (id, workspace_id, name)
VALUES
  ('44444444-4444-4444-8444-444444444401', '11111111-1111-4111-8111-111111111111', 'migration'),
  ('44444444-4444-4444-8444-444444444402', '11111111-1111-4111-8111-111111111111', 'storage'),
  ('44444444-4444-4444-8444-444444444403', '11111111-1111-4111-8111-111111111111', 'payments'),
  ('44444444-4444-4444-8444-444444444404', '11111111-1111-4111-8111-111111111111', 'reliability'),
  ('44444444-4444-4444-8444-444444444405', '11111111-1111-4111-8111-111111111111', 'async'),
  ('44444444-4444-4444-8444-444444444406', '11111111-1111-4111-8111-111111111111', 'retention'),
  ('44444444-4444-4444-8444-444444444407', '11111111-1111-4111-8111-111111111111', 'api')
ON CONFLICT (workspace_id, name) DO NOTHING;

INSERT INTO decision_tags (decision_id, tag_id)
VALUES
  ('33333333-3333-4333-8333-333333333301', '44444444-4444-4444-8444-444444444401'),
  ('33333333-3333-4333-8333-333333333301', '44444444-4444-4444-8444-444444444402'),
  ('33333333-3333-4333-8333-333333333302', '44444444-4444-4444-8444-444444444403'),
  ('33333333-3333-4333-8333-333333333303', '44444444-4444-4444-8444-444444444401'),
  ('33333333-3333-4333-8333-333333333304', '44444444-4444-4444-8444-444444444402'),
  ('33333333-3333-4333-8333-333333333305', '44444444-4444-4444-8444-444444444403'),
  ('33333333-3333-4333-8333-333333333305', '44444444-4444-4444-8444-444444444404'),
  ('33333333-3333-4333-8333-333333333306', '44444444-4444-4444-8444-444444444405'),
  ('33333333-3333-4333-8333-333333333307', '44444444-4444-4444-8444-444444444406'),
  ('33333333-3333-4333-8333-333333333308', '44444444-4444-4444-8444-444444444407'),
  ('33333333-3333-4333-8333-333333333309', '44444444-4444-4444-8444-444444444402')
ON CONFLICT DO NOTHING;

INSERT INTO source_snapshots (
  id, workspace_id, decision_id, provider, external_channel_id,
  external_thread_id, anchor_external_id, anchor_text, permalink, captured_at, messages,
  source_context, channel_name
)
VALUES (
  '55555555-5555-4555-8555-555555555501',
  '11111111-1111-4111-8111-111111111111',
  '33333333-3333-4333-8333-333333333301',
  'SLACK',
  'C-DEMO-PLATFORM',
  '1728032400.000100',
  '1728032400.000100',
  'We should keep migration backups in object storage so rollback does not depend on the database host.',
  'https://example.slack.com/archives/C-DEMO-PLATFORM/p1728032400000100',
  '2026-10-04T09:30:00Z',
  '[
    {"author":"Kiet Le","timestamp":"2026-10-04T09:02:00Z","text":"The rehearsal export is already larger than the database host free space.","anchor":false},
    {"author":"Alex Rivera","timestamp":"2026-10-04T09:06:00Z","text":"Keeping it beside PostgreSQL also makes database backup and restore much slower.","anchor":false},
    {"author":"Maya Chen","timestamp":"2026-10-04T09:12:00Z","text":"We should keep migration backups in object storage so rollback does not depend on the database host.","anchor":true},
    {"author":"Alex Rivera","timestamp":"2026-10-04T09:18:00Z","text":"Agreed. Lifecycle retention also covers the rehearsal window without manual cleanup.","anchor":false},
    {"author":"Kiet Le","timestamp":"2026-10-04T09:20:00Z","text":"Can the cutover workers use short-lived credentials instead of a shared key?","anchor":false},
    {"author":"Maya Chen","timestamp":"2026-10-04T09:24:00Z","text":"Yes. We will use workload identity and keep the bucket private.","anchor":false},
    {"author":"Alex Rivera","timestamp":"2026-10-04T09:27:00Z","text":"I will add the rollback and cleanup steps to ATLAS-248.","anchor":false}
  ]'::jsonb,
  '{"entryPoint":"shortcut","invokingUserId":"demo-user","teamId":"T-DEMO","totalMessageCount":7,"capturedMessageCount":7,"captureTruncated":false}'::jsonb,
  'platform-decisions'
)
ON CONFLICT (id) DO UPDATE SET
  anchor_text = EXCLUDED.anchor_text,
  messages = EXCLUDED.messages,
  source_context = EXCLUDED.source_context,
  channel_name = EXCLUDED.channel_name;

INSERT INTO external_references (
  id, workspace_id, decision_id, kind, label, url
)
VALUES
  ('66666666-6666-4666-8666-666666666601', '11111111-1111-4111-8111-111111111111', '33333333-3333-4333-8333-333333333301', 'JIRA', 'ATLAS-248 · Migration backup plan', 'https://example.atlassian.net/browse/ATLAS-248'),
  ('66666666-6666-4666-8666-666666666602', '11111111-1111-4111-8111-111111111111', '33333333-3333-4333-8333-333333333301', 'URL', 'Atlas migration runbook', 'https://example.com/atlas-runbook')
ON CONFLICT (id) DO UPDATE SET kind = EXCLUDED.kind;

INSERT INTO decision_relations (
  id, workspace_id, from_decision_id, to_decision_id, relation_type
)
VALUES (
  '77777777-7777-4777-8777-777777777701',
  '11111111-1111-4111-8111-111111111111',
  '33333333-3333-4333-8333-333333333301',
  '33333333-3333-4333-8333-333333333303',
  'SUPERSEDES'
)
ON CONFLICT DO NOTHING;
