import { describe, it, expect, vi } from "vitest"
import express from "express"
import request from "supertest"
import userRouter from "./user.js"

function appWith(user: { id: string }, supabase: any) {
  const app = express()
  app.use(express.json())
  app.use((req: any, _res, next) => {
    req.user = user
    req.supabase = supabase
    next()
  })
  app.use("/", userRouter)
  return app
}

describe("GET /credits", () => {
  it("sums completed purchase credits for the authenticated user", async () => {
    const supabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn().mockResolvedValue({ data: [{ credits_amount: 10 }, { credits_amount: 5 }], error: null }),
          })),
        })),
      })),
    }
    const res = await request(appWith({ id: "user-1" }, supabase)).get("/credits")
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ credits: 15 })
  })

  it("ignores userId query param and uses caller's ID", async () => {
    const eqUserId = vi.fn().mockResolvedValue({ data: [{ credits_amount: 10 }], error: null })
    const eqStatus = vi.fn(() => ({ eq: eqUserId }))
    const supabase = { from: vi.fn(() => ({ select: vi.fn(() => ({ eq: eqStatus })) })) }

    const res = await request(appWith({ id: "user-1" }, supabase)).get("/credits?userId=user-2")
    expect(res.status).toBe(200)

    // Verify the query was made for user-1 (the caller), not user-2
    expect(supabase.from).toHaveBeenCalledWith("purchase_credits")
    expect(eqStatus).toHaveBeenCalledWith("freelancer_id", "user-1")
  })
})

describe("GET /profile", () => {
  it("returns the caller's profile", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: { id: "user-1", full_name: "Jane" }, error: null })
    const supabase = { from: vi.fn(() => ({ select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle })) })) })) }

    const res = await request(appWith({ id: "user-1" }, supabase)).get("/profile")

    expect(res.body).toEqual({ profile: { id: "user-1", full_name: "Jane" } })
  })
})

describe("GET /balance", () => {
  it("sums verified, unpaid Funded_jobs101 rows", async () => {
    const supabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn().mockResolvedValue({
            data: [
              { amount: 5000, status: "verified", payout_successful: false },
              { amount: 3000, status: "verified", payout_successful: true },
              { amount: 1000, status: "pending", payout_successful: false },
            ],
            error: null,
          }),
        })),
      })),
    }
    const res = await request(appWith({ id: "user-1" }, supabase)).get("/balance")
    expect(res.body).toEqual({ balance: 5000 })
  })
})

describe("GET /nin-verified", () => {
  it("returns true when a verified freelancer_verification row exists", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: { status: "verified" }, error: null })
    const supabase = {
      from: vi.fn(() => ({ select: vi.fn(() => ({ eq: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle })) })) })) })),
    }
    const res = await request(appWith({ id: "user-1" }, supabase)).get("/nin-verified")
    expect(res.body).toEqual({ verified: true })
  })
})

describe("GET /dashboard", () => {
  it("uses the get_freelancer_dashboard RPC when it succeeds", async () => {
    const supabase = {
      rpc: vi.fn().mockResolvedValue({
        data: { profile: { id: "user-1" }, credits: 100, balance: 5000, is_verified: true },
        error: null,
      }),
    }
    const res = await request(appWith({ id: "user-1" }, supabase)).get("/dashboard")
    expect(res.body).toEqual({ profile: { id: "user-1" }, credits: 100, balance: 5000, isVerified: true })
  })

  it("falls back to parallel queries when the RPC errors", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: { id: "user-1" }, error: null })
    const chainable: any = {
      then: (onFulfilled: any) => Promise.resolve({ data: [], error: null }).then(onFulfilled),
      catch: (onRejected: any) => Promise.resolve({ data: [], error: null }).catch(onRejected),
      maybeSingle,
      eq: () => chainable,
    }
    const supabase = {
      rpc: vi.fn().mockResolvedValue({ data: null, error: { message: "not deployed" } }),
      from: vi.fn(() => ({
        select: vi.fn(() => ({ eq: vi.fn(() => chainable) })),
      })),
    }
    const res = await request(appWith({ id: "user-1" }, supabase)).get("/dashboard")
    expect(res.status).toBe(200)
    expect(res.body.profile).toEqual({ id: "user-1" })
  })
})

describe("POST /freelancer-logos", () => {
  it("returns a map of freelancer_id to resolved avatar", async () => {
    process.env.SUPABASE_URL = "https://example.supabase.co"
    const inMock = vi.fn().mockResolvedValue({
      data: [{ freelancer_id: "f1", logo_path: "f1/logo.png", logo_data: null }],
      error: null,
    })
    const supabase = { from: vi.fn(() => ({ select: vi.fn(() => ({ in: inMock })) })) }

    const res = await request(appWith({ id: "user-1" }, supabase))
      .post("/freelancer-logos")
      .send({ freelancerIds: ["f1"] })

    expect(res.body).toEqual({
      logos: { f1: "https://example.supabase.co/storage/v1/object/public/avatars/f1/logo.png" },
    })
  })

  it("returns an empty map without querying when freelancerIds is empty", async () => {
    const supabase = { from: vi.fn() }
    const res = await request(appWith({ id: "user-1" }, supabase))
      .post("/freelancer-logos")
      .send({ freelancerIds: [] })

    expect(res.body).toEqual({ logos: {} })
    expect(supabase.from).not.toHaveBeenCalled()
  })
})

describe("GET /agency-image", () => {
  it("returns the resolved agency image for the caller", async () => {
    process.env.SUPABASE_URL = "https://example.supabase.co"
    const maybeSingle = vi.fn().mockResolvedValue({ data: { image_path: "a1/logo.png" }, error: null })
    const supabase = { from: vi.fn(() => ({ select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle })) })) })) }

    const res = await request(appWith({ id: "agency-1" }, supabase)).get("/agency-image")

    expect(res.body).toEqual({
      image: "https://example.supabase.co/storage/v1/object/public/avatars/a1/logo.png",
    })
  })
})
