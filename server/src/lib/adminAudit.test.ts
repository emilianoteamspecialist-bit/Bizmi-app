import { describe, it, expect, vi } from "vitest"
import { logAdminAction } from "./adminAudit.js"

describe("logAdminAction", () => {
  it("inserts a row into admin_audit_log with the given fields", async () => {
    const insertMock = vi.fn().mockResolvedValue({ error: null })
    const service = { from: vi.fn(() => ({ insert: insertMock })) } as any

    await logAdminAction(service, {
      adminId: "admin-1",
      action: "user.disable",
      targetType: "user",
      targetId: "u-2",
      details: { reason: "spam" },
    })

    expect(service.from).toHaveBeenCalledWith("admin_audit_log")
    expect(insertMock).toHaveBeenCalledWith({
      admin_id: "admin-1",
      action: "user.disable",
      target_type: "user",
      target_id: "u-2",
      details: { reason: "spam" },
    })
  })

  it("defaults optional fields to null and never throws when the insert reports an error", async () => {
    const service = { from: vi.fn(() => ({ insert: vi.fn().mockResolvedValue({ error: { message: "boom" } }) })) } as any
    await expect(logAdminAction(service, { adminId: "admin-1", action: "user.disable" })).resolves.toBeUndefined()
    expect(service.from).toHaveBeenCalledWith("admin_audit_log")
  })

  it("never throws when the insert call itself rejects", async () => {
    const service = { from: vi.fn(() => ({ insert: vi.fn().mockRejectedValue(new Error("network")) })) } as any
    await expect(logAdminAction(service, { adminId: "admin-1", action: "user.disable" })).resolves.toBeUndefined()
  })
})
