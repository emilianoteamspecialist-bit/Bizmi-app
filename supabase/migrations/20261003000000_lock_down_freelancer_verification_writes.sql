-- ============================================================
-- Security fix: stop freelancers from self-verifying their identity
--
-- freelancer_verification's RLS (as created in scripts/reset-and-migrate.sql)
-- let any authenticated freelancer UPDATE their own row with no column
-- restriction, and INSERT their own row with any status. So a freelancer
-- could set status = 'verified' directly via PostgREST -- no NIN check at
-- all -- and unlock the bid gate and the verified badge. The legacy
-- identity page's 60-second client-side "auto-verify" timer relied on
-- exactly this UPDATE policy.
--
-- KYC/NIN verification is performed by an external service, which owns the
-- status transition (pending -> verified/rejected). Users only ever need
-- to submit a NIN as 'pending':
--   - legacy app/freelancer/identity/IdentityClient.tsx (insert, 'pending')
--   - Express POST /api/user/verification (insert, 'pending')
-- Neither needs UPDATE, and the legacy timer is removed in the same change.
--
-- ASSUMPTION to confirm before applying: the external KYC service writes
-- status with the service-role key (which bypasses RLS). If it instead
-- writes as an authenticated user, it will lose the ability to update rows
-- once this is applied.
-- ============================================================

-- No client UPDATEs at all: status is owned by the external KYC service.
DROP POLICY IF EXISTS "Freelancers can update own verification" ON public.freelancer_verification;
REVOKE UPDATE ON public.freelancer_verification FROM authenticated;

-- Clients may still submit their own NIN, but only as 'pending'.
DROP POLICY IF EXISTS "Freelancers can insert own verification" ON public.freelancer_verification;
CREATE POLICY "Freelancers can insert own verification" ON public.freelancer_verification
    FOR INSERT WITH CHECK (auth.uid() = freelancer_id AND status = 'pending');
