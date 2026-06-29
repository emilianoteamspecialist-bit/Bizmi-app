import "server-only"
import { createClient } from "@/lib/supabase-server"
import { getCurrentUser } from "@/lib/auth"

// Read-side helper for the influencer area. Queries the influencer tables
// (influencer_profiles, referrals, influencer_payouts) defensively: if a table
// doesn't exist yet (migration not run) or a query errors, it falls back to
// empty/zero so the UI renders cleanly before the backend lands.

const toNaira = (kobo?: number | null) => Number(kobo || 0) / 100

export type InfluencerReferral = {
  id: string
  referred_account_type: string | null
  status: string
  commission_kobo: number | null
  created_at: string
  qualified_at: string | null
}

export type InfluencerPayout = {
  id: string
  amount_kobo: number
  status: string
  processed_at: string | null
  note: string | null
}

export type InfluencerData = {
  userId: string
  referralCode: string | null
  displayName: string | null
  socialHandle: string | null
  totals: {
    referred: number
    qualified: number
    pending: number
    earnedNaira: number
    unpaidNaira: number
  }
  referrals: InfluencerReferral[]
  payouts: InfluencerPayout[]
}

export async function getInfluencerData(): Promise<InfluencerData | null> {
  const user = await getCurrentUser()
  if (!user) return null

  const supabase = await createClient()

  const { data: profile } = await supabase
    .from("influencer_profiles")
    .select("referral_code, display_name, social_handle, total_referrals, total_qualified, total_earned_kobo, balance_unpaid_kobo")
    .eq("user_id", user.id)
    .maybeSingle()

  const { data: referralRows } = await supabase
    .from("referrals")
    .select("id, referred_account_type, status, commission_kobo, created_at, qualified_at")
    .eq("influencer_id", user.id)
    .order("created_at", { ascending: false })

  const { data: payoutRows } = await supabase
    .from("influencer_payouts")
    .select("id, amount_kobo, status, processed_at, note")
    .eq("influencer_id", user.id)
    .order("processed_at", { ascending: false })

  const referrals = (referralRows as InfluencerReferral[] | null) ?? []
  const payouts = (payoutRows as InfluencerPayout[] | null) ?? []

  const pending = referrals.filter((r) => r.status === "pending").length
  const qualified = referrals.filter((r) => r.status === "qualified" || r.status === "paid").length

  return {
    userId: user.id,
    referralCode: (profile as any)?.referral_code ?? null,
    displayName: (profile as any)?.display_name ?? null,
    socialHandle: (profile as any)?.social_handle ?? null,
    totals: {
      referred: (profile as any)?.total_referrals ?? referrals.length,
      qualified: (profile as any)?.total_qualified ?? qualified,
      pending,
      earnedNaira: toNaira((profile as any)?.total_earned_kobo),
      unpaidNaira: toNaira((profile as any)?.balance_unpaid_kobo),
    },
    referrals,
    payouts,
  }
}
