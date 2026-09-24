import { describe, it, expect, vi, beforeEach } from "vitest"
import request from "supertest"
import express from "express"

const fakeService = { from: vi.fn() }
vi.mock("../lib/supabase.js", () => ({ createServiceClient: () => fakeService }))
vi.mock("../lib/referralCode.js", () => ({ generateReferralCode: () => "newcode123" }))

async function appWith(user: { id: string; user_metadata?: Record<string, unknown> }, supabase: any) {
  const app = express()
  app.use(express.json())
  app.use((req: any, _res, next) => {
    req.user = user
    req.supabase = supabase
    next()
  })
  const influencerRouter = (await import("./influencer.js")).default
  app.use("/", influencerRouter)
  return app
}

// Builds a chainable query-builder stub: .select().eq().maybeSingle() /
// .order() etc. all resolve to the given result.
function builder(result: { data: any; error: any } = { data: null, error: null }) {
  const b: any = {}
  const chain = () => b
  b.select = vi.fn(chain)
  b.eq = vi.fn(chain)
  b.in = vi.fn(chain)
  b.order = vi.fn(() => Promise.resolve(result))
  b.maybeSingle = vi.fn(() => Promise.resolve(result))
  b.insert = vi.fn(() => Promise.resolve(result))
  b.update = vi.fn(chain)
  return b
}

function readSupabase({ profile = null, referrals = [], payouts = [] }: { profile?: any; referrals?: any[]; payouts?: any[] } = {}) {
  return {
    from: vi.fn((table: string) => {
      if (table === "influencer_profiles") return builder({ data: profile, error: null })
      if (table === "referrals") return builder({ data: referrals, error: null })
      if (table === "influencer_payouts") return builder({ data: payouts, error: null })
      throw new Error(`unexpected read table ${table}`)
    }),
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("GET /me", () => {
  it("creates a new influencer profile + referral code on first load when none exists, and returns zeroed totals", async () => {
    const tables: Record<string, any> = {
      profiles: builder({ data: { account_type: "influencer" }, error: null }),
      influencer_profiles: builder({ data: null, error: null }), // no existing row
    }
    fakeService.from.mockImplementation((table: string) => {
      if (tables[table]) return tables[table]
      throw new Error(`unexpected service table ${table}`)
    })
    const supabase = readSupabase({ profile: null, referrals: [], payouts: [] })

    const res = await request(await appWith({ id: "user-1", user_metadata: {} }, supabase)).get("/me")

    expect(res.status).toBe(200)
    expect(tables.influencer_profiles.insert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: "user-1", referral_code: "newcode123" })
    )
    expect(res.body).toEqual({
      referralCode: null,
      displayName: null,
      socialHandle: null,
      totals: { referred: 0, qualified: 0, pending: 0, earnedNaira: 0, unpaidNaira: 0 },
      referrals: [],
      payouts: [],
    })
  })

  it("skips profile creation and returns real data when an influencer_profiles row already exists", async () => {
    const tables: Record<string, any> = {
      profiles: builder({ data: { account_type: "influencer" }, error: null }),
      influencer_profiles: builder({ data: { user_id: "user-1" }, error: null }), // existing row
    }
    fakeService.from.mockImplementation((table: string) => {
      if (tables[table]) return tables[table]
      throw new Error(`unexpected service table ${table}`)
    })
    const supabase = readSupabase({
      profile: { referral_code: "abc123", display_name: "Jane", social_handle: null, total_referrals: 2, total_qualified: 1, total_earned_kobo: 5000, balance_unpaid_kobo: 2000 },
      referrals: [{ id: "r-1", referred_account_type: "freelancer", status: "qualified", commission_kobo: 5000, created_at: "2026-01-01T00:00:00Z", qualified_at: "2026-01-02T00:00:00Z" }],
      payouts: [],
    })

    const res = await request(await appWith({ id: "user-1", user_metadata: {} }, supabase)).get("/me")

    expect(res.status).toBe(200)
    expect(tables.influencer_profiles.insert).not.toHaveBeenCalled()
    expect(res.body).toEqual({
      referralCode: "abc123",
      displayName: "Jane",
      socialHandle: null,
      totals: { referred: 2, qualified: 1, pending: 0, earnedNaira: 50, unpaidNaira: 20 },
      referrals: [{ id: "r-1", referred_account_type: "freelancer", status: "qualified", commission_kobo: 5000, created_at: "2026-01-01T00:00:00Z", qualified_at: "2026-01-02T00:00:00Z" }],
      payouts: [],
    })
  })

  it("attributes a referral from a valid, unclaimed ref_code exactly once", async () => {
    const influencerProfilesBuilder = builder({ data: null, error: null })
    const referralsBuilder = builder({ data: null, error: null }) // "already" check -> not found
    referralsBuilder.insert = vi.fn(() => Promise.resolve({ data: {}, error: null }))
    const profilesBuilder = builder({ data: { account_type: "freelancer" }, error: null })
    profilesBuilder.update = vi.fn(chainReturnsEq)

    function chainReturnsEq() {
      return { eq: vi.fn(() => Promise.resolve({ data: null, error: null })) }
    }

    // influencer_profiles is queried twice with different intents in the service
    // client: once for "does referred_by-referral_code exist" (keyed by
    // referral_code) -- give it a match -- and never for "own profile exists"
    // since accountType isn't "influencer" here.
    const influencerLookup = builder({ data: { user_id: "influencer-1", total_referrals: 3 }, error: null })

    fakeService.from.mockImplementation((table: string) => {
      if (table === "profiles") return profilesBuilder
      if (table === "influencer_profiles") return influencerLookup
      if (table === "referrals") return referralsBuilder
      throw new Error(`unexpected service table ${table}`)
    })
    const supabase = readSupabase({ profile: null, referrals: [], payouts: [] })

    const res = await request(
      await appWith({ id: "user-2", user_metadata: { ref_code: "abc123" } }, supabase)
    ).get("/me")

    expect(res.status).toBe(200)
    expect(referralsBuilder.insert).toHaveBeenCalledWith({
      influencer_id: "influencer-1",
      referred_user_id: "user-2",
      referred_account_type: "freelancer",
      status: "pending",
    })
    expect(profilesBuilder.update).toHaveBeenCalledWith({ referred_by: "influencer-1" })
    expect(influencerLookup.update).toHaveBeenCalledWith({ total_referrals: 4 })
  })

  it("does not attribute a referral when the user already has one recorded", async () => {
    const tables: Record<string, any> = {
      profiles: builder({ data: { account_type: "freelancer" }, error: null }),
      influencer_profiles: builder({ data: null, error: null }),
      referrals: builder({ data: { id: "existing-referral" }, error: null }), // "already" check -> found
    }
    fakeService.from.mockImplementation((table: string) => {
      if (tables[table]) return tables[table]
      throw new Error(`unexpected service table ${table}`)
    })
    const supabase = readSupabase({ profile: null, referrals: [], payouts: [] })

    const res = await request(
      await appWith({ id: "user-3", user_metadata: { ref_code: "abc123" } }, supabase)
    ).get("/me")

    expect(res.status).toBe(200)
    expect(tables.referrals.insert).not.toHaveBeenCalled()
  })

  it("does not attribute a self-referral", async () => {
    const tables: Record<string, any> = {
      profiles: builder({ data: { account_type: "influencer" }, error: null }),
      influencer_profiles: builder({ data: { user_id: "user-4", total_referrals: 1 }, error: null }),
      referrals: builder({ data: null, error: null }),
    }
    fakeService.from.mockImplementation((table: string) => {
      if (tables[table]) return tables[table]
      throw new Error(`unexpected service table ${table}`)
    })
    const supabase = readSupabase({ profile: null, referrals: [], payouts: [] })

    const res = await request(
      await appWith({ id: "user-4", user_metadata: { ref_code: "own-code" } }, supabase)
    ).get("/me")

    expect(res.status).toBe(200)
    expect(tables.referrals.insert).not.toHaveBeenCalled()
  })

  it("does not crash when the referral-code insert collides on every retry attempt", async () => {
    const tables: Record<string, any> = {
      profiles: builder({ data: { account_type: "influencer" }, error: null }),
      influencer_profiles: builder({ data: null, error: null }),
    }
    tables.influencer_profiles.insert = vi.fn(() => Promise.resolve({ data: null, error: { code: "23505" } }))
    fakeService.from.mockImplementation((table: string) => {
      if (tables[table]) return tables[table]
      throw new Error(`unexpected service table ${table}`)
    })
    const supabase = readSupabase({ profile: null, referrals: [], payouts: [] })

    const res = await request(await appWith({ id: "user-5", user_metadata: {} }, supabase)).get("/me")

    expect(res.status).toBe(200)
    expect(tables.influencer_profiles.insert).toHaveBeenCalledTimes(5)
    expect(res.body.referralCode).toBeNull()
  })

  it("silently ignores an invalid ref_code with no matching influencer", async () => {
    const tables: Record<string, any> = {
      profiles: builder({ data: { account_type: "freelancer" }, error: null }),
      influencer_profiles: builder({ data: null, error: null }), // no influencer matches this code
      referrals: builder({ data: null, error: null }),
    }
    fakeService.from.mockImplementation((table: string) => {
      if (tables[table]) return tables[table]
      throw new Error(`unexpected service table ${table}`)
    })
    const supabase = readSupabase({ profile: null, referrals: [], payouts: [] })

    const res = await request(
      await appWith({ id: "user-6", user_metadata: { ref_code: "does-not-exist" } }, supabase)
    ).get("/me")

    expect(res.status).toBe(200)
    expect(tables.referrals.insert).not.toHaveBeenCalled()
  })
})
