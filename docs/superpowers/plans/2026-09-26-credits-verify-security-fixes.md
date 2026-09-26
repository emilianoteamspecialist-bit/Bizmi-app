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
