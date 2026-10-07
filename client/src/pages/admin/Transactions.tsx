import { useState } from "react"
import { ChevronDown } from "lucide-react"
import { Input } from "@/components/ui/input"
import AdminSidebar from "@/components/AdminSidebar"
import EscrowStatusBadge from "@/components/shared/EscrowStatusBadge"
import { formatKobo, useAdminEscrowEventsQuery, useAdminTransactionsQuery, type AdminTransaction } from "@/lib/queries/escrow"

function EventTrail({ escrowId }: { escrowId: string }) {
  const eventsQuery = useAdminEscrowEventsQuery(escrowId)
  if (eventsQuery.isLoading) return <p className="text-xs text-muted-foreground">Loading history…</p>
  const events = eventsQuery.data?.events ?? []
  if (events.length === 0) return <p className="text-xs text-muted-foreground">No events recorded.</p>
  return (
    <ol className="space-y-1.5" data-testid={`events-${escrowId}`}>
      {events.map((e) => (
        <li key={e.id} className="text-xs text-muted-foreground">
          <span className="tabular-nums">{new Date(e.created_at).toLocaleString()}</span> · <span className="font-medium text-foreground">{e.type}</span>{" "}
          ({e.from_status ?? "—"} → {e.to_status}) by {e.actor_type}
          {e.amount_kobo != null && <> · {formatKobo(e.amount_kobo)}</>}
        </li>
      ))}
    </ol>
  )
}

function Row({ t }: { t: AdminTransaction }) {
  const [open, setOpen] = useState(false)
  const payout = t.payouts[0]
  return (
    <>
      <tr className="border-b border-border">
        <td className="px-5 py-3">
          <p className="font-medium text-foreground">{t.job_title ?? "Job"}</p>
          <p className="text-xs text-muted-foreground font-mono truncate max-w-[14rem]">{t.paystack_reference ?? "—"}</p>
        </td>
        <td className="px-5 py-3 text-muted-foreground">{t.agency_name ?? "—"}</td>
        <td className="px-5 py-3 text-muted-foreground">{t.freelancer_name ?? "—"}</td>
        <td className="px-5 py-3 tabular-nums">{formatKobo(t.amount_kobo)}</td>
        <td className="px-5 py-3">
          <EscrowStatusBadge status={t.status_v2} />
        </td>
        <td className="px-5 py-3 text-xs text-muted-foreground">
          {payout ? (
            <>
              {payout.status} · {formatKobo(payout.net_amount_kobo)}
              {payout.failure_reason && <span className="block text-destructive">{payout.failure_reason}</span>}
            </>
          ) : (
            "—"
          )}
        </td>
        <td className="px-5 py-3">
          <button
            onClick={() => setOpen(!open)}
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            aria-expanded={open}
            aria-label={`History for ${t.job_title ?? t.id}`}
          >
            History <ChevronDown className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} />
          </button>
        </td>
      </tr>
      {open && (
        <tr className="border-b border-border bg-surface-2/50">
          <td colSpan={7} className="px-5 py-3">
            <EventTrail escrowId={t.id} />
          </td>
        </tr>
      )}
    </>
  )
}

export default function AdminTransactions() {
  const txQuery = useAdminTransactionsQuery()
  const [search, setSearch] = useState("")

  const totals = txQuery.data?.totals
  const term = search.trim().toLowerCase()
  const rows = (txQuery.data?.transactions ?? []).filter(
    (t) =>
      !term ||
      [t.job_title, t.agency_name, t.freelancer_name, t.paystack_reference, t.status_v2].some((v) => (v ?? "").toLowerCase().includes(term))
  )

  return (
    <div className="flex h-screen flex-col bg-surface">
      <AdminSidebar />
      <div className="flex-1 overflow-auto">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
          <header className="space-y-1">
            <h1 className="font-heading text-xl font-semibold tracking-tight text-foreground sm:text-2xl">Transactions</h1>
            <p className="text-sm text-muted-foreground">
              Every escrow on the platform, its payouts and its audit trail. Money only moves through the escrow state machine, so this view is read-only.
            </p>
          </header>

          {txQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : txQuery.isError ? (
            <p className="text-sm text-destructive">Couldn't load transactions.</p>
          ) : (
            <>
              <section className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                {[
                  ["Funded (all time)", totals?.funded_kobo],
                  ["Held in escrow", totals?.in_escrow_kobo],
                  ["Released, awaiting payout", totals?.released_kobo],
                  ["Paid out", totals?.paid_out_kobo],
                  ["Platform fees earned", totals?.fees_kobo],
                ].map(([label, value]) => (
                  <div key={label as string} className="rounded-lg border border-border bg-card p-4">
                    <p className="text-xs font-medium text-muted-foreground">{label}</p>
                    <p className="mt-2 text-xl font-semibold tracking-tight text-foreground tabular-nums">{formatKobo(value as number)}</p>
                  </div>
                ))}
              </section>

              <div className="rounded-lg border border-border bg-card overflow-hidden">
                <div className="px-5 py-4 border-b border-border flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <h2 className="text-base font-semibold text-foreground">Escrows</h2>
                  <Input placeholder="Search job, party, reference, status…" value={search} onChange={(e) => setSearch(e.target.value)} className="md:max-w-xs" />
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-surface-2 text-xs font-medium text-muted-foreground border-b border-border">
                      <tr>
                        <th className="px-5 py-3">Job</th>
                        <th className="px-5 py-3">Agency</th>
                        <th className="px-5 py-3">Freelancer</th>
                        <th className="px-5 py-3">Amount</th>
                        <th className="px-5 py-3">Status</th>
                        <th className="px-5 py-3">Latest payout</th>
                        <th className="px-5 py-3" />
                      </tr>
                    </thead>
                    <tbody>
                      {rows.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-5 py-10 text-center text-muted-foreground">
                            No escrows found.
                          </td>
                        </tr>
                      ) : (
                        rows.map((t) => <Row key={t.id} t={t} />)
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
