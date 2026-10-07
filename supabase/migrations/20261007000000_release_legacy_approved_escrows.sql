-- ============================================================
-- Reconcile escrows approved in the legacy Next.js app into escrow v2
--
-- The legacy approve route (app/api/submissions/[id]/approve) marks the job
-- payable (jobs.payout_status = 'completed') and sets the legacy
-- escrow_deposits.status = 'confirmed', but never moves status_v2 off
-- 'funded'. The new server only pays out escrows in status_v2 = 'released',
-- so without this those freelancers can't withdraw through the new app.
--
-- For every v2 escrow still 'funded' whose job was approved in the legacy app:
--   payout_status 'completed' (or an approved submission) -> released
--   payout_status 'paid' (legacy already transferred)     -> released -> paid_out
--   payout_status 'processing' (legacy transfer in flight) -> SKIPPED; re-run
--     this migration after it settles (it's idempotent) to pick it up.
--
-- Transitions go through the escrow-002 state-machine trigger (so timestamps
-- are stamped and invalid moves still raise) and each writes an escrow_events
-- row via escrow_append_event with a stable idempotency key, so re-running
-- adds nothing.
--
-- Preview first with scripts/go-live-check.sql Part B rows 2–4.
-- Requires escrow-001/002 to be applied (Part A rows 1–4).
-- ============================================================

DO $$
DECLARE
  r record;
  released_count integer := 0;
  paid_out_count integer := 0;
BEGIN
  FOR r IN
    SELECT e.id, e.amount_kobo, j.payout_status
    FROM public.escrow_deposits e
    JOIN public.jobs j ON j.id = e.job_id
    WHERE e.status_v2 = 'funded'
      AND (
        j.payout_status IN ('completed', 'paid')
        OR (
          j.payout_status IS DISTINCT FROM 'processing'
          AND EXISTS (SELECT 1 FROM public.project_submissions s WHERE s.job_id = e.job_id AND s.status = 'approved')
        )
      )
    FOR UPDATE OF e
  LOOP
    UPDATE public.escrow_deposits
       SET status_v2 = 'released', status = 'confirmed'
     WHERE id = r.id AND status_v2 = 'funded';

    PERFORM public.escrow_append_event(
      r.id, 'released', 'funded', 'released', r.amount_kobo, NULL, 'system',
      jsonb_build_object('via', 'backfill_legacy_approved', 'legacy_payout_status', r.payout_status),
      'backfill_release:' || r.id
    );
    released_count := released_count + 1;

    IF r.payout_status = 'paid' THEN
      UPDATE public.escrow_deposits
         SET status_v2 = 'paid_out'
       WHERE id = r.id AND status_v2 = 'released';

      PERFORM public.escrow_append_event(
        r.id, 'paid_out', 'released', 'paid_out', r.amount_kobo, NULL, 'system',
        jsonb_build_object('via', 'backfill_legacy_approved', 'note', 'paid out by the legacy app; no v2 payouts row exists'),
        'backfill_paid_out:' || r.id
      );
      paid_out_count := paid_out_count + 1;
    END IF;
  END LOOP;

  RAISE NOTICE 'release_legacy_approved_escrows: % released (% of them also marked paid_out)', released_count, paid_out_count;
END
$$;
