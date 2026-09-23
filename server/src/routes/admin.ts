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

adminRouter.get(
  "/jobs",
  asyncHandler(async (req, res) => {
    const { data: jobs, error } = await req.supabase!
      .from("jobs")
      .select("id, title, status, moderation_status, moderation_reason, agency_id, created_at, budget_min, budget_max")
      .order("created_at", { ascending: false })
      .limit(300)

    if (error) {
      console.error("Error fetching admin jobs list:", error)
      res.json({ jobs: [] })
      return
    }

    const rows = jobs || []
    const agencyIds = [...new Set(rows.map((j) => j.agency_id).filter(Boolean))]
    const { data: agencies } = agencyIds.length
      ? await req.supabase!.from("profiles").select("id, full_name, company_name").in("id", agencyIds)
      : { data: [] as { id: string; full_name: string | null; company_name: string | null }[] }
    const nameById = new Map((agencies || []).map((a) => [a.id, a.company_name || a.full_name || "Agency"]))

    res.json({
      jobs: rows.map((j) => ({
        id: j.id,
        title: j.title,
        status: j.status,
        moderation_status: j.moderation_status ?? "visible",
        moderation_reason: j.moderation_reason ?? null,
        agency_name: nameById.get(j.agency_id) || "—",
        created_at: j.created_at,
        budget_min: j.budget_min,
        budget_max: j.budget_max,
      })),
    })
  })
)

adminRouter.post(
  "/jobs/:id/moderate",
  asyncHandler(async (req, res) => {
    const jobId = req.params.id
    const { action, reason } = req.body ?? {}

    if (action !== "remove" && action !== "restore") {
      res.status(400).json({ error: "action must be 'remove' or 'restore'" })
      return
    }

    const service = createServiceClient()

    const { data: job } = await service.from("jobs").select("id, title, agency_id").eq("id", jobId).maybeSingle()
    if (!job) {
      res.status(404).json({ error: "Job not found" })
      return
    }

    const removing = action === "remove"
    const { error } = await service
      .from("jobs")
      .update({
        moderation_status: removing ? "removed" : "visible",
        moderated_by: req.user!.id,
        moderated_at: new Date().toISOString(),
        moderation_reason: removing ? reason ?? null : null,
      })
      .eq("id", jobId)

    if (error) {
      console.error("Failed to update job moderation status:", error)
      res.status(500).json({ error: error.message })
      return
    }

    await logAdminAction(service, {
      adminId: req.user!.id,
      action: removing ? "job.remove" : "job.restore",
      targetType: "job",
      targetId: jobId,
      details: { title: job.title, agency_id: job.agency_id, reason: removing ? reason ?? null : null },
    })

    res.json({ success: true, moderation_status: removing ? "removed" : "visible" })
  })
)

adminRouter.get(
  "/audit",
  asyncHandler(async (_req, res) => {
    const service = createServiceClient()

    const { data, error } = await service
      .from("admin_audit_log")
      .select("id, action, target_type, target_id, details, created_at, admin:profiles!admin_audit_log_admin_id_fkey(full_name, email)")
      .order("created_at", { ascending: false })
      .limit(200)

    if (error) {
      console.error("Error fetching admin audit log:", error)
      res.json({ logs: [] })
      return
    }

    res.json({ logs: data || [] })
  })
)

export default adminRouter
