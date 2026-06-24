-- Job moderation: admins can remove a job posting (fraud / spam / policy
-- violation) and later restore it. A removed job is hidden from the freelancer
-- marketplace (the get_jobs_with_details RPC is updated to exclude it — see
-- scripts/get_jobs_with_details.sql).

alter table jobs
  add column if not exists moderation_status text not null default 'visible',
  add column if not exists moderated_by      uuid references profiles(id),
  add column if not exists moderated_at      timestamptz,
  add column if not exists moderation_reason text;

create index if not exists idx_jobs_moderation_status on jobs (moderation_status);
