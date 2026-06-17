-- get_freelancer_dashboard: one round-trip for everything getFullUserData needs.
--
-- Replaces four separate queries (profile, credits sum, funded balance, NIN
-- status) with a single call, and does the credit/balance SUMs in Postgres
-- instead of pulling every row into the app to add up in JS.
--
-- Caller is taken from auth.uid(); reads only that user's own rows. The app
-- falls back to the individual queries if this function isn't present, so it is
-- safe to deploy the code before running this migration (you just don't get the
-- single-round-trip speedup until it's applied).

create or replace function public.get_freelancer_dashboard()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_profile jsonb;
  v_credits integer;
  v_balance numeric;
  v_verified boolean;
begin
  if v_user is null then
    return null;
  end if;

  select to_jsonb(p.*) into v_profile from profiles p where p.id = v_user;

  select coalesce(sum(credits_amount), 0) into v_credits
  from purchase_credits
  where freelancer_id = v_user and status = 'completed';

  -- Mirrors getTotalBalance: verified, not-yet-paid-out funded jobs. Treat a
  -- NULL payout_successful as "not paid out" (matches the JS `!payout_successful`).
  select coalesce(sum(amount), 0) into v_balance
  from "Funded_jobs101"
  where freelancer_id = v_user and status = 'verified' and payout_successful is not true;

  select exists (
    select 1 from freelancer_verification
    where freelancer_id = v_user and status = 'verified'
  ) into v_verified;

  return jsonb_build_object(
    'profile', v_profile,
    'credits', v_credits,
    'balance', v_balance,
    'is_verified', v_verified
  );
end;
$$;

revoke all on function public.get_freelancer_dashboard() from public;
grant execute on function public.get_freelancer_dashboard() to authenticated;
