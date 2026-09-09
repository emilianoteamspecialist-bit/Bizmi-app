import { describe, it, expect, vi } from "vitest"
import express from "express"
import request from "supertest"
import agenciesRouter from "./agencies.js"

function appWith(user: { id: string }, supabase: any) {
  const app = express()
  app.use(express.json())
  app.use((req: any, _res, next) => {
    req.user = user
    req.supabase = supabase
    next()
  })
  app.use("/", agenciesRouter)
  return app
}

describe("GET /:agencyId/image", () => {
  it("returns the resolved image for the given agency", async () => {
    process.env.SUPABASE_URL = "https://example.supabase.co"
    const maybeSingle = vi.fn().mockResolvedValue({ data: { image_path: "agency-1/logo.png" }, error: null })
    const supabase = { from: vi.fn(() => ({ select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle })) })) })) }

    const res = await request(appWith({ id: "freelancer-1" }, supabase)).get("/agency-1/image")

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ image: "https://example.supabase.co/storage/v1/object/public/avatars/agency-1/logo.png" })
    expect(supabase.from).toHaveBeenCalledWith("agency_image")
  })

  it("returns { image: null } when the agency has no image row", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null })
    const supabase = { from: vi.fn(() => ({ select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle })) })) })) }

    const res = await request(appWith({ id: "freelancer-1" }, supabase)).get("/agency-2/image")

    expect(res.body).toEqual({ image: null })
  })
})
