# Credits-Verify Security Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close two standing, user-acknowledged financial vulnerabilities in `POST /api/user/credits/verify`, found during Phase 3a's final review and parked pending a remediation decision: (1) a Paystack payment reference from an unrelated escrow/job-funding payment can be redeemed for credits; (2) `purchase_credits` has a client-writable RLS INSERT policy that lets a freelancer forge an arbitrary `credits_amount` directly via Supabase's API, bypassing this route entirely.

**Architecture:** `POST /api/user/credits/verify` gains a denylist check (via the service-role client) against `escrow_deposits.paystack_reference` and `Funded_jobs101.reference_id` before ever crediting a reference, and its own `purchase_credits` insert switches from the request-scoped client to the service-role client. A companion SQL migration drops `purchase_credits`' client-writable INSERT policy (every historical name it has ever had in this repo's ad hoc `scripts/` history) so the service-role client becomes the *only* way to write that table — closing the RLS bypass regardless of the route-level fix. **The SQL migration is committed to the repo but is NOT applied to the live database by this plan** — the user has chosen to apply it themselves via the Supabase Studio SQL editor, since this session has no live database credentials (no CLI login, no `DATABASE_URL`) to do it safely from here.

**Tech Stack:** Express 5 + TypeScript (server), Vitest + Supertest, raw SQL migration (Postgres/Supabase).

**Spec:** No dedicated spec document for this fix — it directly implements the remediation recorded in `docs/superpowers/plans/2026-09-21-*` (deleted, Phase 3a's own now-gone SDD ledger) and durably re-recorded in this session's memory (`react-node-migration-status.md`'s "OPEN, USER-ACKNOWLEDGED FINANCIAL SECURITY ISSUES" section) as Findings 1 and 2. The user selected: for Finding 1, the denylist approach (cheapest of three options identified in Phase 3a, versus a full server-initialized-transaction redesign); for Finding 2, yes to both the RLS drop and the service-role insert switch, with the RLS drop applied by the user themselves.

## Global Constraints

- Money is stored as `bigint` kobo everywhere in this codebase; this fix introduces no new money-unit conversions — it only gates *whether* a credit is minted, not how much.
- The service-role client (`createServiceClient()`) is this codebase's established boundary for "system write/read after server-side verification" — both new uses in this fix (denylist reads, `purchase_credits` insert) match that convention exactly, matching how `server/src/routes/admin.ts` and `server/src/routes/influencer.ts` already use it.
- `POST /api/user/credits/verify`'s existing behavior (Paystack verification, amount/currency checks, server-derived `credits_amount`, duplicate-reference 23505 handling) is UNCHANGED by this fix except for where noted — do not refactor unrelated parts of the route.
- The SQL migration must be **idempotent** (`DROP POLICY IF EXISTS` for every historical policy name) since which of the three historical iterations of this table's RLS is actually live cannot be determined from this repo's ad hoc `scripts/` history alone (three different scripts created three different-but-overlapping policy sets over time: `create-credits-system-tables.sql`, `create-credits-system-tables-v2.sql`, `fix-credits-function-conflict.sql`/`reset-and-migrate.sql`) — verified by grep, exactly two distinct INSERT-policy names have ever existed: `"Freelancers can insert own credit purchases"` and `"Users can insert own credit purchases"`.
- The migration file lives in `supabase/migrations/` (this repo's CLI-convention directory for real, checked-in schema/RLS, distinct from `scripts/`'s ad hoc history) — matching where `influencer_referral_program`, `admin_audit_log`, and `job_moderation`'s migrations already live.
- Do not attempt to apply the migration to the live database from this session — no live DB credentials are available here, and the user has chosen to apply it themselves.

## Review Focus

- A reference that matches an `escrow_deposits` row must be rejected even though the deposit itself is completely untouched (no write to `escrow_deposits`, no state-machine transition) — the fix is purely a read-then-reject gate on the credits route.
- A reference that matches a legacy `Funded_jobs101` row must be rejected the same way — this is the manual-reference funding path, a second table entirely, and both must be checked.
- A reference that matches NEITHER table must still succeed exactly as before (regression: the fix must not accidentally reject legitimate credits purchases).
- The already-existing "reference already used" 23505 duplicate-key path (on `purchase_credits` itself) must still work identically after the insert moves to the service-role client — a service-role insert still hits the same UNIQUE constraint and returns the same Postgres error code.
- The denylist check must run for every code path that reaches it (i.e., after Paystack verification succeeds and amount/currency match, before the insert) — not skippable via any request shape.

## Amendment (after Task 1's final whole-branch review)

Task 1 merged its own final review with 2 Critical, 2 Important findings, both Criticals independently verified against the live legacy codebase before any further work:

- **C1 (verified):** the still-live production Next.js app also writes to `purchase_credits`, via `createRouteHandlerClient` (session-scoped, RLS-bound) — NOT the service-role client. Applying Task 1's migration as originally written would break real users' credit purchases immediately.
- **C2 (verified):** the original migration only dropped the INSERT policy; two UPDATE policies remain, which is the same bypass class Finding #2 was about (a freelancer can still `PATCH` their own row directly via PostgREST). Also compounds C1 — a legacy route depends on client-writable UPDATE too.
- **I1/I2 (plausible, addressed below):** the Express route's denylist fails open on a lookup error, and misses a third table, `Paystack_data`, that also holds funding references.

The user, presented with this, chose: (1) also patch the legacy Next.js routes so the live vulnerability is actually closed today, not just the not-yet-live Express route; (2) fix I1 and I2 too.

**Further research** (by the controller, directly against the legacy codebase) found the live legacy attack surface is worse than Task 1's final review described: `app/api/verify-transaction/route.ts` — confirmed as THE live top-up path via `components/topit-modal.tsx:102` — takes `user_id` and `credits_amount` directly from the client request body with **zero server-side derivation**, and its only "denylist" check is implemented client-side in `topit-modal.tsx` (trivially bypassable by calling the API directly). This is a more direct vulnerability than the reference-reuse issue alone: a client can claim any `credits_amount` for any real (even unrelated) successful transaction.

Every file in the legacy app referencing `purchase_credits` was enumerated and checked for (a) whether it's reachable from any live UI code, and (b) what Supabase client it uses:

| File | Live? | Client | Action |
|---|---|---|---|
| `app/api/verify-transaction/route.ts` | **Yes** — called by `components/topit-modal.tsx:102` | session-scoped (`createRouteHandlerClient`) | **Task 3: full rewrite** |
| `app/api/credits/verify-payment/route.ts` | **Yes** — called by `app/credits/verify/page.tsx:33` | session-scoped | **Task 4: service-role + denylist** |
| `app/actions/user.ts` | Yes, but read-only (`.select` only, line 18) | n/a | No action needed |
| `app/api/credits/verify-credits/route.ts` | No caller found in `app/`/`components/`/`lib/` | session-scoped | Left untouched (see below) |
| `app/credits/verify-credits/route.ts` | No caller found | session-scoped | Left untouched |
| `app/api/credits/initialize-payment/route.ts` | No caller found | session-scoped | Left untouched |
| `app/api/paystack/initialize-payment/route.ts` | No caller found | session-scoped | Left untouched |
| `app/api/credits/welcome-bonus/route.ts` | No caller found; welcome credits appear to actually be granted by a `SECURITY DEFINER` DB trigger (`scripts/create-welcome-credits-trigger.sql`, fires inside `handle_new_user`, bypasses RLS as the function owner) — this route looks superseded | anon client (`lib/supabase.ts`, unusual for a server route) | Left untouched |
| `app/api/credits/webhook/route.ts`, `app/api/paystack/webhook/route.ts` | N/A | N/A | Confirmed via grep: neither references `purchase_credits` at all (an earlier review pass's claim about the credits webhook touching this table was checked and does not hold) |

**Ruling:** patch only the two confirmed-live routes (Tasks 3-4). The five apparently-orphaned routes are left untouched — patching genuinely unreachable code adds review/maintenance surface for zero security benefit, and deleting dead code is a separate decision the user hasn't asked for. This table is the durable record of that decision; if any of these routes turns out to have a caller this research missed, re-open this finding.

**This changes the migration's risk profile favorably.** Once Tasks 3-4 switch both live legacy writers to the service-role client, `purchase_credits`' RLS policies (INSERT and UPDATE alike) become genuinely dead weight — no live code depends on them anymore. Task 5 revises the migration to drop both INSERT and UPDATE policies (closing C2 for real) and removes the "hold until cutover" caveat, since after Tasks 3-4 there is no longer an ordering dependency — **but Tasks 3-4 must land before Task 5's migration is applied to the live database**, since until then the legacy routes still depend on those policies. The migration itself is still not applied by this plan; the user applies it via Supabase Studio, now after Tasks 3-4 are merged.

**New Global Constraints for Tasks 2-5:**
- The legacy Next.js app (`app/`) has **no automated test suite** (per `CLAUDE.md`) — Tasks 3-4 cannot be verified with `vitest`. Verification is `npx tsc --noEmit` from the repo root (a `tsconfig.json` exists there) plus careful manual trace of every code path by both the implementer and the task reviewer. Treat this as raising the review bar, not lowering it — there's no test safety net.
- `app/api/verify-transaction/route.ts`'s rewrite drops `user_id` and `credits_amount` from the trusted request body entirely (derives both server-side instead: `user.id` from the authenticated session via `supabase.auth.getUser()`, `credits_amount` from the verified Paystack kobo amount). The client (`components/topit-modal.tsx`) is **not modified** — it can keep sending the now-ignored `user_id`/`credits_amount` fields harmlessly, and its own client-side denylist check (lines 76-97) is left in place as friendly, fail-fast UX; the route's own server-side check is what actually enforces the security property now, independent of the client.
- `app/api/credits/verify-payment/route.ts`'s rewrite adds `.eq("freelancer_id", user.id)` to its purchase-record lookup — a genuine hardening (the original route completed a pending purchase found by reference alone, with no check that the caller is the same person who initiated it).
- Both legacy route rewrites use `createServiceRoleClient()` from `lib/supabase-service.ts` (the Next.js app's own established service-role helper — see `CLAUDE.md`'s client-boundary rule), not the Express server's `createServiceClient()` (a different file in a different package).
- The denylist check added to both legacy routes and the Express route (Task 2) checks `escrow_deposits.paystack_reference`, `Funded_jobs101.reference_id`, AND `Paystack_data.reference` (three tables, not two) — and fails closed (500) on any lookup `.error`, not just checking `.data`.

---

### Task 1: Server — denylist check + service-role insert in `POST /api/user/credits/verify`

**Files:**
- Modify: `server/src/routes/user.ts`
- Modify: `server/src/routes/user.test.ts`
- Create: `supabase/migrations/20260926000000_lock_down_purchase_credits_insert.sql`

**Interfaces:**
- Consumes: `createServiceClient()` from `server/src/lib/supabase.ts` (existing, already used by `admin.ts`/`influencer.ts`).
- Produces: no new exports — this is a behavior-only change to an existing route. The route's response shape is unchanged except for one new possible error body: `{ success: false, error: "This payment reference cannot be used for credits" }` with HTTP 400.

- [ ] **Step 1: Write the failing tests for the denylist check**

Edit `server/src/routes/user.test.ts`. First, add this near the top of the file, right after the existing imports (Vitest hoists `vi.mock` calls automatically, so placement relative to other code doesn't matter, but keep it visually grouped with the imports):

```ts
const fakeService = { from: vi.fn() }
vi.mock("../lib/supabase.js", () => ({ createServiceClient: () => fakeService }))
```

Then replace the ENTIRE existing `describe("POST /credits/verify", ...)` block (currently lines 81-198) with this:

```ts
describe("POST /credits/verify", () => {
  const validVerifyBody = { reference: "ref-123", amount: 500 }

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  beforeEach(() => {
    fakeService.from = vi.fn()
  })

  function mockService({
    escrowMatch = null,
    fundedJobMatch = null,
    insertResult = { data: null, error: null },
  }: {
    escrowMatch?: { id: string } | null
    fundedJobMatch?: { id: string } | null
    insertResult?: { data: any; error: any }
  } = {}) {
    const insertMock = vi.fn(() => ({ select: vi.fn(() => ({ single: vi.fn().mockResolvedValue(insertResult) })) }))
    fakeService.from = vi.fn((table: string) => {
      if (table === "escrow_deposits") {
        return { select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn().mockResolvedValue({ data: escrowMatch, error: null }) })) })) }
      }
      if (table === "Funded_jobs101") {
        return { select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn().mockResolvedValue({ data: fundedJobMatch, error: null }) })) })) }
      }
      if (table === "purchase_credits") return { insert: insertMock }
      throw new Error(`unexpected service table ${table}`)
    })
    return insertMock
  }

  function mockFetch(data: { status: string; amount: number; currency: string }) {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ status: true, data }) })
    )
  }

  it("returns 400 when reference or amount is missing or the wrong type", async () => {
    const supabase = { from: vi.fn() }
    const res = await request(appWith({ id: "user-1" }, supabase)).post("/credits/verify").send({ reference: "ref-123" })
    expect(res.status).toBe(400)
    expect(supabase.from).not.toHaveBeenCalled()
    expect(fakeService.from).not.toHaveBeenCalled()
  })

  it("verifies with Paystack, inserts a completed purchase scoped to the caller, and returns success", async () => {
    mockFetch({ status: "success", amount: 50000, currency: "NGN" })
    const insertedRow = { id: "p-1", amount: 500, credits_amount: 10, status: "completed", created_at: "2026-01-01T00:00:00Z", paystack_reference: "ref-123" }
    const insertMock = mockService({ insertResult: { data: insertedRow, error: null } })
    const supabase = { from: vi.fn() }

    const res = await request(appWith({ id: "user-1" }, supabase)).post("/credits/verify").send(validVerifyBody)

    expect(fetch).toHaveBeenCalledWith(
      "https://api.paystack.co/transaction/verify/ref-123",
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: expect.stringContaining("Bearer") }) })
    )
    expect(insertMock).toHaveBeenCalledWith({
      freelancer_id: "user-1",
      amount: 500,
      credits_amount: 10,
      paystack_reference: "ref-123",
      status: "completed",
    })
    expect(supabase.from).not.toHaveBeenCalled()
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ success: true, credits_added: 10, purchase: insertedRow })
  })

  it("ignores a client-supplied credits_amount and derives it from the verified Paystack kobo amount instead", async () => {
    mockFetch({ status: "success", amount: 50000, currency: "NGN" })
    const insertedRow = { id: "p-1", amount: 500, credits_amount: 10, status: "completed", created_at: "2026-01-01T00:00:00Z", paystack_reference: "ref-123" }
    const insertMock = mockService({ insertResult: { data: insertedRow, error: null } })

    const res = await request(appWith({ id: "user-1" }, { from: vi.fn() }))
      .post("/credits/verify")
      .send({ reference: "ref-123", amount: 500, credits_amount: 999999 })

    expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({ credits_amount: 10 }))
    expect(res.body.credits_added).toBe(10)
  })

  it("returns 400 when Paystack reports the transaction as not successful", async () => {
    mockFetch({ status: "failed", amount: 50000, currency: "NGN" })
    mockService()

    const res = await request(appWith({ id: "user-1" }, { from: vi.fn() })).post("/credits/verify").send(validVerifyBody)

    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
    expect(fakeService.from).not.toHaveBeenCalled()
  })

  it("returns 400 when the paid amount doesn't match Paystack's recorded amount", async () => {
    mockFetch({ status: "success", amount: 10000, currency: "NGN" })
    mockService()

    const res = await request(appWith({ id: "user-1" }, { from: vi.fn() })).post("/credits/verify").send(validVerifyBody)

    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
    expect(fakeService.from).not.toHaveBeenCalled()
  })

  it("returns 400 with a clear message when the reference was already used", async () => {
    mockFetch({ status: "success", amount: 50000, currency: "NGN" })
    mockService({ insertResult: { data: null, error: { code: "23505", message: "duplicate key" } } })

    const res = await request(appWith({ id: "user-1" }, { from: vi.fn() })).post("/credits/verify").send(validVerifyBody)

    expect(res.status).toBe(400)
    expect(res.body).toEqual({ success: false, error: "This reference has already been used" })
  })

  it("rejects a reference that already belongs to an escrow deposit", async () => {
    mockFetch({ status: "success", amount: 50000, currency: "NGN" })
    const insertMock = mockService({ escrowMatch: { id: "escrow-1" } })

    const res = await request(appWith({ id: "user-1" }, { from: vi.fn() })).post("/credits/verify").send(validVerifyBody)

    expect(res.status).toBe(400)
    expect(res.body).toEqual({ success: false, error: "This payment reference cannot be used for credits" })
    expect(insertMock).not.toHaveBeenCalled()
  })

  it("rejects a reference that already belongs to a legacy Funded_jobs101 row", async () => {
    mockFetch({ status: "success", amount: 50000, currency: "NGN" })
    const insertMock = mockService({ fundedJobMatch: { id: "job-1" } })

    const res = await request(appWith({ id: "user-1" }, { from: vi.fn() })).post("/credits/verify").send(validVerifyBody)

    expect(res.status).toBe(400)
    expect(res.body).toEqual({ success: false, error: "This payment reference cannot be used for credits" })
    expect(insertMock).not.toHaveBeenCalled()
  })
})
```

Note: this rewrite adds `beforeEach` to the file's existing import line — `server/src/routes/user.test.ts:1` currently reads `import { describe, it, expect, vi, afterEach } from "vitest"`; add `beforeEach` to that import list.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd server && npx vitest run src/routes/user.test.ts`
Expected: FAIL — `createServiceClient` is not yet imported/used in `user.ts`, and the denylist queries don't exist yet, so `fakeService.from` assertions and the two new "rejects a reference" tests fail; the pre-existing tests that expect the insert through `req.supabase` also now fail since the mock setup changed to expect it through `fakeService`.

- [ ] **Step 3: Implement the denylist check and service-role insert**

Edit `server/src/routes/user.ts`. Add this import near the top, alongside the existing imports:

```ts
import { createServiceClient } from "../lib/supabase.js"
```

Then replace the body of the `POST /credits/verify` handler (currently lines 109-178) with:

```ts
userRouter.post(
  "/credits/verify",
  asyncHandler(async (req, res) => {
    const { reference, amount } = req.body ?? {}
    if (typeof reference !== "string" || !reference.trim() || typeof amount !== "number") {
      res.status(400).json({ success: false, error: "reference and amount are required" })
      return
    }

    const verifyRes = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` },
    })
    const verifyData = (await verifyRes.json()) as {
      status: boolean
      data?: { status: string; amount: number; currency: string }
    }

    if (!verifyRes.ok || verifyData.status === false || !verifyData.data) {
      res.status(400).json({ success: false, error: "Transaction verification failed" })
      return
    }

    const transaction = verifyData.data
    if (transaction.status !== "success") {
      res.status(400).json({ success: false, error: "Transaction not successful" })
      return
    }

    const expectedAmountKobo = Math.round(amount * 100)
    if (transaction.amount !== expectedAmountKobo) {
      res.status(400).json({ success: false, error: "Transaction amount does not match" })
      return
    }

    if (transaction.currency !== "NGN") {
      res.status(400).json({ success: false, error: "Invalid transaction currency" })
      return
    }

    // Reject a reference that already belongs to an escrow/job-funding
    // payment. This Paystack merchant account also processes escrow
    // deposits, and a freelancer can read their own job's paystack_reference
    // via existing RLS -- without this check, that same, already-spent
    // payment would also mint credits here.
    const service = createServiceClient()
    const [escrowMatch, fundedJobMatch] = await Promise.all([
      service.from("escrow_deposits").select("id").eq("paystack_reference", reference).maybeSingle(),
      service.from("Funded_jobs101").select("id").eq("reference_id", reference).maybeSingle(),
    ])
    if (escrowMatch.data || fundedJobMatch.data) {
      res.status(400).json({ success: false, error: "This payment reference cannot be used for credits" })
      return
    }

    // Derive credits from the Paystack-verified kobo amount server-side --
    // never trust a client-supplied credits_amount, which could claim any
    // value regardless of what was actually paid.
    const CREDITS_RATE_KOBO = 5000 // ₦50 per credit
    const credits_amount = Math.floor(transaction.amount / CREDITS_RATE_KOBO)

    const { data, error } = await service
      .from("purchase_credits")
      .insert({
        freelancer_id: req.user!.id,
        amount,
        credits_amount,
        paystack_reference: reference,
        status: "completed",
      })
      .select()
      .single()

    if (error) {
      if (error.code === "23505") {
        res.status(400).json({ success: false, error: "This reference has already been used" })
        return
      }
      console.error("purchase_credits insert error:", error)
      res.status(500).json({ success: false, error: "Failed to save purchase record" })
      return
    }

    res.json({ success: true, credits_added: credits_amount, purchase: data })
  })
)
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd server && npx vitest run src/routes/user.test.ts`
Expected: PASS (all tests in the file, including the rewritten `POST /credits/verify` block — 9 tests in that block).

- [ ] **Step 5: Run the full server suite and typecheck**

Run: `cd server && npx vitest run` and `cd server && npx tsc --noEmit`
Expected: full suite passes; typecheck clean (or only the one pre-existing, unrelated error at `src/routes/user.test.ts:230` if it still exists at a different line number after this edit — confirm by diffing against `git show HEAD:server/src/routes/user.test.ts` if anything unexpected shows up).

- [ ] **Step 6: Commit the route + test changes**

```bash
git add server/src/routes/user.ts server/src/routes/user.test.ts
git commit -m "fix(server): reject escrow/job-funding references in credits/verify, insert via service role"
```

- [ ] **Step 7: Write the RLS migration**

Create `supabase/migrations/20260926000000_lock_down_purchase_credits_insert.sql`:

```sql
-- ============================================================
-- Security fix: lock down purchase_credits' client-writable INSERT policy
--
-- purchase_credits had an RLS INSERT policy letting any authenticated
-- freelancer write a row directly via Supabase's PostgREST API --
-- including an arbitrary credits_amount -- completely bypassing
-- POST /api/user/credits/verify's server-side derivation of credits_amount
-- from the Paystack-verified payment amount. fetchCredits sums
-- credits_amount over status='completed' with no other gate, so a forged
-- row immediately inflates the visible balance.
--
-- This repo's ad hoc scripts/ directory recreated this table's RLS three
-- times over its history, under two different INSERT-policy names
-- (create-credits-system-tables.sql / -v2.sql used one name;
-- fix-credits-function-conflict.sql and reset-and-migrate.sql used
-- another) -- drop both by name so this migration is correct regardless
-- of which iteration is actually live. IF EXISTS makes either DROP a
-- no-op if that particular name was never created.
--
-- After this migration, the ONLY way to write purchase_credits is via the
-- service-role client -- matching /api/user/credits/verify's insert,
-- which was switched to createServiceClient() in the same fix (see
-- server/src/routes/user.ts).
-- ============================================================

DROP POLICY IF EXISTS "Freelancers can insert own credit purchases" ON public.purchase_credits;
DROP POLICY IF EXISTS "Users can insert own credit purchases" ON public.purchase_credits;
```

- [ ] **Step 8: Commit the migration file**

```bash
git add supabase/migrations/20260926000000_lock_down_purchase_credits_insert.sql
git commit -m "fix(db): drop purchase_credits' client-writable INSERT policy"
```

Note: do NOT run this migration against the live database as part of this task. The user has chosen to apply it themselves via the Supabase Studio SQL editor.

---

### Task 2: Server — fail-closed denylist + third table (`Paystack_data`) in the Express route

**Files:**
- Modify: `server/src/routes/user.ts`
- Modify: `server/src/routes/user.test.ts`

**Interfaces:**
- Consumes: `createServiceClient()` (existing, already imported by Task 1).
- Produces: no new exports. One new possible response, unchanged shape: `{ success: false, error: "Failed to verify payment reference" }` with HTTP 500 when a denylist lookup itself errors.

- [ ] **Step 1: Write the failing tests**

Edit `server/src/routes/user.test.ts`. Update the `mockService` helper inside the `describe("POST /credits/verify", ...)` block (added in Task 1) to this:

```ts
  function mockService({
    escrowMatch = null,
    fundedJobMatch = null,
    paystackDataMatch = null,
    denylistError = null,
    insertResult = { data: null, error: null },
  }: {
    escrowMatch?: { id: string } | null
    fundedJobMatch?: { id: string } | null
    paystackDataMatch?: { id: string } | null
    denylistError?: { message: string; code?: string } | null
    insertResult?: { data: any; error: any }
  } = {}) {
    const insertMock = vi.fn(() => ({ select: vi.fn(() => ({ single: vi.fn().mockResolvedValue(insertResult) })) }))
    fakeService.from = vi.fn((table: string) => {
      if (table === "escrow_deposits") {
        return { select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn().mockResolvedValue({ data: escrowMatch, error: denylistError }) })) })) }
      }
      if (table === "Funded_jobs101") {
        return { select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn().mockResolvedValue({ data: fundedJobMatch, error: denylistError }) })) })) }
      }
      if (table === "Paystack_data") {
        return { select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn().mockResolvedValue({ data: paystackDataMatch, error: denylistError }) })) })) }
      }
      if (table === "purchase_credits") return { insert: insertMock }
      throw new Error(`unexpected service table ${table}`)
    })
    return insertMock
  }
```

(This is a drop-in replacement for the existing `mockService` function — same name, same call sites in the existing tests keep working since every new parameter has a default.)

Then add these two tests at the end of the `describe("POST /credits/verify", ...)` block, right before its closing `})`:

```ts
  it("rejects a reference that already belongs to a Paystack_data funding record", async () => {
    mockFetch({ status: "success", amount: 50000, currency: "NGN" })
    const insertMock = mockService({ paystackDataMatch: { id: "pd-1" } })

    const res = await request(appWith({ id: "user-1" }, { from: vi.fn() })).post("/credits/verify").send(validVerifyBody)

    expect(res.status).toBe(400)
    expect(res.body).toEqual({ success: false, error: "This payment reference cannot be used for credits" })
    expect(insertMock).not.toHaveBeenCalled()
  })

  it("fails closed with a 500 when the denylist lookup itself errors, without attempting the insert", async () => {
    mockFetch({ status: "success", amount: 50000, currency: "NGN" })
    const insertMock = mockService({ denylistError: { message: "connection reset", code: "PGRST116" } })

    const res = await request(appWith({ id: "user-1" }, { from: vi.fn() })).post("/credits/verify").send(validVerifyBody)

    expect(res.status).toBe(500)
    expect(res.body).toEqual({ success: false, error: "Failed to verify payment reference" })
    expect(insertMock).not.toHaveBeenCalled()
  })
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd server && npx vitest run src/routes/user.test.ts`
Expected: FAIL — the route doesn't query `Paystack_data` yet and doesn't check `.error` on the denylist lookups yet.

- [ ] **Step 3: Update the route**

Edit `server/src/routes/user.ts`. Replace the denylist block (added in Task 1) with:

```ts
    // Reject a reference that already belongs to an escrow/job-funding
    // payment. This Paystack merchant account also processes escrow
    // deposits and manual job-funding references, and a freelancer can
    // read their own job's reference via existing RLS -- without this
    // check, that same, already-spent payment would also mint credits here.
    const service = createServiceClient()
    const [escrowMatch, fundedJobMatch, paystackDataMatch] = await Promise.all([
      service.from("escrow_deposits").select("id").eq("paystack_reference", reference).maybeSingle(),
      service.from("Funded_jobs101").select("id").eq("reference_id", reference).maybeSingle(),
      service.from("Paystack_data").select("id").eq("reference", reference).maybeSingle(),
    ])
    if (escrowMatch.error || fundedJobMatch.error || paystackDataMatch.error) {
      console.error("credits/verify denylist check failed:", escrowMatch.error || fundedJobMatch.error || paystackDataMatch.error)
      res.status(500).json({ success: false, error: "Failed to verify payment reference" })
      return
    }
    if (escrowMatch.data || fundedJobMatch.data || paystackDataMatch.data) {
      res.status(400).json({ success: false, error: "This payment reference cannot be used for credits" })
      return
    }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd server && npx vitest run src/routes/user.test.ts`
Expected: PASS (10 tests in the `POST /credits/verify` block: the 8 from Task 1 plus these 2).

- [ ] **Step 5: Run the full server suite and typecheck**

Run: `cd server && npx vitest run` and `cd server && npx tsc --noEmit`
Expected: full suite passes; typecheck clean except the one pre-existing, unrelated error (confirm by content, not line number, against `git show HEAD~1:server/src/routes/user.test.ts` if the line number has shifted again).

- [ ] **Step 6: Commit**

```bash
git add server/src/routes/user.ts server/src/routes/user.test.ts
git commit -m "fix(server): fail closed on denylist errors, check Paystack_data too"
```

---

### Task 3: Legacy — `app/api/verify-transaction/route.ts` full rewrite

**Files:**
- Modify: `app/api/verify-transaction/route.ts`

**Interfaces:**
- Consumes: `createServiceRoleClient()` from `lib/supabase-service.ts` (existing).
- Produces: no new exports. Request body shape narrows from `{ user_id, reference, credits_amount, amount }` to `{ reference, amount }` (extra fields sent by the still-unmodified client are simply ignored, not an error). Response shape unchanged on success; one new possible error, matching Task 2's Express route: `{ error: "Failed to verify payment reference" }` with HTTP 500.

- [ ] **Step 1: Replace the route's full contents**

Replace `app/api/verify-transaction/route.ts` in full with:

```ts
import { NextResponse } from "next/server"
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import { createServiceRoleClient } from "@/lib/supabase-service"

const CREDITS_RATE_KOBO = 5000 // ₦50 per credit

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { reference, amount } = await req.json()

    if (!reference || typeof amount !== "number") {
      return NextResponse.json({ error: "Missing reference or amount" }, { status: 400 })
    }

    // Verify transaction with Paystack
    const verifyRes = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
      },
    })

    const verifyData = await verifyRes.json()

    if (!verifyRes.ok || verifyData.status === false) {
      return NextResponse.json({ error: "Transaction verification failed", details: verifyData }, { status: 400 })
    }

    const transaction = verifyData.data

    if (transaction.status !== "success") {
      return NextResponse.json({ error: "Transaction not successful" }, { status: 400 })
    }

    // Check that the amount matches (Paystack amounts are in kobo: ₦ 1 = 100 kobo)
    const expectedAmountKobo = Math.round(Number(amount) * 100)
    if (transaction.amount !== expectedAmountKobo) {
      return NextResponse.json({ error: "Transaction amount does not match" }, { status: 400 })
    }

    // Optional: check currency is Nigerian Naira
    if (transaction.currency !== "NGN") {
      return NextResponse.json({ error: "Invalid transaction currency" }, { status: 400 })
    }

    // Reject a reference that already belongs to an escrow/job-funding
    // payment. This Paystack merchant account also processes escrow
    // deposits and manual job-funding references, and a freelancer can
    // read their own job's reference via existing RLS -- without this
    // check, that same, already-spent payment would also mint credits here.
    const service = createServiceRoleClient()
    const [escrowMatch, fundedJobMatch, paystackDataMatch] = await Promise.all([
      service.from("escrow_deposits").select("id").eq("paystack_reference", reference).maybeSingle(),
      service.from("Funded_jobs101").select("id").eq("reference_id", reference).maybeSingle(),
      service.from("Paystack_data").select("id").eq("reference", reference).maybeSingle(),
    ])
    if (escrowMatch.error || fundedJobMatch.error || paystackDataMatch.error) {
      console.error("verify-transaction denylist check failed:", escrowMatch.error || fundedJobMatch.error || paystackDataMatch.error)
      return NextResponse.json({ error: "Failed to verify payment reference" }, { status: 500 })
    }
    if (escrowMatch.data || fundedJobMatch.data || paystackDataMatch.data) {
      return NextResponse.json({ error: "This payment reference cannot be used for credits" }, { status: 400 })
    }

    // Derive credits from the Paystack-verified kobo amount server-side --
    // never trust a client-supplied credits_amount, which could claim any
    // value regardless of what was actually paid.
    const credits_amount = Math.floor(transaction.amount / CREDITS_RATE_KOBO)

    // Insert via the service-role client -- purchase_credits' client-writable
    // INSERT/UPDATE policies are being retired (see the companion migration);
    // this route no longer depends on them, and the freelancer_id comes from
    // the authenticated session, never from the request body.
    const { data, error } = await service
      .from("purchase_credits")
      .insert([
        {
          freelancer_id: user.id,
          credits_amount,
          amount,
          paystack_reference: reference,
          status: "completed",
        },
      ])
      .select()

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json({ error: "This reference has already been used" }, { status: 400 })
      }
      console.error("Supabase insert error:", error)
      return NextResponse.json({ error: "Failed to save purchase record", details: error.message }, { status: 500 })
    }

    const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single()

    return NextResponse.json({
      message: "Transaction verified and credits added successfully",
      purchase: data,
      success: true,
      credits_added: credits_amount,
      profile,
    })
  } catch (err: any) {
    console.error("API error:", err)
    return NextResponse.json({ error: "Internal server error", details: err.message }, { status: 500 })
  }
}
```

- [ ] **Step 2: Typecheck**

Run (from the repo root, not `server/` or `client/`): `npx tsc --noEmit`
Expected: no new errors introduced by this file. This app's build ignores TypeScript errors (`next.config.mjs`), so this is the only automated check available — read the full diff once more after typechecking and manually trace: (a) every early return happens before the denylist check and the insert; (b) `user.id` (not any request-body field) is what's written as `freelancer_id`; (c) `credits_amount` is computed only from `transaction.amount`, never from the request body.

- [ ] **Step 3: Commit**

```bash
git add app/api/verify-transaction/route.ts
git commit -m "fix(legacy): derive credits_amount/user_id server-side, add denylist to verify-transaction"
```

---

### Task 4: Legacy — `app/api/credits/verify-payment/route.ts` service-role + denylist

**Files:**
- Modify: `app/api/credits/verify-payment/route.ts`

**Interfaces:**
- Consumes: `createServiceRoleClient()` from `lib/supabase-service.ts` (existing).
- Produces: no new exports. Response shape unchanged on success; one new possible error: `{ error: "Failed to verify payment reference" }` with HTTP 500; the existing 404 ("Purchase record not found") now also fires if the reference belongs to a different user's pending purchase, not just a nonexistent one — this is intentional (see the plan's Amendment section).

- [ ] **Step 1: Replace the route's full contents**

Replace `app/api/credits/verify-payment/route.ts` in full with:

```ts
import { type NextRequest, NextResponse } from "next/server"
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import { createServiceRoleClient } from "@/lib/supabase-service"

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const reference = searchParams.get("reference")
    console.log("🔍 Verifying credits payment - Reference:", reference)

    if (!reference) {
      return NextResponse.json({ error: "Payment reference is required" }, { status: 400 })
    }

    const cookieStore = await cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const service = createServiceRoleClient()

    // Find the purchase record first, scoped to the caller -- this route
    // only ever completes the caller's OWN pending purchase, never anyone
    // else's.
    const { data: purchaseRecord, error: purchaseError } = await service
      .from("purchase_credits")
      .select("*")
      .eq("paystack_reference", reference)
      .eq("freelancer_id", user.id)
      .single()

    if (purchaseError || !purchaseRecord) {
      console.error("❌ Purchase record not found:", purchaseError)
      return NextResponse.json({ error: "Purchase record not found" }, { status: 404 })
    }

    // If already processed, return success
    if (purchaseRecord.status === "completed") {
      console.log("✅ Payment already processed")
      return NextResponse.json({
        success: true,
        message: "Credits purchase completed successfully",
        credits_added: purchaseRecord.credits_amount,
        amount_paid: purchaseRecord.amount,
      })
    }

    // Reject a reference that already belongs to an escrow/job-funding
    // payment, mirroring the same check in /api/verify-transaction.
    const [escrowMatch, fundedJobMatch, paystackDataMatch] = await Promise.all([
      service.from("escrow_deposits").select("id").eq("paystack_reference", reference).maybeSingle(),
      service.from("Funded_jobs101").select("id").eq("reference_id", reference).maybeSingle(),
      service.from("Paystack_data").select("id").eq("reference", reference).maybeSingle(),
    ])
    if (escrowMatch.error || fundedJobMatch.error || paystackDataMatch.error) {
      console.error("verify-payment denylist check failed:", escrowMatch.error || fundedJobMatch.error || paystackDataMatch.error)
      return NextResponse.json({ error: "Failed to verify payment reference" }, { status: 500 })
    }
    if (escrowMatch.data || fundedJobMatch.data || paystackDataMatch.data) {
      return NextResponse.json({ error: "This payment reference cannot be used for credits" }, { status: 400 })
    }

    // Verify payment with Paystack
    const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY
    if (!PAYSTACK_SECRET_KEY) {
      console.error("PAYSTACK_SECRET_KEY is not set")
      return NextResponse.json({ error: "Payment service not configured" }, { status: 500 })
    }

    console.log("📡 Verifying with Paystack...")
    const paystackResponse = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
      },
    })
    const paystackData = await paystackResponse.json()
    console.log("📥 Paystack verification response:", paystackData)

    if (!paystackData.status || paystackData.data.status !== "success") {
      console.error("❌ Payment verification failed:", paystackData)
      return NextResponse.json({ error: "Payment verification failed" }, { status: 400 })
    }

    // Verify amount matches
    const paidAmount = paystackData.data.amount / 100 // Convert from kobo
    if (paidAmount !== purchaseRecord.amount) {
      console.error("❌ Amount mismatch:", { paid: paidAmount, expected: purchaseRecord.amount })
      return NextResponse.json({ error: "Payment amount mismatch" }, { status: 400 })
    }

    console.log("💳 Payment verified successfully, adding credits to user...")

    const freelancerId = purchaseRecord.freelancer_id

    // Mark the purchase complete via the service-role client -- purchase_credits'
    // client-writable UPDATE policy is being retired (see the companion
    // migration); this route no longer depends on it.
    const { error: statusError } = await service
      .from("purchase_credits")
      .update({ status: "completed" })
      .eq("id", purchaseRecord.id)
    if (statusError) {
      console.error("❌ Error updating purchase status:", statusError)
      return NextResponse.json({ error: "Failed to complete credits purchase" }, { status: 500 })
    }

    // Authoritative balance, derived from the ledger.
    const { data: ledgerRows } = await service
      .from("purchase_credits")
      .select("credits_amount")
      .eq("freelancer_id", freelancerId)
      .eq("status", "completed")
    const newBalance = (ledgerRows ?? []).reduce(
      (sum: number, row: any) => sum + (row.credits_amount || 0),
      0,
    )

    console.log("✅ Credits added successfully!")
    return NextResponse.json({
      success: true,
      message: "Credits purchase completed successfully",
      credits_added: purchaseRecord.credits_amount,
      amount_paid: purchaseRecord.amount,
      new_balance: newBalance,
    })
  } catch (error: any) {
    console.error("💥 Credits verification error:", error)
    return NextResponse.json(
      {
        error: "Payment verification failed",
        details: error.message,
      },
      { status: 500 },
    )
  }
}
```

- [ ] **Step 2: Typecheck**

Run (from the repo root): `npx tsc --noEmit`
Expected: no new errors introduced by this file. Manually trace: (a) the purchase-record lookup is scoped to both `paystack_reference` AND `freelancer_id: user.id`; (b) the denylist check runs before the Paystack verify call and before the status update; (c) both the status update and the balance read use `service`, not `supabase`.

- [ ] **Step 3: Commit**

```bash
git add app/api/credits/verify-payment/route.ts
git commit -m "fix(legacy): scope verify-payment to the caller, service-role update, add denylist"
```

---

### Task 5: Migration — drop both INSERT and UPDATE policies, remove the hold-until-cutover caveat

**Files:**
- Modify: `supabase/migrations/20260926000000_lock_down_purchase_credits_insert.sql` → rename to `supabase/migrations/20260926000000_lock_down_purchase_credits_writes.sql`

**Interfaces:**
- Consumes: nothing (pure SQL, no code interface).
- Produces: nothing consumed by other tasks — this is the last task in the plan.

- [ ] **Step 1: Rewrite and rename the migration file**

Delete `supabase/migrations/20260926000000_lock_down_purchase_credits_insert.sql` and create `supabase/migrations/20260926000000_lock_down_purchase_credits_writes.sql` with:

```sql
-- ============================================================
-- Security fix: lock down purchase_credits' client-writable INSERT/UPDATE
-- policies
--
-- purchase_credits previously let any authenticated freelancer INSERT or
-- UPDATE a row directly via PostgREST -- including an arbitrary
-- credits_amount on INSERT, or flipping status/credits_amount on UPDATE --
-- completely bypassing this codebase's server-side verification of
-- Paystack payments. fetchCredits sums credits_amount over
-- status='completed' with no other gate, so a forged or altered row
-- immediately changes the visible balance.
--
-- Safe to apply now: every LIVE writer of this table has been switched to
-- the service-role client and no longer depends on these policies --
-- the new Express server's POST /api/user/credits/verify, and the legacy
-- Next.js app's POST /api/verify-transaction and GET
-- /api/credits/verify-payment (the only two legacy routes with a live
-- caller in the current UI; several other legacy routes under
-- app/api/credits/ and app/api/paystack/ reference this table but have no
-- live caller and were deliberately left untouched -- see this plan's
-- Amendment section, and the react-node-migration-status memory, for the
-- full list).
--
-- This repo's ad hoc scripts/ directory recreated this table's RLS
-- multiple times over its history, under two different names each for
-- INSERT and for UPDATE -- drop every historical name so this migration
-- is correct regardless of which iteration is actually live. IF EXISTS
-- makes each DROP a no-op for a name that was never created.
-- ============================================================

DROP POLICY IF EXISTS "Freelancers can insert own credit purchases" ON public.purchase_credits;
DROP POLICY IF EXISTS "Users can insert own credit purchases" ON public.purchase_credits;
DROP POLICY IF EXISTS "System can update credit purchases" ON public.purchase_credits;
DROP POLICY IF EXISTS "Users can update own credit purchases" ON public.purchase_credits;
```

- [ ] **Step 2: Commit**

```bash
git rm supabase/migrations/20260926000000_lock_down_purchase_credits_insert.sql
git add supabase/migrations/20260926000000_lock_down_purchase_credits_writes.sql
git commit -m "fix(db): also drop purchase_credits' UPDATE policies, now safe post-Tasks-3-4"
```

Note: do NOT run this migration against the live database as part of this task. The user will apply it themselves via the Supabase Studio SQL editor, after Tasks 3-4 are merged (not before — the legacy routes still depend on the current policies until then).
