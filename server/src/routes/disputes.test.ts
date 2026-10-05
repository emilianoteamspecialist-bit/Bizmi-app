import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import express from "express"
import request from "supertest"
import { fakeSupabase, callsTo, hasFilter, type Handler } from "../test/fakeSupabase.js"

let service = fakeSupabase(() => ({}))
vi.mock("../lib/supabase.js", () => ({ createServiceClient: () => service.client }))
const auditMock = vi.fn()
vi.mock("../lib/adminAudit.js", () => ({ logAdminAction: (...a: unknown[]) => auditMock(...a) }))

import disputesRouter from "./disputes.js"
import adminEscrowRouter from "./adminEscrow.js"

function appWith(user: { id: string }, userClient: any, router: any) {
  const a = express()
  a.use(express.json())
  a.use((req: any, _res, next) => {
    req.user = user
    req.supabase = userClient
    next()
  })
  a.use("/", router)
  a.use((err: any, _req: any, res: any, _next: any) => res.status(500).json({ error: err.message }))
  return a
}

const useService = (handler: Handler) => (service = fakeSupabase(handler))
const escrow = (status_v2: string) => ({
  id: "esc-1",
  job_id: "job-1",
  agency_id: "agency-1",
  freelancer_id: "free-1",
  amount_kobo: 5_000_000,
  status_v2,
  paystack_reference: "escrow_esc-1_a",
})
const openBody = { job_id: "job-1", dispute_type: "non_delivery", description: "Nothing was delivered" }

beforeEach(() => {
  process.env.PAYSTACK_SECRET_KEY = "sk_test"
  auditMock.mockReset()
  vi.spyOn(console, "error").mockImplementation(() => {})
})
afterEach(() => vi.unstubAllGlobals())

describe("POST /api/disputes", () => {
  it("validates the dispute type", async () => {
    useService(() => ({}))
    const user = fakeSupabase(() => ({}))
    const res = await request(appWith({ id: "agency-1" }, user.client, disputesRouter)).post("/").send({ ...openBody, dispute_type: "vibes" })
    expect(res.status).toBe(400)
  })

  it("404s for someone who isn't a party to the escrow", async () => {
    useService(() => ({ data: escrow("funded") }))
    const user = fakeSupabase(() => ({}))
    const res = await request(appWith({ id: "stranger" }, user.client, disputesRouter)).post("/").send(openBody)
    expect(res.status).toBe(404)
  })

  it("only allows disputes on a funded escrow", async () => {
    useService(() => ({ data: escrow("released") }))
    const user = fakeSupabase(() => ({}))
    const res = await request(appWith({ id: "agency-1" }, user.client, disputesRouter)).post("/").send(openBody)
    expect(res.status).toBe(409)
  })

  it("opens the dispute against the other party with the escrow amount, freezes the funds and seeds the room", async () => {
    const s = useService((op) => {
      if (op.table === "escrow_deposits" && op.action === "select") return { data: escrow("funded") }
      if (op.table === "escrow_deposits" && op.action === "update") return { data: { id: "esc-1" } }
      return {}
    })
    const user = fakeSupabase((op) => (op.table === "disputes" ? { data: { id: "disp-1" } } : {}))

    const res = await request(appWith({ id: "agency-1" }, user.client, disputesRouter))
      .post("/")
      .send({ ...openBody, respondent_id: "spoof", amount_disputed: 1 })

    expect(res.status).toBe(200)
    expect(callsTo(user.calls, "disputes", "insert")[0].payload).toMatchObject({
      initiator_id: "agency-1",
      respondent_id: "free-1",
      amount_disputed: 50_000,
      status: "in_platform_review",
    })
    const [freeze] = callsTo(s.calls, "escrow_deposits", "update")
    expect(freeze.payload).toMatchObject({ status_v2: "disputed", status: "disputed" })
    expect(hasFilter(freeze, "eq", "status_v2", "funded")).toBe(true)
    expect(callsTo(user.calls, "dispute_messages", "insert")[0].payload).toEqual({
      dispute_id: "disp-1",
      sender_id: "agency-1",
      message: "Nothing was delivered",
    })
  })

  it("removes the dispute again if the escrow changed state before it could be frozen", async () => {
    const s = useService((op) => (op.table === "escrow_deposits" && op.action === "select" ? { data: escrow("funded") } : { data: null }))
    const user = fakeSupabase((op) => (op.table === "disputes" ? { data: { id: "disp-1" } } : {}))
    const res = await request(appWith({ id: "free-1" }, user.client, disputesRouter)).post("/").send(openBody)
    expect(res.status).toBe(409)
    expect(hasFilter(callsTo(s.calls, "disputes", "delete")[0], "eq", "id", "disp-1")).toBe(true)
  })
})

describe("POST /api/admin/disputes/:id/resolve", () => {
  const admin = { id: "admin-1" }
  const resolve = (outcome: string) =>
    request(appWith(admin, fakeSupabase(() => ({})).client, adminEscrowRouter)).post("/disputes/disp-1/resolve").send({ resolution_outcome: outcome })

  it("rejects partial release on v2", async () => {
    useService(() => ({}))
    const res = await resolve("partial_release")
    expect(res.status).toBe(422)
    expect(res.body.code).toBe("partial_not_supported")
  })

  it("409s for an already-resolved dispute", async () => {
    useService((op) => (op.table === "disputes" ? { data: { id: "disp-1", job_id: "job-1", status: "resolved" } } : {}))
    expect((await resolve("full_release")).status).toBe(409)
  })

  it("full release: disputed -> released, job made payable, dispute resolved by the session admin and audited", async () => {
    const s = useService((op) => {
      if (op.table === "disputes" && op.action === "select") return { data: { id: "disp-1", job_id: "job-1", status: "admin_intervention" } }
      if (op.table === "escrow_deposits" && op.action === "select") return { data: escrow("disputed") }
      if (op.table === "escrow_deposits" && op.action === "update") return { data: { id: "esc-1" } }
      if (op.table === "jobs" && op.action === "select") return { data: { payout_status: null } }
      return {}
    })
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)

    const res = await resolve("full_release")

    expect(res.status).toBe(200)
    expect(fetchMock).not.toHaveBeenCalled()
    const [release] = callsTo(s.calls, "escrow_deposits", "update")
    expect(release.payload).toMatchObject({ status_v2: "released" })
    expect(hasFilter(release, "eq", "status_v2", "disputed")).toBe(true)
    expect(callsTo(s.calls, "jobs", "update")[0].payload).toEqual({ status: "closed", payout_status: "completed" })
    expect(callsTo(s.calls, "disputes", "update")[0].payload).toMatchObject({ status: "resolved", resolution_outcome: "full_release", admin_id: "admin-1" })
    expect(auditMock).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ adminId: "admin-1", action: "dispute.resolve", targetId: "disp-1" }))
  })

  it("refund: calls Paystack's refund for the original charge, then disputed -> refunded", async () => {
    const s = useService((op) => {
      if (op.table === "disputes" && op.action === "select") return { data: { id: "disp-1", job_id: "job-1", status: "in_platform_review" } }
      if (op.table === "escrow_deposits" && op.action === "select") return { data: escrow("disputed") }
      if (op.table === "escrow_deposits" && op.action === "update") return { data: { id: "esc-1" } }
      return {}
    })
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: true, data: { id: 9, status: "pending" } }) })
    vi.stubGlobal("fetch", fetchMock)

    const res = await resolve("refund")

    expect(res.status).toBe(200)
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ transaction: "escrow_esc-1_a", amount: 5_000_000 })
    expect(callsTo(s.calls, "escrow_deposits", "update")[0].payload).toMatchObject({ status_v2: "refunded", status: "refunded" })
    expect(callsTo(s.calls, "jobs", "update")).toHaveLength(0)
  })

  it("leaves the escrow disputed when Paystack refuses the refund", async () => {
    const s = useService((op) => {
      if (op.table === "disputes" && op.action === "select") return { data: { id: "disp-1", job_id: "job-1", status: "in_platform_review" } }
      if (op.table === "escrow_deposits" && op.action === "select") return { data: escrow("disputed") }
      return {}
    })
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 400, json: async () => ({ status: false, message: "Transaction has been fully reversed" }) }))

    const res = await resolve("refund")

    expect(res.status).toBe(502)
    expect(callsTo(s.calls, "escrow_deposits", "update")).toHaveLength(0)
    expect(callsTo(s.calls, "disputes", "update")).toHaveLength(0)
  })
})

describe("GET /api/admin/analytics", () => {
  it("ranks freelancers by successful net payouts and agencies by funded escrow, in kobo", async () => {
    useService((op) => {
      if (op.table === "payouts") return { data: [{ freelancer_id: "f1", net_amount_kobo: 100 }, { freelancer_id: "f2", net_amount_kobo: 300 }, { freelancer_id: "f1", net_amount_kobo: 50 }] }
      if (op.table === "escrow_deposits") return { data: [{ agency_id: "a1", amount_kobo: 1000 }] }
      if (op.table === "profiles") return { data: [{ id: "f1", full_name: "One" }, { id: "f2", full_name: "Two" }, { id: "a1", company_name: "Acme" }] }
      return {}
    })
    const res = await request(appWith({ id: "admin-1" }, fakeSupabase(() => ({})).client, adminEscrowRouter)).get("/analytics")
    expect(res.body.topFreelancers.map((f: any) => [f.name, f.earned_kobo, f.paid_jobs])).toEqual([
      ["Two", 300, 1],
      ["One", 150, 2],
    ])
    expect(res.body.topAgencies[0]).toMatchObject({ name: "Acme", funded_kobo: 1000, funded_jobs: 1 })
  })
})
