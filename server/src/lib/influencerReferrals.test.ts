import { describe, it, expect, vi, beforeEach } from "vitest"
import { fakeSupabase, callsTo, hasFilter } from "../test/fakeSupabase.js"
import { qualifyReferralOnRelease } from "./influencerReferrals.js"

const escrow = { job_id: "job-1", agency_id: "agency-1", freelancer_id: "free-1", amount_kobo: 5_000_000 }

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {})
})

describe("qualifyReferralOnRelease", () => {
  it("qualifies a pending referral with commission = commission% of the platform fee, and credits the influencer", async () => {
    const { client, calls } = fakeSupabase((op) => {
      if (op.table === "referrals" && op.action === "select") return { data: [{ id: "ref-1", influencer_id: "inf-1" }] }
      if (op.table === "app_settings") return { data: { value: hasFilter(op, "eq", "key", "platform_fee_pct") ? 15 : 10 } }
      if (op.table === "referrals" && op.action === "update") return { data: { id: "ref-1" } }
      if (op.table === "influencer_profiles" && op.action === "select") return { data: { total_qualified: 2, total_earned_kobo: 1000, balance_unpaid_kobo: 500 } }
      return {}
    })

    await qualifyReferralOnRelease(client, escrow)

    // fee = 15% of 5,000,000 = 750,000; commission = 10% of that = 75,000 kobo
    const [claim] = callsTo(calls, "referrals", "update")
    expect(claim.payload).toMatchObject({ status: "qualified", qualifying_job_id: "job-1", commission_kobo: 75_000 })
    expect(hasFilter(claim, "eq", "status", "pending")).toBe(true)
    expect(callsTo(calls, "influencer_profiles", "update")[0].payload).toEqual({
      total_qualified: 3,
      total_earned_kobo: 76_000,
      balance_unpaid_kobo: 75_500,
    })
  })

  it("does not credit the influencer when the referral was already claimed by a concurrent release", async () => {
    const { client, calls } = fakeSupabase((op) => {
      if (op.table === "referrals" && op.action === "select") return { data: [{ id: "ref-1", influencer_id: "inf-1" }] }
      if (op.table === "referrals" && op.action === "update") return { data: null }
      return {}
    })
    await qualifyReferralOnRelease(client, escrow)
    expect(callsTo(calls, "influencer_profiles")).toHaveLength(0)
  })

  it("is a no-op when neither party has a pending referral", async () => {
    const { client, calls } = fakeSupabase(() => ({ data: [] }))
    await qualifyReferralOnRelease(client, escrow)
    expect(callsTo(calls, "referrals", "update")).toHaveLength(0)
  })

  it("never throws, even when the database errors", async () => {
    const client = { from: () => { throw new Error("db down") } } as any
    await expect(qualifyReferralOnRelease(client, escrow)).resolves.toBeUndefined()
  })
})
