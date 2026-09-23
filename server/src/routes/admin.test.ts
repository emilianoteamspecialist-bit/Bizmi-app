import { describe, it, expect, vi } from "vitest"
import request from "supertest"
import express from "express"
import adminRouter from "./admin.js"

function appWith(supabase: any) {
  const app = express()
  app.use(express.json())
  app.use((req: any, _res, next) => {
    req.user = { id: "admin-1" }
    req.supabase = supabase
    next()
  })
  app.use("/", adminRouter)
  return app
}

describe("GET /users", () => {
  it("lists all profiles, newest first", async () => {
    const orderMock = vi.fn().mockResolvedValue({
      data: [
        { id: "u-1", email: "a@x.com", full_name: "Agency A", account_type: "agency", created_at: "2026-01-02T00:00:00Z", wallet_balance: 5000 },
        { id: "u-2", email: "f@x.com", full_name: "Freelancer F", account_type: "freelancer", created_at: "2026-01-01T00:00:00Z", wallet_balance: null },
      ],
      error: null,
    })
    const supabase = { from: vi.fn(() => ({ select: vi.fn(() => ({ order: orderMock })) })) }

    const res = await request(appWith(supabase)).get("/users")

    expect(res.status).toBe(200)
    expect(supabase.from).toHaveBeenCalledWith("profiles")
    expect(orderMock).toHaveBeenCalledWith("created_at", { ascending: false })
    expect(res.body.users).toHaveLength(2)
    expect(res.body.users[0].id).toBe("u-1")
  })

  it("returns an empty list on a query error", async () => {
    const supabase = { from: vi.fn(() => ({ select: vi.fn(() => ({ order: vi.fn().mockResolvedValue({ data: null, error: { message: "boom" } }) })) })) }
    const res = await request(appWith(supabase)).get("/users")
    expect(res.body).toEqual({ users: [] })
  })
})
