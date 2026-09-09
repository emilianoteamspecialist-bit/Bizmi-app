import { describe, it, expect, vi, beforeEach } from "vitest"
import request from "supertest"

const getUserMock = vi.fn()
const singleMock = vi.fn()

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
}))

beforeEach(() => {
  getUserMock.mockReset()
  singleMock.mockReset()
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
