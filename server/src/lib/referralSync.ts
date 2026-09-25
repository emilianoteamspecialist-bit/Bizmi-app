import type { SupabaseClient } from "@supabase/supabase-js"
import { generateReferralCode } from "./referralCode.js"

// Idempotent first-load setup, mirroring legacy lib/influencer-sync.ts's
// runReferralSync. Must run for EVERY authenticated user at least once after
// sign-up (freelancer, agency, AND influencer) -- not just influencers --
// so a signup carrying a stashed ref_code actually gets attributed to the
// referring influencer. Legacy mounted <ReferralSync /> in the freelancer
// and agency layouts as well as the influencer layout for exactly this
// reason.
export async function runReferralSync(
  service: SupabaseClient,
  userId: string,
  meta: Record<string, unknown>
): Promise<void> {
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
        if ((error as { code?: string }).code !== "23505") {
          console.error("[influencer] create profile failed:", error)
          break
        }
      }
    }
  }

  // 2. Attribute the referral, once.
  const refCode = typeof meta.ref_code === "string" ? meta.ref_code.trim() : ""
  if (!refCode) return

  const { data: already } = await service.from("referrals").select("id").eq("referred_user_id", userId).maybeSingle()
  if (already) return

  const { data: influencer } = await service
    .from("influencer_profiles")
    .select("user_id, total_referrals")
    .eq("referral_code", refCode)
    .maybeSingle()
  const influencerRow = influencer as { user_id?: string; total_referrals?: number } | null
  const influencerId = influencerRow?.user_id
  if (!influencerId || influencerId === userId) return

  const { error: insertError } = await service.from("referrals").insert({
    influencer_id: influencerId,
    referred_user_id: userId,
    referred_account_type: accountType,
    status: "pending",
  })
  if (insertError) {
    if ((insertError as { code?: string }).code !== "23505") {
      console.error("[influencer] attribute failed:", insertError)
    }
    return
  }

  await service.from("profiles").update({ referred_by: influencerId }).eq("id", userId)
  await service
    .from("influencer_profiles")
    .update({ total_referrals: (influencerRow?.total_referrals ?? 0) + 1 })
    .eq("user_id", influencerId)
}
