import { Router } from "express"
import type { SupabaseClient } from "@supabase/supabase-js"
import { asyncHandler } from "../lib/http.js"
import { resolveAvatar } from "../lib/avatar.js"

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

userRouter.get(
  "/credits",
  asyncHandler(async (req, res) => {
    const credits = await fetchCredits(req.supabase!, req.user!.id)
    res.json({ credits })
  })
)

userRouter.get(
  "/profile",
  asyncHandler(async (req, res) => {
    const profile = await fetchProfile(req.supabase!, req.user!.id)
    res.json({ profile })
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

export default userRouter
