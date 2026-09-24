import { Router } from "express"
import { asyncHandler } from "../lib/http.js"
import { createServiceClient } from "../lib/supabase.js"
import { generateReferralCode } from "../lib/referralCode.js"

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

    const { data: profileRow } = await service.from("profiles").select("account_type").eq("id", userId).maybeSingle()
    const accountType = (profileRow as { account_type?: string } | null)?.account_type ?? null

    // 1. Ensure the influencer's own profile + referral code exist.
    if (accountType === "influencer") {
      const { data: existing } = await service
        .from("influencer_profiles")
        .select("user_id")
        .eq("user_id", userId)
        .maybeSingle()

      if (!existing) {
        for (let attempt = 0; attempt < 5; attempt++) {
          const { error } = await service.from("influencer_profiles").insert({
            user_id: userId,
            referral_code: generateReferralCode(),
            display_name: typeof meta.full_name === "string" ? meta.full_name : null,
            social_handle: typeof meta.social_handle === "string" ? meta.social_handle : null,
          })
          if (!error) break
          // 23505 = unique violation (code collision) -> retry; anything else -> stop.
          if ((error as { code?: string }).code !== "23505") {
            console.error("[influencer] create profile failed:", error)
            break
          }
        }
      }
    }

    // 2. Attribute the referral, once.
    const refCode = typeof meta.ref_code === "string" ? meta.ref_code.trim() : ""
    if (refCode) {
      const { data: already } = await service.from("referrals").select("id").eq("referred_user_id", userId).maybeSingle()

      if (!already) {
        const { data: influencer } = await service
          .from("influencer_profiles")
          .select("user_id, total_referrals")
          .eq("referral_code", refCode)
          .maybeSingle()
        const influencerRow = influencer as { user_id?: string; total_referrals?: number } | null
        const influencerId = influencerRow?.user_id

        if (influencerId && influencerId !== userId) {
          const { error: insertError } = await service.from("referrals").insert({
            influencer_id: influencerId,
            referred_user_id: userId,
            referred_account_type: accountType,
            status: "pending",
          })
          if (!insertError) {
            await service.from("profiles").update({ referred_by: influencerId }).eq("id", userId)
            await service
              .from("influencer_profiles")
              .update({ total_referrals: (influencerRow?.total_referrals ?? 0) + 1 })
              .eq("user_id", influencerId)
          } else if ((insertError as { code?: string }).code !== "23505") {
            // Unique violation = a concurrent call already attributed -- safe to ignore.
            console.error("[influencer] attribute failed:", insertError)
          }
        }
      }
    }

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
