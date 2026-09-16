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
