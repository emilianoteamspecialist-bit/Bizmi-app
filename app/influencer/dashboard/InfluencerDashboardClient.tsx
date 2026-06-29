"use client"

import { useEffect, useState } from "react"
import { Users, BadgeCheck, Clock, Coins, Link2, Check, Copy, Share2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { InfluencerData } from "@/lib/influencer"

const naira = (n: number) => `₦${Number(n || 0).toLocaleString()}`
const fmtDate = (d: string) => new Date(d).toLocaleDateString()

function statusPill(status: string) {
  const base = "inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium capitalize"
  if (status === "qualified") return `${base} bg-success/10 text-success`
  if (status === "paid") return `${base} bg-info/10 text-info`
  return `${base} bg-warning/10 text-warning`
}

export default function InfluencerDashboardClient({ data, appUrl }: { data: InfluencerData; appUrl: string }) {
  const { totals, referrals, referralCode } = data
  const [origin, setOrigin] = useState(appUrl)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!appUrl && typeof window !== "undefined") setOrigin(window.location.origin)
  }, [appUrl])

  const referralLink = referralCode ? `${origin || ""}/signup?ref=${referralCode}` : null

  const copy = async () => {
    if (!referralLink) return
    try {
      await navigator.clipboard.writeText(referralLink)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      /* clipboard unavailable */
    }
  }

  const share = async () => {
    if (!referralLink) return
    if (typeof navigator !== "undefined" && (navigator as any).share) {
      try {
        await (navigator as any).share({ title: "Join me on Bizimi", url: referralLink })
        return
      } catch {
        /* fall back to copy */
      }
    }
    copy()
  }

  const tiles = [
    { label: "People referred", value: totals.referred, icon: Users, tile: "bg-primary/10 text-primary" },
    { label: "Qualified", value: totals.qualified, icon: BadgeCheck, tile: "bg-jade/10 text-jade" },
    { label: "Pending", value: totals.pending, icon: Clock, tile: "bg-warning/10 text-warning" },
    { label: "Total earned", value: naira(totals.earnedNaira), icon: Coins, tile: "bg-info/10 text-info" },
  ]

  return (
    <div className="min-h-screen bg-surface pb-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Header */}
        <header className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Influencer</p>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Share your link, refer new users, and earn when they complete their first transaction.
          </p>
        </header>

        {/* Referral link */}
        <section className="rounded-2xl border border-border bg-card p-6">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Link2 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground">Your referral link</h2>
              <p className="text-xs text-muted-foreground">Anyone who signs up through this link is attributed to you.</p>
            </div>
          </div>

          {referralLink ? (
            <div className="mt-4 flex flex-col sm:flex-row gap-2">
              <div className="flex-1 min-w-0 flex items-center rounded-xl border border-border bg-surface-2 px-3 h-11">
                <span className="truncate text-sm text-foreground font-mono">{referralLink}</span>
              </div>
              <div className="flex gap-2">
                <Button onClick={copy} className="gap-2 h-11">
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copied ? "Copied" : "Copy link"}
                </Button>
                <Button onClick={share} variant="outline" className="gap-2 h-11">
                  <Share2 className="h-4 w-4" />
                  Share
                </Button>
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-xl border border-dashed border-border bg-surface-2 px-4 py-5 text-sm text-muted-foreground">
              Your referral link is being set up. Once your influencer profile is ready, your unique link will appear here.
            </div>
          )}
        </section>

        {/* Metric tiles */}
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

        <div className="grid lg:grid-cols-3 gap-6 items-start">
          {/* Unpaid balance */}
          <div className="rounded-2xl border border-primary/30 bg-card p-5 lg:col-span-1">
            <p className="text-xs font-medium text-muted-foreground">Unpaid balance</p>
            <p className="mt-1 text-3xl font-semibold tracking-tight text-foreground tabular-nums">{naira(totals.unpaidNaira)}</p>
            <p className="mt-3 text-xs text-muted-foreground leading-relaxed">
              Earnings you've made that haven't been paid out yet. Payouts are processed manually by the Bizimi team.
            </p>
          </div>

          {/* Recent referrals */}
          <div className="rounded-2xl border border-border bg-card overflow-hidden lg:col-span-2">
            <div className="px-5 py-4 border-b border-border">
              <h2 className="text-base font-semibold text-foreground">Recent referrals</h2>
            </div>
            {referrals.length === 0 ? (
              <div className="px-5 py-12 text-center">
                <div className="mx-auto h-11 w-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <Users className="h-5 w-5" />
                </div>
                <p className="mt-4 text-sm font-medium text-foreground">No referrals yet</p>
                <p className="mt-1 text-sm text-muted-foreground">Share your link to start referring new users.</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {referrals.slice(0, 6).map((r) => (
                  <div key={r.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground capitalize">{r.referred_account_type || "New user"}</p>
                      <p className="text-[11px] text-muted-foreground tabular-nums">Joined {fmtDate(r.created_at)}</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {r.commission_kobo ? (
                        <span className="text-sm font-semibold text-foreground tabular-nums">{naira(r.commission_kobo / 100)}</span>
                      ) : null}
                      <span className={statusPill(r.status)}>{r.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
