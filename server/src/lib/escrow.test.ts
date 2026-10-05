import { describe, it, expect, vi, beforeEach } from "vitest"
import { fakeSupabase, callsTo, hasFilter } from "../test/fakeSupabase.js"
import { payoutAmounts, transitionEscrow, markEscrowFunded, type EscrowRow } from "./escrow.js"

const escrow: EscrowRow = {
  id: "esc-1",
  job_id: "job-1",
  agency_id: "agency-1",
  freelancer_id: "free-1",
  amount_kobo: 5_000_000,
  status_v2: "awaiting",
}

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {})
})

describe("payoutAmounts", () => {
  it("takes the 15% platform fee in integer kobo", () => {
    expect(payoutAmounts(5_000_000)).toEqual({ grossKobo: 5_000_000, feeKobo: 750_000, netKobo: 4_250_000 })
  })

  it("rounds the fee and keeps gross = fee + net exactly", () => {
    const { grossKobo, feeKobo, netKobo } = payoutAmounts(333)
    expect(feeKobo).toBe(50)
    expect(feeKobo + netKobo).toBe(grossKobo)
  })

  it.each([0, -100, 1.5, NaN])("rejects an invalid amount (%s)", (amount) => {
    expect(() => payoutAmounts(amount)).toThrow()
  })
})

describe("transitionEscrow", () => {
  it("updates guarded on the from-status, mirrors the legacy status and appends the event", async () => {
    const { client, calls } = fakeSupabase((op) => (op.action === "update" ? { data: { id: "esc-1" } } : {}))

    const won = await transitionEscrow(client, {
      escrowId: "esc-1",
      from: "funded",
      to: "released",
      type: "released",
      amountKobo: 100,
      actorId: "agency-1",
      actorType: "agency",
      idempotencyKey: "release:esc-1",
    })

    expect(won).toBe(true)
    const [update] = callsTo(calls, "escrow_deposits", "update")
    expect(update.payload).toEqual({ status_v2: "released", status: "confirmed" })
    expect(hasFilter(update, "eq", "id", "esc-1")).toBe(true)
    expect(hasFilter(update, "eq", "status_v2", "funded")).toBe(true)
    const [rpc] = callsTo(calls, "escrow_append_event", "rpc")
    expect(rpc.payload).toMatchObject({ p_escrow_id: "esc-1", p_from: "funded", p_to: "released", p_idempotency_key: "release:esc-1" })
  })

  it("returns false and writes no event when the escrow is no longer in the from-status", async () => {
    const { client, calls } = fakeSupabase(() => ({ data: null }))

    const won = await transitionEscrow(client, {
      escrowId: "esc-1",
      from: "funded",
      to: "released",
      type: "released",
      actorType: "agency",
      idempotencyKey: "k",
    })

    expect(won).toBe(false)
    expect(callsTo(calls, "escrow_append_event")).toHaveLength(0)
  })

  it("throws when the update itself errors (e.g. the state-machine trigger rejects it)", async () => {
    const { client } = fakeSupabase(() => ({ error: { message: "Invalid escrow status transition" } }))
    await expect(
      transitionEscrow(client, { escrowId: "esc-1", from: "funded", to: "paid_out", type: "x", actorType: "system", idempotencyKey: "k" })
    ).rejects.toMatchObject({ message: "Invalid escrow status transition" })
  })

  it("still reports success when only the audit event fails to append", async () => {
    const { client } = fakeSupabase((op) => (op.action === "rpc" ? { error: { message: "boom" } } : { data: { id: "esc-1" } }))
    await expect(
      transitionEscrow(client, { escrowId: "esc-1", from: "funded", to: "disputed", type: "disputed", actorType: "agency", idempotencyKey: "k" })
    ).resolves.toBe(true)
  })
})

describe("markEscrowFunded", () => {
  const opts = { reference: "escrow_esc-1_x", actorType: "system" as const, idempotencyKey: "paystack:1", via: "webhook" }

  it("refuses to fund when the paid amount differs from the escrow amount", async () => {
    const { client, calls } = fakeSupabase(() => ({}))
    expect(await markEscrowFunded(client, escrow, 4_999_999, opts)).toBe("amount_mismatch")
    expect(callsTo(calls, "escrow_deposits", "update")).toHaveLength(0)
  })

  it("is a no-op for an escrow that is already past awaiting", async () => {
    const { client, calls } = fakeSupabase(() => ({}))
    expect(await markEscrowFunded(client, { ...escrow, status_v2: "funded" }, 5_000_000, opts)).toBe("already")
    expect(calls).toHaveLength(0)
  })

  it("funds the escrow and mirrors it to Funded_jobs101", async () => {
    const { client, calls } = fakeSupabase((op) => {
      if (op.table === "escrow_deposits" && op.action === "update") return { data: { id: "esc-1" } }
      if (op.table === "profiles") return { data: { company_name: "Acme" } }
      if (op.table === "jobs") return { data: { title: "Site" } }
      return {}
    })

    expect(await markEscrowFunded(client, escrow, 5_000_000, opts)).toBe("funded")
    const [update] = callsTo(calls, "escrow_deposits", "update")
    expect(update.payload).toMatchObject({ status_v2: "funded", status: "funded" })
    const [mirror] = callsTo(calls, "Funded_jobs101", "insert")
    expect(mirror.payload).toMatchObject({ reference_id: "escrow_esc-1_x", amount: 50_000, agency_name: "Acme", job_title: "Site" })
  })

  it("reports 'already' when it loses the race to another funder", async () => {
    const { client } = fakeSupabase((op) => (op.table === "Funded_jobs101" ? { data: { id: "existing" } } : { data: null }))
    expect(await markEscrowFunded(client, escrow, 5_000_000, opts)).toBe("already")
  })
})
