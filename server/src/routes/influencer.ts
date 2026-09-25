import { Router } from "express"
import { asyncHandler } from "../lib/http.js"
import { createServiceClient } from "../lib/supabase.js"
import { runReferralSync } from "../lib/referralSync.js"

const influencerRouter = Router()

const toNaira = (kobo?: number | null) => Number(kobo || 0) / 100

type ReferralRow = {
  id: string
  referred_account_type: string | null
  status: string
  commission_kobo: number | null
  created_at: string
  qualified_at: string | null
}

type PayoutRow = {
  id: string
  amount_kobo: number
  status: string
  processed_at: string | null
  note: string | null
}

influencerRouter.get(
  "/me",
  asyncHandler(async (req, res) => {
    const userId = req.user!.id
    const service = createServiceClient()
    const meta = (req.user!.user_metadata ?? {}) as Record<string, unknown>

    await runReferralSync(service, userId, meta)

    // 3. Read the influencer's own data back through the request-scoped, RLS-
    // bound client -- defense-in-depth alongside the .eq() filters, matching
    // this migration's established convention (see the plan's Global
    // Constraints). RLS on these three tables already restricts SELECT to the
    // caller's own rows.
    const { data: myProfile } = await req.supabase!
      .from("influencer_profiles")
      .select("referral_code, display_name, social_handle, total_referrals, total_qualified, total_earned_kobo, balance_unpaid_kobo")
      .eq("user_id", userId)
      .maybeSingle()

    const { data: referralRows } = await req.supabase!
      .from("referrals")
      .select("id, referred_account_type, status, commission_kobo, created_at, qualified_at")
      .eq("influencer_id", userId)
      .order("created_at", { ascending: false })

    const { data: payoutRows } = await req.supabase!
      .from("influencer_payouts")
      .select("id, amount_kobo, status, processed_at, note")
      .eq("influencer_id", userId)
      .order("processed_at", { ascending: false })

    const referrals = (referralRows as ReferralRow[] | null) ?? []
    const payouts = (payoutRows as PayoutRow[] | null) ?? []
    const pending = referrals.filter((r) => r.status === "pending").length
    const qualified = referrals.filter((r) => r.status === "qualified" || r.status === "paid").length

    const p = myProfile as {
      referral_code?: string
      display_name?: string
      social_handle?: string
      total_referrals?: number
      total_qualified?: number
      total_earned_kobo?: number
      balance_unpaid_kobo?: number
    } | null

    res.json({
      referralCode: p?.referral_code ?? null,
      displayName: p?.display_name ?? null,
      socialHandle: p?.social_handle ?? null,
      totals: {
        referred: p?.total_referrals ?? referrals.length,
        qualified: p?.total_qualified ?? qualified,
        pending,
        earnedNaira: toNaira(p?.total_earned_kobo),
        unpaidNaira: toNaira(p?.balance_unpaid_kobo),
      },
      referrals,
      payouts,
    })
  })
)

export default influencerRouter
