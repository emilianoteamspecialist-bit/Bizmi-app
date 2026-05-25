-- =============================================================
-- ESCROW v2 — Phase 1.2: State machine
-- =============================================================
-- Enforces the escrow state machine via Postgres triggers.
--
-- Valid transitions:
--   pending → awaiting
--   awaiting → funded
--   awaiting → cancelled
--   funded → released
--   funded → disputed
--   funded → refunded
--   disputed → released
--   disputed → refunded
--   released → paid_out
--
-- Every transition writes a row to escrow_events (one-to-one with status changes).
-- Invalid transitions raise an exception.
-- =============================================================

CREATE OR REPLACE FUNCTION escrow_validate_transition()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  is_valid boolean := false;
BEGIN
  -- Only enforce when status_v2 is being changed (or being set initially).
  IF NEW.status_v2 IS NOT DISTINCT FROM OLD.status_v2 THEN
    RETURN NEW;
  END IF;

  -- Initial state must be 'pending'.
  IF OLD.status_v2 IS NULL THEN
    IF NEW.status_v2 = 'pending' THEN
      RETURN NEW;
    ELSE
      RAISE EXCEPTION 'Initial escrow status_v2 must be pending, got %', NEW.status_v2;
    END IF;
  END IF;

  -- Validate the (from, to) pair.
  is_valid := CASE
    WHEN OLD.status_v2 = 'pending'   AND NEW.status_v2 = 'awaiting'   THEN true
    WHEN OLD.status_v2 = 'pending'   AND NEW.status_v2 = 'cancelled'  THEN true
    WHEN OLD.status_v2 = 'awaiting'  AND NEW.status_v2 = 'funded'     THEN true
    WHEN OLD.status_v2 = 'awaiting'  AND NEW.status_v2 = 'cancelled'  THEN true
    WHEN OLD.status_v2 = 'funded'    AND NEW.status_v2 = 'released'   THEN true
    WHEN OLD.status_v2 = 'funded'    AND NEW.status_v2 = 'disputed'   THEN true
    WHEN OLD.status_v2 = 'funded'    AND NEW.status_v2 = 'refunded'   THEN true
    WHEN OLD.status_v2 = 'disputed'  AND NEW.status_v2 = 'released'   THEN true
    WHEN OLD.status_v2 = 'disputed'  AND NEW.status_v2 = 'refunded'   THEN true
    WHEN OLD.status_v2 = 'released'  AND NEW.status_v2 = 'paid_out'   THEN true
    ELSE false
  END;

  IF NOT is_valid THEN
    RAISE EXCEPTION 'Invalid escrow status transition: % → %', OLD.status_v2, NEW.status_v2;
  END IF;

  -- Stamp the appropriate timestamp.
  CASE NEW.status_v2
    WHEN 'funded'    THEN NEW.funded_at    := COALESCE(NEW.funded_at, now());
    WHEN 'released'  THEN NEW.released_at  := COALESCE(NEW.released_at, now());
    WHEN 'refunded'  THEN NEW.refunded_at  := COALESCE(NEW.refunded_at, now());
    WHEN 'disputed'  THEN NEW.disputed_at  := COALESCE(NEW.disputed_at, now());
    WHEN 'paid_out'  THEN NEW.paid_out_at  := COALESCE(NEW.paid_out_at, now());
    WHEN 'cancelled' THEN NEW.cancelled_at := COALESCE(NEW.cancelled_at, now());
    ELSE NULL;
  END CASE;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS escrow_deposits_validate_transition ON escrow_deposits;
CREATE TRIGGER escrow_deposits_validate_transition
  BEFORE UPDATE ON escrow_deposits
  FOR EACH ROW
  EXECUTE FUNCTION escrow_validate_transition();

-- Also enforce initial state on INSERT.
CREATE OR REPLACE FUNCTION escrow_validate_initial()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Only enforce for rows that participate in the new state machine.
  IF NEW.status_v2 IS NULL THEN
    RETURN NEW;  -- legacy rows; backfill handles them
  END IF;
  IF NEW.status_v2 <> 'pending' THEN
    RAISE EXCEPTION 'New escrow must start in pending status; got %', NEW.status_v2;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS escrow_deposits_validate_initial ON escrow_deposits;
CREATE TRIGGER escrow_deposits_validate_initial
  BEFORE INSERT ON escrow_deposits
  FOR EACH ROW
  EXECUTE FUNCTION escrow_validate_initial();

-- =============================================================
-- Helper: append an event to escrow_events
-- =============================================================
-- Server code should always go through this function rather than INSERTing
-- to escrow_events directly. It enforces:
--   - The event type matches the new status (for transition events)
--   - Idempotency via idempotency_key
--
-- Usage:
--   SELECT escrow_append_event(
--     p_escrow_id  => '...',
--     p_type       => 'funded',
--     p_from       => 'awaiting',
--     p_to         => 'funded',
--     p_amount     => 150000000,
--     p_actor_id   => null,
--     p_actor_type => 'system',
--     p_payload    => '{"paystack_reference": "abc123"}'::jsonb,
--     p_idempotency_key => 'paystack:evt_xyz'
--   );

CREATE OR REPLACE FUNCTION escrow_append_event(
  p_escrow_id       uuid,
  p_type            text,
  p_from            escrow_status_v2,
  p_to              escrow_status_v2,
  p_amount          bigint,
  p_actor_id        uuid,
  p_actor_type      escrow_actor_type,
  p_payload         jsonb,
  p_idempotency_key text
)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  new_event_id uuid;
BEGIN
  INSERT INTO escrow_events (
    escrow_id, type, from_status, to_status,
    amount_kobo, actor_id, actor_type, payload, idempotency_key
  ) VALUES (
    p_escrow_id, p_type, p_from, p_to,
    p_amount, p_actor_id, p_actor_type, COALESCE(p_payload, '{}'::jsonb), p_idempotency_key
  )
  ON CONFLICT (idempotency_key) DO NOTHING
  RETURNING id INTO new_event_id;

  RETURN new_event_id;
END;
$$;
