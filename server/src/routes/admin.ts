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

adminRouter.get(
  "/credits",
  asyncHandler(async (req, res) => {
    const [purchasesResult, freelancersResult] = await Promise.all([
      req.supabase!.from("purchase_credits").select("id, credits_amount, paystack_reference, status, created_at, profiles(full_name)").order("created_at", { ascending: false }),
      req.supabase!.from("profiles").select("id, full_name, created_at, account_type").eq("account_type", "freelancer").order("created_at", { ascending: false }),
    ])

    const purchases = (purchasesResult.data || []).map((p: any) => ({
      id: p.id,
      credits_amount: p.credits_amount,
      paystack_reference: p.paystack_reference,
      status: p.status,
      created_at: p.created_at,
      freelancer_name: p.profiles?.full_name || "Unknown",
    }))
    const freelancers = freelancersResult.data || []
    const totalCredits = purchases.reduce((sum: number, p: any) => sum + (p.credits_amount || 0), 0)

    res.json({ purchases, freelancers, totalCredits })
  })
)

adminRouter.get(
  "/influencers",
  asyncHandler(async (_req, res) => {
    const service = createServiceClient()

    const { data: profiles } = await service
      .from("influencer_profiles")
      .select("user_id, referral_code, display_name, social_handle, total_referrals, total_qualified, total_earned_kobo, balance_unpaid_kobo")
      .order("total_earned_kobo", { ascending: false })

    const list = profiles ?? []
    const ids = list.map((p: any) => p.user_id)

    const { data: names } = ids.length ? await service.from("profiles").select("id, full_name, email").in("id", ids) : { data: [] as any[] }
    const nameById = new Map((names ?? []).map((n: any) => [n.id, n]))

    const [totalUsersResult, referredUsersResult, settingsResult] = await Promise.all([
      service.from("profiles").select("*", { count: "exact", head: true }),
      service.from("referrals").select("*", { count: "exact", head: true }),
      service.from("app_settings").select("key, value").in("key", ["influencer_commission_pct", "platform_fee_pct"]),
    ])

    const toNaira = (kobo?: number | null) => Number(kobo || 0) / 100
    const settingNum = (rows: any[], key: string, fallback: number) => {
      const raw = rows.find((r) => r.key === key)?.value
      const n = typeof raw === "number" ? raw : Number(raw)
      return Number.isFinite(n) ? n : fallback
    }

    const influencers = list.map((p: any) => ({
      id: p.user_id,
      name: nameById.get(p.user_id)?.full_name || p.display_name || "Unknown",
      email: nameById.get(p.user_id)?.email || null,
      referralCode: p.referral_code,
      socialHandle: p.social_handle,
      referred: p.total_referrals ?? 0,
      qualified: p.total_qualified ?? 0,
      earnedNaira: toNaira(p.total_earned_kobo),
      unpaidNaira: toNaira(p.balance_unpaid_kobo),
    }))

    const total = totalUsersResult.count ?? 0
    const referred = referredUsersResult.count ?? 0

    res.json({
      influencers,
      summary: { totalUsers: total, referred, organic: Math.max(total - referred, 0) },
      commissionPct: settingNum(settingsResult.data ?? [], "influencer_commission_pct", 10),
      platformFeePct: settingNum(settingsResult.data ?? [], "platform_fee_pct", 15),
    })
  })
)

adminRouter.post(
  "/influencers/:id/payout",
  asyncHandler(async (req, res) => {
    const influencerId = req.params.id
    const { note } = req.body ?? {}
    const trimmedNote = typeof note === "string" ? note.slice(0, 500) : null

    const service = createServiceClient()

    const { data: influencer } = await service.from("influencer_profiles").select("user_id, balance_unpaid_kobo").eq("user_id", influencerId).maybeSingle()
    if (!influencer) {
      res.status(404).json({ error: "Influencer not found" })
      return
    }

    const amountKobo = Number(influencer.balance_unpaid_kobo || 0)
    if (amountKobo <= 0) {
      res.status(409).json({ error: "Nothing to pay out" })
      return
    }

    const { data: qualifiedRefs } = await service.from("referrals").select("id").eq("influencer_id", influencerId).eq("status", "qualified")
    const coveredIds = (qualifiedRefs as { id: string }[] | null)?.map((r) => r.id) ?? []

    const { data: zeroed } = await service
      .from("influencer_profiles")
      .update({ balance_unpaid_kobo: 0 })
      .eq("user_id", influencerId)
      .eq("balance_unpaid_kobo", amountKobo)
      .select("user_id")
      .maybeSingle()
    if (!zeroed) {
      res.status(409).json({ error: "Balance changed — please refresh and try again" })
      return
    }

    await service.from("influencer_payouts").insert({ influencer_id: influencerId, amount_kobo: amountKobo, status: "paid", processed_by: req.user!.id, note: trimmedNote })

    if (coveredIds.length > 0) {
      await service.from("referrals").update({ status: "paid" }).in("id", coveredIds)
    }

    await logAdminAction(service, {
      adminId: req.user!.id,
      action: "influencer.payout",
      targetType: "influencer",
      targetId: influencerId,
      details: { amount_kobo: amountKobo, referrals_paid: coveredIds.length, note: trimmedNote },
    })

    res.json({ success: true, amount_kobo: amountKobo })
  })
)

const SETTINGS_ALLOWED_KEYS = new Set(["influencer_commission_pct", "platform_fee_pct"])

adminRouter.post(
  "/settings",
  asyncHandler(async (req, res) => {
    const body = req.body ?? {}
    const updates: Record<string, number> = {}

    for (const [key, raw] of Object.entries(body)) {
      if (!SETTINGS_ALLOWED_KEYS.has(key)) continue
      const n = Number(raw)
      if (!Number.isFinite(n) || n < 0 || n > 100) {
        res.status(400).json({ error: `${key} must be a number between 0 and 100` })
        return
      }
      updates[key] = n
    }

    if (Object.keys(updates).length === 0) {
      res.status(400).json({ error: "No valid settings provided" })
      return
    }

    const service = createServiceClient()
    const rows = Object.entries(updates).map(([key, value]) => ({ key, value, updated_at: new Date().toISOString() }))
    const { error } = await service.from("app_settings").upsert(rows, { onConflict: "key" })
    if (error) {
      res.status(500).json({ error: "Failed to save settings" })
      return
    }

    await logAdminAction(service, { adminId: req.user!.id, action: "settings.update", targetType: "app_settings", targetId: Object.keys(updates).join(","), details: updates })

    res.json({ success: true, updated: updates })
  })
)

export default adminRouter
