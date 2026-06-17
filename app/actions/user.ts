"use server"

import { createClient } from "@/lib/supabase-server"
import { resolveAvatar } from "@/lib/avatar-url"
import { getCurrentUser } from "@/lib/auth"

export async function getUserCredits(userId?: string) {
  const supabase = await createClient()
  let finalUserId = userId

  if (!finalUserId) {
    const user = await getCurrentUser()
    if (!user) return 0
    finalUserId = user.id
  }

  const { data, error } = await supabase
    .from("purchase_credits")
    .select("credits_amount")
    .eq("freelancer_id", finalUserId)
    .eq("status", "completed")

  if (error) {
    console.error("Error fetching credits:", error)
    return 0
  }

  const totalCredits = data?.reduce((sum, purchase) => sum + (purchase.credits_amount || 0), 0) || 0
  return Math.max(0, totalCredits)
}

export async function getProfile(userId?: string) {
    const supabase = await createClient()
    let finalUserId = userId

    if (!finalUserId) {
      const user = await getCurrentUser()
      if (!user) return null
      finalUserId = user.id
    }
  
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", finalUserId)
      .maybeSingle()

    if (error) {
      console.error("Error fetching profile:", error)
      return null
    }

    return data
}

export async function getTotalBalance(userId?: string) {
  const supabase = await createClient()
  let finalUserId = userId

  if (!finalUserId) {
    const user = await getCurrentUser()
    if (!user) return 0
    finalUserId = user.id
  }

  const { data, error } = await supabase
    .from("Funded_jobs101")
    .select("amount, status, payout_successful")
    .eq("freelancer_id", finalUserId)

  if (error) {
    console.error("Error fetching balance:", error)
    return 0
  }

  const totalAmount =
    data
      ?.filter((job) => job.status === "verified" && !job.payout_successful)
      .reduce((sum, job) => sum + Number(job.amount), 0) || 0
  
  return totalAmount
}

export async function getNINVerified(userId?: string) {
  const supabase = await createClient()
  let finalUserId = userId

  if (!finalUserId) {
    const user = await getCurrentUser()
    if (!user) return false
    finalUserId = user.id
  }

  const { data } = await supabase
    .from("freelancer_verification")
    .select("status")
    .eq("freelancer_id", finalUserId)
    .eq("status", "verified")
    .maybeSingle()

  return !!data
}

export async function getFullUserData() {
  const user = await getCurrentUser()

  if (!user) return null

  // Fast path: one round-trip that also does the SUMs in Postgres.
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("get_freelancer_dashboard")
  if (!error && data) {
    const d = data as { profile?: any; credits?: number; balance?: number; is_verified?: boolean }
    return {
      user,
      profile: d.profile ?? null,
      credits: d.credits ?? 0,
      balance: Number(d.balance ?? 0),
      isVerified: !!d.is_verified,
    }
  }

  // Fallback (e.g. the RPC hasn't been deployed yet): the original parallel
  // queries. Keeps the dashboard/profile/marketplace pages working regardless
  // of migration order.
  const [profile, credits, balance, isVerified] = await Promise.all([
    getProfile(user.id),
    getUserCredits(user.id),
    getTotalBalance(user.id),
    getNINVerified(user.id),
  ])

  return { user, profile, credits, balance, isVerified }
}

export async function getFreelancerLogos(freelancerIds: string[]) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("freelancer_logos")
    .select("freelancer_id, logo_path, logo_data")
    .in("freelancer_id", freelancerIds)

  if (error) {
    console.error("Error fetching freelancer logos:", error)
    return {}
  }

  const logoMap: { [key: string]: string } = {}
  data.forEach((item) => {
    logoMap[item.freelancer_id] = resolveAvatar(item)
  })
  return logoMap
}

export async function getAgencyImage() {
  const supabase = await createClient()
  const user = await getCurrentUser()

  if (!user) return null

  const { data, error } = await supabase
    .from("agency_image")
    .select("image_path, image_data")
    .eq("agency_id", user.id)
    .maybeSingle()

  if (error || !data) return null
  return resolveAvatar(data)
}
