-- Enforces "one proposal per freelancer per job" at the DB level. This makes
-- proposal submission naturally idempotent: a retry (double-click, hung
-- request, network retry) lands on the same row and is rejected with a
-- unique_violation (Postgres 23505), which the server action treats as a
-- meaningful "already submitted" response instead of a duplicate row.
--
-- Cleans up existing duplicates before creating the constraint — without
-- this step the migration would fail on any historical duplicates.

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY job_id, freelancer_id
      ORDER BY created_at ASC NULLS LAST, id ASC
    ) AS rn
  FROM proposals
)
DELETE FROM proposals
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

ALTER TABLE proposals
  ADD CONSTRAINT proposals_job_freelancer_unique
  UNIQUE (job_id, freelancer_id);
