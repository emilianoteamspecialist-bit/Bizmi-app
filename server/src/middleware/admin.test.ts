import { describe, it, expect, vi, beforeEach } from "vitest"
import type { Request, Response } from "express"

function mockRes() {
  const res: Partial<Response> = {}
  res.status = vi.fn().mockReturnValue(res)
  res.json = vi.fn().mockReturnValue(res)
  return res as Response
}

function mockReq(user: { id: string } | undefined, maybeSingleResult: { data: any; error: any }) {
  const maybeSingle = vi.fn().mockResolvedValue(maybeSingleResult)
  const eq = vi.fn(() => ({ maybeSingle }))
  const select = vi.fn(() => ({ eq }))
  const supabase = { from: vi.fn(() => ({ select })) }
  return { req: { user, supabase } as unknown as Request, supabase }
}

describe("requireAdmin", () => {
  it("returns 401 when req.user is missing", async () => {
    const { requireAdmin } = await import("./admin.js")
    const { req } = mockReq(undefined, { data: null, error: null })
    const res = mockRes()
    const next = vi.fn()

    await requireAdmin(req, res, next)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(next).not.toHaveBeenCalled()
  })

  it("returns 403 when neither role nor account_type is admin", async () => {
    const { requireAdmin } = await import("./admin.js")
    const { req } = mockReq(
      { id: "user-1" },
      { data: { role: "freelancer", account_type: "freelancer" }, error: null }
    )
    const res = mockRes()
    const next = vi.fn()

    await requireAdmin(req, res, next)

    expect(res.status).toHaveBeenCalledWith(403)
    expect(next).not.toHaveBeenCalled()
  })

  it("calls next() when role is admin", async () => {
    const { requireAdmin } = await import("./admin.js")
    const { req } = mockReq({ id: "user-1" }, { data: { role: "admin", account_type: "freelancer" }, error: null })
    const res = mockRes()
    const next = vi.fn()

    await requireAdmin(req, res, next)

    expect(next).toHaveBeenCalledOnce()
    expect(res.status).not.toHaveBeenCalled()
  })

  it("calls next() when account_type is admin (role isn't)", async () => {
    const { requireAdmin } = await import("./admin.js")
    const { req } = mockReq({ id: "user-1" }, { data: { role: "user", account_type: "admin" }, error: null })
    const res = mockRes()
    const next = vi.fn()

    await requireAdmin(req, res, next)

    expect(next).toHaveBeenCalledOnce()
  })
})
