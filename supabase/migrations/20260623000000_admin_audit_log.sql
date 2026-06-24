-- Admin audit log: an append-only record of consequential admin actions
-- (money movement, account suspension). Every admin-only endpoint writes a row
-- here so there is an accountable trail of who did what, when.

create table if not exists admin_audit_log (
  id          uuid primary key default gen_random_uuid(),
  admin_id    uuid references profiles(id),
  action      text not null,              -- e.g. 'dispute.resolve', 'user.disable'
  target_type text,                       -- e.g. 'dispute', 'user'
  target_id   text,                       -- id of the affected entity
  details     jsonb,                      -- action-specific payload (amounts, outcome, ...)
  created_at  timestamptz not null default now()
);

create index if not exists idx_admin_audit_created on admin_audit_log (created_at desc);
create index if not exists idx_admin_audit_admin   on admin_audit_log (admin_id);

-- Only admins can read the log. Writes happen through the service role (which
-- bypasses RLS), so there is no insert policy by design — users cannot forge
-- entries.
alter table admin_audit_log enable row level security;

drop policy if exists admin_audit_read on admin_audit_log;
create policy admin_audit_read on admin_audit_log
  for select
  using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid() and p.account_type = 'admin'
    )
  );
