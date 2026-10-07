import type { SupabaseClient } from "@supabase/supabase-js"

// Ported from the Next.js app's lib/influencer-referrals.ts.
//
// Qualifying event for the influencer program: a referred user's FIRST escrow
// release (work approved). Pays each referred party's influencer a commission
// equal to `influencer_commission_pct` of Bizimi's platform fee on the job.
//
// One-time & idempotent: only referrals still 'pending' are claimed, via a
// guarded `status = 'pending'` update, so repeat approvals pay at most once.
// Fail-soft: errors are logged and swallowed so they never block a release.

type EscrowLike = {
  job_id: string
  agency_id: string | null
  freelancer_id: string | null
  amount_kobo: number | null
}

async function getNumericSetting(service: SupabaseClient, key: string, fallback: number): Promise<number> {
  const { data } = await service.from("app_settings").select("value").eq("key", key).maybeSingle()
  const raw = (data as any)?.value
  const n = typeof raw === "number" ? raw : Number(raw)
  return Number.isFinite(n) ? n : fallback
}

export async function qualifyReferralOnRelease(service: SupabaseClient, escrow: EscrowLike): Promise<void> {
  try {
    const parties = [escrow.freelancer_id, escrow.agency_id].filter(Boolean) as string[]
    if (parties.length === 0) return

    const amountKobo = Number(escrow.amount_kobo || 0)
    if (amountKobo <= 0) return

    const { data: pendingRows } = await service
      .from("referrals")
      .select("id, influencer_id")
      .in("referred_user_id", parties)
      .eq("status", "pending")

    const pending = (pendingRows as { id: string; influencer_id: string }[] | null) ?? []
    if (pending.length === 0) return

    const platformFeePct = await getNumericSetting(service, "platform_fee_pct", 15)
    const commissionPct = await getNumericSetting(service, "influencer_commission_pct", 10)
    const platformFeeKobo = Math.round((amountKobo * platformFeePct) / 100)
    const commissionKobo = Math.round((platformFeeKobo * commissionPct) / 100)

    for (const ref of pending) {
      const { data: claimed } = await service
        .from("referrals")
        .update({
          status: "qualified",
          qualifying_job_id: escrow.job_id,
          commission_kobo: commissionKobo,
          qualified_at: new Date().toISOString(),
        })
        .eq("id", ref.id)
        .eq("status", "pending")
        .select("id")
        .maybeSingle()
      if (!claimed) continue // a concurrent call already qualified it

      const { data: ip } = await service
        .from("influencer_profiles")
        .select("total_qualified, total_earned_kobo, balance_unpaid_kobo")
        .eq("user_id", ref.influencer_id)
        .maybeSingle()

      await service
        .from("influencer_profiles")
        .update({
          total_qualified: ((ip as any)?.total_qualified ?? 0) + 1,
          total_earned_kobo: ((ip as any)?.total_earned_kobo ?? 0) + commissionKobo,
          balance_unpaid_kobo: ((ip as any)?.balance_unpaid_kobo ?? 0) + commissionKobo,
        })
        .eq("user_id", ref.influencer_id)
    }
  } catch (e) {
    console.error("[influencer] qualifyReferralOnRelease failed:", e)
  }
}
