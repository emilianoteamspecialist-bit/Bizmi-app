-- ============================================================
-- Security fix: lock down purchase_credits' client-writable INSERT policy
--
-- purchase_credits had an RLS INSERT policy letting any authenticated
-- freelancer write a row directly via Supabase's PostgREST API --
-- including an arbitrary credits_amount -- completely bypassing
-- POST /api/user/credits/verify's server-side derivation of credits_amount
-- from the Paystack-verified payment amount. fetchCredits sums
-- credits_amount over status='completed' with no other gate, so a forged
-- row immediately inflates the visible balance.
--
-- This repo's ad hoc scripts/ directory recreated this table's RLS three
-- times over its history, under two different INSERT-policy names
-- (create-credits-system-tables.sql / -v2.sql used one name;
-- fix-credits-function-conflict.sql and reset-and-migrate.sql used
-- another) -- drop both by name so this migration is correct regardless
-- of which iteration is actually live. IF EXISTS makes either DROP a
-- no-op if that particular name was never created.
--
-- After this migration, the ONLY way to write purchase_credits is via the
-- service-role client -- matching /api/user/credits/verify's insert,
-- which was switched to createServiceClient() in the same fix (see
-- server/src/routes/user.ts).
-- ============================================================

DROP POLICY IF EXISTS "Freelancers can insert own credit purchases" ON public.purchase_credits;
DROP POLICY IF EXISTS "Users can insert own credit purchases" ON public.purchase_credits;
