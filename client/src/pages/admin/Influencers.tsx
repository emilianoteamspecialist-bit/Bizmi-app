import { useState } from "react"
import { Users, UserPlus, Sparkles, Percent } from "lucide-react"
import AdminSidebar from "@/components/AdminSidebar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useAdminInfluencersQuery, useRecordInfluencerPayoutMutation, useUpdateInfluencerSettingsMutation, type AdminInfluencerRow } from "@/lib/queries/admin"

const naira = (n: number) => `₦${Number(n || 0).toLocaleString()}`

// Owns its own local state, seeded from the real query values. Extracted so it
// only ever mounts once `data` has actually loaded -- a `useState` initializer
// in the parent would capture the loading-state's fallback defaults on the
// component's first render (before the isLoading gate below returns), and
// never re-sync when the real data arrives on the next render.
function SettingsForm({
  commissionPct,
  platformFeePct,
  onSave,
  isSaving,
}: {
  commissionPct: number
  platformFeePct: number
  onSave: (commission: number, fee: number) => void
  isSaving: boolean
}) {
  const [commission, setCommission] = useState(String(commissionPct))
  const [fee, setFee] = useState(String(platformFeePct))

  return (
    <section className="rounded-xl border border-border bg-card p-6">
      <h2 className="text-base font-semibold text-foreground">Program settings</h2>
      <p className="mt-1 text-sm text-muted-foreground">Commission is this % of Bizimi&apos;s platform fee. Changes apply to future qualifying events only.</p>
      <div className="mt-4 flex flex-col sm:flex-row sm:items-end gap-3">
        <div className="space-y-1">
          <label htmlFor="influencer-commission-pct" className="text-xs font-medium text-muted-foreground">Influencer commission %</label>
          <Input id="influencer-commission-pct" type="number" min={0} max={100} value={commission} onChange={(e) => setCommission(e.target.value)} className="sm:w-44" />
        </div>
        <div className="space-y-1">
          <label htmlFor="platform-fee-pct" className="text-xs font-medium text-muted-foreground">Platform fee %</label>
          <Input id="platform-fee-pct" type="number" min={0} max={100} value={fee} onChange={(e) => setFee(e.target.value)} className="sm:w-44" />
        </div>
        <Button onClick={() => onSave(Number(commission), Number(fee))} disabled={isSaving} className="sm:ml-1">
          {isSaving ? "Saving…" : "Save settings"}
        </Button>
      </div>
    </section>
  )
}

export default function AdminInfluencers() {
  const influencersQuery = useAdminInfluencersQuery()
  const recordPayout = useRecordInfluencerPayoutMutation()
  const updateSettings = useUpdateInfluencerSettingsMutation()

  const data = influencersQuery.data
  const influencers = data?.influencers ?? []
  const summary = data?.summary ?? { totalUsers: 0, referred: 0, organic: 0 }

  const [payingId, setPayingId] = useState<string | null>(null)

  const referralRate = summary.totalUsers > 0 ? Math.round((summary.referred / summary.totalUsers) * 100) : 0

  const tiles = [
    { label: "Total users", value: summary.totalUsers, icon: Users },
    { label: "Referred", value: summary.referred, icon: UserPlus },
    { label: "Organic", value: summary.organic, icon: Sparkles },
    { label: "Referral rate", value: `${referralRate}%`, icon: Percent },
  ]

  const handleSaveSettings = (commission: number, fee: number) => {
    updateSettings.mutate({ influencer_commission_pct: commission, platform_fee_pct: fee })
  }

  const handleRecordPayout = (inf: AdminInfluencerRow) => {
    if (!confirm(`Record a payout of ${naira(inf.unpaidNaira)} to ${inf.name}? This zeroes their unpaid balance and marks their qualified referrals as paid.`)) return
    setPayingId(inf.id)
    recordPayout.mutate({ influencerId: inf.id }, { onSettled: () => setPayingId(null) })
  }

  if (influencersQuery.isLoading) {
    return (
      <div className="flex h-screen bg-surface">
        <AdminSidebar />
        <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">Loading…</div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-surface">
      <AdminSidebar />
      <div className="flex-1 overflow-auto">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
          <header className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Admin</p>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Influencers</h1>
            <p className="text-sm text-muted-foreground">Referral performance, user acquisition, and payouts.</p>
          </header>

          <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {tiles.map((t) => (
              <div key={t.label} className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-muted-foreground">{t.label}</p>
                  <t.icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <p className="mt-3 text-2xl font-semibold tracking-tight text-foreground tabular-nums">{t.value}</p>
              </div>
            ))}
          </section>

          <SettingsForm
            commissionPct={data?.commissionPct ?? 10}
            platformFeePct={data?.platformFeePct ?? 15}
            onSave={handleSaveSettings}
            isSaving={updateSettings.isPending}
          />

          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <h2 className="text-base font-semibold text-foreground">All influencers ({influencers.length})</h2>
            </div>
            {influencers.length === 0 ? (
              <div className="px-5 py-12 text-center text-sm text-muted-foreground">No influencers yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-surface-2 text-[11px] uppercase tracking-wide font-medium text-muted-foreground border-b border-border">
                    <tr>
                      <th className="px-5 py-3">Influencer</th>
                      <th className="px-5 py-3">Code</th>
                      <th className="px-5 py-3">Referred</th>
                      <th className="px-5 py-3">Qualified</th>
                      <th className="px-5 py-3">Earned</th>
                      <th className="px-5 py-3">Unpaid</th>
                      <th className="px-5 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {influencers.map((inf: AdminInfluencerRow) => (
                      <tr key={inf.id} className="hover:bg-surface/60 transition-colors">
                        <td className="px-5 py-4">
                          <p className="font-medium text-foreground truncate">{inf.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{inf.email || inf.socialHandle || "—"}</p>
                        </td>
                        <td className="px-5 py-4 font-mono text-xs text-muted-foreground">{inf.referralCode}</td>
                        <td className="px-5 py-4 text-muted-foreground tabular-nums">{inf.referred}</td>
                        <td className="px-5 py-4 text-muted-foreground tabular-nums">{inf.qualified}</td>
                        <td className="px-5 py-4 text-foreground tabular-nums">{naira(inf.earnedNaira)}</td>
                        <td className="px-5 py-4 font-semibold text-foreground tabular-nums">{naira(inf.unpaidNaira)}</td>
                        <td className="px-5 py-4 text-right">
                          <Button size="sm" variant="outline" disabled={inf.unpaidNaira <= 0 || payingId === inf.id} onClick={() => handleRecordPayout(inf)}>
                            {payingId === inf.id ? "Recording…" : "Record payout"}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
