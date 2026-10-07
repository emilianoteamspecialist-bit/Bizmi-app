import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { FileText, Loader2, ShieldAlert, Wallet as WalletIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import EscrowStatusBadge from "@/components/shared/EscrowStatusBadge"
import { EmptyState, ErrorState, PageContainer, PageHeader, SkeletonBlock } from "@/components/marketplace/primitives"
import { formatTimeAgo } from "@/lib/format"
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
    { label: "In escrow", value: sum((e) => e.status_v2 === "funded" || e.status_v2 === "disputed"), hint: "Held until you approve the work" },
    { label: "Released", value: sum((e) => e.status_v2 === "released"), hint: "Approved, awaiting payout" },
    { label: "Paid out", value: sum((e) => e.status_v2 === "paid_out"), hint: "Paid to freelancers" },
    { label: "Refunded", value: sum((e) => e.status_v2 === "refunded"), hint: "Returned to you" },
  ]

  return (
    <PageContainer>
      <PageHeader title="Payments" description="Money you've paid into escrow and where it stands. You fund a job from a hired freelancer's bid." />

      {escrowsQuery.isLoading ? (
        <div data-testid="wallet-loading" className="mt-6 space-y-3" aria-label="Loading payments">
          <SkeletonBlock className="h-20" />
          <SkeletonBlock className="h-40" />
        </div>
      ) : escrowsQuery.isError ? (
        <div className="mt-6">
          <ErrorState title="Couldn't load your payments" description="Please try refreshing the page." />
        </div>
      ) : (
        <>
          <dl className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border lg:grid-cols-4">
            {tiles.map((t) => (
              <div key={t.label} className="bg-card px-4 py-3">
                <dt className="text-xs text-muted-foreground">{t.label}</dt>
                <dd className="mt-1 font-heading text-xl font-semibold tabular-nums text-foreground" data-testid={`wallet-${t.label}`}>
                  {formatKobo(t.value)}
                </dd>
                <dd className="text-[11px] text-muted-foreground">{t.hint}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-5">
            {escrows.length === 0 ? (
              <EmptyState
                icon={<WalletIcon className="h-5 w-5" />}
                title="Nothing in escrow yet"
                description="Hire a freelancer from your job's bids, then choose Fund job to pay into escrow."
                action={
                  <Button asChild variant="outline">
                    <Link to="/agency/posts">Go to my jobs</Link>
                  </Button>
                }
              />
            ) : (
              <ul className="divide-y divide-border rounded-lg border border-border bg-card">
                {escrows.map((escrow) => (
                  <li key={escrow.id} className="p-4" data-testid={`escrow-${escrow.id}`}>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2.5">
                          <h2 className="truncate text-sm font-semibold text-foreground">{escrow.job_title ?? "Job"}</h2>
                          <EscrowStatusBadge status={escrow.status_v2} />
                        </div>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          <span>{escrow.freelancer_name ?? "Freelancer"}</span>
                          <span className="font-medium tabular-nums text-foreground">{formatKobo(escrow.amount_kobo)}</span>
                          <span>{escrow.funded_at ? `Funded ${formatTimeAgo(escrow.funded_at)}` : `Started ${formatTimeAgo(escrow.created_at)}`}</span>
                        </div>
                        {escrow.status_v2 === "funded" && escrow.submission_status === "submitted" && (
                          <p className="text-xs font-medium text-primary">Work submitted. Review it in the workspace.</p>
                        )}
                      </div>
                      <div className="flex shrink-0 flex-wrap items-center gap-2">
                        {escrow.status_v2 === "awaiting" && <ResumePayment />}
                        {escrow.status_v2 === "funded" && (
                          <>
                            <Button asChild size="sm" variant="outline">
                              <Link to={`/workspace/${escrow.job_id}`}>
                                <FileText /> Workspace
                              </Link>
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                              onClick={() => setDisputingId(disputingId === escrow.id ? null : escrow.id)}
                            >
                              <ShieldAlert /> Dispute
                            </Button>
                          </>
                        )}
                        {escrow.open_dispute_id && (
                          <Button asChild size="sm" variant="outline">
                            <Link to={`/disputes/${escrow.open_dispute_id}`}>
                              <ShieldAlert /> View dispute
                            </Link>
                          </Button>
                        )}
                      </div>
                    </div>
                    {disputingId === escrow.id && <DisputeForm escrow={escrow} onCancel={() => setDisputingId(null)} />}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </PageContainer>
  )
}

// An escrow left 'awaiting' (checkout opened but not paid) is resumed from the
// bid's "Complete payment" button -- the server hands back the same Paystack
// checkout -- so this points the agency at their jobs.
function ResumePayment() {
  return (
    <Button asChild size="sm">
      <Link to="/agency/posts">Complete payment</Link>
    </Button>
  )
}
