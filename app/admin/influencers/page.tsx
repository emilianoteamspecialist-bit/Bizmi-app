import { redirect } from "next/navigation"
import { getFullUserData } from "@/app/actions/user"
import { createServiceRoleClient } from "@/lib/supabase-service"
import AdminInfluencersClient from "./AdminInfluencersClient"

const toNaira = (kobo?: number | null) => Number(kobo || 0) / 100
const settingNum = (rows: any[], key: string, fallback: number) => {
  const raw = rows.find((r) => r.key === key)?.value
  const n = typeof raw === "number" ? raw : Number(raw)
  return Number.isFinite(n) ? n : fallback
}

export default async function AdminInfluencersPage() {
  // Admin guard.
  const userData = await getFullUserData()
  if (!userData?.user) redirect("/admin/login")
  if (userData.profile?.account_type !== "admin") redirect("/admin/login")

  // Admin reads cross-user influencer data via the service-role client.
  const service = createServiceRoleClient()

  const { data: profiles } = await service
    .from("influencer_profiles")
    .select("user_id, referral_code, display_name, social_handle, total_referrals, total_qualified, total_earned_kobo, balance_unpaid_kobo, created_at")
    .order("total_earned_kobo", { ascending: false })

  const list = profiles ?? []
  const ids = list.map((p: any) => p.user_id)

  const { data: names } = ids.length
    ? await service.from("profiles").select("id, full_name, email").in("id", ids)
    : { data: [] as any[] }
  const nameById = new Map((names ?? []).map((n: any) => [n.id, n]))

  const [{ count: totalUsers }, { count: referredUsers }, { data: settingsRows }] = await Promise.all([
    service.from("profiles").select("*", { count: "exact", head: true }),
    service.from("referrals").select("*", { count: "exact", head: true }),
    service.from("app_settings").select("key, value").in("key", ["influencer_commission_pct", "platform_fee_pct"]),
  ])

  const influencers = list.map((p: any) => ({
    id: p.user_id,
    name: nameById.get(p.user_id)?.full_name || p.display_name || "Unknown",
    email: nameById.get(p.user_id)?.email || null,
    referralCode: p.referral_code,
    socialHandle: p.social_handle,
    referred: p.total_referrals ?? 0,
    qualified: p.total_qualified ?? 0,
    earnedNaira: toNaira(p.total_earned_kobo),
    unpaidNaira: toNaira(p.balance_unpaid_kobo),
  }))

  const total = totalUsers ?? 0
  const referred = referredUsers ?? 0

  return (
    <AdminInfluencersClient
      influencers={influencers}
      summary={{ totalUsers: total, referred, organic: Math.max(total - referred, 0) }}
      commissionPct={settingNum(settingsRows ?? [], "influencer_commission_pct", 10)}
      platformFeePct={settingNum(settingsRows ?? [], "platform_fee_pct", 15)}
    />
  )
}
