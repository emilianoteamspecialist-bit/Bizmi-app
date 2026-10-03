import { describe, it, expect, vi, afterEach, beforeEach } from "vitest"
import express from "express"
import request from "supertest"
import userRouter from "./user.js"

const fakeService = { from: vi.fn(), auth: { admin: { deleteUser: vi.fn() } } as any }
vi.mock("../lib/supabase.js", () => ({ createServiceClient: () => fakeService }))

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

describe("GET /credits/history", () => {
  it("returns the caller's purchase history, newest first", async () => {
    const orderMock = vi.fn().mockResolvedValue({
      data: [
        { id: "p-2", amount: 1000, credits_amount: 20, status: "completed", created_at: "2026-02-01T00:00:00Z", paystack_reference: "ref-2" },
        { id: "p-1", amount: 500, credits_amount: 10, status: "completed", created_at: "2026-01-01T00:00:00Z", paystack_reference: "ref-1" },
      ],
      error: null,
    })
    const eqMock = vi.fn(() => ({ order: orderMock }))
    const supabase = { from: vi.fn(() => ({ select: vi.fn(() => ({ eq: eqMock })) })) }

    const res = await request(appWith({ id: "user-1" }, supabase)).get("/credits/history")

    expect(res.status).toBe(200)
    expect(supabase.from).toHaveBeenCalledWith("purchase_credits")
    expect(eqMock).toHaveBeenCalledWith("freelancer_id", "user-1")
    expect(orderMock).toHaveBeenCalledWith("created_at", { ascending: false })
    expect(res.body.purchases).toHaveLength(2)
    expect(res.body.purchases[0].id).toBe("p-2")
  })

  it("returns an empty list on a query error", async () => {
    const orderMock = vi.fn().mockResolvedValue({ data: null, error: { message: "boom" } })
    const supabase = { from: vi.fn(() => ({ select: vi.fn(() => ({ eq: vi.fn(() => ({ order: orderMock })) })) })) }

    const res = await request(appWith({ id: "user-1" }, supabase)).get("/credits/history")

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ purchases: [] })
  })
})

describe("POST /credits/verify", () => {
  const validVerifyBody = { reference: "ref-123", amount: 500 }

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  beforeEach(() => {
    fakeService.from = vi.fn()
  })

  function mockService({
    escrowMatch = null,
    fundedJobMatch = null,
    paystackDataMatch = null,
    denylistError = null,
    insertResult = { data: null, error: null },
  }: {
    escrowMatch?: { id: string } | null
    fundedJobMatch?: { id: string } | null
    paystackDataMatch?: { id: string } | null
    denylistError?: { message: string; code?: string } | null
    insertResult?: { data: any; error: any }
  } = {}) {
    const insertMock = vi.fn(() => ({ select: vi.fn(() => ({ single: vi.fn().mockResolvedValue(insertResult) })) }))
    fakeService.from = vi.fn((table: string) => {
      if (table === "escrow_deposits") {
        return { select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn().mockResolvedValue({ data: escrowMatch, error: denylistError }) })) })) }
      }
      if (table === "Funded_jobs101") {
        return { select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn().mockResolvedValue({ data: fundedJobMatch, error: denylistError }) })) })) }
      }
      if (table === "Paystack_data") {
        return { select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn().mockResolvedValue({ data: paystackDataMatch, error: denylistError }) })) })) }
      }
      if (table === "purchase_credits") return { insert: insertMock }
      throw new Error(`unexpected service table ${table}`)
    })
    return insertMock
  }

  function mockFetch(data: { status: string; amount: number; currency: string; reference?: string }) {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ status: true, data: { reference: "ref-123", ...data } }),
      })
    )
  }

  it("returns 400 when reference or amount is missing or the wrong type", async () => {
    const supabase = { from: vi.fn() }
    const res = await request(appWith({ id: "user-1" }, supabase)).post("/credits/verify").send({ reference: "ref-123" })
    expect(res.status).toBe(400)
    expect(supabase.from).not.toHaveBeenCalled()
    expect(fakeService.from).not.toHaveBeenCalled()
  })

  it("verifies with Paystack, inserts a completed purchase scoped to the caller, and returns success", async () => {
    mockFetch({ status: "success", amount: 50000, currency: "NGN" })
    const insertedRow = { id: "p-1", amount: 500, credits_amount: 10, status: "completed", created_at: "2026-01-01T00:00:00Z", paystack_reference: "ref-123" }
    const insertMock = mockService({ insertResult: { data: insertedRow, error: null } })
    const supabase = { from: vi.fn() }

    const res = await request(appWith({ id: "user-1" }, supabase)).post("/credits/verify").send(validVerifyBody)

    expect(fetch).toHaveBeenCalledWith(
      "https://api.paystack.co/transaction/verify/ref-123",
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: expect.stringContaining("Bearer") }) })
    )
    expect(insertMock).toHaveBeenCalledWith({
      freelancer_id: "user-1",
      amount: 500,
      credits_amount: 10,
      paystack_reference: "ref-123",
      status: "completed",
    })
    expect(supabase.from).not.toHaveBeenCalled()
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ success: true, credits_added: 10, purchase: insertedRow })
  })

  it("ignores a client-supplied credits_amount and derives it from the verified Paystack kobo amount instead", async () => {
    mockFetch({ status: "success", amount: 50000, currency: "NGN" })
    const insertedRow = { id: "p-1", amount: 500, credits_amount: 10, status: "completed", created_at: "2026-01-01T00:00:00Z", paystack_reference: "ref-123" }
    const insertMock = mockService({ insertResult: { data: insertedRow, error: null } })

    const res = await request(appWith({ id: "user-1" }, { from: vi.fn() }))
      .post("/credits/verify")
      .send({ reference: "ref-123", amount: 500, credits_amount: 999999 })

    // 50000 kobo verified by Paystack / 5000 kobo per credit = 10 credits,
    // regardless of the 999999 the client tried to claim.
    expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({ credits_amount: 10 }))
    expect(res.body.credits_added).toBe(10)
  })

  it("returns 400 when Paystack reports the transaction as not successful", async () => {
    mockFetch({ status: "failed", amount: 50000, currency: "NGN" })
    mockService()

    const res = await request(appWith({ id: "user-1" }, { from: vi.fn() })).post("/credits/verify").send(validVerifyBody)

    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
    expect(fakeService.from).not.toHaveBeenCalled()
  })

  it("returns 400 when Paystack's returned reference doesn't match what was requested (fragment/mismatch defense)", async () => {
    // Simulates a client submitting "realref#1" -- fetch() strips the "#1"
    // fragment before it ever reaches Paystack, so Paystack verifies and
    // returns the bare "realref" while the request body still has the
    // fragment-suffixed string. The route must reject rather than trust
    // the mismatched values as if they were the same payment.
    mockFetch({ status: "success", amount: 50000, currency: "NGN", reference: "realref" })
    mockService()

    const res = await request(appWith({ id: "user-1" }, { from: vi.fn() }))
      .post("/credits/verify")
      .send({ reference: "realref#1", amount: 500 })

    expect(res.status).toBe(400)
    expect(res.body).toEqual({ success: false, error: "Transaction verification failed" })
    expect(fakeService.from).not.toHaveBeenCalled()
  })

  it("returns 400 when the paid amount doesn't match Paystack's recorded amount", async () => {
    mockFetch({ status: "success", amount: 10000, currency: "NGN" })
    mockService()

    const res = await request(appWith({ id: "user-1" }, { from: vi.fn() })).post("/credits/verify").send(validVerifyBody)

    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
    expect(fakeService.from).not.toHaveBeenCalled()
  })

  it("returns 400 with a clear message when the reference was already used", async () => {
    mockFetch({ status: "success", amount: 50000, currency: "NGN" })
    mockService({ insertResult: { data: null, error: { code: "23505", message: "duplicate key" } } })

    const res = await request(appWith({ id: "user-1" }, { from: vi.fn() })).post("/credits/verify").send(validVerifyBody)

    expect(res.status).toBe(400)
    expect(res.body).toEqual({ success: false, error: "This reference has already been used" })
  })

  it("rejects a reference that already belongs to an escrow deposit", async () => {
    mockFetch({ status: "success", amount: 50000, currency: "NGN" })
    const insertMock = mockService({ escrowMatch: { id: "escrow-1" } })

    const res = await request(appWith({ id: "user-1" }, { from: vi.fn() })).post("/credits/verify").send(validVerifyBody)

    expect(res.status).toBe(400)
    expect(res.body).toEqual({ success: false, error: "This payment reference cannot be used for credits" })
    expect(insertMock).not.toHaveBeenCalled()
  })

  it("rejects a reference that already belongs to a legacy Funded_jobs101 row", async () => {
    mockFetch({ status: "success", amount: 50000, currency: "NGN" })
    const insertMock = mockService({ fundedJobMatch: { id: "job-1" } })

    const res = await request(appWith({ id: "user-1" }, { from: vi.fn() })).post("/credits/verify").send(validVerifyBody)

    expect(res.status).toBe(400)
    expect(res.body).toEqual({ success: false, error: "This payment reference cannot be used for credits" })
    expect(insertMock).not.toHaveBeenCalled()
  })

  it("rejects a reference that already belongs to a Paystack_data funding record", async () => {
    mockFetch({ status: "success", amount: 50000, currency: "NGN" })
    const insertMock = mockService({ paystackDataMatch: { id: "pd-1" } })

    const res = await request(appWith({ id: "user-1" }, { from: vi.fn() })).post("/credits/verify").send(validVerifyBody)

    expect(res.status).toBe(400)
    expect(res.body).toEqual({ success: false, error: "This payment reference cannot be used for credits" })
    expect(insertMock).not.toHaveBeenCalled()
  })

  it("fails closed with a 500 when the denylist lookup itself errors, without attempting the insert", async () => {
    mockFetch({ status: "success", amount: 50000, currency: "NGN" })
    const insertMock = mockService({ denylistError: { message: "connection reset", code: "PGRST116" } })

    const res = await request(appWith({ id: "user-1" }, { from: vi.fn() })).post("/credits/verify").send(validVerifyBody)

    expect(res.status).toBe(500)
    expect(res.body).toEqual({ success: false, error: "Failed to verify payment reference" })
    expect(insertMock).not.toHaveBeenCalled()
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

describe("PATCH /profile", () => {
  it("writes only whitelisted fields, scoped to the caller's own id", async () => {
    const eqMock = vi.fn().mockResolvedValue({ error: null })
    const updateMock = vi.fn(() => ({ eq: eqMock }))
    const supabase = { from: vi.fn(() => ({ update: updateMock })) }

    const res = await request(appWith({ id: "user-1" }, supabase))
      .patch("/profile")
      .send({
        full_name: "Jane Doe",
        bio: "A bio",
        hourly_rate: 5000,
        skills: ["React", "Node"],
        role: "admin", // not whitelisted — must be dropped
        id: "someone-else", // not whitelisted — must be dropped
      })

    expect(res.body).toEqual({ success: true })
    expect(supabase.from).toHaveBeenCalledWith("profiles")
    const writtenFields = updateMock.mock.calls[0][0]
    expect(writtenFields).toMatchObject({
      full_name: "Jane Doe",
      bio: "A bio",
      hourly_rate: 5000,
      skills: ["React", "Node"],
    })
    expect(writtenFields).not.toHaveProperty("role")
    expect(writtenFields).not.toHaveProperty("id")
    expect(eqMock).toHaveBeenCalledWith("id", "user-1")
  })

  it("returns success: false with the DB error message when the update fails", async () => {
    const eqMock = vi.fn().mockResolvedValue({ error: { message: "constraint violation" } })
    const supabase = { from: vi.fn(() => ({ update: vi.fn(() => ({ eq: eqMock })) })) }

    const res = await request(appWith({ id: "user-1" }, supabase))
      .patch("/profile")
      .send({ full_name: "Jane Doe" })

    expect(res.body).toEqual({ success: false, error: "constraint violation" })
  })
})

describe("POST /avatar", () => {
  it("uploads to storage and upserts freelancer_logos for a freelancer caller", async () => {
    process.env.SUPABASE_URL = "https://example.supabase.co"
    const uploadMock = vi.fn().mockResolvedValue({ error: null })
    const deleteEq = vi.fn().mockResolvedValue({ error: null })
    const insertMock = vi.fn().mockResolvedValue({ error: null })

    const supabase = {
      storage: { from: vi.fn(() => ({ upload: uploadMock })) },
      from: vi.fn((table: string) => {
        if (table === "profiles") {
          return { select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn().mockResolvedValue({ data: { account_type: "freelancer" }, error: null }) })) })) }
        }
        if (table === "freelancer_logos") {
          return { delete: vi.fn(() => ({ eq: deleteEq })), insert: insertMock }
        }
        throw new Error(`unexpected table ${table}`)
      }),
    }

    const res = await request(appWith({ id: "user-1" }, supabase))
      .post("/avatar")
      .send({ data: Buffer.from("hello").toString("base64"), fileName: "photo.png", mimeType: "image/png" })

    expect(supabase.storage.from).toHaveBeenCalledWith("avatars")
    expect(uploadMock).toHaveBeenCalledWith(
      "user-1/avatar.png",
      Buffer.from("hello"),
      { contentType: "image/png", upsert: true }
    )
    expect(deleteEq).toHaveBeenCalledWith("freelancer_id", "user-1")
    expect(insertMock).toHaveBeenCalledWith({
      freelancer_id: "user-1",
      logo_path: "user-1/avatar.png",
      file_name: "photo.png",
      file_size: 5,
      mime_type: "image/png",
    })
    expect(res.body).toEqual({
      success: true,
      avatar: "https://example.supabase.co/storage/v1/object/public/avatars/user-1/avatar.png",
    })
  })

  it("upserts agency_image instead when the caller's account_type is agency", async () => {
    process.env.SUPABASE_URL = "https://example.supabase.co"
    const uploadMock = vi.fn().mockResolvedValue({ error: null })
    const insertMock = vi.fn().mockResolvedValue({ error: null })

    const supabase = {
      storage: { from: vi.fn(() => ({ upload: uploadMock })) },
      from: vi.fn((table: string) => {
        if (table === "profiles") {
          return { select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn().mockResolvedValue({ data: { account_type: "agency" }, error: null }) })) })) }
        }
        if (table === "agency_image") {
          return { delete: vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: null }) })), insert: insertMock }
        }
        throw new Error(`unexpected table ${table}`)
      }),
    }

    await request(appWith({ id: "agency-1" }, supabase))
      .post("/avatar")
      .send({ data: Buffer.from("hi").toString("base64"), fileName: "logo.jpg", mimeType: "image/jpeg" })

    expect(insertMock).toHaveBeenCalledWith({
      agency_id: "agency-1",
      image_path: "agency-1/avatar.jpg",
      file_name: "logo.jpg",
      file_size: 2,
      mime_type: "image/jpeg",
    })
  })

  it("returns 400 when data, fileName, or mimeType is missing", async () => {
    const supabase = { from: vi.fn() }
    const res = await request(appWith({ id: "user-1" }, supabase)).post("/avatar").send({ fileName: "a.png" })
    expect(res.status).toBe(400)
    expect(supabase.from).not.toHaveBeenCalled()
  })

  it("returns 400 for an unsupported mimeType", async () => {
    const supabase = { storage: { from: vi.fn() }, from: vi.fn() }
    const res = await request(appWith({ id: "user-1" }, supabase))
      .post("/avatar")
      .send({ data: Buffer.from("hi").toString("base64"), fileName: "evil.svg", mimeType: "image/svg+xml" })
    expect(res.status).toBe(400)
    expect(supabase.storage.from).not.toHaveBeenCalled()
    expect(supabase.from).not.toHaveBeenCalled()
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

describe("POST /account", () => {
  it("deletes the caller's own profile row and auth user, scoped to their own id", async () => {
    const deleteMock = vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: null }) }))
    const deleteUserMock = vi.fn().mockResolvedValue({ error: null })
    fakeService.from = vi.fn((table: string) => {
      if (table === "profiles") return { delete: deleteMock }
      throw new Error(`unexpected service table ${table}`)
    })
    fakeService.auth = { admin: { deleteUser: deleteUserMock } }

    const res = await request(appWith({ id: "user-1" }, { from: vi.fn() })).post("/account")

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ ok: true })
    expect(deleteMock).toHaveBeenCalled()
    expect(deleteUserMock).toHaveBeenCalledWith("user-1")
  })

  it("returns 500 when the profile delete fails, and never attempts the auth user delete", async () => {
    fakeService.from = vi.fn((table: string) => {
      if (table === "profiles") return { delete: vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: { message: "boom" } }) })) }
      throw new Error(`unexpected service table ${table}`)
    })
    fakeService.auth = { admin: { deleteUser: vi.fn() } }

    const res = await request(appWith({ id: "user-1" }, { from: vi.fn() })).post("/account")

    expect(res.status).toBe(500)
    expect(fakeService.auth.admin.deleteUser).not.toHaveBeenCalled()
  })

  it("returns 409 with a clear message when the profile delete fails due to a foreign-key violation", async () => {
    fakeService.from = vi.fn((table: string) => {
      if (table === "profiles") return { delete: vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: { code: "23503", message: "foreign key violation" } }) })) }
      throw new Error(`unexpected service table ${table}`)
    })
    fakeService.auth = { admin: { deleteUser: vi.fn() } }

    const res = await request(appWith({ id: "user-1" }, { from: vi.fn() })).post("/account")

    expect(res.status).toBe(409)
    expect(res.body).toEqual({
      error: "Your account has financial or administrative history and can't be deleted automatically. Please contact support.",
    })
    expect(fakeService.auth.admin.deleteUser).not.toHaveBeenCalled()
  })

  it("returns 500 when the auth user delete fails, after the profile row is already gone", async () => {
    fakeService.from = vi.fn((table: string) => {
      if (table === "profiles") return { delete: vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: null }) })) }
      throw new Error(`unexpected service table ${table}`)
    })
    fakeService.auth = { admin: { deleteUser: vi.fn().mockResolvedValue({ error: { message: "boom" } }) } }

    const res = await request(appWith({ id: "user-1" }, { from: vi.fn() })).post("/account")

    expect(res.status).toBe(500)
  })
})

describe("GET /verification", () => {
  it("returns the caller's own verification record", async () => {
    const record = { nin: "12345678901", status: "pending", created_at: "2026-01-01T00:00:00Z" }
    const eqMock = vi.fn(() => ({ maybeSingle: vi.fn().mockResolvedValue({ data: record, error: null }) }))
    const supabase = { from: vi.fn(() => ({ select: vi.fn(() => ({ eq: eqMock })) })) }

    const res = await request(appWith({ id: "user-1" }, supabase)).get("/verification")

    expect(res.status).toBe(200)
    expect(supabase.from).toHaveBeenCalledWith("freelancer_verification")
    expect(eqMock).toHaveBeenCalledWith("freelancer_id", "user-1")
    expect(res.body).toEqual({ verification: record })
  })

  it("returns null when the caller has no record", async () => {
    const supabase = { from: vi.fn(() => ({ select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) })) })) })) }

    const res = await request(appWith({ id: "user-1" }, supabase)).get("/verification")

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ verification: null })
  })
})

describe("POST /verification", () => {
  // User-scoped client: eq("freelancer_id") -> caller's own row (maybeSingle),
  // eq("nin") -> NIN-already-exists check (single), plus insert.
  function verificationClient(opts: {
    own?: { status: string } | null
    ownError?: unknown
    ninMatch?: { nin: string } | null
    insertResult?: { error: unknown }
  }) {
    const insertMock = vi.fn().mockResolvedValue(opts.insertResult ?? { error: null })
    const supabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn((col: string) =>
            col === "freelancer_id"
              ? { maybeSingle: vi.fn().mockResolvedValue({ data: opts.own ?? null, error: opts.ownError ?? null }) }
              : {
                  single: vi
                    .fn()
                    .mockResolvedValue(
                      opts.ninMatch ? { data: opts.ninMatch, error: null } : { data: null, error: { code: "PGRST116" } }
                    ),
                }
          ),
        })),
        insert: insertMock,
      })),
    }
    return { supabase, insertMock }
  }

  function serviceDelete(result: { error: unknown } = { error: null }) {
    const eqStatus = vi.fn().mockResolvedValue(result)
    const eqFreelancer = vi.fn(() => ({ eq: eqStatus }))
    const deleteMock = vi.fn(() => ({ eq: eqFreelancer }))
    fakeService.from = vi.fn(() => ({ delete: deleteMock }))
    return { deleteMock, eqFreelancer, eqStatus }
  }

  beforeEach(() => {
    fakeService.from = vi.fn()
  })

  it("returns 400 when nin is missing or the wrong shape", async () => {
    const supabase = { from: vi.fn() }
    const res = await request(appWith({ id: "user-1" }, supabase)).post("/verification").send({})
    expect(res.status).toBe(400)
    expect(supabase.from).not.toHaveBeenCalled()
  })

  it("returns 400 when nin is not exactly 11 digits", async () => {
    const supabase = { from: vi.fn() }
    const res = await request(appWith({ id: "user-1" }, supabase)).post("/verification").send({ nin: "12345" })
    expect(res.status).toBe(400)
    expect(supabase.from).not.toHaveBeenCalled()
  })

  it("returns 400 when the nin already exists", async () => {
    const { supabase, insertMock } = verificationClient({ ninMatch: { nin: "12345678901" } })

    const res = await request(appWith({ id: "user-1" }, supabase)).post("/verification").send({ nin: "12345678901" })

    expect(res.status).toBe(400)
    expect(insertMock).not.toHaveBeenCalled()
  })

  it("inserts a pending record scoped to the caller when they have no record yet", async () => {
    const { supabase, insertMock } = verificationClient({})

    const res = await request(appWith({ id: "user-1" }, supabase)).post("/verification").send({ nin: "12345678901" })

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ success: true })
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({ freelancer_id: "user-1", nin: "12345678901", status: "pending" })
    )
    expect(fakeService.from).not.toHaveBeenCalled()
  })

  it.each(["pending", "verified"])("returns 409 and changes nothing when the caller's record is %s", async (status) => {
    const { supabase, insertMock } = verificationClient({ own: { status } })

    const res = await request(appWith({ id: "user-1" }, supabase)).post("/verification").send({ nin: "12345678901" })

    expect(res.status).toBe(409)
    expect(insertMock).not.toHaveBeenCalled()
    expect(fakeService.from).not.toHaveBeenCalled()
  })

  it("replaces a rejected record: service-role delete scoped to the caller + rejected, then a fresh pending insert", async () => {
    const { supabase, insertMock } = verificationClient({ own: { status: "rejected" } })
    const { eqFreelancer, eqStatus } = serviceDelete()

    const res = await request(appWith({ id: "user-1" }, supabase)).post("/verification").send({ nin: "10987654321" })

    expect(res.status).toBe(200)
    expect(fakeService.from).toHaveBeenCalledWith("freelancer_verification")
    expect(eqFreelancer).toHaveBeenCalledWith("freelancer_id", "user-1")
    expect(eqStatus).toHaveBeenCalledWith("status", "rejected")
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({ freelancer_id: "user-1", nin: "10987654321", status: "pending" })
    )
  })

  it("returns 500 and does not insert when clearing the rejected record fails", async () => {
    const { supabase, insertMock } = verificationClient({ own: { status: "rejected" } })
    serviceDelete({ error: { message: "boom" } })

    const res = await request(appWith({ id: "user-1" }, supabase)).post("/verification").send({ nin: "10987654321" })

    expect(res.status).toBe(500)
    expect(insertMock).not.toHaveBeenCalled()
  })

  it("returns 500 when loading the caller's own record fails", async () => {
    const { supabase, insertMock } = verificationClient({ ownError: { message: "boom" } })

    const res = await request(appWith({ id: "user-1" }, supabase)).post("/verification").send({ nin: "12345678901" })

    expect(res.status).toBe(500)
    expect(insertMock).not.toHaveBeenCalled()
  })
})
