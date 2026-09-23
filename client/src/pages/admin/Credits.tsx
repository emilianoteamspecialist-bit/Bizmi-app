import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import AdminSidebar from "@/components/AdminSidebar"
import { useAdminCreditsQuery, type AdminCreditPurchase } from "@/lib/queries/admin"

const getStatusBadge = (status: string) => {
  const badge = "inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium"
  switch (status?.toLowerCase()) {
    case "success":
    case "completed":
      return <span className={`${badge} bg-success/10 text-success`}>Success</span>
    case "pending":
      return <span className={`${badge} bg-warning/10 text-warning`}>Pending</span>
    case "failed":
      return <span className={`${badge} bg-destructive/10 text-destructive`}>Failed</span>
    default:
      return <span className={`${badge} bg-surface-2 text-muted-foreground capitalize`}>{status}</span>
  }
}

export default function AdminCredits() {
  const creditsQuery = useAdminCreditsQuery()
  const [searchTerm, setSearchTerm] = useState("")

  const purchases = creditsQuery.data?.purchases ?? []
  const freelancers = creditsQuery.data?.freelancers ?? []
  const totalCredits = creditsQuery.data?.totalCredits ?? 0

  const filtered = purchases.filter(
    (p: AdminCreditPurchase) =>
      p.paystack_reference.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.status.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.freelancer_name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (creditsQuery.isLoading) {
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
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Credits &amp; users</h1>
            <p className="text-sm text-muted-foreground">Manage platform credits and registered freelancers.</p>
          </header>

          <section className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs font-medium text-muted-foreground">Total credits purchased</p>
              <p className="mt-3 text-3xl font-semibold tracking-tight text-foreground tabular-nums" data-testid="total-credits-value">{totalCredits.toLocaleString()}</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs font-medium text-muted-foreground">Total freelancers</p>
              <p className="mt-3 text-3xl font-semibold tracking-tight text-foreground tabular-nums">{freelancers.length}</p>
            </div>
          </section>

          <div className="rounded-xl border border-border bg-card overflow-hidden" data-testid="transactions-table">
            <div className="px-5 py-4 border-b border-border flex flex-col md:flex-row md:items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-foreground">Recent transactions</h2>
              <Input placeholder="Search transactions…" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="md:max-w-xs" />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-surface-2 text-[11px] uppercase tracking-wide font-medium text-muted-foreground border-b border-border">
                  <tr>
                    <th className="px-5 py-3">Freelancer</th>
                    <th className="px-5 py-3">Amount</th>
                    <th className="px-5 py-3">Reference ID</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-5 py-12 text-center text-sm text-muted-foreground">
                        {searchTerm ? "No transactions matching your search." : "No transactions found."}
                      </td>
                    </tr>
                  ) : (
                    filtered.map((p: AdminCreditPurchase) => (
                      <tr key={p.id} className="hover:bg-surface/60 transition-colors">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-9 w-9 rounded-full">
                              <AvatarFallback className="bg-surface-2 text-foreground text-sm font-semibold">{p.freelancer_name.charAt(0).toUpperCase()}</AvatarFallback>
                            </Avatar>
                            <span className="font-medium text-foreground">{p.freelancer_name}</span>
                          </div>
                        </td>
                        <td className="px-5 py-4 tabular-nums">
                          {p.credits_amount.toLocaleString()} <span className="text-[11px] text-muted-foreground">CR</span>
                        </td>
                        <td className="px-5 py-4 font-mono text-xs text-muted-foreground">{p.paystack_reference}</td>
                        <td className="px-5 py-4">{getStatusBadge(p.status)}</td>
                        <td className="px-5 py-4 text-muted-foreground tabular-nums">{new Date(p.created_at).toLocaleDateString()}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <h2 className="text-base font-semibold text-foreground">Registered freelancers</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-surface-2 text-[11px] uppercase tracking-wide font-medium text-muted-foreground border-b border-border">
                  <tr>
                    <th className="px-5 py-3">Name</th>
                    <th className="px-5 py-3">Account type</th>
                    <th className="px-5 py-3">Registration date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {freelancers.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-5 py-12 text-center text-sm text-muted-foreground">No freelancers registered yet.</td>
                    </tr>
                  ) : (
                    freelancers.map((f) => (
                      <tr key={f.id} className="hover:bg-surface/60 transition-colors">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-9 w-9 rounded-full">
                              <AvatarFallback className="bg-surface-2 text-foreground text-sm font-semibold">{f.full_name?.charAt(0).toUpperCase() || "?"}</AvatarFallback>
                            </Avatar>
                            <span className="font-medium text-foreground">{f.full_name}</span>
                          </div>
                        </td>
                        <td className="px-5 py-4 capitalize">{f.account_type}</td>
                        <td className="px-5 py-4 text-muted-foreground tabular-nums">{new Date(f.created_at).toLocaleDateString()}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
