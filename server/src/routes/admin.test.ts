import { describe, it, expect, vi, beforeEach } from "vitest"
import request from "supertest"
import express from "express"
import adminRouter from "./admin.js"

const { maybeSingleMock, updateUserByIdMock, auditInsertMock, jobLookupMock, jobUpdateEqMock, auditSelectLimitMock, fakeService } = vi.hoisted(() => {
  const maybeSingleMock = vi.fn()
  const updateUserByIdMock = vi.fn()
  const auditInsertMock = vi.fn().mockResolvedValue({ error: null })
  const jobLookupMock = vi.fn()
  const jobUpdateEqMock = vi.fn().mockResolvedValue({ error: null })
  const auditSelectLimitMock = vi.fn()
  const fakeService = {
    from: vi.fn((table: string) => {
      if (table === "profiles") return { select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: maybeSingleMock })) })) }
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
      throw new Error(`unexpected table ${table}`)
    }),
    auth: { admin: { updateUserById: updateUserByIdMock } },
  }
  return { maybeSingleMock, updateUserByIdMock, auditInsertMock, jobLookupMock, jobUpdateEqMock, auditSelectLimitMock, fakeService }
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
