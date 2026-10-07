import AdminSidebar from "@/components/AdminSidebar"
import { formatKobo, useAdminAnalyticsQuery } from "@/lib/queries/escrow"

function Table({ title, testId, head, rows }: { title: string; testId: string; head: string[]; rows: (string | number)[][] }) {
  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden" data-testid={testId}>
      <h2 className="px-5 py-4 border-b border-border text-base font-semibold text-foreground">{title}</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-surface-2 text-xs font-medium text-muted-foreground border-b border-border">
            <tr>
              {head.map((h) => (
                <th key={h} className="px-5 py-3">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={head.length} className="px-5 py-8 text-center text-muted-foreground">
                  No data yet.
                </td>
              </tr>
            ) : (
              rows.map((r, i) => (
                <tr key={i} className="border-b border-border last:border-0">
                  {r.map((cell, j) => (
                    <td key={j} className="px-5 py-3 tabular-nums">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function AdminAnalytics() {
  const analyticsQuery = useAdminAnalyticsQuery()
  const data = analyticsQuery.data

  return (
    <div className="flex h-screen flex-col bg-surface">
      <AdminSidebar />
      <div className="flex-1 overflow-auto">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
          <header className="space-y-1">
            <h1 className="font-heading text-xl font-semibold tracking-tight text-foreground sm:text-2xl">Analytics</h1>
            <p className="text-sm text-muted-foreground">Top earners (successful payouts, after fees) and top funders (money paid into escrow).</p>
          </header>
          {analyticsQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : analyticsQuery.isError || !data ? (
            <p className="text-sm text-destructive">Couldn't load analytics.</p>
          ) : (
            <div className="grid gap-6 lg:grid-cols-2">
              <Table
                title="Top freelancers"
                testId="top-freelancers"
                head={["Freelancer", "Earned", "Paid jobs"]}
                rows={data.topFreelancers.map((f) => [f.name, formatKobo(f.earned_kobo), f.paid_jobs])}
              />
              <Table
                title="Top agencies"
                testId="top-agencies"
                head={["Agency", "Funded", "Funded jobs"]}
                rows={data.topAgencies.map((a) => [a.name, formatKobo(a.funded_kobo), a.funded_jobs])}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
