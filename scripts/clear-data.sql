-- ============================================================
-- ⚠️  DANGER: CLEAR ALL DATA  ⚠️
-- ------------------------------------------------------------
-- Wipes every row from the application (public schema) tables and deletes all
-- auth users. Schema, functions, triggers, indexes and RLS policies are KEPT —
-- so the app keeps working, you just start from an empty database.
--
-- This is IRREVERSIBLE. For development / staging resets ONLY.
-- Do NOT run against production. Take a backup first if you're unsure.
--
-- How to run:
--   • Supabase Dashboard → SQL Editor → paste → Run, OR
--   • psql "$DATABASE_URL" -f scripts/clear-data.sql
--
-- Notes:
--   • `app_settings` is preserved (commission %, platform fee %). Remove it from
--     the exclusion list below if you want config cleared too.
--   • Uploaded files in Supabase Storage are NOT touched (separate `storage`
--     schema) — clear those from the Storage UI if needed.
-- ============================================================

BEGIN;

-- 1. Truncate every public table. CASCADE resolves foreign-key order; RESTART
--    IDENTITY resets serial/identity counters.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename NOT IN ('app_settings')   -- keep program config; add more names to preserve
  LOOP
    EXECUTE format('TRUNCATE TABLE public.%I RESTART IDENTITY CASCADE', r.tablename);
  END LOOP;
END $$;

-- 2. Delete all auth users so their emails can be reused on fresh sign-ups.
--    Comment this line out if you want to clear app data but KEEP accounts.
DELETE FROM auth.users;

COMMIT;
