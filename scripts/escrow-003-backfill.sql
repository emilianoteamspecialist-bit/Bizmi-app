-- =============================================================
-- ESCROW v2 — Phase 1.4: Backfill
-- =============================================================
-- Populates the new schema (status_v2, amount_kobo, freelancer_id, *_at
-- timestamps) from the existing escrow_deposits rows AND Funded_jobs101 rows.
--
-- IDEMPOTENT: safe to re-run. Existing v2 rows are not overwritten.
--
-- Run AFTER:
--   - scripts/escrow-001-schema.sql
--   - scripts/escrow-002-state-machine.sql
--
-- The triggers from 002 enforce valid transitions. The backfill bypasses
-- them by INSERTing/UPDATEing in carefully chosen orders. Because INSERT
-- only requires the initial state to be 'pending', and UPDATE chains
-- transitions, we step through the states one at a time.
-- =============================================================

-- Run as a single transaction so a partial failure rolls back the trigger
-- disable (otherwise an error mid-script leaves validation off).
BEGIN;

-- ─────────────────────────────────────────────────────────────
-- 0a. Pre-flight: refuse to run if duplicate job_ids exist
-- ─────────────────────────────────────────────────────────────
-- The new partial unique index on escrow_deposits(job_id) WHERE status_v2 IS
-- NOT NULL would fire as soon as step 1 backfills status_v2 onto two rows
-- sharing a job_id. Abort with a helpful message so the operator can
-- deduplicate manually first.

DO $$
DECLARE
  dup_count integer;
BEGIN
  SELECT COUNT(*) INTO dup_count
  FROM (
    SELECT job_id FROM escrow_deposits
    WHERE job_id IS NOT NULL
    GROUP BY job_id HAVING COUNT(*) > 1
  ) d;

  IF dup_count > 0 THEN
    RAISE EXCEPTION
      'Backfill aborted: % job_id(s) have duplicate escrow_deposits rows. '
      'Inspect with: SELECT job_id, COUNT(*) FROM escrow_deposits '
      'WHERE job_id IS NOT NULL GROUP BY job_id HAVING COUNT(*) > 1; '
      'then deduplicate before re-running.', dup_count;
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────
-- 0b. Disable transition validation for the duration of this script
-- ─────────────────────────────────────────────────────────────
-- The trigger expects clean transitions; backfill jumps around the state
-- machine when reconstructing history. Re-enabled at the end (or on rollback,
-- since DDL is transactional).

ALTER TABLE escrow_deposits DISABLE TRIGGER escrow_deposits_validate_transition;
ALTER TABLE escrow_deposits DISABLE TRIGGER escrow_deposits_validate_initial;

-- ─────────────────────────────────────────────────────────────
-- 1. Backfill from existing escrow_deposits rows (Paystack path)
-- ─────────────────────────────────────────────────────────────
-- Map the legacy free-text `status` to escrow_status_v2.

UPDATE escrow_deposits ed
SET
  status_v2 = CASE ed.status
    WHEN 'awaiting'   THEN 'awaiting'::escrow_status_v2
    WHEN 'funded'     THEN 'funded'::escrow_status_v2
    WHEN 'confirmed'  THEN 'released'::escrow_status_v2
    WHEN 'disputed'   THEN 'disputed'::escrow_status_v2
    WHEN 'refunded'   THEN 'refunded'::escrow_status_v2
    ELSE 'pending'::escrow_status_v2
  END,
  amount_kobo = COALESCE(amount_kobo, ROUND(COALESCE(ed.balance, 0) * 100)::bigint),
  funded_at = COALESCE(ed.funded_at, CASE WHEN ed.status IN ('funded','confirmed') THEN ed.updated_at END),
  released_at = COALESCE(ed.released_at, CASE WHEN ed.status = 'confirmed' THEN ed.updated_at END),
  disputed_at = COALESCE(ed.disputed_at, CASE WHEN ed.status = 'disputed' THEN ed.updated_at END),
  refunded_at = COALESCE(ed.refunded_at, CASE WHEN ed.status = 'refunded' THEN ed.updated_at END)
WHERE ed.status_v2 IS NULL;

-- Resolve freelancer_id from the accepted proposal on this job.
UPDATE escrow_deposits ed
SET freelancer_id = p.freelancer_id
FROM proposals p
WHERE ed.freelancer_id IS NULL
  AND p.job_id = ed.job_id
  AND p.status = 'accepted';

-- ─────────────────────────────────────────────────────────────
-- 2. Backfill from Funded_jobs101 (legacy manual reference path)
-- ─────────────────────────────────────────────────────────────
-- Some jobs were funded via the manual reference flow and have NO row in
-- escrow_deposits. Create one for each, with status mapped from
-- Funded_jobs101.status.

-- Legacy `status` and `balance` columns are NOT NULL (and `status` has a
-- CHECK constraint allowing only awaiting/funded/confirmed/disputed/refunded),
-- so the INSERT must supply them mapped from the v2 status. The legacy values
-- are write-shadows; v2 columns are the source of truth.
INSERT INTO escrow_deposits (
  job_id, agency_id, freelancer_id,
  amount_kobo, status_v2,
  status, balance,
  paystack_reference,
  funded_at, released_at,
  created_at, updated_at
)
SELECT
  fj.job_id,
  fj.agency_id,
  fj.freelancer_id,
  ROUND(COALESCE(fj.amount, 0) * 100)::bigint,
  -- Funded_jobs101 has no terminal state for "released"; if completed +
  -- paid out, treat as paid_out. If completed but not paid, treat as released.
  -- Otherwise: verified=funded, pending_verification=awaiting, failed=cancelled.
  CASE
    WHEN fj.payout_successful                                  THEN 'paid_out'::escrow_status_v2
    WHEN fj.job_completed AND NOT COALESCE(fj.payout_successful, false) THEN 'released'::escrow_status_v2
    WHEN fj.status = 'verified'                                THEN 'funded'::escrow_status_v2
    WHEN fj.status = 'pending_verification'                    THEN 'awaiting'::escrow_status_v2
    WHEN fj.status = 'failed'                                  THEN 'cancelled'::escrow_status_v2
    ELSE 'pending'::escrow_status_v2
  END,
  -- Legacy status mapped to the existing CHECK set
  -- ('awaiting','funded','confirmed','disputed','refunded').
  -- 'cancelled' (v2) has no exact legacy peer; 'refunded' is the closest.
  CASE
    WHEN fj.payout_successful                                  THEN 'confirmed'
    WHEN fj.job_completed AND NOT COALESCE(fj.payout_successful, false) THEN 'confirmed'
    WHEN fj.status = 'verified'                                THEN 'funded'
    WHEN fj.status = 'pending_verification'                    THEN 'awaiting'
    WHEN fj.status = 'failed'                                  THEN 'refunded'
    ELSE 'awaiting'
  END,
  -- Legacy balance (in naira). Zero for cancelled/failed funding.
  CASE WHEN fj.status = 'failed' THEN 0 ELSE COALESCE(fj.amount, 0) END,
  fj.reference_id,
  fj.funded_at,
  CASE WHEN fj.job_completed THEN fj.updated_at END,
  fj.created_at,
  fj.updated_at
FROM "Funded_jobs101" fj
WHERE NOT EXISTS (
  -- Avoid duplicates: skip if escrow_deposits already has a row for this job
  -- (the Paystack-path rows take precedence since they're the source of truth
  -- going forward).
  SELECT 1 FROM escrow_deposits ed WHERE ed.job_id = fj.job_id
);

-- ─────────────────────────────────────────────────────────────
-- 3. Synthesize retroactive escrow_events
-- ─────────────────────────────────────────────────────────────
-- For every escrow_deposits row, write the events corresponding to its
-- history. Events are derived from timestamps; if a timestamp is null
-- the event is skipped.

-- 3a. pending → awaiting (created event)
INSERT INTO escrow_events (escrow_id, type, from_status, to_status, amount_kobo, actor_type, payload, idempotency_key, created_at)
SELECT
  ed.id, 'funding_initiated', NULL, 'awaiting'::escrow_status_v2,
  ed.amount_kobo, 'system', '{"backfilled": true}'::jsonb,
  'backfill:initiated:' || ed.id::text,
  ed.created_at
FROM escrow_deposits ed
WHERE ed.status_v2 IS NOT NULL
ON CONFLICT (idempotency_key) DO NOTHING;

-- 3b. awaiting → funded
INSERT INTO escrow_events (escrow_id, type, from_status, to_status, amount_kobo, actor_type, payload, idempotency_key, created_at)
SELECT
  ed.id, 'funded', 'awaiting'::escrow_status_v2, 'funded'::escrow_status_v2,
  ed.amount_kobo, 'system', '{"backfilled": true}'::jsonb,
  'backfill:funded:' || ed.id::text,
  COALESCE(ed.funded_at, ed.updated_at)
FROM escrow_deposits ed
WHERE ed.status_v2 IN ('funded', 'released', 'paid_out', 'disputed', 'refunded')
ON CONFLICT (idempotency_key) DO NOTHING;

-- 3c. funded → released
INSERT INTO escrow_events (escrow_id, type, from_status, to_status, amount_kobo, actor_type, payload, idempotency_key, created_at)
SELECT
  ed.id, 'released', 'funded'::escrow_status_v2, 'released'::escrow_status_v2,
  ed.amount_kobo, 'system', '{"backfilled": true}'::jsonb,
  'backfill:released:' || ed.id::text,
  COALESCE(ed.released_at, ed.updated_at)
FROM escrow_deposits ed
WHERE ed.status_v2 IN ('released', 'paid_out')
ON CONFLICT (idempotency_key) DO NOTHING;

-- 3d. released → paid_out
INSERT INTO escrow_events (escrow_id, type, from_status, to_status, amount_kobo, actor_type, payload, idempotency_key, created_at)
SELECT
  ed.id, 'paid_out', 'released'::escrow_status_v2, 'paid_out'::escrow_status_v2,
  ed.amount_kobo, 'system', '{"backfilled": true}'::jsonb,
  'backfill:paid_out:' || ed.id::text,
  COALESCE(ed.paid_out_at, ed.updated_at)
FROM escrow_deposits ed
WHERE ed.status_v2 = 'paid_out'
ON CONFLICT (idempotency_key) DO NOTHING;

-- 3e. funded → disputed
INSERT INTO escrow_events (escrow_id, type, from_status, to_status, amount_kobo, actor_type, payload, idempotency_key, created_at)
SELECT
  ed.id, 'disputed', 'funded'::escrow_status_v2, 'disputed'::escrow_status_v2,
  ed.amount_kobo, 'system', '{"backfilled": true}'::jsonb,
  'backfill:disputed:' || ed.id::text,
  COALESCE(ed.disputed_at, ed.updated_at)
FROM escrow_deposits ed
WHERE ed.status_v2 = 'disputed'
ON CONFLICT (idempotency_key) DO NOTHING;

-- 3f. * → refunded
INSERT INTO escrow_events (escrow_id, type, from_status, to_status, amount_kobo, actor_type, payload, idempotency_key, created_at)
SELECT
  ed.id, 'refunded',
  CASE WHEN ed.disputed_at IS NOT NULL THEN 'disputed'::escrow_status_v2 ELSE 'funded'::escrow_status_v2 END,
  'refunded'::escrow_status_v2,
  ed.amount_kobo, 'system', '{"backfilled": true}'::jsonb,
  'backfill:refunded:' || ed.id::text,
  COALESCE(ed.refunded_at, ed.updated_at)
FROM escrow_deposits ed
WHERE ed.status_v2 = 'refunded'
ON CONFLICT (idempotency_key) DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- 4. Reconciliation summary (run this manually to verify)
-- ─────────────────────────────────────────────────────────────

-- Uncomment to view:
-- SELECT status_v2, COUNT(*), SUM(amount_kobo) / 100 AS total_naira
-- FROM escrow_deposits WHERE status_v2 IS NOT NULL GROUP BY status_v2;

-- SELECT type, COUNT(*) FROM escrow_events GROUP BY type;

-- SELECT
--   (SELECT COUNT(*) FROM "Funded_jobs101") AS old_funded_jobs,
--   (SELECT COUNT(*) FROM escrow_deposits WHERE status_v2 IS NOT NULL) AS new_escrow_rows,
--   (SELECT COUNT(*) FROM escrow_events) AS event_count;

-- ─────────────────────────────────────────────────────────────
-- 5. Re-enable triggers and commit
-- ─────────────────────────────────────────────────────────────

ALTER TABLE escrow_deposits ENABLE TRIGGER escrow_deposits_validate_transition;
ALTER TABLE escrow_deposits ENABLE TRIGGER escrow_deposits_validate_initial;

COMMIT;
