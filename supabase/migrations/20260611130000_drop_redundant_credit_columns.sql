-- Drop the redundant denormalized credit columns on profiles.
--
-- Background
-- ----------
-- Credits had three stores: the purchase_credits ledger (the real balance,
-- summed by getUserCredits and written by every top-up + the welcome bonus +
-- place_bid), plus two write-only denormalized caches that nothing displayed:
--   * profiles.credits          -- maintained only by api/credits/verify-payment
--   * profiles.credits_balance  -- maintained only by the two verify-credits routes
-- Those two caches were never read for display and could silently disagree with
-- the ledger. The application no longer writes either column.
--
-- ⚠️ RUN THIS LAST, and only after:
--   1. the code change that stops writing these columns is deployed, AND
--   2. you've confirmed nothing OUTSIDE this app (BI/exports/reports/manual
--      queries) reads profiles.credits or profiles.credits_balance.
--
-- Dropping a column is destructive and not trivially reversible. If unsure,
-- leave the columns in place — once nothing writes them they are harmless dead
-- weight. This migration is cleanup, not a correctness requirement.

alter table public.profiles drop column if exists credits;
alter table public.profiles drop column if exists credits_balance;
