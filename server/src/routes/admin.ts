import { Router } from "express"
import { asyncHandler } from "../lib/http.js"
import { createServiceClient } from "../lib/supabase.js"
import { logAdminAction } from "../lib/adminAudit.js"

const adminRouter = Router()

adminRouter.get(
  "/users",
  asyncHandler(async (req, res) => {
    const { data, error } = await req.supabase!
      .from("profiles")
      .select("id, email, full_name, account_type, created_at, wallet_balance")
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Error fetching admin users list:", error)
      res.json({ users: [] })
      return
    }

    res.json({ users: data || [] })
  })
)

adminRouter.post(
  "/users/:id/disable",
  asyncHandler(async (req, res) => {
    const targetUserId = req.params.id
    const { disabled } = req.body ?? {}

    if (typeof disabled !== "boolean") {
      res.status(400).json({ error: "Body must include { disabled: boolean }" })
      return
    }

    if (targetUserId === req.user!.id) {
      res.status(400).json({ error: "You cannot disable your own account" })
      return
    }

    const service = createServiceClient()

    const { data: targetProfile } = await service
      .from("profiles")
      .select("role, account_type")
      .eq("id", targetUserId)
      .maybeSingle()

    if (!targetProfile) {
      res.status(404).json({ error: "User not found" })
      return
    }
    if (targetProfile.role === "admin" || targetProfile.account_type === "admin") {
      res.status(403).json({ error: "Cannot disable an admin account" })
      return
    }

    const { error } = await service.auth.admin.updateUserById(targetUserId, {
      ban_duration: disabled ? "876000h" : "none",
    })

    if (error) {
      console.error("Failed to update user ban state:", error)
      res.status(500).json({ error: error.message })
      return
    }

    await logAdminAction(service, {
      adminId: req.user!.id,
      action: disabled ? "user.disable" : "user.enable",
      targetType: "user",
      targetId: targetUserId,
    })

    res.json({ success: true, disabled })
  })
)

export default adminRouter
