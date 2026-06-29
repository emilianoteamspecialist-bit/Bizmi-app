-- ============================================================
-- Influencer Referral Program
-- Spec: docs/superpowers/specs/2026-06-10-influencer-referral-program-design.md (§4)
--
-- Adds the 'influencer' account type, the three program tables
-- (influencer_profiles, referrals, influencer_payouts), the profiles.referred_by
-- column, an app_settings config store, and RLS. Idempotent — safe to re-run.
-- All cross-party writes (attribution at sign-up, qualify on release, payouts)
-- happen via the service-role client; clients only ever READ their own rows.
-- ============================================================

-- ------------------------------------------------------------
-- 1. account_type / role: add 'influencer' to any existing CHECK
--    (only touches a constraint if it already exists, so we never
--    impose a new restriction on previously-unconstrained data).
-- ------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_account_type_check') THEN
    ALTER TABLE public.profiles DROP CONSTRAINT profiles_account_type_check;
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_account_type_check
      CHECK (account_type IN ('freelancer', 'agency', 'influencer'));
  END IF;

  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_role_check') THEN
    ALTER TABLE public.profiles DROP CONSTRAINT profiles_role_check;
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
      CHECK (role IN ('agency', 'freelancer', 'admin', 'influencer'));
  END IF;
END $$;

-- ------------------------------------------------------------
-- 2. Tables
-- ------------------------------------------------------------

-- One row per influencer. Counters are denormalised and maintained by the
-- service-role code that creates referrals and qualifies them.
CREATE TABLE IF NOT EXISTS public.influencer_profiles (
  user_id             uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  referral_code       text UNIQUE NOT NULL,
  display_name        text,
  social_handle       text,
  total_referrals     integer NOT NULL DEFAULT 0,
  total_qualified     integer NOT NULL DEFAULT 0,
  total_earned_kobo   bigint  NOT NULL DEFAULT 0,
  balance_unpaid_kobo bigint  NOT NULL DEFAULT 0,
  created_at          timestamptz NOT NULL DEFAULT now()
);

-- One row per referred user (a user can be referred only once → UNIQUE).
CREATE TABLE IF NOT EXISTS public.referrals (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  influencer_id         uuid NOT NULL REFERENCES public.influencer_profiles(user_id) ON DELETE CASCADE,
  referred_user_id      uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  referred_account_type text,
  status                text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'qualified', 'paid')),
  qualifying_job_id     uuid REFERENCES public.jobs(id) ON DELETE SET NULL,
  commission_kobo       bigint,
  qualified_at          timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now()
);

-- Manual payout records (admin-triggered). Decrements the unpaid balance and
-- flips covered referrals to 'paid' in the same server-side transaction.
CREATE TABLE IF NOT EXISTS public.influencer_payouts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  influencer_id uuid NOT NULL REFERENCES public.influencer_profiles(user_id) ON DELETE CASCADE,
  amount_kobo   bigint NOT NULL,
  status        text NOT NULL DEFAULT 'paid',
  processed_by  uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  processed_at  timestamptz NOT NULL DEFAULT now(),
  note          text
);

-- Fast lookup of a user's referrer (authoritative record stays in `referrals`).
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS referred_by uuid REFERENCES public.influencer_profiles(user_id) ON DELETE SET NULL;

-- Simple key/value settings store (commission rate + platform fee %).
CREATE TABLE IF NOT EXISTS public.app_settings (
  key        text PRIMARY KEY,
  value      jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.app_settings (key, value) VALUES
  ('influencer_commission_pct', '10'::jsonb),   -- % of Bizimi's platform fee paid to the influencer
  ('platform_fee_pct',          '15'::jsonb)    -- platform fee as % of escrow amount (matches payout route)
ON CONFLICT (key) DO NOTHING;

-- ------------------------------------------------------------
-- 3. Indexes
-- ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_referrals_influencer_id ON public.referrals(influencer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_status        ON public.referrals(status);
CREATE INDEX IF NOT EXISTS idx_payouts_influencer_id   ON public.influencer_payouts(influencer_id);
CREATE INDEX IF NOT EXISTS idx_profiles_referred_by    ON public.profiles(referred_by);

-- ------------------------------------------------------------
-- 4. Row Level Security
--    Influencers may only READ their own rows. Every write (sign-up
--    attribution, qualify-on-release, payouts) goes through the service-role
--    client, which bypasses RLS — so no client INSERT/UPDATE policies exist.
--    Admin reads also go through the service-role client.
-- ------------------------------------------------------------
ALTER TABLE public.influencer_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.influencer_payouts  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings        ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Influencer can view own profile"  ON public.influencer_profiles;
DROP POLICY IF EXISTS "Influencer can view own referrals" ON public.referrals;
DROP POLICY IF EXISTS "Influencer can view own payouts"   ON public.influencer_payouts;

CREATE POLICY "Influencer can view own profile" ON public.influencer_profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Influencer can view own referrals" ON public.referrals
  FOR SELECT USING (auth.uid() = influencer_id);

CREATE POLICY "Influencer can view own payouts" ON public.influencer_payouts
  FOR SELECT USING (auth.uid() = influencer_id);

-- app_settings: no client policies → readable/writable only via service role.
