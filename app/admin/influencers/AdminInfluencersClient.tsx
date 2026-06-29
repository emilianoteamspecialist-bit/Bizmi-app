"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Users, UserPlus, Sparkles, Percent } from "lucide-react"
import { AdminSidebar } from "@/components/admin-sidebar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

const naira = (n: number) => `₦${Number(n || 0).toLocaleString()}`

type Influencer = {
  id: string
  name: string
  email: string | null
  referralCode: string
  socialHandle: string | null
  referred: number
  qualified: number
  earnedNaira: number
  unpaidNaira: number
}

interface Props {
  influencers: Influencer[]
  summary: { totalUsers: number; referred: number; organic: number }
  commissionPct: number
  platformFeePct: number
}

export default function AdminInfluencersClient({ influencers, summary, commissionPct, platformFeePct }: Props) {
  const router = useRouter()
  const [commission, setCommission] = useState(String(commissionPct))
  const [fee, setFee] = useState(String(platformFeePct))
  const [savingSettings, setSavingSettings] = useState(false)
  const [payingId, setPayingId] = useState<string | null>(null)

  const referralRate = summary.totalUsers > 0 ? Math.round((summary.referred / summary.totalUsers) * 100) : 0

  const tiles = [
    { label: "Total users", value: summary.totalUsers, icon: Users, tile: "bg-primary/10 text-primary" },
    { label: "Referred", value: summary.referred, icon: UserPlus, tile: "bg-jade/10 text-jade" },
    { label: "Organic", value: summary.organic, icon: Sparkles, tile: "bg-info/10 text-info" },
    { label: "Referral rate", value: `${referralRate}%`, icon: Percent, tile: "bg-aubergine/10 text-aubergine" },
  ]

  const saveSettings = async () => {
    setSavingSettings(true)
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          influencer_commission_pct: Number(commission),
          platform_fee_pct: Number(fee),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        alert(data.error || "Failed to save")
        return
      }
      router.refresh()
    } catch {
      alert("Something went wrong.")
    } finally {
      setSavingSettings(false)
    }
  }

  const recordPayout = async (inf: Influencer) => {
    if (!confirm(`Record a payout of ${naira(inf.unpaidNaira)} to ${inf.name}? This zeroes their unpaid balance and marks their qualified referrals as paid.`)) {
      return
    }
    setPayingId(inf.id)
    try {
      const res = await fetch(`/api/admin/influencers/${inf.id}/payout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
      const data = await res.json()
      if (!res.ok) {
        alert(data.error || "Payout failed")
        return
      }
      router.refresh()
    } catch {
      alert("Something went wrong.")
    } finally {
      setPayingId(null)
    }
  }

  return (
    <div className="flex h-screen bg-surface">
      <AdminSidebar />
      <div className="flex-1 overflow-auto">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
          {/* Header */}
          <header className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Admin</p>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Influencers</h1>
            <p className="text-sm text-muted-foreground">Referral performance, user acquisition, and payouts.</p>
          </header>

          {/* Acquisition */}
          <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {tiles.map((t) => (
              <div key={t.label} className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-muted-foreground">{t.label}</p>
                  <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${t.tile}`}>
                    <t.icon className="h-4 w-4" />
                  </div>
                </div>
                <p className="mt-3 text-2xl font-semibold tracking-tight text-foreground tabular-nums">{t.value}</p>
              </div>
            ))}
          </section>

          {/* Settings */}
          <section className="rounded-xl border border-border bg-card p-6">
            <h2 className="text-base font-semibold text-foreground">Program settings</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Commission is this % of Bizimi&apos;s platform fee. Changes apply to future qualifying events only.
            </p>
            <div className="mt-4 flex flex-col sm:flex-row sm:items-end gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Influencer commission %</label>
                <Input type="number" min={0} max={100} value={commission} onChange={(e) => setCommission(e.target.value)} className="sm:w-44" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Platform fee %</label>
                <Input type="number" min={0} max={100} value={fee} onChange={(e) => setFee(e.target.value)} className="sm:w-44" />
              </div>
              <Button onClick={saveSettings} disabled={savingSettings} className="sm:ml-1">
                {savingSettings ? "Saving…" : "Save settings"}
              </Button>
            </div>
          </section>

          {/* Influencers table */}
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
                    {influencers.map((inf) => (
                      <tr key={inf.id} className="hover:bg-surface/60 transition-colors">
                        <td className="px-5 py-4">
                          <div className="min-w-0">
                            <p className="font-medium text-foreground truncate">{inf.name}</p>
                            <p className="text-xs text-muted-foreground truncate">{inf.email || inf.socialHandle || "—"}</p>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <span className="font-mono text-xs text-muted-foreground bg-surface-2 px-2 py-1 rounded-md border border-border">{inf.referralCode}</span>
                        </td>
                        <td className="px-5 py-4 text-muted-foreground tabular-nums">{inf.referred}</td>
                        <td className="px-5 py-4 text-muted-foreground tabular-nums">{inf.qualified}</td>
                        <td className="px-5 py-4 text-foreground tabular-nums">{naira(inf.earnedNaira)}</td>
                        <td className="px-5 py-4 font-semibold text-foreground tabular-nums">{naira(inf.unpaidNaira)}</td>
                        <td className="px-5 py-4 text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={inf.unpaidNaira <= 0 || payingId === inf.id}
                            onClick={() => recordPayout(inf)}
                          >
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
