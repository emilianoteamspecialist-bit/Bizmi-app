import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { FileText, Loader2, ShieldAlert, Wallet as WalletIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import EscrowStatusBadge from "@/components/shared/EscrowStatusBadge"
import {
  DISPUTE_TYPE_LABELS,
  formatKobo,
  useMyEscrowsQuery,
  useOpenDisputeMutation,
  type DisputeType,
  type MyEscrow,
} from "@/lib/queries/escrow"

function DisputeForm({ escrow, onCancel }: { escrow: MyEscrow; onCancel: () => void }) {
  const navigate = useNavigate()
  const openDispute = useOpenDisputeMutation()
  const [type, setType] = useState<DisputeType>("non_delivery")
  const [description, setDescription] = useState("")
  const [error, setError] = useState("")

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        setError("")
        openDispute.mutate(
          { job_id: escrow.job_id, dispute_type: type, description },
          {
            onSuccess: ({ dispute }) => navigate(`/disputes/${dispute.id}`),
            onError: (err) => setError(err instanceof Error ? err.message : "Could not open the dispute"),
          }
        )
      }}
      className="mt-4 space-y-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4"
    >
      <p className="text-sm text-foreground">
        Opening a dispute freezes the {formatKobo(escrow.amount_kobo)} held for <strong>{escrow.job_title}</strong> until an admin resolves it.
      </p>
      <div className="space-y-1.5">
        <Label htmlFor={`dispute-type-${escrow.id}`}>Reason</Label>
        <select
          id={`dispute-type-${escrow.id}`}
          value={type}
          onChange={(e) => setType(e.target.value as DisputeType)}
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
        >
          {(["non_delivery", "quality"] as DisputeType[]).map((t) => (
            <option key={t} value={t}>
              {DISPUTE_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`dispute-desc-${escrow.id}`}>What happened?</Label>
        <Textarea id={`dispute-desc-${escrow.id}`} value={description} onChange={(e) => setDescription(e.target.value)} rows={3} required />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" variant="destructive" disabled={openDispute.isPending || !description.trim()}>
          {openDispute.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Open dispute"}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  )
}

export default function Wallet() {
  const escrowsQuery = useMyEscrowsQuery()
  const [disputingId, setDisputingId] = useState<string | null>(null)
  const escrows = (escrowsQuery.data?.escrows ?? []).filter((e) => e.role === "agency" && e.status_v2 !== "pending")

  const sum = (pred: (e: MyEscrow) => boolean) => escrows.filter(pred).reduce((t, e) => t + (Number(e.amount_kobo) || 0), 0)
  const tiles = [
    { label: "In escrow", value: sum((e) => e.status_v2 === "funded" || e.status_v2 === "disputed") },
    { label: "Released", value: sum((e) => e.status_v2 === "released") },
    { label: "Paid out", value: sum((e) => e.status_v2 === "paid_out") },
    { label: "Refunded", value: sum((e) => e.status_v2 === "refunded") },
  ]

  return (
    <div className="min-h-screen bg-surface pb-20">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <header className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Hiring desk</p>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Wallet</h1>
          <p className="text-sm text-muted-foreground">Money you've placed in escrow and where it stands. Fund a job from an accepted proposal.</p>
        </header>

        {escrowsQuery.isLoading ? (
          <div data-testid="wallet-loading" className="h-32 rounded-xl border border-border bg-card animate-pulse" />
        ) : escrowsQuery.isError ? (
          <div className="rounded-xl border border-border bg-card p-8 text-center">
            <p className="text-sm font-semibold text-foreground">Couldn't load your wallet</p>
            <p className="text-sm text-muted-foreground">Please try refreshing the page.</p>
          </div>
        ) : (
          <>
            <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {tiles.map((t) => (
                <div key={t.label} className="rounded-xl border border-border bg-card p-4">
                  <p className="text-xs font-medium text-muted-foreground">{t.label}</p>
                  <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground tabular-nums" data-testid={`wallet-${t.label}`}>
                    {formatKobo(t.value)}
                  </p>
                </div>
              ))}
            </section>

            {escrows.length === 0 ? (
              <div className="rounded-xl border border-border bg-card py-16 px-6 text-center">
                <div className="mx-auto h-11 w-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <WalletIcon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-sm font-semibold text-foreground">Nothing in escrow yet</h3>
                <p className="mt-1 text-sm text-muted-foreground">Accept a proposal and choose "Fund job" to pay into escrow.</p>
              </div>
            ) : (
              <div className="rounded-xl border border-border bg-card divide-y divide-border overflow-hidden">
                {escrows.map((escrow) => (
                  <div key={escrow.id} className="p-4 sm:p-5" data-testid={`escrow-${escrow.id}`}>
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                      <div className="min-w-0 space-y-1.5">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <h3 className="text-sm font-semibold text-foreground truncate">{escrow.job_title ?? "Job"}</h3>
                          <EscrowStatusBadge status={escrow.status_v2} />
                        </div>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          <span>{escrow.freelancer_name ?? "Freelancer"}</span>
                          <span className="font-medium text-foreground tabular-nums">{formatKobo(escrow.amount_kobo)}</span>
                          <span>{new Date(escrow.funded_at ?? escrow.created_at).toLocaleDateString()}</span>
                        </div>
                        {escrow.status_v2 === "funded" && escrow.submission_status === "submitted" && (
                          <p className="text-xs text-primary">Work submitted — review it in the workspace.</p>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        {escrow.status_v2 === "awaiting" && <ResumePayment />}
                        {escrow.status_v2 === "funded" && (
                          <>
                            <Button asChild size="sm" variant="outline" className="gap-1.5">
                              <Link to={`/workspace/${escrow.job_id}`}>
                                <FileText className="h-3.5 w-3.5" /> Workspace
                              </Link>
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10"
                              onClick={() => setDisputingId(disputingId === escrow.id ? null : escrow.id)}
                            >
                              <ShieldAlert className="h-3.5 w-3.5" /> Dispute
                            </Button>
                          </>
                        )}
                        {escrow.open_dispute_id && (
                          <Button asChild size="sm" variant="outline" className="gap-1.5">
                            <Link to={`/disputes/${escrow.open_dispute_id}`}>
                              <ShieldAlert className="h-3.5 w-3.5" /> View dispute
                            </Link>
                          </Button>
                        )}
                      </div>
                    </div>
                    {disputingId === escrow.id && <DisputeForm escrow={escrow} onCancel={() => setDisputingId(null)} />}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// An escrow left 'awaiting' (checkout opened but not paid) is resumed from the
// proposal's "Fund job" button -- the server hands back the same Paystack
// checkout -- so this points the agency at their job posts.
function ResumePayment() {
  return (
    <Button asChild size="sm" variant="outline">
      <Link to="/agency/posts">Complete payment</Link>
    </Button>
  )
}
