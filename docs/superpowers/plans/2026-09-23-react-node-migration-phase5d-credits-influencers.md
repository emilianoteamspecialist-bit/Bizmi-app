# Phase 5d: Credits oversight + influencer program admin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `/admin/credits` (read-only oversight of freelancer credit purchases) and `/admin/influencers` (referral program oversight: acquisition stats, commission/fee settings, manual payout recording) — the fourth slice of Phase 5.

**Architecture:** Same conventions as Phase 5a/5b/5c. `GET /api/admin/credits` uses `req.supabase` (matching the legacy `app/admin/credits/page.tsx`'s own `createClient()` choice — see Global Constraints for the caveat this carries). `GET/POST /api/admin/influencers*` and `POST /api/admin/settings` all use `createServiceClient()` (matching legacy's own `createServiceRoleClient()` usage throughout `app/admin/influencers/page.tsx` and its two API routes) — required because these aggregate cross-user data (`influencer_profiles`, `referrals`, `app_settings` have RLS scoped to each row's own owner, not to admins).

**Tech Stack:** React 19, Vite, TanStack Query, React Router, Express, Supabase.

**Spec:** `docs/superpowers/specs/2026-09-08-nextjs-to-react-node-migration-design.md` (Phase 5 row). Fourth sub-plan of Phase 5 — builds on Phase 5a/5b/5c (`Tabs`, `Table`, `AdminSidebar`, `adminAudit.ts`'s `logAdminAction`), all merged to `main`.

## Global Constraints

- Admin authorization check is `profile.role === "admin" || profile.account_type === "admin"` — never just one field (`CLAUDE.md`). Self-review confirms no task below adds a new admin-identity check of its own (all routes mount behind the existing `requireAuth, requireAdmin` stack).
- **Known ambiguity, ported as-is, not a bug to fix here:** the legacy `app/admin/credits/page.tsx` reads `purchase_credits` and `profiles` via the cookie-aware client (`createClient()`), NOT the service-role client — unlike every other admin-oversight page in this codebase, which uses service-role for cross-user reads. This asymmetry may be a pre-existing gap in the legacy app (if `purchase_credits`' own RLS SELECT policy is scoped to `auth.uid() = freelancer_id`, an admin using the RLS-scoped client would see ONLY their own purchases, if any — making the ported page functionally broken for real oversight) or it may be fine (if `purchase_credits`/`profiles` have a broader read policy this migration hasn't found). **This migration's principle is to port existing behavior faithfully, not guess at fixes for uninvestigated ambiguities** — `GET /api/admin/credits` below uses `req.supabase`, exactly matching legacy. If someone with live Supabase access later confirms this page shows empty/wrong data for a real admin, that's a follow-up fix (switch to `createServiceClient()`), not something to speculatively "improve" now.
- `AdminCredits` and `AdminInfluencers` both use the plain `<div className="flex h-screen bg-surface"><AdminSidebar />...` layout, matching every admin page shipped so far.
- The influencer payout route's concurrency guard (`.eq("balance_unpaid_kobo", amountKobo)` on the zeroing update, so a payout can't race a fresh qualifying event) is load-bearing — preserve it exactly, don't simplify it to an unconditional update.
- `server/src/routes/admin.ts` and `server/src/routes/admin.test.ts` are modified by only ONE task in this plan (Task 1) even though it covers 4 distinct routes — this mirrors Phase 5c's Task 2, which combined 3 routes into one task specifically because they'd otherwise fight over the same shared `vi.hoisted` mock block in a 5-way-parallel-safe way. Splitting server route work across multiple parallel tasks touching the same two files is what caused Phase 5c's multi-way git tangle (documented in memory) — this plan avoids that from the start rather than relying on implementers to self-correct it.
- Per the updated git-race guidance (memory: "cap fully-parallel dispatch at 3-4 concurrent implementers"), this plan's tasks are structured so at most 4 run in parallel at once (Tasks 1-4), not 5+.

---

## Task 1: `GET /api/admin/credits`, `GET /api/admin/influencers`, `POST /api/admin/influencers/:id/payout`, `POST /api/admin/settings`

**Files:**
- Modify: `server/src/routes/admin.ts`
- Modify: `server/src/routes/admin.test.ts`

**Interfaces:**
- Produces: `GET /api/admin/credits` — response `{ purchases: AdminCreditPurchase[], freelancers: AdminFreelancerRow[], totalCredits: number }` where `AdminCreditPurchase = { id, credits_amount, paystack_reference, status, created_at, freelancer_name }` and `AdminFreelancerRow = { id, full_name, created_at, account_type }`.
- Produces: `GET /api/admin/influencers` — response `{ influencers: AdminInfluencerRow[], summary: { totalUsers, referred, organic }, commissionPct: number, platformFeePct: number }` where `AdminInfluencerRow = { id, name, email, referralCode, socialHandle, referred, qualified, earnedNaira, unpaidNaira }`.
- Produces: `POST /api/admin/influencers/:id/payout` — request body `{ note?: string }`; response `{ success: true, amount_kobo: number }` or `{ error: string }` at 404/409/500.
- Produces: `POST /api/admin/settings` — request body `{ influencer_commission_pct?: number, platform_fee_pct?: number }`; response `{ success: true, updated: Record<string, number> }` or `{ error: string }` at 400.

- [ ] **Step 1: Read the current top of `server/src/routes/admin.test.ts`**

Confirm the shared `vi.hoisted` block (from Phase 5c) currently exports `maybeSingleMock, updateUserByIdMock, auditInsertMock, jobLookupMock, jobUpdateEqMock, auditSelectLimitMock, fakeService` with `fakeService.from` branching on `"profiles"`, `"admin_audit_log"`, `"jobs"`. If it doesn't match, STOP and re-read this brief's assumptions rather than guessing.

- [ ] **Step 2: Extend the hoisted mock block**

Replace the ENTIRE `vi.hoisted(...)` block and its immediately-following `vi.mock` line with this extended version — exactly one `vi.hoisted` and one `vi.mock("../lib/supabase.js", ...)` must remain in the file:

```ts
const {
  maybeSingleMock,
  updateUserByIdMock,
  auditInsertMock,
  jobLookupMock,
  jobUpdateEqMock,
  auditSelectLimitMock,
  influencerProfilesOrderMock,
  namesInMock,
  totalUsersCountMock,
  referredUsersCountMock,
  settingsInMock,
  influencerLookupMock,
  qualifiedRefsMock,
  balanceUpdateMock,
  referralsUpdateInMock,
  appSettingsUpsertMock,
  fakeService,
} = vi.hoisted(() => {
  const maybeSingleMock = vi.fn()
  const updateUserByIdMock = vi.fn()
  const auditInsertMock = vi.fn().mockResolvedValue({ error: null })
  const jobLookupMock = vi.fn()
  const jobUpdateEqMock = vi.fn().mockResolvedValue({ error: null })
  const auditSelectLimitMock = vi.fn()
  const influencerProfilesOrderMock = vi.fn()
  const namesInMock = vi.fn()
  const totalUsersCountMock = vi.fn()
  const referredUsersCountMock = vi.fn()
  const settingsInMock = vi.fn()
  const influencerLookupMock = vi.fn()
  const qualifiedRefsMock = vi.fn()
  const balanceUpdateMock = vi.fn()
  const referralsUpdateInMock = vi.fn().mockResolvedValue({ error: null })
  const appSettingsUpsertMock = vi.fn()

  const fakeService = {
    from: vi.fn((table: string) => {
      if (table === "profiles") {
        return {
          // Three distinct call shapes route to three distinct mocks, distinguished
          // by the exact arguments the real code passes:
          //   .select("role, account_type").eq(...).maybeSingle()      -- disable route (Phase 5b)
          //   .select("id, full_name, email").in([...])                -- GET /influencers name lookup
          //   .select("*", { count: "exact", head: true })              -- GET /influencers total-users count
          select: vi.fn((cols: string, opts?: { count?: string; head?: boolean }) => {
            if (opts?.count) return totalUsersCountMock()
            if (cols === "id, full_name, email") return { in: namesInMock }
            return { eq: vi.fn(() => ({ maybeSingle: maybeSingleMock })) }
          }),
        }
      }
      if (table === "admin_audit_log") {
        return {
          insert: auditInsertMock,
          select: vi.fn(() => ({ order: vi.fn(() => ({ limit: auditSelectLimitMock })) })),
        }
      }
      if (table === "jobs") {
        return {
          select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: jobLookupMock })) })),
          update: vi.fn(() => ({ eq: jobUpdateEqMock })),
        }
      }
      if (table === "influencer_profiles") {
        return {
          // .select(...).order(...)              -- GET /influencers list
          // .select(...).eq(...).maybeSingle()    -- POST /influencers/:id/payout lookup
          select: vi.fn(() => ({
            order: influencerProfilesOrderMock,
            eq: vi.fn(() => ({ maybeSingle: influencerLookupMock })),
          })),
          // .update(...).eq(...).eq(...).select(...).maybeSingle() -- the guarded balance-zeroing update
          update: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                select: vi.fn(() => ({ maybeSingle: balanceUpdateMock })),
              })),
            })),
          })),
        }
      }
      if (table === "referrals") {
        return {
          // .select("*", { count, head })         -- GET /influencers referred-users count
          // .select("id").eq(...).eq(...)         -- POST /influencers/:id/payout qualified-referrals lookup
          select: vi.fn((_cols: string, opts?: { count?: string; head?: boolean }) => {
            if (opts?.count) return referredUsersCountMock()
            return { eq: vi.fn(() => ({ eq: qualifiedRefsMock })) }
          }),
          update: vi.fn(() => ({ in: referralsUpdateInMock })),
        }
      }
      if (table === "influencer_payouts") {
        return { insert: vi.fn().mockResolvedValue({ error: null }) }
      }
      if (table === "app_settings") {
        return {
          select: vi.fn(() => ({ in: settingsInMock })),
          upsert: appSettingsUpsertMock,
        }
      }
      throw new Error(`unexpected table ${table}`)
    }),
    auth: { admin: { updateUserById: updateUserByIdMock } },
  }
  return {
    maybeSingleMock,
    updateUserByIdMock,
    auditInsertMock,
    jobLookupMock,
    jobUpdateEqMock,
    auditSelectLimitMock,
    influencerProfilesOrderMock,
    namesInMock,
    totalUsersCountMock,
    referredUsersCountMock,
    settingsInMock,
    influencerLookupMock,
    qualifiedRefsMock,
    balanceUpdateMock,
    referralsUpdateInMock,
    appSettingsUpsertMock,
    fakeService,
  }
})

vi.mock("../lib/supabase.js", () => ({ createServiceClient: () => fakeService }))
```

This mock plumbing is fully specified — every branch above corresponds to exactly one call shape in Step 6's route implementation (cross-referenced in the comments). Implement it exactly as written; there is nothing left to figure out.

- [ ] **Step 3: Run the existing suite once to confirm no regression from the mock extension alone**

Run: `cd server && npx vitest run src/routes/admin.test.ts`
Expected: all pre-existing tests (users, disable, jobs, moderate, audit) still PASS unchanged — confirms the extension didn't regress Phase 5b/5c's work before any new tests are added.

- [ ] **Step 4: Write the failing tests**

Add to `server/src/routes/admin.test.ts`:

```ts
describe("GET /credits", () => {
  it("lists credit purchases with freelancer names, freelancers, and a computed total", async () => {
    const purchasesOrderMock = vi.fn().mockResolvedValue({
      data: [
        { id: "p-1", credits_amount: 20, paystack_reference: "ref-1", status: "completed", created_at: "2026-01-02T00:00:00Z", profiles: { full_name: "Jane F" } },
        { id: "p-2", credits_amount: 10, paystack_reference: "ref-2", status: "completed", created_at: "2026-01-01T00:00:00Z", profiles: { full_name: "Sam F" } },
      ],
      error: null,
    })
    const freelancersOrderMock = vi.fn().mockResolvedValue({
      data: [{ id: "f-1", full_name: "Jane F", created_at: "2026-01-01T00:00:00Z", account_type: "freelancer" }],
      error: null,
    })
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "purchase_credits") return { select: vi.fn(() => ({ order: purchasesOrderMock })) }
        if (table === "profiles") return { select: vi.fn(() => ({ eq: vi.fn(() => ({ order: freelancersOrderMock })) })) }
        throw new Error(`unexpected table ${table}`)
      }),
    }

    const res = await request(appWith(supabase)).get("/credits")

    expect(res.status).toBe(200)
    expect(res.body.purchases).toHaveLength(2)
    expect(res.body.purchases[0]).toEqual(expect.objectContaining({ id: "p-1", freelancer_name: "Jane F", credits_amount: 20 }))
    expect(res.body.freelancers).toHaveLength(1)
    expect(res.body.totalCredits).toBe(30)
  })

  it("returns empty lists and zero total on a query error", async () => {
    const supabase = { from: vi.fn(() => ({ select: vi.fn(() => ({ order: vi.fn().mockResolvedValue({ data: null, error: { message: "boom" } }), eq: vi.fn(() => ({ order: vi.fn().mockResolvedValue({ data: null, error: { message: "boom" } })})) })) })) }
    const res = await request(appWith(supabase)).get("/credits")
    expect(res.body).toEqual({ purchases: [], freelancers: [], totalCredits: 0 })
  })
})

describe("GET /influencers", () => {
  beforeEach(() => vi.clearAllMocks())

  it("lists influencers with resolved names and program settings, via the service-role client", async () => {
    influencerProfilesOrderMock.mockResolvedValue({
      data: [{ user_id: "inf-1", referral_code: "ABC123", display_name: "Influencer One", social_handle: "@one", total_referrals: 5, total_qualified: 2, total_earned_kobo: 200000, balance_unpaid_kobo: 50000 }],
      error: null,
    })
    namesInMock.mockResolvedValue({ data: [{ id: "inf-1", full_name: "Influencer One", email: "one@x.com" }], error: null })
    totalUsersCountMock.mockResolvedValue({ count: 100 })
    referredUsersCountMock.mockResolvedValue({ count: 30 })
    settingsInMock.mockResolvedValue({ data: [{ key: "influencer_commission_pct", value: 10 }, { key: "platform_fee_pct", value: 15 }], error: null })

    const res = await request(appWith({})).get("/influencers")

    expect(res.status).toBe(200)
    expect(res.body.influencers).toHaveLength(1)
    expect(res.body.influencers[0]).toEqual(
      expect.objectContaining({ id: "inf-1", name: "Influencer One", referralCode: "ABC123", earnedNaira: 2000, unpaidNaira: 500 })
    )
    expect(res.body.summary).toEqual({ totalUsers: 100, referred: 30, organic: 70 })
    expect(res.body.commissionPct).toBe(10)
    expect(res.body.platformFeePct).toBe(15)
  })
})

describe("POST /influencers/:id/payout", () => {
  beforeEach(() => vi.clearAllMocks())

  it("zeroes the balance, records the payout, marks qualified referrals paid, and logs the action", async () => {
    influencerLookupMock.mockResolvedValue({ data: { user_id: "inf-1", balance_unpaid_kobo: 50000 }, error: null })
    qualifiedRefsMock.mockResolvedValue({ data: [{ id: "r-1" }, { id: "r-2" }], error: null })
    balanceUpdateMock.mockResolvedValue({ data: { user_id: "inf-1" }, error: null })
    auditInsertMock.mockResolvedValue({ error: null })

    const res = await request(appWith({})).post("/influencers/inf-1/payout").send({ note: "manual payout" })

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ success: true, amount_kobo: 50000 })
    expect(referralsUpdateInMock).toHaveBeenCalledWith(["r-1", "r-2"])
    expect(auditInsertMock).toHaveBeenCalledWith(expect.objectContaining({ admin_id: "admin-1", action: "influencer.payout", target_id: "inf-1" }))
  })

  it("returns 404 when the influencer doesn't exist", async () => {
    influencerLookupMock.mockResolvedValue({ data: null, error: null })
    const res = await request(appWith({})).post("/influencers/inf-404/payout").send({})
    expect(res.status).toBe(404)
  })

  it("returns 409 when there is nothing to pay out", async () => {
    influencerLookupMock.mockResolvedValue({ data: { user_id: "inf-1", balance_unpaid_kobo: 0 }, error: null })
    const res = await request(appWith({})).post("/influencers/inf-1/payout").send({})
    expect(res.status).toBe(409)
  })

  it("returns 409 when the balance changed concurrently (the guarded update matches zero rows)", async () => {
    influencerLookupMock.mockResolvedValue({ data: { user_id: "inf-1", balance_unpaid_kobo: 50000 }, error: null })
    balanceUpdateMock.mockResolvedValue({ data: null, error: null })
    const res = await request(appWith({})).post("/influencers/inf-1/payout").send({})
    expect(res.status).toBe(409)
  })
})

describe("POST /settings", () => {
  beforeEach(() => vi.clearAllMocks())

  it("upserts allowed keys and logs the change", async () => {
    appSettingsUpsertMock.mockResolvedValue({ error: null })
    const res = await request(appWith({})).post("/settings").send({ influencer_commission_pct: 12, platform_fee_pct: 18 })

    expect(res.status).toBe(200)
    expect(appSettingsUpsertMock).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ key: "influencer_commission_pct", value: 12 }), expect.objectContaining({ key: "platform_fee_pct", value: 18 })]),
      { onConflict: "key" }
    )
    expect(res.body).toEqual({ success: true, updated: { influencer_commission_pct: 12, platform_fee_pct: 18 } })
  })

  it("returns 400 for an out-of-range value", async () => {
    const res = await request(appWith({})).post("/settings").send({ platform_fee_pct: 150 })
    expect(res.status).toBe(400)
    expect(appSettingsUpsertMock).not.toHaveBeenCalled()
  })

  it("returns 400 when no valid keys are provided", async () => {
    const res = await request(appWith({})).post("/settings").send({ unrelated_key: 5 })
    expect(res.status).toBe(400)
  })

  it("ignores keys not in the allowlist", async () => {
    appSettingsUpsertMock.mockResolvedValue({ error: null })
    const res = await request(appWith({})).post("/settings").send({ influencer_commission_pct: 12, admin_password: "hunter2" })
    expect(res.body.updated).toEqual({ influencer_commission_pct: 12 })
    expect(appSettingsUpsertMock).toHaveBeenCalledWith([expect.objectContaining({ key: "influencer_commission_pct" })], { onConflict: "key" })
  })
})
```

- [ ] **Step 5: Run the tests to verify they fail**

Run: `cd server && npx vitest run src/routes/admin.test.ts -t "credits|influencers|settings"`
Expected: FAIL — none of these four routes exist yet.

- [ ] **Step 6: Implement the routes**

Add to `server/src/routes/admin.ts` (after the existing `GET /audit` route):

```ts
adminRouter.get(
  "/credits",
  asyncHandler(async (req, res) => {
    const [purchasesResult, freelancersResult] = await Promise.all([
      req.supabase!.from("purchase_credits").select("id, credits_amount, paystack_reference, status, created_at, profiles(full_name)").order("created_at", { ascending: false }),
      req.supabase!.from("profiles").select("id, full_name, created_at, account_type").eq("account_type", "freelancer").order("created_at", { ascending: false }),
    ])

    const purchases = (purchasesResult.data || []).map((p: any) => ({
      id: p.id,
      credits_amount: p.credits_amount,
      paystack_reference: p.paystack_reference,
      status: p.status,
      created_at: p.created_at,
      freelancer_name: p.profiles?.full_name || "Unknown",
    }))
    const freelancers = freelancersResult.data || []
    const totalCredits = purchases.reduce((sum: number, p: any) => sum + (p.credits_amount || 0), 0)

    res.json({ purchases, freelancers, totalCredits })
  })
)

adminRouter.get(
  "/influencers",
  asyncHandler(async (_req, res) => {
    const service = createServiceClient()

    const { data: profiles } = await service
      .from("influencer_profiles")
      .select("user_id, referral_code, display_name, social_handle, total_referrals, total_qualified, total_earned_kobo, balance_unpaid_kobo")
      .order("total_earned_kobo", { ascending: false })

    const list = profiles ?? []
    const ids = list.map((p: any) => p.user_id)

    const { data: names } = ids.length ? await service.from("profiles").select("id, full_name, email").in("id", ids) : { data: [] as any[] }
    const nameById = new Map((names ?? []).map((n: any) => [n.id, n]))

    const [totalUsersResult, referredUsersResult, settingsResult] = await Promise.all([
      service.from("profiles").select("*", { count: "exact", head: true }),
      service.from("referrals").select("*", { count: "exact", head: true }),
      service.from("app_settings").select("key, value").in("key", ["influencer_commission_pct", "platform_fee_pct"]),
    ])

    const toNaira = (kobo?: number | null) => Number(kobo || 0) / 100
    const settingNum = (rows: any[], key: string, fallback: number) => {
      const raw = rows.find((r) => r.key === key)?.value
      const n = typeof raw === "number" ? raw : Number(raw)
      return Number.isFinite(n) ? n : fallback
    }

    const influencers = list.map((p: any) => ({
      id: p.user_id,
      name: nameById.get(p.user_id)?.full_name || p.display_name || "Unknown",
      email: nameById.get(p.user_id)?.email || null,
      referralCode: p.referral_code,
      socialHandle: p.social_handle,
      referred: p.total_referrals ?? 0,
      qualified: p.total_qualified ?? 0,
      earnedNaira: toNaira(p.total_earned_kobo),
      unpaidNaira: toNaira(p.balance_unpaid_kobo),
    }))

    const total = totalUsersResult.count ?? 0
    const referred = referredUsersResult.count ?? 0

    res.json({
      influencers,
      summary: { totalUsers: total, referred, organic: Math.max(total - referred, 0) },
      commissionPct: settingNum(settingsResult.data ?? [], "influencer_commission_pct", 10),
      platformFeePct: settingNum(settingsResult.data ?? [], "platform_fee_pct", 15),
    })
  })
)

adminRouter.post(
  "/influencers/:id/payout",
  asyncHandler(async (req, res) => {
    const influencerId = req.params.id
    const { note } = req.body ?? {}
    const trimmedNote = typeof note === "string" ? note.slice(0, 500) : null

    const service = createServiceClient()

    const { data: influencer } = await service.from("influencer_profiles").select("user_id, balance_unpaid_kobo").eq("user_id", influencerId).maybeSingle()
    if (!influencer) {
      res.status(404).json({ error: "Influencer not found" })
      return
    }

    const amountKobo = Number(influencer.balance_unpaid_kobo || 0)
    if (amountKobo <= 0) {
      res.status(409).json({ error: "Nothing to pay out" })
      return
    }

    const { data: qualifiedRefs } = await service.from("referrals").select("id").eq("influencer_id", influencerId).eq("status", "qualified")
    const coveredIds = (qualifiedRefs as { id: string }[] | null)?.map((r) => r.id) ?? []

    const { data: zeroed } = await service
      .from("influencer_profiles")
      .update({ balance_unpaid_kobo: 0 })
      .eq("user_id", influencerId)
      .eq("balance_unpaid_kobo", amountKobo)
      .select("user_id")
      .maybeSingle()
    if (!zeroed) {
      res.status(409).json({ error: "Balance changed — please refresh and try again" })
      return
    }

    await service.from("influencer_payouts").insert({ influencer_id: influencerId, amount_kobo: amountKobo, status: "paid", processed_by: req.user!.id, note: trimmedNote })

    if (coveredIds.length > 0) {
      await service.from("referrals").update({ status: "paid" }).in("id", coveredIds)
    }

    await logAdminAction(service, {
      adminId: req.user!.id,
      action: "influencer.payout",
      targetType: "influencer",
      targetId: influencerId,
      details: { amount_kobo: amountKobo, referrals_paid: coveredIds.length, note: trimmedNote },
    })

    res.json({ success: true, amount_kobo: amountKobo })
  })
)

const SETTINGS_ALLOWED_KEYS = new Set(["influencer_commission_pct", "platform_fee_pct"])

adminRouter.post(
  "/settings",
  asyncHandler(async (req, res) => {
    const body = req.body ?? {}
    const updates: Record<string, number> = {}

    for (const [key, raw] of Object.entries(body)) {
      if (!SETTINGS_ALLOWED_KEYS.has(key)) continue
      const n = Number(raw)
      if (!Number.isFinite(n) || n < 0 || n > 100) {
        res.status(400).json({ error: `${key} must be a number between 0 and 100` })
        return
      }
      updates[key] = n
    }

    if (Object.keys(updates).length === 0) {
      res.status(400).json({ error: "No valid settings provided" })
      return
    }

    const service = createServiceClient()
    const rows = Object.entries(updates).map(([key, value]) => ({ key, value, updated_at: new Date().toISOString() }))
    const { error } = await service.from("app_settings").upsert(rows, { onConflict: "key" })
    if (error) {
      res.status(500).json({ error: "Failed to save settings" })
      return
    }

    await logAdminAction(service, { adminId: req.user!.id, action: "settings.update", targetType: "app_settings", targetId: Object.keys(updates).join(","), details: updates })

    res.json({ success: true, updated: updates })
  })
)
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `cd server && npx vitest run src/routes/admin.test.ts`
Expected: PASS (all tests in the file, old and new). If a mock-shape mismatch surfaces, fix the test's mock chain to match the real route's actual Supabase call shape (see the note in Step 4) — don't change the route to match a wrong mock.

- [ ] **Step 8: Run the full server test suite**

Run: `cd server && npx vitest run`
Expected: PASS

- [ ] **Step 9: Run tsc**

Run: `cd server && npx tsc --noEmit`
Expected: only the known pre-existing `src/routes/user.test.ts(230,52)` error.

- [ ] **Step 10: Self-check then commit**

Confirm via `git show --stat` that your commit touches only `server/src/routes/admin.ts` and `server/src/routes/admin.test.ts`. If another concurrent subagent's staged files got swept in, recover non-destructively (`git reset --soft HEAD~1` + selective `git restore --staged`, never `git reset --hard`) — see the SDD ledger for the established pattern if this happens.

```bash
git add server/src/routes/admin.ts server/src/routes/admin.test.ts
git commit -m "feat(server): add GET /api/admin/credits, GET/POST /api/admin/influencers, POST /api/admin/settings"
```

---

## Task 2: Client hooks — `useAdminCreditsQuery`, `useAdminInfluencersQuery`, `useRecordInfluencerPayoutMutation`, `useUpdateInfluencerSettingsMutation`

**Files:**
- Modify: `client/src/lib/queries/admin.ts`
- Modify: `client/src/lib/queries/admin.test.tsx`

**Interfaces:**
- Produces: `type AdminCreditPurchase`, `type AdminFreelancerRow`, `useAdminCreditsQuery()`; `type AdminInfluencerRow`, `useAdminInfluencersQuery()`; `useRecordInfluencerPayoutMutation()` (`mutate({influencerId, note?})`, invalidates `["admin", "influencers"]`); `useUpdateInfluencerSettingsMutation()` (`mutate({influencer_commission_pct?, platform_fee_pct?})`, invalidates `["admin", "influencers"]`). Consumed by Task 3 (`AdminCredits`) and Task 4 (`AdminInfluencers`).

- [ ] **Step 1: Write the failing tests**

Add to `client/src/lib/queries/admin.test.tsx`:

```tsx
describe("useAdminCreditsQuery", () => {
  it("GETs /api/admin/credits", async () => {
    apiFetchMock.mockResolvedValue({ purchases: [{ id: "p-1", credits_amount: 20, paystack_reference: "ref-1", status: "completed", created_at: "2026-01-01T00:00:00Z", freelancer_name: "Jane F" }], freelancers: [], totalCredits: 20 })
    const { useAdminCreditsQuery } = await import("./admin")

    const { result } = renderHook(() => useAdminCreditsQuery(), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(apiFetchMock).toHaveBeenCalledWith("/api/admin/credits")
    expect(result.current.data?.totalCredits).toBe(20)
  })
})

describe("useAdminInfluencersQuery", () => {
  it("GETs /api/admin/influencers", async () => {
    apiFetchMock.mockResolvedValue({ influencers: [{ id: "inf-1", name: "Influencer One", email: "one@x.com", referralCode: "ABC123", socialHandle: null, referred: 5, qualified: 2, earnedNaira: 2000, unpaidNaira: 500 }], summary: { totalUsers: 100, referred: 30, organic: 70 }, commissionPct: 10, platformFeePct: 15 })
    const { useAdminInfluencersQuery } = await import("./admin")

    const { result } = renderHook(() => useAdminInfluencersQuery(), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(apiFetchMock).toHaveBeenCalledWith("/api/admin/influencers")
    expect(result.current.data?.influencers[0].name).toBe("Influencer One")
  })
})

describe("useRecordInfluencerPayoutMutation", () => {
  it("POSTs /api/admin/influencers/:id/payout and invalidates the influencers list", async () => {
    apiFetchMock.mockResolvedValue({ success: true, amount_kobo: 50000 })
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const invalidateSpy = vi.spyOn(client, "invalidateQueries")
    const { useRecordInfluencerPayoutMutation } = await import("./admin")

    const { result } = renderHook(() => useRecordInfluencerPayoutMutation(), {
      wrapper: ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>,
    })
    result.current.mutate({ influencerId: "inf-1", note: "manual" })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(apiFetchMock).toHaveBeenCalledWith("/api/admin/influencers/inf-1/payout", { method: "POST", body: JSON.stringify({ note: "manual" }) })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["admin", "influencers"] })
  })
})

describe("useUpdateInfluencerSettingsMutation", () => {
  it("POSTs /api/admin/settings and invalidates the influencers list", async () => {
    apiFetchMock.mockResolvedValue({ success: true, updated: { influencer_commission_pct: 12 } })
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const invalidateSpy = vi.spyOn(client, "invalidateQueries")
    const { useUpdateInfluencerSettingsMutation } = await import("./admin")

    const { result } = renderHook(() => useUpdateInfluencerSettingsMutation(), {
      wrapper: ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>,
    })
    result.current.mutate({ influencer_commission_pct: 12, platform_fee_pct: 18 })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(apiFetchMock).toHaveBeenCalledWith("/api/admin/settings", { method: "POST", body: JSON.stringify({ influencer_commission_pct: 12, platform_fee_pct: 18 }) })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["admin", "influencers"] })
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd client && npx vitest run src/lib/queries/admin.test.tsx -t "AdminCredits|AdminInfluencers|InfluencerPayout|InfluencerSettings"`
Expected: FAIL — none of these exports exist yet.

- [ ] **Step 3: Implement the hooks**

Add to `client/src/lib/queries/admin.ts` (at the end of the file):

```ts
export type AdminCreditPurchase = {
  id: string
  credits_amount: number
  paystack_reference: string
  status: string
  created_at: string
  freelancer_name: string
}

export type AdminFreelancerRow = {
  id: string
  full_name: string
  created_at: string
  account_type: string
}

export function useAdminCreditsQuery() {
  return useQuery({
    queryKey: ["admin", "credits"],
    queryFn: () => apiFetch<{ purchases: AdminCreditPurchase[]; freelancers: AdminFreelancerRow[]; totalCredits: number }>("/api/admin/credits"),
  })
}

export type AdminInfluencerRow = {
  id: string
  name: string
  email: string | null
  referralCode: string
  socialHandle: string | null
  referred: number
  qualified: number
  earnedNaira: number
  unpaidNaira: number
}

export function useAdminInfluencersQuery() {
  return useQuery({
    queryKey: ["admin", "influencers"],
    queryFn: () =>
      apiFetch<{
        influencers: AdminInfluencerRow[]
        summary: { totalUsers: number; referred: number; organic: number }
        commissionPct: number
        platformFeePct: number
      }>("/api/admin/influencers"),
  })
}

export function useRecordInfluencerPayoutMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ influencerId, note }: { influencerId: string; note?: string }) =>
      apiFetch<{ success: boolean; amount_kobo: number }>(`/api/admin/influencers/${influencerId}/payout`, {
        method: "POST",
        body: JSON.stringify({ note }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "influencers"] })
    },
  })
}

export function useUpdateInfluencerSettingsMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { influencer_commission_pct?: number; platform_fee_pct?: number }) =>
      apiFetch<{ success: boolean; updated: Record<string, number> }>("/api/admin/settings", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "influencers"] })
    },
  })
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd client && npx vitest run src/lib/queries/admin.test.tsx`
Expected: PASS (all tests in the file, old and new)

- [ ] **Step 5: Run tsc**

Run: `cd client && npx tsc --noEmit`
Expected: clean.

- [ ] **Step 6: Self-check then commit**

Confirm via `git show --stat` that your commit touches only `client/src/lib/queries/admin.ts` and `client/src/lib/queries/admin.test.tsx`.

```bash
git add client/src/lib/queries/admin.ts client/src/lib/queries/admin.test.tsx
git commit -m "feat(client): add credits/influencers query and mutation hooks"
```

---

## Task 3: `AdminCredits` page

**Files:**
- Create: `client/src/pages/admin/Credits.tsx`
- Test: `client/src/pages/admin/Credits.test.tsx`

**Interfaces:**
- Consumes: `useAdminCreditsQuery`, `type AdminCreditPurchase` (`@/lib/queries/admin`); `AdminSidebar`; `Table` family; `Input`, `Avatar`/`AvatarFallback`.
- Produces: default export `AdminCredits`. Consumed by Task 5's route wiring.

**Test file MUST mock `../../contexts/AuthContext`** (this page renders `AdminSidebar`, whose `useAuth()` otherwise imports the real `lib/supabase.ts` and throws under Vitest — see memory's environment gotchas for why this is required, not optional).

- [ ] **Step 1: Write the failing tests**

```tsx
// client/src/pages/admin/Credits.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"

const useAdminCreditsQueryMock = vi.fn()
vi.mock("../../lib/queries/admin", () => ({ useAdminCreditsQuery: () => useAdminCreditsQueryMock() }))

vi.mock("../../contexts/AuthContext", () => ({ useAuth: () => ({ signOut: vi.fn() }) }))

import AdminCredits from "./Credits"

const purchase = { id: "p-1", credits_amount: 20, paystack_reference: "ref-1", status: "completed", created_at: "2026-01-01T00:00:00Z", freelancer_name: "Jane F" }
const freelancer = { id: "f-1", full_name: "Jane F", created_at: "2026-01-01T00:00:00Z", account_type: "freelancer" }

function renderPage() {
  return render(<MemoryRouter><AdminCredits /></MemoryRouter>)
}

beforeEach(() => {
  vi.clearAllMocks()
  useAdminCreditsQueryMock.mockReturnValue({ isLoading: false, data: { purchases: [purchase], freelancers: [freelancer], totalCredits: 20 } })
})

describe("AdminCredits", () => {
  it("shows a loading state while data is pending", () => {
    useAdminCreditsQueryMock.mockReturnValue({ isLoading: true, data: undefined })
    renderPage()
    expect(screen.getByText(/loading/i)).toBeInTheDocument()
  })

  it("shows the total credits purchased and lists transactions", () => {
    renderPage()
    expect(screen.getByText("20")).toBeInTheDocument()
    expect(screen.getByText("Jane F")).toBeInTheDocument()
    expect(screen.getByText("ref-1")).toBeInTheDocument()
  })

  it("filters transactions by search term", async () => {
    const user = userEvent.setup()
    renderPage()
    await user.type(screen.getByPlaceholderText(/search transactions/i), "nonexistent")
    expect(screen.queryByText("Jane F")).not.toBeInTheDocument()
  })

  it("lists registered freelancers", () => {
    renderPage()
    expect(screen.getAllByText("Jane F").length).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd client && npx vitest run src/pages/admin/Credits.test.tsx`
Expected: FAIL — `Cannot find module './Credits'`

- [ ] **Step 3: Implement the page**

```tsx
// client/src/pages/admin/Credits.tsx
import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import AdminSidebar from "@/components/AdminSidebar"
import { useAdminCreditsQuery, type AdminCreditPurchase } from "@/lib/queries/admin"

const getStatusBadge = (status: string) => {
  const badge = "inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium"
  switch (status?.toLowerCase()) {
    case "success":
    case "completed":
      return <span className={`${badge} bg-success/10 text-success`}>Success</span>
    case "pending":
      return <span className={`${badge} bg-warning/10 text-warning`}>Pending</span>
    case "failed":
      return <span className={`${badge} bg-destructive/10 text-destructive`}>Failed</span>
    default:
      return <span className={`${badge} bg-surface-2 text-muted-foreground capitalize`}>{status}</span>
  }
}

export default function AdminCredits() {
  const creditsQuery = useAdminCreditsQuery()
  const [searchTerm, setSearchTerm] = useState("")

  const purchases = creditsQuery.data?.purchases ?? []
  const freelancers = creditsQuery.data?.freelancers ?? []
  const totalCredits = creditsQuery.data?.totalCredits ?? 0

  const filtered = purchases.filter(
    (p: AdminCreditPurchase) =>
      p.paystack_reference.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.status.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.freelancer_name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (creditsQuery.isLoading) {
    return (
      <div className="flex h-screen bg-surface">
        <AdminSidebar />
        <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">Loading…</div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-surface">
      <AdminSidebar />
      <div className="flex-1 overflow-auto">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
          <header className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Admin</p>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Credits &amp; users</h1>
            <p className="text-sm text-muted-foreground">Manage platform credits and registered freelancers.</p>
          </header>

          <section className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs font-medium text-muted-foreground">Total credits purchased</p>
              <p className="mt-3 text-3xl font-semibold tracking-tight text-foreground tabular-nums">{totalCredits.toLocaleString()}</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs font-medium text-muted-foreground">Total freelancers</p>
              <p className="mt-3 text-3xl font-semibold tracking-tight text-foreground tabular-nums">{freelancers.length}</p>
            </div>
          </section>

          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex flex-col md:flex-row md:items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-foreground">Recent transactions</h2>
              <Input placeholder="Search transactions…" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="md:max-w-xs" />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-surface-2 text-[11px] uppercase tracking-wide font-medium text-muted-foreground border-b border-border">
                  <tr>
                    <th className="px-5 py-3">Freelancer</th>
                    <th className="px-5 py-3">Amount</th>
                    <th className="px-5 py-3">Reference ID</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-5 py-12 text-center text-sm text-muted-foreground">
                        {searchTerm ? "No transactions matching your search." : "No transactions found."}
                      </td>
                    </tr>
                  ) : (
                    filtered.map((p: AdminCreditPurchase) => (
                      <tr key={p.id} className="hover:bg-surface/60 transition-colors">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-9 w-9 rounded-full">
                              <AvatarFallback className="bg-surface-2 text-foreground text-sm font-semibold">{p.freelancer_name.charAt(0).toUpperCase()}</AvatarFallback>
                            </Avatar>
                            <span className="font-medium text-foreground">{p.freelancer_name}</span>
                          </div>
                        </td>
                        <td className="px-5 py-4 tabular-nums">
                          {p.credits_amount.toLocaleString()} <span className="text-[11px] text-muted-foreground">CR</span>
                        </td>
                        <td className="px-5 py-4 font-mono text-xs text-muted-foreground">{p.paystack_reference}</td>
                        <td className="px-5 py-4">{getStatusBadge(p.status)}</td>
                        <td className="px-5 py-4 text-muted-foreground tabular-nums">{new Date(p.created_at).toLocaleDateString()}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <h2 className="text-base font-semibold text-foreground">Registered freelancers</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-surface-2 text-[11px] uppercase tracking-wide font-medium text-muted-foreground border-b border-border">
                  <tr>
                    <th className="px-5 py-3">Name</th>
                    <th className="px-5 py-3">Account type</th>
                    <th className="px-5 py-3">Registration date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {freelancers.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-5 py-12 text-center text-sm text-muted-foreground">No freelancers registered yet.</td>
                    </tr>
                  ) : (
                    freelancers.map((f) => (
                      <tr key={f.id} className="hover:bg-surface/60 transition-colors">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-9 w-9 rounded-full">
                              <AvatarFallback className="bg-surface-2 text-foreground text-sm font-semibold">{f.full_name?.charAt(0).toUpperCase() || "?"}</AvatarFallback>
                            </Avatar>
                            <span className="font-medium text-foreground">{f.full_name}</span>
                          </div>
                        </td>
                        <td className="px-5 py-4 capitalize">{f.account_type}</td>
                        <td className="px-5 py-4 text-muted-foreground tabular-nums">{new Date(f.created_at).toLocaleDateString()}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd client && npx vitest run src/pages/admin/Credits.test.tsx`
Expected: PASS

- [ ] **Step 5: Run tsc**

Run: `cd client && npx tsc --noEmit`
Expected: clean.

- [ ] **Step 6: Self-check then commit**

Confirm via `git show --stat` that your commit touches only `client/src/pages/admin/Credits.tsx` and `client/src/pages/admin/Credits.test.tsx`.

```bash
git add client/src/pages/admin/Credits.tsx client/src/pages/admin/Credits.test.tsx
git commit -m "Port admin credits oversight page to client"
```

---

## Task 4: `AdminInfluencers` page

**Files:**
- Create: `client/src/pages/admin/Influencers.tsx`
- Test: `client/src/pages/admin/Influencers.test.tsx`

**Interfaces:**
- Consumes: `useAdminInfluencersQuery`, `useRecordInfluencerPayoutMutation`, `useUpdateInfluencerSettingsMutation`, `type AdminInfluencerRow` (`@/lib/queries/admin`); `AdminSidebar`; `Button`, `Input`.
- Produces: default export `AdminInfluencers`. Consumed by Task 5's route wiring.

**Test file MUST mock `../../contexts/AuthContext`** (same reason as Task 3).

- [ ] **Step 1: Write the failing tests**

```tsx
// client/src/pages/admin/Influencers.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"

const useAdminInfluencersQueryMock = vi.fn()
const recordPayoutMutate = vi.fn()
const updateSettingsMutate = vi.fn()
vi.mock("../../lib/queries/admin", () => ({
  useAdminInfluencersQuery: () => useAdminInfluencersQueryMock(),
  useRecordInfluencerPayoutMutation: () => ({ mutate: recordPayoutMutate, isPending: false }),
  useUpdateInfluencerSettingsMutation: () => ({ mutate: updateSettingsMutate, isPending: false }),
}))

vi.mock("../../contexts/AuthContext", () => ({ useAuth: () => ({ signOut: vi.fn() }) }))

import AdminInfluencers from "./Influencers"

const influencer = { id: "inf-1", name: "Influencer One", email: "one@x.com", referralCode: "ABC123", socialHandle: null, referred: 5, qualified: 2, earnedNaira: 2000, unpaidNaira: 500 }

function renderPage() {
  return render(<MemoryRouter><AdminInfluencers /></MemoryRouter>)
}

beforeEach(() => {
  vi.clearAllMocks()
  useAdminInfluencersQueryMock.mockReturnValue({
    isLoading: false,
    data: { influencers: [influencer], summary: { totalUsers: 100, referred: 30, organic: 70 }, commissionPct: 10, platformFeePct: 15 },
  })
  vi.stubGlobal("confirm", vi.fn(() => true))
})

describe("AdminInfluencers", () => {
  it("shows acquisition stat tiles", () => {
    renderPage()
    expect(screen.getByText("100")).toBeInTheDocument()
    expect(screen.getByText("30")).toBeInTheDocument()
  })

  it("lists influencers with their unpaid balance", () => {
    renderPage()
    expect(screen.getByText("Influencer One")).toBeInTheDocument()
    expect(screen.getByText("ABC123")).toBeInTheDocument()
  })

  it("records a payout after confirmation", async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByRole("button", { name: /record payout/i }))
    expect(window.confirm).toHaveBeenCalled()
    expect(recordPayoutMutate).toHaveBeenCalledWith({ influencerId: "inf-1" }, expect.anything())
  })

  it("disables the payout button when unpaid balance is zero", () => {
    useAdminInfluencersQueryMock.mockReturnValue({
      isLoading: false,
      data: { influencers: [{ ...influencer, unpaidNaira: 0 }], summary: { totalUsers: 100, referred: 30, organic: 70 }, commissionPct: 10, platformFeePct: 15 },
    })
    renderPage()
    expect(screen.getByRole("button", { name: /record payout/i })).toBeDisabled()
  })

  it("saves program settings", async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByRole("button", { name: /save settings/i }))
    expect(updateSettingsMutate).toHaveBeenCalledWith({ influencer_commission_pct: 10, platform_fee_pct: 15 })
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd client && npx vitest run src/pages/admin/Influencers.test.tsx`
Expected: FAIL — `Cannot find module './Influencers'`

- [ ] **Step 3: Implement the page**

```tsx
// client/src/pages/admin/Influencers.tsx
import { useState } from "react"
import { Users, UserPlus, Sparkles, Percent } from "lucide-react"
import AdminSidebar from "@/components/AdminSidebar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useAdminInfluencersQuery, useRecordInfluencerPayoutMutation, useUpdateInfluencerSettingsMutation, type AdminInfluencerRow } from "@/lib/queries/admin"

const naira = (n: number) => `₦${Number(n || 0).toLocaleString()}`

export default function AdminInfluencers() {
  const influencersQuery = useAdminInfluencersQuery()
  const recordPayout = useRecordInfluencerPayoutMutation()
  const updateSettings = useUpdateInfluencerSettingsMutation()

  const data = influencersQuery.data
  const influencers = data?.influencers ?? []
  const summary = data?.summary ?? { totalUsers: 0, referred: 0, organic: 0 }

  const [commission, setCommission] = useState(String(data?.commissionPct ?? 10))
  const [fee, setFee] = useState(String(data?.platformFeePct ?? 15))
  const [payingId, setPayingId] = useState<string | null>(null)

  const referralRate = summary.totalUsers > 0 ? Math.round((summary.referred / summary.totalUsers) * 100) : 0

  const tiles = [
    { label: "Total users", value: summary.totalUsers, icon: Users },
    { label: "Referred", value: summary.referred, icon: UserPlus },
    { label: "Organic", value: summary.organic, icon: Sparkles },
    { label: "Referral rate", value: `${referralRate}%`, icon: Percent },
  ]

  const handleSaveSettings = () => {
    updateSettings.mutate({ influencer_commission_pct: Number(commission), platform_fee_pct: Number(fee) })
  }

  const handleRecordPayout = (inf: AdminInfluencerRow) => {
    if (!confirm(`Record a payout of ${naira(inf.unpaidNaira)} to ${inf.name}? This zeroes their unpaid balance and marks their qualified referrals as paid.`)) return
    setPayingId(inf.id)
    recordPayout.mutate({ influencerId: inf.id }, { onSettled: () => setPayingId(null) })
  }

  if (influencersQuery.isLoading) {
    return (
      <div className="flex h-screen bg-surface">
        <AdminSidebar />
        <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">Loading…</div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-surface">
      <AdminSidebar />
      <div className="flex-1 overflow-auto">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
          <header className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Admin</p>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Influencers</h1>
            <p className="text-sm text-muted-foreground">Referral performance, user acquisition, and payouts.</p>
          </header>

          <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {tiles.map((t) => (
              <div key={t.label} className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-muted-foreground">{t.label}</p>
                  <t.icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <p className="mt-3 text-2xl font-semibold tracking-tight text-foreground tabular-nums">{t.value}</p>
              </div>
            ))}
          </section>

          <section className="rounded-xl border border-border bg-card p-6">
            <h2 className="text-base font-semibold text-foreground">Program settings</h2>
            <p className="mt-1 text-sm text-muted-foreground">Commission is this % of Bizimi&apos;s platform fee. Changes apply to future qualifying events only.</p>
            <div className="mt-4 flex flex-col sm:flex-row sm:items-end gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Influencer commission %</label>
                <Input type="number" min={0} max={100} value={commission} onChange={(e) => setCommission(e.target.value)} className="sm:w-44" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Platform fee %</label>
                <Input type="number" min={0} max={100} value={fee} onChange={(e) => setFee(e.target.value)} className="sm:w-44" />
              </div>
              <Button onClick={handleSaveSettings} disabled={updateSettings.isPending} className="sm:ml-1">
                {updateSettings.isPending ? "Saving…" : "Save settings"}
              </Button>
            </div>
          </section>

          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <h2 className="text-base font-semibold text-foreground">All influencers ({influencers.length})</h2>
            </div>
            {influencers.length === 0 ? (
              <div className="px-5 py-12 text-center text-sm text-muted-foreground">No influencers yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-surface-2 text-[11px] uppercase tracking-wide font-medium text-muted-foreground border-b border-border">
                    <tr>
                      <th className="px-5 py-3">Influencer</th>
                      <th className="px-5 py-3">Code</th>
                      <th className="px-5 py-3">Referred</th>
                      <th className="px-5 py-3">Qualified</th>
                      <th className="px-5 py-3">Earned</th>
                      <th className="px-5 py-3">Unpaid</th>
                      <th className="px-5 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {influencers.map((inf: AdminInfluencerRow) => (
                      <tr key={inf.id} className="hover:bg-surface/60 transition-colors">
                        <td className="px-5 py-4">
                          <p className="font-medium text-foreground truncate">{inf.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{inf.email || inf.socialHandle || "—"}</p>
                        </td>
                        <td className="px-5 py-4 font-mono text-xs text-muted-foreground">{inf.referralCode}</td>
                        <td className="px-5 py-4 text-muted-foreground tabular-nums">{inf.referred}</td>
                        <td className="px-5 py-4 text-muted-foreground tabular-nums">{inf.qualified}</td>
                        <td className="px-5 py-4 text-foreground tabular-nums">{naira(inf.earnedNaira)}</td>
                        <td className="px-5 py-4 font-semibold text-foreground tabular-nums">{naira(inf.unpaidNaira)}</td>
                        <td className="px-5 py-4 text-right">
                          <Button size="sm" variant="outline" disabled={inf.unpaidNaira <= 0 || payingId === inf.id} onClick={() => handleRecordPayout(inf)}>
                            {payingId === inf.id ? "Recording…" : "Record payout"}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd client && npx vitest run src/pages/admin/Influencers.test.tsx`
Expected: PASS

- [ ] **Step 5: Run tsc**

Run: `cd client && npx tsc --noEmit`
Expected: clean.

- [ ] **Step 6: Self-check then commit**

Confirm via `git show --stat` that your commit touches only `client/src/pages/admin/Influencers.tsx` and `client/src/pages/admin/Influencers.test.tsx`.

```bash
git add client/src/pages/admin/Influencers.tsx client/src/pages/admin/Influencers.test.tsx
git commit -m "Port admin influencers program page to client"
```

---

## Task 5: Wire `/admin/credits` and `/admin/influencers` into `App.tsx`

**Files:**
- Modify: `client/src/App.tsx`
- Test: `client/src/App.test.tsx` (extend)

**Interfaces:** none new — wires Task 3's and Task 4's pages in, both `RequireAuth`-wrapped.

- [ ] **Step 1: Write the failing tests**

Add to `client/src/App.test.tsx`:

```tsx
describe("admin credits and influencers routes", () => {
  it("redirects /admin/credits to /login when signed out", async () => {
    renderAt("/admin/credits")
    await screen.findByRole("heading", { name: /Continue your work/i })
  })

  it("redirects /admin/influencers to /login when signed out", async () => {
    renderAt("/admin/influencers")
    await screen.findByRole("heading", { name: /Continue your work/i })
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd client && npx vitest run src/App.test.tsx -t "admin credits and influencers routes"`
Expected: FAIL — neither route is registered yet.

- [ ] **Step 3: Update `client/src/App.tsx`**

Read the current file first. Add the imports:

```tsx
import AdminCredits from "./pages/admin/Credits"
import AdminInfluencers from "./pages/admin/Influencers"
```

Add both routes, `RequireAuth`-wrapped, after `/admin/audit` and before the catch-all:

```tsx
            <Route
              path="/admin/credits"
              element={
                <RequireAuth>
                  <AdminCredits />
                </RequireAuth>
              }
            />
            <Route
              path="/admin/influencers"
              element={
                <RequireAuth>
                  <AdminInfluencers />
                </RequireAuth>
              }
            />
```

- [ ] **Step 4: Update `App.test.tsx`'s `renderAt` helper**

Add the same imports and routes to the helper's local `<Routes>` table.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd client && npx vitest run src/App.test.tsx`
Expected: PASS

- [ ] **Step 6: Run the full client test suite**

Run: `cd client && npm test`
Expected: All tests PASS

- [ ] **Step 7: Run tsc**

Run: `cd client && npx tsc --noEmit`
Expected: clean.

- [ ] **Step 8: Commit**

```bash
git add client/src/App.tsx client/src/App.test.tsx
git commit -m "Wire /admin/credits and /admin/influencers routes behind RequireAuth"
```

---

## Post-Phase-5d note

This plan completes the fourth slice of Phase 5. Next: Phase 5e (influencer self-service portal: dashboard, referrals, earnings) — the last sub-plan of Phase 5's escrow-independent slice. `/admin/disputes`, `/admin/transactions`, `/disputes/[id]` remain blocked behind the Supabase-side escrow v2 migration. The `GET /api/admin/credits` ambiguity documented in this plan's Global Constraints (whether `req.supabase` actually surfaces cross-user `purchase_credits` data for an admin, matching legacy exactly but unverified against live RLS) should be checked against the real database whenever someone with Supabase access is available — not blocking, but worth resolving.
