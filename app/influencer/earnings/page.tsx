import { redirect } from "next/navigation"
import { getInfluencerData } from "@/lib/influencer"

const naira = (n: number) => `₦${Number(n || 0).toLocaleString()}`
const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString() : "—")

export default async function InfluencerEarningsPage() {
  const data = await getInfluencerData()
  if (!data) redirect("/login")
  const { totals, payouts } = data

  const cards = [
    { label: "Total earned", value: naira(totals.earnedNaira), accent: "border-border" },
    { label: "Unpaid balance", value: naira(totals.unpaidNaira), accent: "border-primary/30" },
    { label: "Paid out", value: naira(Math.max(totals.earnedNaira - totals.unpaidNaira, 0)), accent: "border-border" },
  ]

  return (
    <div className="min-h-screen bg-surface pb-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <header className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Influencer</p>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Earnings</h1>
          <p className="text-sm text-muted-foreground">Your commission earnings and payout history. Payouts are processed by the Bizimi team.</p>
        </header>

        <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {cards.map((c) => (
            <div key={c.label} className={`rounded-xl border bg-card p-4 ${c.accent}`}>
              <p className="text-xs font-medium text-muted-foreground">{c.label}</p>
              <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground tabular-nums">{c.value}</p>
            </div>
          ))}
        </section>

        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="text-base font-semibold text-foreground">Payout history</h2>
          </div>
          {payouts.length === 0 ? (
            <div className="px-5 py-12 text-center text-sm text-muted-foreground">No payouts yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-surface-2 text-[11px] uppercase tracking-wide font-medium text-muted-foreground border-b border-border">
                  <tr>
                    <th className="px-5 py-3">Amount</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Date</th>
                    <th className="px-5 py-3">Note</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {payouts.map((p) => (
                    <tr key={p.id} className="hover:bg-surface/60 transition-colors">
                      <td className="px-5 py-4 font-semibold text-foreground tabular-nums">{naira(p.amount_kobo / 100)}</td>
                      <td className="px-5 py-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-success/10 text-success capitalize">{p.status}</span>
                      </td>
                      <td className="px-5 py-4 text-muted-foreground tabular-nums">{fmtDate(p.processed_at)}</td>
                      <td className="px-5 py-4 text-muted-foreground">{p.note || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
