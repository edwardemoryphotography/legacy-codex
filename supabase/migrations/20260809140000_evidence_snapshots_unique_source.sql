-- The evidence-bridge GitHub Action re-runs on a schedule and must upsert
-- the same PR's record on every run rather than inserting a duplicate row
-- each time. `source` (e.g. "github:owner/repo#123") is the natural key —
-- one row per PR, updated in place as its merge/check state changes.
alter table evidence_snapshots
  add constraint evidence_snapshots_source_key unique (source);
