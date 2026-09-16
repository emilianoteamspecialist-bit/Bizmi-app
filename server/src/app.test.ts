// server/src/app.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest"
import request from "supertest"
import { createApp } from "./app.js"

const getUserMock = vi.fn()
const singleMock = vi.fn()

vi.mock("./lib/supabase.js", () => ({
  createUserClient: vi.fn(() => ({
    auth: { getUser: getUserMock },
    from: vi.fn((table: string) => {
      if (table === "profiles") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: singleMock,
            })),
          })),
        }
      }
      // For jobs table: update chain should error
      return {
        select: vi.fn(() => ({ eq: vi.fn(() => ({ eq: vi.fn() })) })),
        update: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn().mockRejectedValue(new Error("DB error")),
          })),
        })),
      }
    }),
  })),
}))

beforeEach(() => {
  getUserMock.mockReset()
  singleMock.mockReset()
  vi.clearAllMocks()
})

describe("GET /health", () => {
  it("returns status ok", async () => {
    const app = createApp()
    const res = await request(app).get("/health")
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ status: "ok" })
  })
})

describe("auth gate on Phase 1 routers", () => {
  it("requires auth on /api/user", async () => {
    const res = await request(createApp()).get("/api/user/credits")
    expect(res.status).toBe(401)
  })

  it("requires auth on /api/jobs", async () => {
    const res = await request(createApp()).get("/api/jobs")
    expect(res.status).toBe(401)
  })

  it("requires auth on /api/proposals", async () => {
    const res = await request(createApp()).get("/api/proposals/mine")
    expect(res.status).toBe(401)
  })

  it("requires auth on /api/agencies", async () => {
    const res = await request(createApp()).get("/api/agencies/agency-1/image")
    expect(res.status).toBe(401)
  })
})

describe("JSON 404 fallback", () => {
  it("returns 404 with JSON body for unmatched routes", async () => {
    const res = await request(createApp()).get("/api/does-not-exist")
    expect(res.status).toBe(404)
    expect(res.body).toEqual({ error: "Not found", code: "not_found" })
  })
})

describe("error propagation through errorHandler", () => {
  it("catches thrown errors in mounted routers and returns 500", async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: "user-1", email: "a@b.com" } },
      error: null,
    })
    singleMock.mockResolvedValue({
      data: { id: "user-1", full_name: "Jane Doe", account_type: "agency" },
      error: null,
    })

    const res = await request(createApp())
      .patch("/api/jobs/some-id/status")
      .set("Authorization", "Bearer valid-token")
      .send({ status: "closed" })

    expect(res.status).toBe(500)
    expect(res.body).toEqual({ error: "Internal server error" })
  })
})

describe("JSON body size limit", () => {
  it("accepts a JSON body larger than Express's 100kb default (raised for avatar uploads)", async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: "user-1", email: "a@b.com" } },
      error: null,
    })
    singleMock.mockResolvedValue({
      data: { id: "user-1", full_name: "Jane Doe", account_type: "agency" },
      error: null,
    })

    const res = await request(createApp())
      .patch("/api/jobs/some-id/status")
      .set("Authorization", "Bearer valid-token")
      .send({ status: "x".repeat(150_000) })

    expect(res.status).not.toBe(413)
  })
})
