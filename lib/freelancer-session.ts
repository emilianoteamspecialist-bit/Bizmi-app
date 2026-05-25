import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase-server"
import { resolveAvatar } from "@/lib/avatar-url"

export interface FreelancerSession {
  user: { id: string; email?: string | null }
  profile: any
  credits: number
  balance: number
  logo: string
}

/**
 * Server-side session loader. Use from server components to pre-fetch everything
 * a freelancer page typically needs in a single round of parallel queries.
 *
 * Redirects:
 *   - unauthenticated → /login
 *   - non-freelancer account → /agency/dashboard or /admin/dashboard
 */
export async function requireFreelancerSession(): Promise<FreelancerSession> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single()

  if (profile?.account_type === "agency") redirect("/agency/dashboard")
  if (profile?.account_type === "admin") redirect("/admin/dashboard")

  // Fetch credits, balance, and logo in parallel
  const [creditsRes, balanceRes, logoRes] = await Promise.all([
    supabase
      .from("purchase_credits")
      .select("credits_amount")
      .eq("freelancer_id", user.id)
      .eq("status", "completed"),
    supabase
      .from("Funded_jobs101")
      .select("amount, status, payout_successful")
      .eq("freelancer_id", user.id),
    supabase
      .from("freelancer_logos")
      .select("logo_path, logo_data")
      .eq("freelancer_id", user.id)
      .single(),
  ])

  const credits = Math.max(
    0,
    (creditsRes.data || []).reduce((sum, r) => sum + (r.credits_amount || 0), 0)
  )
  const balance = (balanceRes.data || [])
    .filter((j) => j.status === "verified" && !j.payout_successful)
    .reduce((sum, j) => sum + Number(j.amount), 0)
  const logo = resolveAvatar(logoRes.data)

  return {
    user: { id: user.id, email: user.email },
    profile,
    credits,
    balance,
    logo,
  }
}
