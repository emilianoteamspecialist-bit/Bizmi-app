import { describe, it, expect, vi, beforeEach } from "vitest"
import type { Request, Response } from "express"

const getUserMock = vi.fn()
vi.mock("../lib/supabase.js", () => ({
  createUserClient: vi.fn(() => ({
    auth: { getUser: getUserMock },
  })),
}))

function mockRes() {
  const res: Partial<Response> = {}
  res.status = vi.fn().mockReturnValue(res)
  res.json = vi.fn().mockReturnValue(res)
  return res as Response
}

beforeEach(() => {
  getUserMock.mockReset()
})

describe("requireAuth", () => {
  it("returns 401 when no Authorization header is present", async () => {
    const { requireAuth } = await import("./auth.js")
    const req = { headers: {} } as Request
    const res = mockRes()
    const next = vi.fn()

    await requireAuth(req, res, next)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(res.json).toHaveBeenCalledWith({ error: "Unauthorized" })
    expect(next).not.toHaveBeenCalled()
  })

  it("returns 401 when Supabase rejects the token", async () => {
    getUserMock.mockResolvedValue({ data: { user: null }, error: new Error("invalid") })
    const { requireAuth } = await import("./auth.js")
    const req = { headers: { authorization: "Bearer bad-token" } } as Request
    const res = mockRes()
    const next = vi.fn()

    await requireAuth(req, res, next)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(next).not.toHaveBeenCalled()
  })

  it("attaches req.user (including user_metadata) and req.supabase and calls next() on success", async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: "user-1", email: "a@b.com" } },
      error: null,
    })
    const { requireAuth } = await import("./auth.js")
    const req = { headers: { authorization: "Bearer good-token" } } as Request
    const res = mockRes()
    const next = vi.fn()

    await requireAuth(req, res, next)

    expect(req.user).toEqual({ id: "user-1", email: "a@b.com", user_metadata: {} })
    expect(req.supabase).toBeDefined()
    expect(next).toHaveBeenCalledOnce()
  })

  it("carries through a real user_metadata object when Supabase returns one", async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: "user-2", email: "c@d.com", user_metadata: { ref_code: "abc123", full_name: "Jane Doe" } } },
      error: null,
    })
    const { requireAuth } = await import("./auth.js")
    const req = { headers: { authorization: "Bearer good-token" } } as Request
    const res = mockRes()
    const next = vi.fn()

    await requireAuth(req, res, next)

    expect(req.user?.user_metadata).toEqual({ ref_code: "abc123", full_name: "Jane Doe" })
  })
})
