import { useQuery } from "@tanstack/react-query"
import { apiFetch } from "../api"

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

export type InfluencerMeData = {
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

export function useInfluencerMeQuery() {
  return useQuery({
    queryKey: ["influencer", "me"],
    queryFn: () => apiFetch<InfluencerMeData>("/api/influencer/me"),
  })
}
