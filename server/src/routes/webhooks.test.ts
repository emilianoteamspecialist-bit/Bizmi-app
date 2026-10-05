import crypto from "node:crypto"
import { describe, it, expect, vi, beforeEach } from "vitest"
import express from "express"
import request from "supertest"
import { fakeSupabase, callsTo, hasFilter, type Handler } from "../test/fakeSupabase.js"

let service = fakeSupabase(() => ({}))
vi.mock("../lib/supabase.js", () => ({ createServiceClient: () => service.client }))
const notifyMock = vi.fn()
vi.mock("../lib/notifications.js", () => ({ notifyFreelancerPayout: (...a: unknown[]) => notifyMock(...a) }))

import webhooksRouter from "./webhooks.js"

const SECRET = "sk_test_secret"
const sign = (body: string) => crypto.createHmac("sha512", SECRET).update(body).digest("hex")

function app() {
  const a = express()
  a.use("/", webhooksRouter)
  return a
}

function post(event: unknown, signature?: string) {
  const body = JSON.stringify(event)
  return request(app())
    .post("/paystack")
    .set("Content-Type", "application/json")
    .set("x-paystack-signature", signature ?? sign(body))
    .send(body)
}

const awaitingEscrow = {
  id: "esc-1",
  job_id: "job-1",
  agency_id: "agency-1",
  freelancer_id: "free-1",
  amount_kobo: 5_000_000,
  status_v2: "awaiting",
}

const charge = (overrides: Record<string, unknown> = {}) => ({
  event: "charge.success",
  data: { id: 111, status: "success", reference: "escrow_esc-1_abc", amount: 5_000_000, ...overrides },
})

function useService(handler: Handler) {
  service = fakeSupabase(handler)
  return service
}

beforeEach(() => {
  process.env.PAYSTACK_SECRET_KEY = SECRET
  notifyMock.mockReset()
  vi.spyOn(console, "error").mockImplementation(() => {})
  vi.spyOn(console, "warn").mockImplementation(() => {})
})

describe("POST /paystack", () => {
  it("rejects a bad signature without touching the database", async () => {
    const s = useService(() => ({}))
    const res = await post(charge(), "0".repeat(128))
    expect(res.status).toBe(400)
    expect(s.calls).toHaveLength(0)
  })

  it("acknowledges a replayed event without reprocessing it", async () => {
    const s = useService((op) => (op.table === "webhook_events" && op.action === "insert" ? { error: { code: "23505" } } : {}))
    const res = await post(charge())
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ received: true, deduped: true })
    expect(callsTo(s.calls, "escrow_deposits")).toHaveLength(0)
  })

  it("claims the event, funds the matching escrow and marks the event processed", async () => {
    const s = useService((op) => {
      if (op.table === "escrow_deposits" && op.action === "select") return { data: awaitingEscrow }
      if (op.table === "escrow_deposits" && op.action === "update") return { data: { id: "esc-1" } }
      return {}
    })

    const res = await post(charge())

    expect(res.status).toBe(200)
    const [claim] = callsTo(s.calls, "webhook_events", "insert")
    expect(claim.payload).toMatchObject({ provider: "paystack", event_id: "charge.success:111" })
    const [lookup] = callsTo(s.calls, "escrow_deposits", "select")
    expect(hasFilter(lookup, "eq", "paystack_reference", "escrow_esc-1_abc")).toBe(true)
    const [update] = callsTo(s.calls, "escrow_deposits", "update")
    expect(update.payload).toMatchObject({ status_v2: "funded" })
    const [rpc] = callsTo(s.calls, "escrow_append_event", "rpc")
    expect(rpc.payload).toMatchObject({ p_to: "funded", p_actor_type: "system", p_idempotency_key: "paystack:charge.success:111" })
    expect(callsTo(s.calls, "webhook_events", "update")[0].payload).toHaveProperty("processed_at")
  })

  it("does not fund when Paystack reports a different amount", async () => {
    const s = useService((op) => (op.table === "escrow_deposits" && op.action === "select" ? { data: awaitingEscrow } : {}))
    const res = await post(charge({ amount: 100 }))
    expect(res.status).toBe(200)
    expect(callsTo(s.calls, "escrow_deposits", "update")).toHaveLength(0)
  })

  it("ignores charges that aren't escrow references (e.g. credit purchases)", async () => {
    const s = useService(() => ({}))
    const res = await post(charge({ reference: "credits_xyz" }))
    expect(res.status).toBe(200)
    expect(callsTo(s.calls, "escrow_deposits")).toHaveLength(0)
  })

  it("releases the claim and returns 500 when applying the event fails, so Paystack's retry is processed", async () => {
    const s = useService((op) =>
      op.table === "escrow_deposits" && op.action === "select" ? { error: { message: "db down" } } : {}
    )
    const res = await post(charge())
    expect(res.status).toBe(500)
    const [release] = callsTo(s.calls, "webhook_events", "delete")
    expect(hasFilter(release, "eq", "event_id", "charge.success:111")).toBe(true)
  })

  it("settles a successful payout transfer: payouts -> success, escrow released -> paid_out, legacy job paid", async () => {
    const s = useService((op) => {
      if (op.table === "payouts" && op.action === "update")
        return { data: { id: "pay-1", escrow_id: "esc-1", freelancer_id: "free-1", net_amount_kobo: 4_250_000 } }
      if (op.table === "escrow_deposits" && op.action === "select") return { data: { job_id: "job-1" } }
      if (op.table === "escrow_deposits" && op.action === "update") return { data: { id: "esc-1" } }
      return {}
    })

    const res = await post({ event: "transfer.success", data: { id: 222, reference: "payout_pay-1", transfer_code: "TRF_1" } })

    expect(res.status).toBe(200)
    const [payoutUpdate] = callsTo(s.calls, "payouts", "update")
    expect(payoutUpdate.payload).toMatchObject({ status: "success", paystack_transfer_code: "TRF_1" })
    expect(hasFilter(payoutUpdate, "eq", "status", "processing")).toBe(true)
    const [escrowUpdate] = callsTo(s.calls, "escrow_deposits", "update")
    expect(escrowUpdate.payload).toMatchObject({ status_v2: "paid_out" })
    expect(hasFilter(escrowUpdate, "eq", "status_v2", "released")).toBe(true)
    const [jobUpdate] = callsTo(s.calls, "jobs", "update")
    expect(jobUpdate.payload).toMatchObject({ payout_status: "paid", payout_amount: 42_500 })
    expect(notifyMock).toHaveBeenCalledWith("free-1", "job-1", 42_500)
  })

  it("on a failed transfer, marks the payout failed and reopens the job for a retry", async () => {
    const s = useService((op) => {
      if (op.table === "payouts" && op.action === "update")
        return { data: { id: "pay-1", escrow_id: "esc-1", freelancer_id: "free-1", net_amount_kobo: 4_250_000 } }
      if (op.table === "escrow_deposits" && op.action === "select") return { data: { job_id: "job-1" } }
      return {}
    })

    await post({ event: "transfer.failed", data: { id: 333, reference: "payout_pay-1", reason: "Account closed" } })

    expect(callsTo(s.calls, "payouts", "update")[0].payload).toMatchObject({ status: "failed", failure_reason: "Account closed" })
    expect(callsTo(s.calls, "escrow_deposits", "update")).toHaveLength(0)
    const [jobUpdate] = callsTo(s.calls, "jobs", "update")
    expect(jobUpdate.payload).toEqual({ payout_status: "completed" })
    expect(hasFilter(jobUpdate, "eq", "payout_status", "processing")).toBe(true)
  })

  it("does nothing for a transfer whose payout is already settled (late duplicate)", async () => {
    const s = useService(() => ({ data: null }))
    await post({ event: "transfer.success", data: { id: 444, reference: "payout_pay-1" } })
    expect(callsTo(s.calls, "escrow_deposits")).toHaveLength(0)
    expect(callsTo(s.calls, "jobs")).toHaveLength(0)
  })
})
