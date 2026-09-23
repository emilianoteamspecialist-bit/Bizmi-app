import { describe, it, expect, vi, beforeEach } from "vitest"
import request from "supertest"
import express from "express"
import adminRouter from "./admin.js"

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

function appWith(supabase: any) {
  const app = express()
  app.use(express.json())
  app.use((req: any, _res, next) => {
    req.user = { id: "admin-1" }
    req.supabase = supabase
    next()
  })
  app.use("/", adminRouter)
  return app
}

describe("GET /users", () => {
  it("lists all profiles, newest first", async () => {
    const orderMock = vi.fn().mockResolvedValue({
      data: [
        { id: "u-1", email: "a@x.com", full_name: "Agency A", account_type: "agency", created_at: "2026-01-02T00:00:00Z", wallet_balance: 5000 },
        { id: "u-2", email: "f@x.com", full_name: "Freelancer F", account_type: "freelancer", created_at: "2026-01-01T00:00:00Z", wallet_balance: null },
      ],
      error: null,
    })
    const supabase = { from: vi.fn(() => ({ select: vi.fn(() => ({ order: orderMock })) })) }

    const res = await request(appWith(supabase)).get("/users")

    expect(res.status).toBe(200)
    expect(supabase.from).toHaveBeenCalledWith("profiles")
    expect(orderMock).toHaveBeenCalledWith("created_at", { ascending: false })
    expect(res.body.users).toHaveLength(2)
    expect(res.body.users[0].id).toBe("u-1")
  })

  it("returns an empty list on a query error", async () => {
    const supabase = { from: vi.fn(() => ({ select: vi.fn(() => ({ order: vi.fn().mockResolvedValue({ data: null, error: { message: "boom" } }) })) })) }
    const res = await request(appWith(supabase)).get("/users")
    expect(res.body).toEqual({ users: [] })
  })
})

describe("POST /users/:id/disable", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    auditInsertMock.mockResolvedValue({ error: null })
  })

  it("disables a non-admin user via the Supabase Admin Auth API and logs the action", async () => {
    maybeSingleMock.mockResolvedValue({ data: { role: "freelancer", account_type: "freelancer" }, error: null })
    updateUserByIdMock.mockResolvedValue({ error: null })

    const res = await request(appWith({})).post("/users/u-2/disable").send({ disabled: true })

    expect(updateUserByIdMock).toHaveBeenCalledWith("u-2", { ban_duration: "876000h" })
    expect(auditInsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ admin_id: "admin-1", action: "user.disable", target_id: "u-2" })
    )
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ success: true, disabled: true })
  })

  it("re-enables a user with ban_duration 'none' and logs 'user.enable'", async () => {
    maybeSingleMock.mockResolvedValue({ data: { role: "freelancer", account_type: "freelancer" }, error: null })
    updateUserByIdMock.mockResolvedValue({ error: null })

    const res = await request(appWith({})).post("/users/u-2/disable").send({ disabled: false })

    expect(updateUserByIdMock).toHaveBeenCalledWith("u-2", { ban_duration: "none" })
    expect(auditInsertMock).toHaveBeenCalledWith(expect.objectContaining({ action: "user.enable" }))
    expect(res.body).toEqual({ success: true, disabled: false })
  })

  it("returns 400 when disabled is not a boolean", async () => {
    const res = await request(appWith({})).post("/users/u-2/disable").send({ disabled: "yes" })
    expect(res.status).toBe(400)
    expect(updateUserByIdMock).not.toHaveBeenCalled()
  })

  it("returns 400 when an admin tries to disable their own account", async () => {
    const res = await request(appWith({})).post("/users/admin-1/disable").send({ disabled: true })
    expect(res.status).toBe(400)
    expect(updateUserByIdMock).not.toHaveBeenCalled()
  })

  it("returns 404 when the target user doesn't exist", async () => {
    maybeSingleMock.mockResolvedValue({ data: null, error: null })
    const res = await request(appWith({})).post("/users/u-404/disable").send({ disabled: true })
    expect(res.status).toBe(404)
    expect(updateUserByIdMock).not.toHaveBeenCalled()
  })

  it("returns 403 when the target is also an admin via account_type", async () => {
    maybeSingleMock.mockResolvedValue({ data: { role: "freelancer", account_type: "admin" }, error: null })
    const res = await request(appWith({})).post("/users/admin-2/disable").send({ disabled: true })
    expect(res.status).toBe(403)
    expect(updateUserByIdMock).not.toHaveBeenCalled()
  })

  it("returns 403 when the target is also an admin via role (not account_type) — this codebase uses both fields inconsistently, see CLAUDE.md", async () => {
    maybeSingleMock.mockResolvedValue({ data: { role: "admin", account_type: "freelancer" }, error: null })
    const res = await request(appWith({})).post("/users/admin-2/disable").send({ disabled: true })
    expect(res.status).toBe(403)
    expect(updateUserByIdMock).not.toHaveBeenCalled()
  })

  it("returns 500 when the Supabase Admin Auth API call fails", async () => {
    maybeSingleMock.mockResolvedValue({ data: { account_type: "freelancer" }, error: null })
    updateUserByIdMock.mockResolvedValue({ error: { message: "boom" } })
    const res = await request(appWith({})).post("/users/u-2/disable").send({ disabled: true })
    expect(res.status).toBe(500)
  })
})

describe("GET /jobs", () => {
  it("lists jobs newest first, resolving agency display names", async () => {
    const jobsLimitMock = vi.fn().mockResolvedValue({
      data: [
        { id: "j-1", title: "Logo design", status: "open", moderation_status: "visible", moderation_reason: null, agency_id: "a-1", created_at: "2026-01-02T00:00:00Z", budget_min: 5000, budget_max: 10000 },
        { id: "j-2", title: "Spam job", status: "open", moderation_status: "removed", moderation_reason: "fraud", agency_id: "a-2", created_at: "2026-01-01T00:00:00Z", budget_min: null, budget_max: null },
      ],
      error: null,
    })
    const agenciesInMock = vi.fn().mockResolvedValue({
      data: [
        { id: "a-1", full_name: "Alice Agency", company_name: null },
        { id: "a-2", full_name: null, company_name: "Acme Co" },
      ],
      error: null,
    })
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "jobs") return { select: vi.fn(() => ({ order: vi.fn(() => ({ limit: jobsLimitMock })) })) }
        if (table === "profiles") return { select: vi.fn(() => ({ in: agenciesInMock })) }
        throw new Error(`unexpected table ${table}`)
      }),
    }

    const res = await request(appWith(supabase)).get("/jobs")

    expect(res.status).toBe(200)
    expect(res.body.jobs).toHaveLength(2)
    expect(res.body.jobs[0]).toEqual(expect.objectContaining({ id: "j-1", agency_name: "Alice Agency", moderation_status: "visible" }))
    expect(res.body.jobs[1]).toEqual(expect.objectContaining({ id: "j-2", agency_name: "Acme Co", moderation_status: "removed", moderation_reason: "fraud" }))
  })

  it("returns an empty list on a query error", async () => {
    const supabase = { from: vi.fn(() => ({ select: vi.fn(() => ({ order: vi.fn(() => ({ limit: vi.fn().mockResolvedValue({ data: null, error: { message: "boom" } }) })) })) })) }
    const res = await request(appWith(supabase)).get("/jobs")
    expect(res.body).toEqual({ jobs: [] })
  })
})

describe("POST /jobs/:id/moderate", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    auditInsertMock.mockResolvedValue({ error: null })
    jobUpdateEqMock.mockResolvedValue({ error: null })
  })

  it("removes a job with a reason and logs the action, via the service-role client", async () => {
    jobLookupMock.mockResolvedValue({ data: { id: "j-1", title: "Spam job", agency_id: "a-2" }, error: null })

    const res = await request(appWith({})).post("/jobs/j-1/moderate").send({ action: "remove", reason: "fraud" })

    expect(jobUpdateEqMock).toHaveBeenCalledWith("id", "j-1")
    expect(auditInsertMock).toHaveBeenCalledWith(expect.objectContaining({ admin_id: "admin-1", action: "job.remove", target_id: "j-1" }))
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ success: true, moderation_status: "removed" })
  })

  it("restores a job, clearing the reason, and logs 'job.restore'", async () => {
    jobLookupMock.mockResolvedValue({ data: { id: "j-1", title: "Logo design", agency_id: "a-1" }, error: null })

    const res = await request(appWith({})).post("/jobs/j-1/moderate").send({ action: "restore" })

    expect(auditInsertMock).toHaveBeenCalledWith(expect.objectContaining({ action: "job.restore" }))
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ success: true, moderation_status: "visible" })
  })

  it("returns 400 for an invalid action", async () => {
    const res = await request(appWith({})).post("/jobs/j-1/moderate").send({ action: "delete" })
    expect(res.status).toBe(400)
    expect(jobUpdateEqMock).not.toHaveBeenCalled()
  })

  it("returns 404 when the job doesn't exist", async () => {
    jobLookupMock.mockResolvedValue({ data: null, error: null })
    const res = await request(appWith({})).post("/jobs/j-404/moderate").send({ action: "remove" })
    expect(res.status).toBe(404)
    expect(jobUpdateEqMock).not.toHaveBeenCalled()
  })

  it("returns 500 when the update fails", async () => {
    jobLookupMock.mockResolvedValue({ data: { id: "j-1", title: "X", agency_id: "a-1" }, error: null })
    jobUpdateEqMock.mockResolvedValue({ error: { message: "boom" } })
    const res = await request(appWith({})).post("/jobs/j-1/moderate").send({ action: "remove" })
    expect(res.status).toBe(500)
  })
})

describe("GET /audit", () => {
  beforeEach(() => vi.clearAllMocks())

  it("lists audit entries newest first with the acting admin's name/email joined, via the service-role client", async () => {
    auditSelectLimitMock.mockResolvedValue({
      data: [
        { id: "log-1", action: "user.disable", target_type: "user", target_id: "u-2", details: { note: "spam" }, created_at: "2026-01-02T00:00:00Z", admin: { full_name: "Admin One", email: "admin1@bizimi.com" } },
      ],
      error: null,
    })

    const res = await request(appWith({})).get("/audit")

    expect(res.status).toBe(200)
    expect(res.body).toEqual({
      logs: [
        { id: "log-1", action: "user.disable", target_type: "user", target_id: "u-2", details: { note: "spam" }, created_at: "2026-01-02T00:00:00Z", admin: { full_name: "Admin One", email: "admin1@bizimi.com" } },
      ],
    })
  })

  it("returns an empty list on a query error", async () => {
    auditSelectLimitMock.mockResolvedValue({ data: null, error: { message: "boom" } })
    const res = await request(appWith({})).get("/audit")
    expect(res.body).toEqual({ logs: [] })
  })
})

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
    expect(referralsUpdateInMock).toHaveBeenCalledWith("id", ["r-1", "r-2"])
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
