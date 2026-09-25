import { describe, it, expect, vi, beforeEach } from "vitest"
import request from "supertest"

const getUserMock = vi.fn()
const singleMock = vi.fn()
const fakeService = { from: vi.fn() }

vi.mock("../lib/supabase.js", () => ({
  createUserClient: vi.fn(() => ({
    auth: { getUser: getUserMock },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: singleMock,
        })),
      })),
    })),
  })),
  createServiceClient: () => fakeService,
}))
vi.mock("../lib/referralCode.js", () => ({ generateReferralCode: () => "newcode123" }))

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

beforeEach(() => {
  getUserMock.mockReset()
  singleMock.mockReset()
  fakeService.from.mockReset()
  process.env.CLIENT_ORIGIN = "http://localhost:5173"
})

describe("GET /api/me", () => {
  it("returns 401 without a token", async () => {
    const { createApp } = await import("../app.js")
    const res = await request(createApp()).get("/api/me")
    expect(res.status).toBe(401)
  })

  it("returns the caller's profile when authenticated", async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: "user-1", email: "a@b.com" } },
      error: null,
    })
    singleMock.mockResolvedValue({
      data: { id: "user-1", full_name: "Jane Doe", account_type: "freelancer" },
      error: null,
    })

    const { createApp } = await import("../app.js")
    const res = await request(createApp())
      .get("/api/me")
      .set("Authorization", "Bearer good-token")

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ id: "user-1", full_name: "Jane Doe", account_type: "freelancer" })
  })
})

describe("POST /api/me/referral-sync", () => {
  function auth(userId: string, meta: Record<string, unknown> = {}) {
    getUserMock.mockResolvedValue({
      data: { user: { id: userId, email: "a@b.com", user_metadata: meta } },
      error: null,
    })
  }

  it("attributes a referral for a freelancer with a valid ref_code", async () => {
    auth("user-2", { ref_code: "abc123" })

    const referralsBuilder = builder({ data: null, error: null }) // "already" check -> not found
    referralsBuilder.insert = vi.fn(() => Promise.resolve({ data: {}, error: null }))
    const profilesBuilder = builder({ data: { account_type: "freelancer" }, error: null })
    profilesBuilder.update = vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ data: null, error: null })) }))
    const influencerLookup = builder({ data: { user_id: "influencer-1", total_referrals: 3 }, error: null })

    fakeService.from.mockImplementation((table: string) => {
      if (table === "profiles") return profilesBuilder
      if (table === "influencer_profiles") return influencerLookup
      if (table === "referrals") return referralsBuilder
      throw new Error(`unexpected service table ${table}`)
    })

    const { createApp } = await import("../app.js")
    const res = await request(createApp())
      .post("/api/me/referral-sync")
      .set("Authorization", "Bearer good-token")

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ success: true })
    expect(referralsBuilder.insert).toHaveBeenCalledWith({
      influencer_id: "influencer-1",
      referred_user_id: "user-2",
      referred_account_type: "freelancer",
      status: "pending",
    })
  })

  it("does nothing when there is no ref_code in user_metadata", async () => {
    auth("user-1", {})

    const tables: Record<string, any> = {
      profiles: builder({ data: { account_type: "freelancer" }, error: null }),
      influencer_profiles: builder({ data: null, error: null }),
      referrals: builder({ data: null, error: null }),
    }
    fakeService.from.mockImplementation((table: string) => {
      if (tables[table]) return tables[table]
      throw new Error(`unexpected service table ${table}`)
    })

    const { createApp } = await import("../app.js")
    const res = await request(createApp())
      .post("/api/me/referral-sync")
      .set("Authorization", "Bearer good-token")

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ success: true })
    expect(tables.referrals.insert).not.toHaveBeenCalled()
  })

  it("does not attribute when the user already has a referral recorded", async () => {
    auth("user-3", { ref_code: "abc123" })

    const tables: Record<string, any> = {
      profiles: builder({ data: { account_type: "freelancer" }, error: null }),
      influencer_profiles: builder({ data: null, error: null }),
      referrals: builder({ data: { id: "existing-referral" }, error: null }), // "already" check -> found
    }
    fakeService.from.mockImplementation((table: string) => {
      if (tables[table]) return tables[table]
      throw new Error(`unexpected service table ${table}`)
    })

    const { createApp } = await import("../app.js")
    const res = await request(createApp())
      .post("/api/me/referral-sync")
      .set("Authorization", "Bearer good-token")

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ success: true })
    expect(tables.referrals.insert).not.toHaveBeenCalled()
  })
})
