"use server"

import { createClient } from "@/lib/supabase-server"
import { resolveAvatar } from "@/lib/avatar-url"

export async function getUserCredits(userId?: string) {
  const supabase = await createClient()
  let finalUserId = userId

  if (!finalUserId) {
    const { data: { user } } = await supabase.auth.getUser()
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
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return null
      finalUserId = user.id
    }
  
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", finalUserId)
      .single()
  
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
    const { data: { user } } = await supabase.auth.getUser()
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

export async function getFullUserData() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  // Fetch all user-related data in parallel with a single user object
  const [profile, credits, balance] = await Promise.all([
    getProfile(user.id),
    getUserCredits(user.id),
    getTotalBalance(user.id)
  ])

  return {
    user,
    profile,
    credits,
    balance
  }
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
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  const { data, error } = await supabase
    .from("agency_image")
    .select("image_path, image_data")
    .eq("agency_id", user.id)
    .single()

  if (error) return null
  return resolveAvatar(data)
}
