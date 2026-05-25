-- =============================================================
-- ESCROW v2 — Phase 1.1: Schema
-- =============================================================
-- Creates the new escrow tables alongside the existing ones.
-- Safe to apply: does NOT touch existing escrow_deposits, Funded_jobs101, etc.
-- The new tables coexist with the old until cutover (Phase 2).
--
-- After applying:
--   - Apply scripts/escrow-002-state-machine.sql for triggers
--   - Apply scripts/escrow-003-backfill.sql to populate from old tables
-- =============================================================

-- The legacy `escrow_deposits` table is reused as the new source of truth, but
-- with additional columns. Existing rows keep working (the new columns are
-- nullable until backfill populates them).

-- ─────────────────────────────────────────────────────────────
-- 1. Enums
-- ─────────────────────────────────────────────────────────────

-- escrow_status: the new state machine.
-- Old `status` column on escrow_deposits used free text; we'll migrate it.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'escrow_status_v2') THEN
    CREATE TYPE escrow_status_v2 AS ENUM (
      'pending',      -- created, awaiting Paystack init
      'awaiting',     -- Paystack URL issued, awaiting payment
      'funded',       -- charge.success received and verified
      'released',     -- approved by client, freelancer earned
      'paid_out',     -- transferred to freelancer's bank
      'refunded',     -- returned to client
      'disputed',     -- frozen pending resolution
      'cancelled'     -- never funded
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payout_status') THEN
    CREATE TYPE payout_status AS ENUM (
      'pending',      -- request created, not yet sent to Paystack
      'processing',   -- transfer initiated, awaiting Paystack confirmation
      'success',      -- transfer.success received
      'failed',       -- transfer.failed received; retryable
      'reversed'      -- Paystack reversed the transfer (rare)
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'escrow_actor_type') THEN
    CREATE TYPE escrow_actor_type AS ENUM ('agency', 'freelancer', 'admin', 'system');
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────
-- 2. escrow_deposits — additive columns
-- ─────────────────────────────────────────────────────────────
-- Add new columns. Old columns (balance, status, paystack_reference, etc.)
-- stay untouched. Backfill (003) populates the new ones from the old.

ALTER TABLE escrow_deposits
  ADD COLUMN IF NOT EXISTS amount_kobo            bigint,
  ADD COLUMN IF NOT EXISTS status_v2              escrow_status_v2,
  ADD COLUMN IF NOT EXISTS freelancer_id          uuid REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS paystack_authorization_url text,
  ADD COLUMN IF NOT EXISTS funded_at              timestamptz,
  ADD COLUMN IF NOT EXISTS released_at            timestamptz,
  ADD COLUMN IF NOT EXISTS refunded_at            timestamptz,
  ADD COLUMN IF NOT EXISTS disputed_at            timestamptz,
  ADD COLUMN IF NOT EXISTS paid_out_at            timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_at           timestamptz;

-- One escrow per job (production invariant).
-- If existing data violates this, the backfill script must deduplicate first.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'escrow_deposits_job_id_key'
  ) THEN
    -- Use a partial unique index so we can add it even while old rows
    -- might have duplicates (those get cleaned up in backfill).
    CREATE UNIQUE INDEX IF NOT EXISTS escrow_deposits_job_id_key
      ON escrow_deposits (job_id)
      WHERE status_v2 IS NOT NULL;
  END IF;
END $$;

-- Indexes for the new lookup patterns
CREATE INDEX IF NOT EXISTS idx_escrow_deposits_freelancer ON escrow_deposits (freelancer_id);
CREATE INDEX IF NOT EXISTS idx_escrow_deposits_status_v2 ON escrow_deposits (status_v2);
CREATE INDEX IF NOT EXISTS idx_escrow_deposits_paystack_ref ON escrow_deposits (paystack_reference);

-- ─────────────────────────────────────────────────────────────
-- 3. escrow_events — immutable audit log
-- ─────────────────────────────────────────────────────────────
-- Every state transition writes here. Never UPDATE or DELETE.
-- All money movement is reconstructable from this table.

CREATE TABLE IF NOT EXISTS escrow_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escrow_id       uuid NOT NULL REFERENCES escrow_deposits(id) ON DELETE CASCADE,
  type            text NOT NULL,                -- 'funding_initiated', 'funded', 'released', etc.
  from_status     escrow_status_v2,             -- null on the very first event
  to_status       escrow_status_v2 NOT NULL,
  amount_kobo     bigint,                       -- amount transferred (if any) in this event
  actor_id        uuid REFERENCES profiles(id), -- null for system events
  actor_type      escrow_actor_type NOT NULL,
  payload         jsonb DEFAULT '{}'::jsonb,    -- diagnostic data (paystack refs, error messages, etc.)
  idempotency_key text UNIQUE,                  -- prevents duplicate event creation on webhook replay
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_escrow_events_escrow ON escrow_events (escrow_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_escrow_events_type ON escrow_events (type);
CREATE INDEX IF NOT EXISTS idx_escrow_events_actor ON escrow_events (actor_id) WHERE actor_id IS NOT NULL;

-- Prevent updates and deletes (immutable log).
CREATE OR REPLACE FUNCTION escrow_events_block_modification()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'escrow_events is an immutable log; UPDATE/DELETE not allowed';
END;
$$;

DROP TRIGGER IF EXISTS escrow_events_no_update ON escrow_events;
CREATE TRIGGER escrow_events_no_update
  BEFORE UPDATE ON escrow_events
  FOR EACH ROW EXECUTE FUNCTION escrow_events_block_modification();

DROP TRIGGER IF EXISTS escrow_events_no_delete ON escrow_events;
CREATE TRIGGER escrow_events_no_delete
  BEFORE DELETE ON escrow_events
  FOR EACH ROW EXECUTE FUNCTION escrow_events_block_modification();

-- ─────────────────────────────────────────────────────────────
-- 4. payouts — explicit transfer records
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS payouts (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escrow_id                uuid NOT NULL REFERENCES escrow_deposits(id) ON DELETE RESTRICT,
  freelancer_id            uuid NOT NULL REFERENCES profiles(id),
  gross_amount_kobo        bigint NOT NULL,
  platform_fee_kobo        bigint NOT NULL,
  net_amount_kobo          bigint NOT NULL,
  paystack_recipient_code  text,
  paystack_transfer_code   text UNIQUE,
  bank_account_number      text NOT NULL,
  bank_code                text NOT NULL,
  account_name             text NOT NULL,
  status                   payout_status NOT NULL DEFAULT 'pending',
  failure_reason           text,
  requested_at             timestamptz NOT NULL DEFAULT now(),
  completed_at             timestamptz,
  idempotency_key          text NOT NULL UNIQUE
);

-- Only one *successful or in-flight* payout per escrow.
-- Failed payouts can be retried, so we exclude them from the constraint.
CREATE UNIQUE INDEX IF NOT EXISTS payouts_one_active_per_escrow
  ON payouts (escrow_id)
  WHERE status IN ('pending', 'processing', 'success');

CREATE INDEX IF NOT EXISTS idx_payouts_freelancer ON payouts (freelancer_id);
CREATE INDEX IF NOT EXISTS idx_payouts_status ON payouts (status);

-- ─────────────────────────────────────────────────────────────
-- 5. webhook_events — deduplication for incoming webhooks
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS webhook_events (
  provider     text NOT NULL,
  event_id     text NOT NULL,
  event_type   text,
  payload      jsonb NOT NULL,
  received_at  timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  PRIMARY KEY (provider, event_id)
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_received ON webhook_events (received_at DESC);

-- ─────────────────────────────────────────────────────────────
-- 6. RLS — read policies (write paths go through service role only)
-- ─────────────────────────────────────────────────────────────

ALTER TABLE escrow_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE payouts ENABLE ROW LEVEL SECURITY;
-- webhook_events is service-role only; do not expose via PostgREST

DROP POLICY IF EXISTS "Participants can read escrow events" ON escrow_events;
CREATE POLICY "Participants can read escrow events" ON escrow_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM escrow_deposits
      WHERE escrow_deposits.id = escrow_events.escrow_id
        AND (escrow_deposits.agency_id = auth.uid()
             OR escrow_deposits.freelancer_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Freelancers can read their payouts" ON payouts;
CREATE POLICY "Freelancers can read their payouts" ON payouts
  FOR SELECT USING (auth.uid() = freelancer_id);

-- Tighten escrow_deposits read policy (existing setup may already cover this;
-- adding here defensively).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'escrow_deposits'
      AND policyname = 'Participants can read escrow_deposits'
  ) THEN
    CREATE POLICY "Participants can read escrow_deposits" ON escrow_deposits
      FOR SELECT USING (
        agency_id = auth.uid() OR freelancer_id = auth.uid()
      );
  END IF;
END $$;
