import { useState } from "react"
import { CheckCircle, ChevronDown, Clock, MessageSquare, ShieldAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import AdminSidebar from "@/components/AdminSidebar"
import { DISPUTE_TYPE_LABELS, useAdminDisputesQuery, useResolveDisputeMutation, type Dispute } from "@/lib/queries/escrow"

function StatusBadge({ status }: { status: Dispute["status"] }) {
  const base = "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium"
  if (status === "resolved") return <span className={`${base} bg-success/10 text-success`}><CheckCircle className="w-3 h-3" /> Resolved</span>
  if (status === "admin_intervention") return <span className={`${base} bg-destructive/10 text-destructive`}><ShieldAlert className="w-3 h-3" /> Admin intervention</span>
  return <span className={`${base} bg-warning/10 text-warning`}><Clock className="w-3 h-3" /> In platform review</span>
}

const OUTCOME_LABEL: Record<string, string> = { full_release: "Released to freelancer", refund: "Refunded to agency", partial_release: "Partial release", none: "None" }

export default function AdminDisputes() {
  const disputesQuery = useAdminDisputesQuery()
  const resolve = useResolveDisputeMutation()
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const handleResolve = (d: Dispute, outcome: "full_release" | "refund") => {
    const what =
      outcome === "full_release"
        ? `release ₦${Number(d.amount_disputed).toLocaleString()} to the freelancer`
        : `refund ₦${Number(d.amount_disputed).toLocaleString()} to the agency through Paystack`
    if (!confirm(`Resolve this dispute and ${what}? This can't be undone.`)) return
    resolve.mutate(
      { disputeId: d.id, outcome },
      { onError: (err) => alert(err instanceof Error ? err.message : "Could not resolve the dispute") }
    )
  }

  const disputes = disputesQuery.data?.disputes ?? []
  const messagesByDispute = disputesQuery.data?.messagesByDispute ?? {}

  return (
    <div className="flex h-screen bg-surface">
      <AdminSidebar />
      <div className="flex-1 overflow-auto">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
          <header className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Admin</p>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Dispute resolution</h1>
            <p className="text-sm text-muted-foreground">Review the conversation, then release the escrow to the freelancer or refund the agency.</p>
          </header>

          {disputesQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading disputes…</p>
          ) : disputesQuery.isError ? (
            <p className="text-sm text-destructive">Couldn't load disputes.</p>
          ) : disputes.length === 0 ? (
            <div className="rounded-xl border border-border bg-card p-12 text-center text-sm text-muted-foreground">No disputes found.</div>
          ) : (
            <div className="space-y-4">
              {disputes.map((d) => {
                const messages = messagesByDispute[d.id] ?? []
                const isOpen = expanded.has(d.id)
                return (
                  <div key={d.id} className="rounded-xl border border-border bg-card overflow-hidden" data-testid={`dispute-${d.id}`}>
                    <div className="px-5 py-4 border-b border-border space-y-2">
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                        <h3 className="text-base font-semibold text-foreground flex items-center gap-2 flex-wrap">
                          {d.job?.title ?? "Unknown job"} <StatusBadge status={d.status} />
                        </h3>
                        <p className="text-sm font-medium tabular-nums">₦{Number(d.amount_disputed).toLocaleString()}</p>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {DISPUTE_TYPE_LABELS[d.dispute_type] ?? d.dispute_type} · opened by {d.initiator?.full_name ?? "—"} against{" "}
                        {d.respondent?.full_name ?? "—"} on {new Date(d.created_at).toLocaleDateString()}
                      </p>
                      <p className="text-sm text-foreground whitespace-pre-wrap">{d.description}</p>
                    </div>

                    <div className="px-5 py-3 flex flex-wrap items-center gap-2">
                      <button onClick={() => toggle(d.id)} className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline" aria-expanded={isOpen}>
                        <MessageSquare className="h-4 w-4" /> Conversation ({messages.length})
                        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                      </button>
                      <div className="flex-1" />
                      {d.status === "resolved" ? (
                        <span className="text-sm text-success">Outcome: {OUTCOME_LABEL[d.resolution_outcome ?? "none"]}</span>
                      ) : (
                        <>
                          <Button size="sm" onClick={() => handleResolve(d, "full_release")} disabled={resolve.isPending}>
                            Release to freelancer
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => handleResolve(d, "refund")} disabled={resolve.isPending}>
                            Refund agency
                          </Button>
                        </>
                      )}
                    </div>

                    {isOpen && (
                      <div className="px-5 pb-4 space-y-3 border-t border-border pt-3">
                        {messages.length === 0 ? (
                          <p className="text-sm text-muted-foreground">No messages.</p>
                        ) : (
                          messages.map((m) => (
                            <div key={m.id} className="text-sm">
                              <p className="text-xs text-muted-foreground">
                                {m.sender?.full_name ?? "Participant"} · {new Date(m.created_at).toLocaleString()}
                              </p>
                              <p className="whitespace-pre-wrap text-foreground">{m.message}</p>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
