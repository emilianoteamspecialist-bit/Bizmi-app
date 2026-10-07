-- =============================================================
-- Go-live check for the React + Node app (READ-ONLY)
-- =============================================================
-- Paste into the Supabase Studio SQL editor and run. Nothing here writes,
-- creates or alters anything.
--
-- Part A checks the schema/policies the new server depends on. Run it first.
-- Part B checks data and references escrow v2 columns, so it will error if
-- Part A shows the escrow v2 schema missing -- run Part B only once Part A is
-- all PASS for the escrow rows.
--
-- See docs/superpowers/plans/2026-10-03-phase4-escrow-readiness.md §4.
-- =============================================================

-- ─────────────────────────────────────────────────────────────
-- PART A — schema & security (expect every row: PASS)
-- ─────────────────────────────────────────────────────────────
SELECT * FROM (
  -- Escrow v2 (scripts/escrow-001-schema.sql, escrow-002-state-machine.sql)
  SELECT 1 AS n, 'escrow v2: escrow_deposits has status_v2/amount_kobo/freelancer_id/paystack_authorization_url/paystack_access_code' AS check,
    CASE WHEN (SELECT count(*) FROM information_schema.columns
               WHERE table_schema = 'public' AND table_name = 'escrow_deposits'
                 AND column_name IN ('status_v2','amount_kobo','freelancer_id','paystack_authorization_url','paystack_access_code')) = 5
         THEN 'PASS' ELSE 'FAIL' END AS result,
    (SELECT string_agg(column_name, ', ') FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'escrow_deposits'
        AND column_name IN ('status_v2','amount_kobo','freelancer_id','paystack_authorization_url','paystack_access_code')) AS detail
  UNION ALL
  SELECT 2, 'escrow v2: tables escrow_events, payouts, webhook_events exist',
    CASE WHEN to_regclass('public.escrow_events') IS NOT NULL AND to_regclass('public.payouts') IS NOT NULL
              AND to_regclass('public.webhook_events') IS NOT NULL THEN 'PASS' ELSE 'FAIL' END,
    concat_ws(', ',
      CASE WHEN to_regclass('public.escrow_events') IS NULL THEN 'escrow_events missing' END,
      CASE WHEN to_regclass('public.payouts') IS NULL THEN 'payouts missing' END,
      CASE WHEN to_regclass('public.webhook_events') IS NULL THEN 'webhook_events missing' END)
  UNION ALL
  SELECT 3, 'escrow v2: state-machine triggers on escrow_deposits',
    CASE WHEN (SELECT count(*) FROM pg_trigger WHERE NOT tgisinternal
               AND tgname IN ('escrow_deposits_validate_transition','escrow_deposits_validate_initial')) = 2
         THEN 'PASS' ELSE 'FAIL' END,
    (SELECT string_agg(tgname, ', ') FROM pg_trigger WHERE NOT tgisinternal AND tgname LIKE 'escrow_deposits_%')
  UNION ALL
  SELECT 4, 'escrow v2: escrow_append_event() function exists',
    CASE WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'escrow_append_event') THEN 'PASS' ELSE 'FAIL' END, NULL
  UNION ALL
  SELECT 5, 'escrow v2: payouts_one_active_per_escrow unique index',
    CASE WHEN EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'payouts_one_active_per_escrow')
         THEN 'PASS' ELSE 'FAIL' END, NULL
  UNION ALL
  SELECT 6, 'workspace/disputes/bank tables exist (project_submissions, submission_comments, disputes, dispute_messages, freelancer_bank_details)',
    CASE WHEN to_regclass('public.project_submissions') IS NOT NULL AND to_regclass('public.submission_comments') IS NOT NULL
              AND to_regclass('public.disputes') IS NOT NULL AND to_regclass('public.dispute_messages') IS NOT NULL
              AND to_regclass('public.freelancer_bank_details') IS NOT NULL THEN 'PASS' ELSE 'FAIL' END, NULL

  -- Security migrations (supabase/migrations/2026092600..., 2026100300..., 2026100301...)
  UNION ALL
  SELECT 7, 'security: purchase_credits has no client INSERT/UPDATE policy (20260926000000)',
    CASE WHEN NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'purchase_credits'
                          AND cmd IN ('INSERT','UPDATE','ALL')) THEN 'PASS' ELSE 'FAIL — apply the migration' END,
    (SELECT string_agg(policyname || ' (' || cmd || ')', '; ') FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'purchase_credits')
  UNION ALL
  SELECT 8, 'security: freelancer_verification has no client UPDATE policy (20261003000000)',
    CASE WHEN NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'freelancer_verification'
                          AND cmd IN ('UPDATE','ALL')) THEN 'PASS' ELSE 'FAIL — apply the migration' END,
    (SELECT string_agg(policyname || ' (' || cmd || ')', '; ') FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'freelancer_verification')
  UNION ALL
  SELECT 9, 'security: freelancer_verification INSERT is restricted to status = pending (20261003000000)',
    CASE WHEN EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'freelancer_verification'
                      AND cmd = 'INSERT' AND with_check ILIKE '%pending%') THEN 'PASS' ELSE 'FAIL — apply the migration' END,
    (SELECT with_check FROM pg_policies WHERE schemaname = 'public' AND tablename = 'freelancer_verification' AND cmd = 'INSERT' LIMIT 1)
  UNION ALL
  SELECT 10, 'security: active-NIN unique index (20261003010000)',
    CASE WHEN EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'freelancer_verification_active_nin_key')
         THEN 'PASS' ELSE 'FAIL — apply the migration (check Part B row 1 first)' END, NULL
) checks
ORDER BY n;


-- ─────────────────────────────────────────────────────────────
-- PART B — data (run only after Part A rows 1–4 PASS)
-- ─────────────────────────────────────────────────────────────
SELECT * FROM (
  -- Must be 0 before applying 20261003010000_freelancer_verification_unique_nin.sql.
  SELECT 1 AS n, 'NINs shared by more than one non-rejected verification' AS check,
    (SELECT count(*) FROM (SELECT nin FROM public.freelancer_verification WHERE status <> 'rejected'
                           GROUP BY nin HAVING count(*) > 1) d)::text AS value
  UNION ALL
  -- Escrows approved in the legacy app but still 'funded' in v2: the new app
  -- can't pay these out until 20261007000000_release_legacy_approved_escrows.sql runs.
  SELECT 2, 'v2 escrows still funded although the job was approved in the legacy app',
    (SELECT count(*) FROM public.escrow_deposits e
       JOIN public.jobs j ON j.id = e.job_id
      WHERE e.status_v2 = 'funded'
        AND (j.payout_status IN ('completed','processing','paid')
             OR EXISTS (SELECT 1 FROM public.project_submissions s WHERE s.job_id = e.job_id AND s.status = 'approved')))::text
  UNION ALL
  -- Of those, how many the legacy app has already paid (they move to paid_out).
  SELECT 3, '  …of which the legacy app already paid out (jobs.payout_status = paid)',
    (SELECT count(*) FROM public.escrow_deposits e JOIN public.jobs j ON j.id = e.job_id
      WHERE e.status_v2 = 'funded' AND j.payout_status = 'paid')::text
  UNION ALL
  -- Legacy payouts mid-transfer: leave these alone until they settle.
  SELECT 4, '  …of which a legacy payout is still in flight (jobs.payout_status = processing)',
    (SELECT count(*) FROM public.escrow_deposits e JOIN public.jobs j ON j.id = e.job_id
      WHERE e.status_v2 = 'funded' AND j.payout_status = 'processing')::text
  UNION ALL
  SELECT 5, 'escrows by v2 status',
    (SELECT string_agg(coalesce(status_v2::text, 'NULL (legacy only)') || ': ' || c, ', ')
       FROM (SELECT status_v2, count(*) c FROM public.escrow_deposits GROUP BY status_v2) x)
  UNION ALL
  SELECT 6, 'payouts by status (v2 payouts table)',
    coalesce((SELECT string_agg(status::text || ': ' || c, ', ') FROM (SELECT status, count(*) c FROM public.payouts GROUP BY status) x), 'none')
) data
ORDER BY n;
