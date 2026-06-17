-- Indexes for the hot freelancer-side query paths.
--
-- These back the filters used by getJobs/getFreelancerProposals/getSavedJobs,
-- the credit/balance sums, and the escrow/verification lookups. All are
-- additive and safe (CREATE INDEX IF NOT EXISTS). Run anytime.
--
-- Note: a unique index on proposals(job_id, freelancer_id) is what makes the
-- place_bid idempotency work — if you don't already have that constraint, the
-- (non-unique) index below still helps reads, but add a UNIQUE one for correctness.

create index if not exists idx_purchase_credits_freelancer_status
  on purchase_credits (freelancer_id, status);

create index if not exists idx_funded_jobs101_freelancer
  on "Funded_jobs101" (freelancer_id);

create index if not exists idx_saved_jobs_freelancer_job
  on saved_jobs (freelancer_id, job_id);

create index if not exists idx_proposals_freelancer
  on proposals (freelancer_id);

create index if not exists idx_proposals_job
  on proposals (job_id);

create index if not exists idx_jobs_agency
  on jobs (agency_id);

create index if not exists idx_jobs_status_created
  on jobs (status, created_at desc);

create index if not exists idx_escrow_deposits_job
  on escrow_deposits (job_id);

create index if not exists idx_freelancer_verification_freelancer_status
  on freelancer_verification (freelancer_id, status);
