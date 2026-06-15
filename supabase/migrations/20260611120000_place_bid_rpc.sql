-- place_bid: atomically submit a proposal and charge the freelancer's credits.
--
-- Why this exists
-- ---------------
-- Bidding previously did two separate writes from application code (insert the
-- proposal, then insert a credit deduction) with no balance check and, in the
-- saved-jobs path, mutated profiles.credits directly from the browser. That
-- allowed: partial failures (proposal recorded but not charged), negative
-- balances, and two disagreeing sources of truth for credits.
--
-- This function makes the whole operation ONE transaction:
--   * the caller is taken from auth.uid() (never trusted from the client),
--   * a per-user advisory lock serialises concurrent bids,
--   * the balance is read from the purchase_credits ledger (the single source
--     of truth) and enforced,
--   * the proposal insert and the negative ledger entry commit together,
--   * a duplicate bid (unique job_id+freelancer_id) is reported, not charged.
--
-- Balance model: purchase_credits is an append-only ledger. Purchases insert
-- positive credits_amount; bids insert negative. Balance = SUM(credits_amount)
-- WHERE status = 'completed'.

create or replace function public.place_bid(
  p_job_id uuid,
  p_proposal_text text,
  p_timeline text,
  p_budget text,
  p_credit_cost integer,
  p_attachments text[] default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_balance integer;
begin
  if v_user is null then
    return jsonb_build_object('ok', false, 'code', 'unauthorized');
  end if;

  if p_credit_cost is null or p_credit_cost < 0 then
    return jsonb_build_object('ok', false, 'code', 'bad_cost');
  end if;

  -- Serialise all bids for this user so the balance check and the charge
  -- cannot race with a concurrent bid. Released automatically at txn end.
  perform pg_advisory_xact_lock(hashtext('bid:' || v_user::text));

  select coalesce(sum(credits_amount), 0)
    into v_balance
  from purchase_credits
  where freelancer_id = v_user
    and status = 'completed';

  if v_balance < p_credit_cost then
    return jsonb_build_object('ok', false, 'code', 'insufficient_credits', 'balance', v_balance);
  end if;

  -- Insert the proposal. The unique (job_id, freelancer_id) constraint makes
  -- this idempotent: a retry of an already-placed bid is reported, not charged.
  begin
    insert into proposals (job_id, freelancer_id, proposal_text, timeline, budget, status, attachments)
    values (p_job_id, v_user, p_proposal_text, p_timeline, p_budget, 'pending', p_attachments);
  exception
    when unique_violation then
      return jsonb_build_object('ok', true, 'code', 'already_submitted');
  end;

  -- Charge: append the negative ledger entry in the SAME transaction.
  insert into purchase_credits (freelancer_id, amount, credits_amount, status, paystack_reference)
  values (
    v_user,
    p_credit_cost * 50,
    -p_credit_cost,
    'completed',
    'job_bid_' || p_job_id::text || '_' || v_user::text || '_' || (extract(epoch from now()) * 1000)::bigint::text
  );

  return jsonb_build_object('ok', true, 'code', 'submitted');
end;
$$;

-- Only authenticated users may call it; it always acts as auth.uid().
revoke all on function public.place_bid(uuid, text, text, text, integer, text[]) from public;
grant execute on function public.place_bid(uuid, text, text, text, integer, text[]) to authenticated;
