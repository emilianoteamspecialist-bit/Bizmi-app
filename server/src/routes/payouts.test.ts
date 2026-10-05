import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import express from "express"
import request from "supertest"
import { fakeSupabase, callsTo, hasFilter, type Handler } from "../test/fakeSupabase.js"

let service = fakeSupabase(() => ({}))
vi.mock("../lib/supabase.js", () => ({ createServiceClient: () => service.client }))

import payoutsRouter from "./payouts.js"

function appWith(user: { id: string }, userClient: any) {
  const a = express()
  a.use(express.json())
  a.use((req: any, _res, next) => {
    req.user = user
    req.supabase = userClient
    next()
  })
  a.use("/", payoutsRouter)
  a.use((err: any, _req: any, res: any, _next: any) => res.status(500).json({ error: err.message }))
  return a
}

const useService = (handler: Handler) => (service = fakeSupabase(handler))
const freelancer = { id: "free-1" }
const bank = { account_number: "0123456789", bank_code: "058", account_name: "JANE DOE" }
const releasedEscrow = { id: "esc-1", job_id: "job-1", freelancer_id: "free-1", amount_kobo: 5_000_000, status_v2: "released" }

// Paystack responses keyed by path.
function paystack(routes: Record<string, unknown | Error>) {
  return vi.fn(async (url: string, _init?: RequestInit) => {
    const path = Object.keys(routes).find((p) => url.includes(p))
    const r = path ? routes[path] : undefined
    if (r instanceof Error) throw r
    if (r === undefined) return { ok: false, status: 404, json: async () => ({ status: false, message: "no route" }) }
    if ((r as any).__fail) return { ok: true, json: async () => ({ status: false, message: (r as any).__fail }) }
    return { ok: true, json: async () => ({ status: true, data: r }) }
  })
}

function serviceFor(overrides: Handler = () => undefined) {
  return useService((op) => {
    const o = overrides(op)
    if (o) return o
    if (op.table === "escrow_deposits") return { data: releasedEscrow }
    if (op.table === "jobs" && op.action === "update" && op.payload.payout_status === "processing") return { data: { id: "job-1" } }
    if (op.table === "payouts" && op.action === "insert") return { data: { id: "pay-1" } }
    return {}
  })
}

beforeEach(() => {
  process.env.PAYSTACK_SECRET_KEY = "sk_test"
  vi.spyOn(console, "error").mockImplementation(() => {})
})
afterEach(() => vi.unstubAllGlobals())

describe("POST /request", () => {
  it("404s for an escrow that belongs to someone else", async () => {
    serviceFor((op) => (op.table === "escrow_deposits" ? { data: { ...releasedEscrow, freelancer_id: "other" } } : undefined))
    const user = fakeSupabase(() => ({ data: bank }))
    const res = await request(appWith(freelancer, user.client)).post("/request").send({ escrowId: "esc-1" })
    expect(res.status).toBe(404)
  })

  it.each(["funded", "paid_out", "disputed", "refunded"])("refuses a payout while the escrow is %s", async (status) => {
    const s = serviceFor((op) => (op.table === "escrow_deposits" ? { data: { ...releasedEscrow, status_v2: status } } : undefined))
    const user = fakeSupabase(() => ({ data: bank }))
    const res = await request(appWith(freelancer, user.client)).post("/request").send({ escrowId: "esc-1" })
    expect(res.status).toBe(409)
    expect(callsTo(s.calls, "payouts")).toHaveLength(0)
  })

  it("requires verified bank details", async () => {
    serviceFor()
    const user = fakeSupabase(() => ({ data: null }))
    const res = await request(appWith(freelancer, user.client)).post("/request").send({ escrowId: "esc-1" })
    expect(res.status).toBe(400)
    expect(res.body.code).toBe("no_bank_details")
  })

  it("409s without inserting a payout when the job's payout claim is already taken (e.g. by the legacy app)", async () => {
    const s = serviceFor((op) => (op.table === "jobs" && op.action === "update" ? { data: null } : undefined))
    const user = fakeSupabase(() => ({ data: bank }))
    const res = await request(appWith(freelancer, user.client)).post("/request").send({ escrowId: "esc-1" })
    expect(res.status).toBe(409)
    const [claim] = callsTo(s.calls, "jobs", "update")
    expect(hasFilter(claim, "eq", "payout_status", "completed")).toBe(true)
    expect(callsTo(s.calls, "payouts", "insert")).toHaveLength(0)
  })

  it("releases the claim and 409s when another payout is already active for the escrow", async () => {
    const s = serviceFor((op) => (op.table === "payouts" && op.action === "insert" ? { error: { code: "23505" } } : undefined))
    const user = fakeSupabase(() => ({ data: bank }))
    const res = await request(appWith(freelancer, user.client)).post("/request").send({ escrowId: "esc-1" })
    expect(res.status).toBe(409)
    const updates = callsTo(s.calls, "jobs", "update")
    expect(updates[updates.length - 1].payload).toEqual({ payout_status: "completed" })
  })

  it("records a server-derived payout and transfers the net amount with a payout_ reference", async () => {
    const s = serviceFor()
    const user = fakeSupabase(() => ({ data: bank }))
    const fetchMock = paystack({ "/transferrecipient": { recipient_code: "RCP_1" }, "/transfer": { transfer_code: "TRF_1", status: "pending" } })
    vi.stubGlobal("fetch", fetchMock)

    const res = await request(appWith(freelancer, user.client)).post("/request").send({ escrowId: "esc-1", amount: 999_999_999 })

    expect(res.status).toBe(200)
    expect(res.body.payout).toEqual({ id: "pay-1", status: "processing", net_amount_kobo: 4_250_000 })
    const [insert] = callsTo(s.calls, "payouts", "insert")
    expect(insert.payload).toMatchObject({
      escrow_id: "esc-1",
      freelancer_id: "free-1",
      gross_amount_kobo: 5_000_000,
      platform_fee_kobo: 750_000,
      net_amount_kobo: 4_250_000,
      status: "pending",
    })
    const transferCall = fetchMock.mock.calls.find(([u]) => (u as string).endsWith("/transfer"))!
    expect(JSON.parse((transferCall[1] as any).body)).toMatchObject({ amount: 4_250_000, recipient: "RCP_1", reference: "payout_pay-1" })
    const payoutUpdates = callsTo(s.calls, "payouts", "update").map((u) => u.payload)
    expect(payoutUpdates).toContainEqual({ status: "processing", paystack_recipient_code: "RCP_1" })
    expect(payoutUpdates).toContainEqual({ paystack_transfer_code: "TRF_1" })
  })

  it("marks the payout failed and releases the claim when Paystack rejects the transfer", async () => {
    const s = serviceFor()
    const user = fakeSupabase(() => ({ data: bank }))
    vi.stubGlobal("fetch", paystack({ "/transferrecipient": { recipient_code: "RCP_1" }, "/transfer": { __fail: "Insufficient balance" } }))

    const res = await request(appWith(freelancer, user.client)).post("/request").send({ escrowId: "esc-1" })

    expect(res.status).toBe(502)
    expect(callsTo(s.calls, "payouts", "update").map((u) => u.payload)).toContainEqual({ status: "failed", failure_reason: "Insufficient balance" })
    const jobUpdates = callsTo(s.calls, "jobs", "update")
    expect(jobUpdates[jobUpdates.length - 1].payload).toEqual({ payout_status: "completed" })
  })

  it("leaves the payout processing and the claim held on an ambiguous network failure (no blind retry)", async () => {
    const s = serviceFor()
    const user = fakeSupabase(() => ({ data: bank }))
    vi.stubGlobal("fetch", paystack({ "/transferrecipient": { recipient_code: "RCP_1" }, "/transfer": new TypeError("socket hang up") }))

    const res = await request(appWith(freelancer, user.client)).post("/request").send({ escrowId: "esc-1" })

    expect(res.status).toBe(202)
    expect(callsTo(s.calls, "payouts", "update").map((u) => u.payload)).not.toContainEqual(expect.objectContaining({ status: "failed" }))
    expect(callsTo(s.calls, "jobs", "update")).toHaveLength(1) // only the original claim
  })
})

describe("bank details", () => {
  it("rejects an account number that isn't 10 digits", async () => {
    const user = fakeSupabase(() => ({}))
    const res = await request(appWith(freelancer, user.client)).put("/bank-details").send({ account_number: "123", bank_code: "058" })
    expect(res.status).toBe(400)
  })

  it("saves the Paystack-resolved account name, not a user-supplied one", async () => {
    const user = fakeSupabase(() => ({ data: null }))
    vi.stubGlobal("fetch", paystack({ "/bank/resolve": { account_name: "JANE DOE", account_number: "0123456789" } }))

    const res = await request(appWith(freelancer, user.client))
      .put("/bank-details")
      .send({ account_number: "0123456789", bank_code: "058", account_name: "Someone Else" })

    expect(res.status).toBe(200)
    expect(callsTo(user.calls, "freelancer_bank_details", "insert")[0].payload).toMatchObject({
      freelancer_id: "free-1",
      account_number: "0123456789",
      bank_code: "058",
      account_name: "JANE DOE",
    })
  })

  it("returns 400 with Paystack's message when the account can't be resolved", async () => {
    const user = fakeSupabase(() => ({}))
    vi.stubGlobal("fetch", paystack({ "/bank/resolve": { __fail: "Could not resolve account name" } }))
    const res = await request(appWith(freelancer, user.client)).put("/bank-details").send({ account_number: "0123456789", bank_code: "058" })
    expect(res.status).toBe(400)
    expect(res.body.error).toBe("Could not resolve account name")
  })
})
