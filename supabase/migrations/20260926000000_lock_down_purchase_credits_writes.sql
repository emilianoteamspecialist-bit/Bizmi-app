-- ============================================================
-- Security fix: lock down purchase_credits' client-writable INSERT/UPDATE
-- policies
--
-- purchase_credits previously let any authenticated freelancer INSERT or
-- UPDATE a row directly via PostgREST -- including an arbitrary
-- credits_amount on INSERT, or flipping status/credits_amount on UPDATE --
-- completely bypassing this codebase's server-side verification of
-- Paystack payments. fetchCredits sums credits_amount over
-- status='completed' with no other gate, so a forged or altered row
-- immediately changes the visible balance.
--
-- Safe to apply now: every LIVE writer of this table has been switched to
-- the service-role client and no longer depends on these policies --
-- the new Express server's POST /api/user/credits/verify, and the legacy
-- Next.js app's POST /api/verify-transaction and GET
-- /api/credits/verify-payment (the only two legacy routes with a live
-- caller in the current UI; several other legacy routes under
-- app/api/credits/ and app/api/paystack/ reference this table but have no
-- live caller and were deliberately left untouched -- see this plan's
-- Amendment section, and the react-node-migration-status memory, for the
-- full list).
--
-- This repo's ad hoc scripts/ directory recreated this table's RLS
-- multiple times over its history, under two different names each for
-- INSERT and for UPDATE -- drop every historical name so this migration
-- is correct regardless of which iteration is actually live. IF EXISTS
-- makes each DROP a no-op for a name that was never created.
-- ============================================================

DROP POLICY IF EXISTS "Freelancers can insert own credit purchases" ON public.purchase_credits;
DROP POLICY IF EXISTS "Users can insert own credit purchases" ON public.purchase_credits;
DROP POLICY IF EXISTS "System can update credit purchases" ON public.purchase_credits;
DROP POLICY IF EXISTS "Users can update own credit purchases" ON public.purchase_credits;
