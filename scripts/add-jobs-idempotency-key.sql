-- Adds an idempotency key to the jobs table so repeated submissions of the
-- same Post-a-Job attempt (double-click, hung request retry, refresh during
-- a slow insert) collapse to a single row.
--
-- The column is nullable and the unique index is partial, so existing rows
-- with NULL keys do not conflict and legacy insert paths that don't supply
-- a key continue to work.

ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS idempotency_key UUID;

CREATE UNIQUE INDEX IF NOT EXISTS jobs_idempotency_key_unique
  ON jobs (idempotency_key)
  WHERE idempotency_key IS NOT NULL;
