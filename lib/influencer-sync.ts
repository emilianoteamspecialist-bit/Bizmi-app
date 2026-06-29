import "server-only"
import { getCurrentUser } from "@/lib/auth"
import { createServiceRoleClient } from "@/lib/supabase-service"
import { generateReferralCode } from "@/lib/referral-code"

// Idempotent first-load setup, keyed to the *authenticated* user (auth.uid via
// getCurrentUser) so a client can never act on someone else's behalf:
//
//   1. If the user is an influencer, ensure their influencer_profiles row +
//      unique referral_code exists.
//   2. If they signed up via a referral link, the code was stashed in their auth
//      metadata (`ref_code`) at sign-up — attribute them to that influencer once
//      (insert a `referrals` row, set profiles.referred_by, bump the counter).
//
// All writes use the service-role client. Safe to call on every load — it
// short-circuits once the work is done.
export async function runReferralSync(): Promise<void> {
  const user = await getCurrentUser()
  if (!user) return

  const service = createServiceRoleClient()

  const { data: profile } = await service
    .from("profiles")
    .select("account_type")
    .eq("id", user.id)
    .maybeSingle()
  const accountType = (profile as any)?.account_type ?? null
  const meta = (user.user_metadata ?? {}) as Record<string, any>

  // 1. Ensure the influencer's own profile + code.
  if (accountType === "influencer") {
    const { data: existing } = await service
      .from("influencer_profiles")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle()

    if (!existing) {
      for (let attempt = 0; attempt < 5; attempt++) {
        const { error } = await service.from("influencer_profiles").insert({
          user_id: user.id,
          referral_code: generateReferralCode(),
          display_name: meta.full_name ?? null,
          social_handle: meta.social_handle ?? null,
        })
        if (!error) break
        // 23505 = unique violation (code collision) → retry; anything else → stop.
        if ((error as any).code !== "23505") {
          console.error("[influencer] create profile failed:", error)
          break
        }
      }
    }
  }

  // 2. Attribute the referral, once.
  const refCode = typeof meta.ref_code === "string" ? meta.ref_code.trim() : ""
  if (!refCode) return

  const { data: already } = await service
    .from("referrals")
    .select("id")
    .eq("referred_user_id", user.id)
    .maybeSingle()
  if (already) return

  const { data: influencer } = await service
    .from("influencer_profiles")
    .select("user_id, total_referrals")
    .eq("referral_code", refCode)
    .maybeSingle()
  const influencerId = (influencer as any)?.user_id
  if (!influencerId || influencerId === user.id) return // invalid code or self-referral

  const { error: insertError } = await service.from("referrals").insert({
    influencer_id: influencerId,
    referred_user_id: user.id,
    referred_account_type: accountType,
    status: "pending",
  })
  if (insertError) {
    // Unique violation = a concurrent call already attributed — safe to ignore.
    if ((insertError as any).code !== "23505") console.error("[influencer] attribute failed:", insertError)
    return
  }

  await service.from("profiles").update({ referred_by: influencerId }).eq("id", user.id)
  await service
    .from("influencer_profiles")
    .update({ total_referrals: ((influencer as any)?.total_referrals ?? 0) + 1 })
    .eq("user_id", influencerId)
}
