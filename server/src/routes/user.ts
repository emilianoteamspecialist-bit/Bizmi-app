import { Router } from "express"
import type { SupabaseClient } from "@supabase/supabase-js"
import { asyncHandler } from "../lib/http.js"
import { resolveAvatar, getAvatarUrl } from "../lib/avatar.js"
import { createServiceClient } from "../lib/supabase.js"

const userRouter = Router()

async function fetchCredits(supabase: SupabaseClient, userId: string): Promise<number> {
  const { data, error } = await supabase
    .from("purchase_credits")
    .select("credits_amount")
    .eq("freelancer_id", userId)
    .eq("status", "completed")

  if (error) {
    console.error("Error fetching credits:", error)
    return 0
  }

  const totalCredits = data?.reduce((sum: number, purchase: any) => sum + (purchase.credits_amount || 0), 0) || 0
  return Math.max(0, totalCredits)
}

async function fetchProfile(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle()
  if (error) {
    console.error("Error fetching profile:", error)
    return null
  }
  return data
}

async function fetchBalance(supabase: SupabaseClient, userId: string): Promise<number> {
  const { data, error } = await supabase
    .from("Funded_jobs101")
    .select("amount, status, payout_successful")
    .eq("freelancer_id", userId)

  if (error) {
    console.error("Error fetching balance:", error)
    return 0
  }

  return (
    data
      ?.filter((job: any) => job.status === "verified" && !job.payout_successful)
      .reduce((sum: number, job: any) => sum + Number(job.amount), 0) || 0
  )
}

async function fetchNinVerified(supabase: SupabaseClient, userId: string): Promise<boolean> {
  const { data } = await supabase
    .from("freelancer_verification")
    .select("status")
    .eq("freelancer_id", userId)
    .eq("status", "verified")
    .maybeSingle()

  return !!data
}

const ALLOWED_AVATAR_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
}

const PROFILE_FIELDS = [
  "full_name",
  "bio",
  "location",
  "phone",
  "website",
  "hourly_rate",
  "skills",
  "experience_level",
  "company_name",
  "company_size",
] as const

userRouter.get(
  "/credits",
  asyncHandler(async (req, res) => {
    const credits = await fetchCredits(req.supabase!, req.user!.id)
    res.json({ credits })
  })
)

userRouter.get(
  "/credits/history",
  asyncHandler(async (req, res) => {
    const { data, error } = await req.supabase!
      .from("purchase_credits")
      .select("id, amount, credits_amount, status, created_at, paystack_reference")
      .eq("freelancer_id", req.user!.id)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Error fetching credit purchase history:", error)
      res.json({ purchases: [] })
      return
    }

    res.json({ purchases: data || [] })
  })
)

userRouter.post(
  "/credits/verify",
  asyncHandler(async (req, res) => {
    const { reference, amount } = req.body ?? {}
    if (typeof reference !== "string" || !reference.trim() || typeof amount !== "number") {
      res.status(400).json({ success: false, error: "reference and amount are required" })
      return
    }

    const verifyRes = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` },
    })
    const verifyData = (await verifyRes.json()) as {
      status: boolean
      data?: { status: string; amount: number; currency: string; reference: string }
    }

    if (!verifyRes.ok || verifyData.status === false || !verifyData.data) {
      res.status(400).json({ success: false, error: "Transaction verification failed" })
      return
    }

    const transaction = verifyData.data
    if (transaction.status !== "success") {
      res.status(400).json({ success: false, error: "Transaction not successful" })
      return
    }

    if (transaction.reference !== reference) {
      res.status(400).json({ success: false, error: "Transaction verification failed" })
      return
    }

    const expectedAmountKobo = Math.round(amount * 100)
    if (transaction.amount !== expectedAmountKobo) {
      res.status(400).json({ success: false, error: "Transaction amount does not match" })
      return
    }

    if (transaction.currency !== "NGN") {
      res.status(400).json({ success: false, error: "Invalid transaction currency" })
      return
    }

    // Reject a reference that already belongs to an escrow/job-funding
    // payment. This Paystack merchant account also processes escrow
    // deposits and manual job-funding references, and a freelancer can
    // read their own job's reference via existing RLS -- without this
    // check, that same, already-spent payment would also mint credits here.
    const service = createServiceClient()
    const [escrowMatch, fundedJobMatch, paystackDataMatch] = await Promise.all([
      service.from("escrow_deposits").select("id").eq("paystack_reference", reference).maybeSingle(),
      service.from("Funded_jobs101").select("id").eq("reference_id", reference).maybeSingle(),
      service.from("Paystack_data").select("id").eq("reference", reference).maybeSingle(),
    ])
    if (escrowMatch.error || fundedJobMatch.error || paystackDataMatch.error) {
      console.error("credits/verify denylist check failed:", escrowMatch.error || fundedJobMatch.error || paystackDataMatch.error)
      res.status(500).json({ success: false, error: "Failed to verify payment reference" })
      return
    }
    if (escrowMatch.data || fundedJobMatch.data || paystackDataMatch.data) {
      res.status(400).json({ success: false, error: "This payment reference cannot be used for credits" })
      return
    }

    // Derive credits from the Paystack-verified kobo amount server-side --
    // never trust a client-supplied credits_amount, which could claim any
    // value regardless of what was actually paid.
    const CREDITS_RATE_KOBO = 5000 // ₦50 per credit
    const credits_amount = Math.floor(transaction.amount / CREDITS_RATE_KOBO)

    const { data, error } = await service
      .from("purchase_credits")
      .insert({
        freelancer_id: req.user!.id,
        amount,
        credits_amount,
        paystack_reference: reference,
        status: "completed",
      })
      .select()
      .single()

    if (error) {
      if (error.code === "23505") {
        res.status(400).json({ success: false, error: "This reference has already been used" })
        return
      }
      console.error("purchase_credits insert error:", error)
      res.status(500).json({ success: false, error: "Failed to save purchase record" })
      return
    }

    res.json({ success: true, credits_added: credits_amount, purchase: data })
  })
)

userRouter.get(
  "/profile",
  asyncHandler(async (req, res) => {
    const profile = await fetchProfile(req.supabase!, req.user!.id)
    res.json({ profile })
  })
)

userRouter.patch(
  "/profile",
  asyncHandler(async (req, res) => {
    const body = req.body ?? {}
    const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
    for (const field of PROFILE_FIELDS) {
      if (field in body) update[field] = body[field]
    }

    const { error } = await req.supabase!.from("profiles").update(update).eq("id", req.user!.id)

    if (error) {
      console.error("updateProfile error:", error)
      res.json({ success: false, error: error.message })
      return
    }

    res.json({ success: true })
  })
)

userRouter.post(
  "/avatar",
  asyncHandler(async (req, res) => {
    const { data, fileName, mimeType } = req.body ?? {}
    if (typeof data !== "string" || typeof fileName !== "string" || typeof mimeType !== "string") {
      res.status(400).json({ error: "data, fileName, and mimeType are required" })
      return
    }

    const ext = ALLOWED_AVATAR_TYPES[mimeType]
    if (!ext) {
      res.status(400).json({ error: "unsupported image type" })
      return
    }

    const supabase = req.supabase!
    const userId = req.user!.id
    const profile = await fetchProfile(supabase, userId)
    const isAgency = profile?.account_type === "agency"

    const path = `${userId}/avatar.${ext}`
    const buffer = Buffer.from(data, "base64")

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, buffer, { contentType: mimeType, upsert: true })

    if (uploadError) {
      console.error("avatar upload error:", uploadError)
      res.json({ success: false, error: uploadError.message })
      return
    }

    const table = isAgency ? "agency_image" : "freelancer_logos"
    const idColumn = isAgency ? "agency_id" : "freelancer_id"
    const pathColumn = isAgency ? "image_path" : "logo_path"

    await supabase.from(table).delete().eq(idColumn, userId)
    const { error: insertError } = await supabase.from(table).insert({
      [idColumn]: userId,
      [pathColumn]: path,
      file_name: fileName,
      file_size: buffer.length,
      mime_type: mimeType,
    })

    if (insertError) {
      console.error("avatar record insert error:", insertError)
      res.json({ success: false, error: insertError.message })
      return
    }

    res.json({ success: true, avatar: getAvatarUrl(path) })
  })
)

userRouter.get(
  "/balance",
  asyncHandler(async (req, res) => {
    const balance = await fetchBalance(req.supabase!, req.user!.id)
    res.json({ balance })
  })
)

userRouter.get(
  "/nin-verified",
  asyncHandler(async (req, res) => {
    const verified = await fetchNinVerified(req.supabase!, req.user!.id)
    res.json({ verified })
  })
)

userRouter.get(
  "/dashboard",
  asyncHandler(async (req, res) => {
    const userId = req.user!.id
    const supabase = req.supabase!

    const { data, error } = await supabase.rpc("get_freelancer_dashboard")
    if (!error && data) {
      const d = data as { profile?: any; credits?: number; balance?: number; is_verified?: boolean }
      res.json({
        profile: d.profile ?? null,
        credits: d.credits ?? 0,
        balance: Number(d.balance ?? 0),
        isVerified: !!d.is_verified,
      })
      return
    }

    const [profile, credits, balance, isVerified] = await Promise.all([
      fetchProfile(supabase, userId),
      fetchCredits(supabase, userId),
      fetchBalance(supabase, userId),
      fetchNinVerified(supabase, userId),
    ])

    res.json({ profile, credits, balance, isVerified })
  })
)

userRouter.post(
  "/freelancer-logos",
  asyncHandler(async (req, res) => {
    const freelancerIds: string[] = Array.isArray(req.body?.freelancerIds) ? req.body.freelancerIds : []
    if (freelancerIds.length === 0) {
      res.json({ logos: {} })
      return
    }

    const { data, error } = await req.supabase!
      .from("freelancer_logos")
      .select("freelancer_id, logo_path, logo_data")
      .in("freelancer_id", freelancerIds)

    if (error) {
      console.error("Error fetching freelancer logos:", error)
      res.json({ logos: {} })
      return
    }

    const logos: Record<string, string> = {}
    for (const item of data || []) logos[item.freelancer_id] = resolveAvatar(item)
    res.json({ logos })
  })
)

// GET /api/user/shell?role=agency|freelancer -- what the portal sidebar and
// top bar need on every page: the caller's avatar, unread-message count and
// latest unread messages (with sender names). `role` is the portal being
// viewed (the legacy shell derives it from the URL), and only picks which
// avatar table to read; every query is the caller's own via RLS.
userRouter.get(
  "/shell",
  asyncHandler(async (req, res) => {
    const userId = req.user!.id
    const role = req.query.role === "agency" ? "agency" : "freelancer"
    const supabase = req.supabase!

    const [avatarRes, countRes, recentRes] = await Promise.all([
      role === "agency"
        ? supabase.from("agency_image").select("image_path, image_data").eq("agency_id", userId).maybeSingle()
        : supabase.from("freelancer_logos").select("logo_path, logo_data").eq("freelancer_id", userId).maybeSingle(),
      supabase.from("messages").select("*", { count: "exact", head: true }).eq("receiver_id", userId).eq("is_read", false),
      supabase
        .from("messages")
        .select("id, message_text, created_at, sender_id, conversation_id")
        .eq("receiver_id", userId)
        .eq("is_read", false)
        .order("created_at", { ascending: false })
        .limit(6),
    ])

    const recent = (recentRes.data ?? []) as { id: string; message_text: string | null; created_at: string; sender_id: string; conversation_id: string }[]
    const senderIds = [...new Set(recent.map((m) => m.sender_id).filter(Boolean))]
    const senders: Record<string, { full_name: string | null; company_name: string | null }> = {}
    if (senderIds.length) {
      const { data } = await supabase.from("profiles").select("id, full_name, company_name").in("id", senderIds)
      for (const p of data ?? []) senders[p.id] = p
    }

    res.json({
      avatar: avatarRes.data ? resolveAvatar(avatarRes.data as any) : null,
      unreadCount: countRes.count ?? 0,
      recentUnread: recent.map((m) => ({
        id: m.id,
        message_text: m.message_text,
        created_at: m.created_at,
        conversation_id: m.conversation_id,
        sender_name: senders[m.sender_id]?.company_name || senders[m.sender_id]?.full_name || "Someone",
      })),
    })
  })
)

userRouter.get(
  "/agency-image",
  asyncHandler(async (req, res) => {
    const { data, error } = await req.supabase!
      .from("agency_image")
      .select("image_path, image_data")
      .eq("agency_id", req.user!.id)
      .maybeSingle()

    if (error || !data) {
      res.json({ image: null })
      return
    }

    res.json({ image: resolveAvatar(data) })
  })
)

userRouter.post(
  "/account",
  asyncHandler(async (req, res) => {
    const service = createServiceClient()

    // Remove application data first. Child tables FK profiles(id) ON DELETE
    // CASCADE, so this clears the user's jobs, proposals, referrals, etc.
    const { error: profileError } = await service.from("profiles").delete().eq("id", req.user!.id)
    if (profileError) {
      console.error("Error deleting profile:", profileError)
      if (profileError.code === "23503") {
        res.status(409).json({ error: "Your account has financial or administrative history and can't be deleted automatically. Please contact support." })
        return
      }
      res.status(500).json({ error: "Failed to delete account data" })
      return
    }

    // Remove the auth identity so the email can be reused on a fresh sign-up.
    const { error: authError } = await service.auth.admin.deleteUser(req.user!.id)
    if (authError) {
      console.error("Error deleting auth user:", authError)
      res.status(500).json({ error: "Failed to delete account" })
      return
    }

    res.json({ ok: true })
  })
)

const NIN_TAKEN_ERROR = "NIN already exists in the system"

userRouter.get(
  "/verification",
  asyncHandler(async (req, res) => {
    const { data } = await req.supabase!
      .from("freelancer_verification")
      .select("nin, status, created_at")
      .eq("freelancer_id", req.user!.id)
      .maybeSingle()

    res.json({ verification: data ?? null })
  })
)

userRouter.post(
  "/verification",
  asyncHandler(async (req, res) => {
    const { nin } = req.body ?? {}
    if (typeof nin !== "string" || !/^\d{11}$/.test(nin)) {
      res.status(400).json({ success: false, error: "NIN must be exactly 11 digits" })
      return
    }

    const userId = req.user!.id

    // One verification row per freelancer (UNIQUE freelancer_id). Only a
    // rejected submission may be replaced; pending/verified ones are final.
    const { data: ownRecord, error: ownError } = await req.supabase!
      .from("freelancer_verification")
      .select("status")
      .eq("freelancer_id", userId)
      .maybeSingle()

    if (ownError) {
      console.error("Error loading verification:", ownError)
      res.status(500).json({ success: false, error: "Error checking NIN. Please try again." })
      return
    }

    if (ownRecord && ownRecord.status !== "rejected") {
      res.status(409).json({ success: false, error: "You've already submitted a NIN for verification" })
      return
    }

    // RLS only exposes the caller's own row, so check across all freelancers
    // with the service role. Rejected rows don't reserve a NIN (matching the
    // partial unique index freelancer_verification_active_nin_key), and the
    // caller's own row is either absent or rejected by this point.
    const { data: ninMatches, error: checkError } = await createServiceClient()
      .from("freelancer_verification")
      .select("freelancer_id")
      .eq("nin", nin)
      .neq("status", "rejected")
      .limit(1)

    if (checkError) {
      console.error("Error checking NIN:", checkError)
      res.status(500).json({ success: false, error: "Error checking NIN. Please try again." })
      return
    }

    if (ninMatches && ninMatches.length > 0) {
      res.status(400).json({ success: false, error: NIN_TAKEN_ERROR })
      return
    }

    if (ownRecord) {
      // Clients can't update or delete verification rows (status is owned by
      // the external KYC service), so clear the rejected row with the service
      // role -- scoped to the caller and to status='rejected' -- and insert a
      // fresh 'pending' row below, so a resubmission reaches the KYC service
      // exactly like a first submission.
      const { error: deleteError } = await createServiceClient()
        .from("freelancer_verification")
        .delete()
        .eq("freelancer_id", userId)
        .eq("status", "rejected")

      if (deleteError) {
        console.error("Error clearing rejected verification:", deleteError)
        res.status(500).json({ success: false, error: "Failed to submit NIN for verification" })
        return
      }
    }

    const { error: insertError } = await req.supabase!.from("freelancer_verification").insert({
      freelancer_id: userId,
      nin,
      status: "pending",
      created_at: new Date().toISOString(),
    })

    if (insertError) {
      // 23505: lost a race -- on the active-NIN unique index, or a concurrent
      // first submission by the same freelancer (UNIQUE freelancer_id).
      if (insertError.code === "23505") {
        res.status(400).json({ success: false, error: NIN_TAKEN_ERROR })
        return
      }
      console.error("Error inserting NIN:", insertError)
      res.status(500).json({ success: false, error: "Failed to submit NIN for verification" })
      return
    }

    res.json({ success: true })
  })
)

export default userRouter
