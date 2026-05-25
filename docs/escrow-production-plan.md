# Production-grade escrow plan for Bizimi

This document is the architecture and rollout plan to turn the current escrow system (two parallel tables, no idempotency, payout with zero validation) into something we'd be comfortable holding real money in.

**Status:** Phase 1 in progress (schema + state machine + backfill).

---

## Design principles (non-negotiable)

1. **One source of truth for funds.** Kill `Funded_jobs101`. Everything goes through `escrow_deposits`.
2. **Server authorizes every money path.** Client never sends amounts; server derives them from DB state.
3. **Every webhook is signature-verified.** No exceptions, no `if (signature)`.
4. **Every operation is idempotent.** Replay a webhook 100 times → no double-credit. Replay a payout → no double-pay.
5. **Money moves through an immutable event log.** Every state transition writes to `escrow_events`. `escrow_deposits.status` is a materialized view of the latest event.
6. **State machine with explicit transitions.** No more `confirmed` meaning two things.
7. **Reconciliation is a first-class job.** Daily cron compares Paystack balance + transfer history vs. internal ledger; alerts on drift.

---

## Phase 1 — Foundation (1–2 weeks)

### 1.1 Schema rebuild

Located in `scripts/escrow-001-schema.sql`.

Key tables:

| Table | Purpose |
|---|---|
| `escrow_deposits` (rebuilt) | One row per job. Holds current state. Amount in kobo. |
| `escrow_events` | Immutable event log. Every state transition appends. |
| `payouts` | Explicit Paystack transfer records. One per release. |
| `webhook_events` | Deduplicates incoming webhooks by `(provider, event_id)`. |

Money stored as `bigint kobo` everywhere. Never floats.

### 1.2 State machine

```
  pending → awaiting → funded → released → paid_out
                          │
                          ├──→ disputed → (released | refunded)
                          │
                          └──→ refunded
```

Enforced via Postgres trigger in `scripts/escrow-002-state-machine.sql`. Invalid transitions raise an exception. Every successful transition writes a row to `escrow_events`.

### 1.3 Money as integer kobo

All amounts stored as `bigint` kobo (₦1 = 100 kobo). Display conversion only at the UI boundary.

### 1.4 Backfill

`scripts/escrow-003-backfill.sql` migrates existing `Funded_jobs101` and `escrow_deposits` rows into the new schema. Generates retroactive `escrow_events` so history is preserved.

Run order:
1. Apply 001 schema (creates new tables, doesn't touch old ones)
2. Apply 002 state machine triggers
3. Run 003 backfill (idempotent — safe to re-run)
4. Soak period: old tables stay populated, new tables shadow them
5. Cut over (Phase 2): rewrite money-path endpoints to use new tables
6. After soak: drop old tables

---

## Phase 2 — Money paths (2–3 weeks)

### 2.1 Fund job

Delete `components/payment-modal.tsx`. Single path is Paystack-integrated.

**Server endpoints:**
- `POST /api/escrow/initialize` — auth required, agency must own job, proposal must be `accepted`. Creates `escrow_deposits` (status `pending`), calls Paystack init, returns checkout URL.
- `POST /api/paystack/webhook` — **mandatory** signature verification. Deduplicates by `webhook_events`. Updates escrow to `funded`, writes event.
- `GET /api/escrow/verify` — manual fallback. Idempotent.

### 2.2 Release funds (approval)

`POST /api/escrow/release` — agency must own job, escrow must be `funded`, submission must exist and not be `approved`. Transitions to `released`. Writes event.

### 2.3 Payout (locked-down)

`POST /api/payout/request` — caller must be the freelancer for the escrow; escrow must be `released`; no existing payout for this escrow; **server derives amount** from `escrow.amount_kobo` × (1 − platform_fee_pct). Idempotency key prevents double-transfer.

Paystack `transfer.success`/`failed` webhook updates the `payouts` row. On success → `escrow.status = 'paid_out'`.

### 2.4 Refund (dispute resolution)

`POST /api/escrow/refund` — admin-only. Calls Paystack `refund` API. For partial release: split into a payout + a refund; either can fail and retry independently.

---

## Phase 3 — Authorization & RLS (1 week)

Every escrow table has explicit RLS. Server routes use `lib/supabase-server` (cookie-aware). Service role used **only** inside webhook handlers.

```sql
-- escrow_deposits: agency + freelancer can read their own; only system writes
create policy escrow_read on escrow_deposits for select
  using (auth.uid() = agency_id or auth.uid() = freelancer_id);

-- payouts: only the freelancer reads their own
create policy payout_read on payouts for select
  using (auth.uid() = freelancer_id);

-- escrow_events: read-only for participants
create policy escrow_events_read on escrow_events for select
  using (
    auth.uid() in (
      select agency_id from escrow_deposits where id = escrow_id
      union
      select freelancer_id from escrow_deposits where id = escrow_id
    )
  );
```

---

## Phase 4 — Edge cases (2–3 weeks)

Maps to the four scenarios in `docs/escrow-policy-options.txt`:

| Scenario | Policy | Implementation |
|---|---|---|
| Client ghosting post-submission | Auto-escalate to admin after 5d | Daily cron: stuck submissions → auto-create dispute (`client_abandonment`) |
| Freelancer ghosting | Client-triggered refund | "Cancel & Refund" button on agency side after deadline. Freelancer has 48h to object. |
| Infinite revisions | 14d stalemate breaker | Track `revision_requested_at`. After 14d, either party can escalate. |
| Mutual cancel | "End Contract" with proposed split | Client proposes split; freelancer accepts → instant resolution, no admin. |

All transitions go through the state machine; no special-case money paths.

### 4.1 Cron infrastructure

Supabase pg_cron or Vercel cron route. Jobs:
- `escrow_auto_escalate` — daily
- `escrow_reconciliation` — daily, compares internal ledger vs. Paystack balance; alerts on drift > ₦100
- `expire_unfunded_proposals` — weekly

---

## Phase 5 — Operations & observability

### 5.1 Reconciliation dashboard

`/admin/finance` page:
- Internal ledger total
- Paystack balance (live from API)
- Pending payouts in flight
- Daily drift chart
- Failed transfers awaiting retry
- Disputes by age

### 5.2 Metrics

- `escrow.funded.count` / `escrow.funded.amount_kobo`
- `escrow.released.lag_seconds`
- `payout.failure.count` by reason
- `dispute.opened.count` by type
- `webhook.signature_invalid.count` (must be 0; alert if not)

### 5.3 Audit trail

Every state change is in `escrow_events`. Admin can replay any contract's history.

### 5.4 Manual intervention

Admin override = `escrow_events` row with `actor_type='admin'` and a required `justification` in the payload.

---

## Rollout timeline

| Week | Phase | Deliverable |
|---|---|---|
| 1–2 | 1.1, 1.2, 1.3 | New schema, state machine, kobo migration. Old tables still in use. |
| 3 | 1.4 | Backfill + dual-write transition period |
| 4–5 | 2.1, 2.2 | Funding via new path; old PaymentModal removed |
| 6 | 2.3 | Locked-down payout |
| 7 | 2.4 | Refund + dispute resolution paths |
| 8 | 3 | RLS lockdown audit |
| 9–11 | 4 | Edge-case automations |
| 12 | 5.1 | Admin finance dashboard |
| Ongoing | 5.2–5.4 | Metrics, alerts, manual intervention tools |

~3 months to production-grade.

---

## What's out of scope (for now)

- KYC/AML escalation for high-value contracts
- Tax withholding (Nigerian VAT/WHT)
- Multi-currency
- Trust scoring
- Email/SMS notifications (assumed handled elsewhere)
