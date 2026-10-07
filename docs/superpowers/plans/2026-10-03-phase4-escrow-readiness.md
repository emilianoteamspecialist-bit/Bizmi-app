# Phase 4 (Escrow & payments) — readiness assessment and gated plan

**Date:** 2026-10-03
**Status (updated later on 2026-10-03):** **Built, not yet live-verified.** At the user's direction (goal: "finish the phase"), Phase 4 was implemented on branch `phase4-escrow` by building the new backend's money paths directly on the escrow v2 schema (`scripts/escrow-00{1,2}-*.sql`) and the escrow plan's design — release, payout and refund included — rather than porting the legacy app's half-migrated logic. That gives the port the stable target the original gate asked for. §1–2 below record the original assessment; §3 is what was built; §4 is what still has to happen before it carries real money.

This document records what the code shows today (`main` @ `ec32cd5`), what has to happen before Phase 4 can begin, and the port plan to run once it can.

> Scope note: this is based on reading the code only. Nobody has checked the live database from here — no CLI login or `DATABASE_URL` is available in this environment. Anything stated about live schema state is inferred from code that would fail if the schema weren't there.

---

## 1. Gate status — what the code shows

`docs/escrow-production-plan.md` still reads "Phase 1 in progress" (last edited 2026-05-25). The code says Phase 1 has mostly landed, and Phase 2 (the money paths) is only partly done:

| Escrow-plan item | State in the legacy app | Evidence |
|---|---|---|
| 1.1–1.3 v2 schema, state machine, kobo | **Likely applied live** | `/api/escrow/initialize`, `/api/escrow/verify` and `/api/paystack/webhook` read/write `escrow_deposits.status_v2`, `amount_kobo`, `escrow_events` and `webhook_events`; funding would fail in production if these didn't exist. Not verified against the DB. |
| 1.4 backfill + soak (dual-write) | **In soak** | `verify` and the webhook still dual-write `Funded_jobs101` via `lib/funded-jobs-sync.ts`. |
| 2.1 fund job | **Done on v2** | initialize → Paystack → webhook (signature-verified, deduped via `webhook_events`) → `status_v2='funded'` + `escrow_events` row. |
| 2.2 release on approval | **Not on v2** | `POST /api/submissions/[id]/approve` writes `Funded_jobs101.job_completed`, `jobs.payout_status='completed'` and the **legacy** `escrow_deposits.status`. It never moves `status_v2` to `released` and writes no `escrow_events`. There is no `/api/escrow/release`. |
| 2.3 locked-down payout | **Partial, off-model** | `POST /api/paystack/payout-freelancer` derives the amount server-side from `amount_kobo` and guards double-pay with a conditional update on `jobs.payout_status`. But it never touches the `payouts` table (created by `escrow-001`), and never moves `status_v2` to `paid_out`. The plan's `transfer.success`/`failed` webhook handling is missing. |
| 2.4 refund / dispute resolution | **Not on v2** | `POST /api/admin/disputes/[id]/resolve` splits the legacy float `escrow.balance` and credits **in-app wallets** via the `increment_user_wallet` RPC. It sets the legacy `status` to `'confirmed'`/`'refunded'` and leaves `status_v2` untouched, so a resolved dispute stays `disputed` in the state machine. No Paystack refund call exists. `POST /api/disputes` likewise freezes funds through the legacy `status` column. |
| 3 RLS lockdown on escrow tables | **Unverified** | Policies are in `scripts/escrow-00*.sql`; whether they're live can't be checked from here. |
| Read paths | **Still on `Funded_jobs101`** | `/freelancer/funded-jobs`, `/agency/wallet` (plus `agency_fundings`), `/admin/transactions`, `/admin/analytics` all read the legacy table. |

**Conclusion:** escrow v2 is mid-flight. The legacy app's money logic is a mix of v1 and v2 state. Porting it into Express now would copy that inconsistency into a second codebase. That is exactly what the locked "no escrow routes in the new backend until v2 is finished" decision exists to prevent.

### Bugs found during this assessment (legacy app, live)

1. **"Mark done" always fails.** `app/agency/posts/PostsClient.tsx` calls `POST /api/paystack/mark-complete`, which does not exist and never has in git history. The button appears for every job with `funding_status === "funded"` and always errors. The real completion path is submission approval in the workspace. Fix: remove the button, or point it at the release path once 2.2 exists.
2. **Dispute resolution desyncs the state machine** (see 2.4 above): after a resolution, `status_v2` and the legacy `status` disagree.
3. **Dispute payouts are wallet credits, not money movement.** They use `escrow.balance` (legacy float column) rather than `amount_kobo`. This contradicts design principles 1 and 2 in `docs/escrow-production-plan.md`.

None of these are fixed here. Each one changes money behaviour and needs a product decision plus Paystack-sandbox testing.

---

## 2. What has to happen before Phase 4 (owner: escrow v2 work, Supabase + legacy app)

In order:

1. **Verify the live schema.** Confirm `escrow-001/002/003` are applied, the state-machine trigger is active, and the escrow RLS from plan §3 is live (`pg_policies` on `escrow_deposits`, `escrow_events`, `payouts`, `webhook_events`).
2. **2.2 Release on v2.** Approval transitions `status_v2: funded → released` through the trigger and writes an `escrow_events` row. Stop writing the legacy `status`.
3. **2.3 Payout on v2.** Write a `payouts` row per transfer, keyed by an idempotency key. Move `released → paid_out` from the Paystack `transfer.success` webhook. Handle `transfer.failed`/`reversed`.
4. **2.4 Refund / dispute on v2.** Opening a dispute moves `funded → disputed`. Resolution moves to `released` (payout) or `refunded` (Paystack refund API), with partial splits as payout + refund. Product decision needed: do in-app wallet credits remain at all?
5. **Move the read paths to v2** (`escrow_deposits` + `payouts` + `escrow_events`) and end the soak: stop writing `Funded_jobs101`, then drop it.
6. **Update `docs/escrow-production-plan.md`'s Status line.** That line is the gate the migration spec points to.

## 3. Phase 4 — what was built (branch `phase4-escrow`)

Following the established pattern: Express routes in `server/src/routes/escrow.ts` (+ tests with supertest), TanStack Query hooks in `client/src/lib/queries/escrow.ts`, pages ported per vertical.

| Step | Server (Express) | Client (SPA) | Notes |
|---|---|---|---|
| 4a Webhooks | `POST /api/webhooks/paystack` — single handler; **raw-body** HMAC-SHA512 signature check (mount `express.raw()` on this route before `express.json()`); dedupe via `webhook_events`; service-role client only here | — | Consolidates the duplicated `paystack/webhook` + `credits/webhook` verification (spec §3). Point Paystack at it only at cutover. |
| 4b Funding | `POST /api/escrow/initialize`, `GET /api/escrow/verify` | "Fund job" in `ProposalsModal` (lazy Paystack script, per spec risk note) | Re-add the action deliberately omitted from `/agency/posts`. |
| 4c Release | `POST /api/escrow/release` (agency owns job; `status_v2='funded'`; submission exists) | `/workspace/:jobId` submissions + approve | Port `project_submissions` / `submission_comments` routes alongside. |
| 4d Payout | `POST /api/payouts/request` (caller is the escrow's freelancer; `status_v2='released'`; no active payout; amount = `amount_kobo × (1 − fee)`; idempotency key) | `/freelancer/funded-jobs` | Bank details / recipient routes come with it. |
| 4e Disputes | `POST /api/disputes`, `POST /api/admin/disputes/:id/resolve` (admin: `role` **or** `account_type`) | `/disputes/:id`, `/admin/disputes` | Realtime `dispute_messages` channel re-subscribed client-side. |
| 4f Read views | `GET /api/agency/wallet`, `GET /api/admin/transactions`, `GET /api/admin/analytics` (from `escrow_deposits`/`payouts`, kobo) | `/agency/wallet`, `/admin/transactions`, `/admin/analytics` | Analytics was reclassified ⛔ on 2026-10-03 for exactly this reason. |

Each step must ship with: supertest coverage of auth/ownership/state-guard/idempotency branches, a webhook replay test (same event twice → one effect), and a Paystack **test-mode** end-to-end run before the step merges. Never derive an amount from the request body.

Server (`server/src`): `lib/escrow.ts` (guarded transitions + `escrow_append_event`, legacy `status` mirroring, `Funded_jobs101` soak sync, kobo fee math), `lib/paystack.ts` (timing-safe HMAC, strict API wrapper), `lib/payouts.ts`; routes `webhooks.ts`, `escrow.ts`, `submissions.ts`, `payouts.ts`, `disputes.ts`, `adminEscrow.ts`. Client (`client/src`): `lib/queries/escrow.ts`, pages FundedJobs, Wallet, EscrowReturn, Workspace, DisputeRoom, admin Transactions/Analytics/Disputes, "Fund job" in `ProposalsModal`. Tests: server lib + route suites using `src/test/fakeSupabase.ts`; client page suites.

Deliberate differences from the legacy app: identities are never taken from request bodies; the admin transactions page has no flag-toggling "mark done / process payout" actions; partial dispute release returns 422 (no v2 representation yet); the legacy "credits webhook" (really the v1 `dep_` deposit confirmation) is not ported.

## 4. Go-live gates (must all pass before the new money paths handle real money)

1. **Run the server test suite** (`cd server && npx vitest run`). It was blocked by the session's permission checker when this was built: every lib/route suite except `routes/disputes.test.ts` was run individually and passed; `disputes.test.ts` has not been run.
2. **Verify the live schema** — paste `scripts/go-live-check.sql` (read-only) into Supabase Studio; Part A covers this gate and the three security migrations. The code depends on: `escrow-001/002` applied (`status_v2`, `amount_kobo`, `escrow_events`, `payouts`, `webhook_events`, the transition trigger, the `escrow_append_event` function); `escrow_deposits.paystack_access_code`; `freelancer_bank_details`; RLS letting participants read `escrow_deposits`/`project_submissions`/`disputes`.
3. **Paystack test mode end to end:** fund → `charge.success` webhook → submit → approve → payout (`/transferrecipient` + `/transfer`; Transfers enabled, OTP off) → `transfer.success`; a failed transfer and a retry; a dispute refund. Replay each webhook to confirm dedupe.
4. **Webhook cutover.** Paystack has one webhook URL. While it points at the legacy app, its handler also confirms the new app's funding (it matches the `escrow_` prefix), but it ignores `transfer.*`, so payouts requested from the new app would sit in `processing`. Do not enable new-app payouts until the webhook points at `<server>/api/webhooks/paystack`. Once it does, legacy-initiated transfers (reference `payout_<jobId>`) won't map to a `payouts` row; that's harmless, because the legacy route sets `jobs.payout_status='paid'` synchronously.
5. **Reconcile legacy-approved escrows.** Jobs approved in the legacy app have `jobs.payout_status='completed'` but `status_v2` still `funded` (legacy approve never transitioned v2). The new app can't pay those out until they're moved to `released`. Preview with `scripts/go-live-check.sql` Part B rows 2–4, then apply `supabase/migrations/20261007000000_release_legacy_approved_escrows.sql` (idempotent; skips legacy payouts still in flight — re-run once they settle).
6. **Product decisions:** partial release; whether in-app wallet credits (legacy dispute path) survive; Paystack refund idempotency (a refund that succeeds but whose DB transition fails can't be retried through Paystack — needs a manual-intervention path per escrow plan §5.4).

## 5. Remaining Phase 7 prerequisites unrelated to escrow

From `docs/react-node-migration-parity-checklist.md` — owned by the user, in Supabase Studio:

- Apply `supabase/migrations/20260926000000_lock_down_purchase_credits_writes.sql`, `20261003000000_lock_down_freelancer_verification_writes.sql` (confirm the external KYC service writes with the service role first) and `20261003010000_freelancer_verification_unique_nin.sql`.
- Add `/reset-password` (and `/freelancer/reset-password`) to Auth → Redirect URLs, then test one real recovery email.
