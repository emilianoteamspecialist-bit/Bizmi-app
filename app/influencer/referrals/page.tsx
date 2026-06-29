import { redirect } from "next/navigation"
import { getInfluencerData } from "@/lib/influencer"

const naira = (n: number) => `₦${Number(n || 0).toLocaleString()}`
const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString() : "—")

function statusPill(status: string) {
  const base = "inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium capitalize"
  if (status === "qualified") return `${base} bg-success/10 text-success`
  if (status === "paid") return `${base} bg-info/10 text-info`
  return `${base} bg-warning/10 text-warning`
}

export default async function InfluencerReferralsPage() {
  const data = await getInfluencerData()
  if (!data) redirect("/login")
  const { referrals } = data

  return (
    <div className="min-h-screen bg-surface pb-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <header className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Influencer</p>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Referrals</h1>
          <p className="text-sm text-muted-foreground">Everyone who signed up through your link, and where they stand.</p>
        </header>

        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="text-base font-semibold text-foreground">All referrals ({referrals.length})</h2>
          </div>
          {referrals.length === 0 ? (
            <div className="px-5 py-12 text-center text-sm text-muted-foreground">
              No referrals yet. Share your link from the dashboard to get started.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-surface-2 text-[11px] uppercase tracking-wide font-medium text-muted-foreground border-b border-border">
                  <tr>
                    <th className="px-5 py-3">User type</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Commission</th>
                    <th className="px-5 py-3">Joined</th>
                    <th className="px-5 py-3">Qualified</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {referrals.map((r) => (
                    <tr key={r.id} className="hover:bg-surface/60 transition-colors">
                      <td className="px-5 py-4 font-medium text-foreground capitalize">{r.referred_account_type || "New user"}</td>
                      <td className="px-5 py-4"><span className={statusPill(r.status)}>{r.status}</span></td>
                      <td className="px-5 py-4 text-foreground tabular-nums">{r.commission_kobo ? naira(r.commission_kobo / 100) : "—"}</td>
                      <td className="px-5 py-4 text-muted-foreground tabular-nums">{fmtDate(r.created_at)}</td>
                      <td className="px-5 py-4 text-muted-foreground tabular-nums">{fmtDate(r.qualified_at)}</td>
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
