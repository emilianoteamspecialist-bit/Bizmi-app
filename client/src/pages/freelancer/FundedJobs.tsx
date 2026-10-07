import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { Banknote, Briefcase, FileText, Landmark, Loader2, ShieldAlert, Wallet } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import EscrowStatusBadge from "@/components/shared/EscrowStatusBadge"
import { EmptyState, ErrorState, PageContainer, PageHeader, Panel, SkeletonBlock } from "@/components/marketplace/primitives"
import { formatTimeAgo } from "@/lib/format"
import {
  DISPUTE_TYPE_LABELS,
  formatKobo,
  useBankDetailsQuery,
  useBanksQuery,
  useMyEscrowsQuery,
  useOpenDisputeMutation,
  useRequestPayoutMutation,
  useSaveBankDetailsMutation,
  type DisputeType,
  type MyEscrow,
} from "@/lib/queries/escrow"

const PLATFORM_FEE_PERCENT = 15
const netOf = (kobo: number) => kobo - Math.round((kobo * PLATFORM_FEE_PERCENT) / 100)

function BankDetailsCard() {
  const bankQuery = useBankDetailsQuery()
  const [editing, setEditing] = useState(false)
  const bankDetails = bankQuery.data?.bankDetails ?? null
  const showForm = editing || (!bankQuery.isLoading && !bankDetails)
  const banksQuery = useBanksQuery(showForm)
  const save = useSaveBankDetailsMutation()
  const [accountNumber, setAccountNumber] = useState("")
  const [bankCode, setBankCode] = useState("")
  const [error, setError] = useState("")

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    save.mutate(
      { account_number: accountNumber, bank_code: bankCode },
      {
        onSuccess: () => {
          setEditing(false)
          setAccountNumber("")
        },
        onError: (err) => setError(err instanceof Error ? err.message : "Could not save bank details"),
      }
    )
  }

  return (
    <section className="rounded-lg border border-border bg-card p-4" aria-labelledby="payout-account-heading">
      <div className="flex items-center gap-2">
        <Landmark className="h-4 w-4 text-primary" />
        <h2 id="payout-account-heading" className="text-sm font-semibold text-foreground">Payout account</h2>
      </div>

      {bankQuery.isLoading ? (
        <SkeletonBlock className="mt-3 h-10" />
      ) : !showForm && bankDetails ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm">
            <p className="font-medium text-foreground">{bankDetails.account_name}</p>
            <p className="text-muted-foreground tabular-nums">
              {bankDetails.bank_name ?? bankDetails.bank_code} · {bankDetails.account_number}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
            Change
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSave} className="mt-3 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="bank">Bank</Label>
            <select
              id="bank"
              value={bankCode}
              onChange={(e) => setBankCode(e.target.value)}
              required
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">{banksQuery.isLoading ? "Loading banks…" : "Select your bank"}</option>
              {(banksQuery.data?.banks ?? []).map((b) => (
                <option key={b.code} value={b.code}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="account-number">Account number</Label>
            <Input
              id="account-number"
              inputMode="numeric"
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, "").slice(0, 10))}
              placeholder="10-digit NUBAN"
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={save.isPending || accountNumber.length !== 10 || !bankCode}>
            {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify & save"}
          </Button>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <p className="text-xs text-muted-foreground">We confirm the account name with your bank before saving.</p>
        </form>
      )}
    </section>
  )
}

function DisputeForm({ escrow, onCancel }: { escrow: MyEscrow; onCancel: () => void }) {
  const navigate = useNavigate()
  const openDispute = useOpenDisputeMutation()
  const [type, setType] = useState<DisputeType>("client_abandonment")
  const [description, setDescription] = useState("")
  const [error, setError] = useState("")

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    openDispute.mutate(
      { job_id: escrow.job_id, dispute_type: type, description },
      {
        onSuccess: ({ dispute }) => navigate(`/disputes/${dispute.id}`),
        onError: (err) => setError(err instanceof Error ? err.message : "Could not open the dispute"),
      }
    )
  }

  return (
    <form onSubmit={submit} className="mt-4 space-y-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
      <p className="text-sm text-foreground">
        Opening a dispute freezes the {formatKobo(escrow.amount_kobo)} held for <strong>{escrow.job_title}</strong> until it's resolved.
      </p>
      <div className="space-y-1.5">
        <Label htmlFor={`dispute-type-${escrow.id}`}>Reason</Label>
        <select
          id={`dispute-type-${escrow.id}`}
          value={type}
          onChange={(e) => setType(e.target.value as DisputeType)}
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
        >
          {(Object.keys(DISPUTE_TYPE_LABELS) as DisputeType[]).map((t) => (
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

function PayoutState({ escrow }: { escrow: MyEscrow }) {
  const requestPayout = useRequestPayoutMutation()
  const [error, setError] = useState("")
  const payout = escrow.latest_payout

  if (escrow.status_v2 === "paid_out" || payout?.status === "success") {
    return <p className="text-xs text-success">Paid out {formatKobo(payout?.net_amount_kobo ?? netOf(escrow.amount_kobo))} to your bank account.</p>
  }
  if (payout?.status === "processing" || payout?.status === "pending") {
    return <p className="text-xs text-muted-foreground">Payout of {formatKobo(payout.net_amount_kobo)} is on its way. It usually lands within 24–48 hours.</p>
  }
  if (escrow.status_v2 !== "released") return null

  const request = () => {
    setError("")
    requestPayout.mutate(escrow.id, {
      onError: (err) => setError(err instanceof Error ? err.message : "Payout request failed"),
    })
  }

  return (
    <div className="space-y-1">
      {payout?.status === "failed" && (
        <p className="text-xs text-destructive">Last payout attempt failed{payout.failure_reason ? `: ${payout.failure_reason}` : ""}. You can try again.</p>
      )}
      <Button size="sm" className="gap-1.5" onClick={request} disabled={requestPayout.isPending}>
        {requestPayout.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Banknote className="h-3.5 w-3.5" />}
        Withdraw {formatKobo(netOf(escrow.amount_kobo))}
      </Button>
      <p className="text-[11px] text-muted-foreground">After the {PLATFORM_FEE_PERCENT}% platform fee.</p>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}

const PAYOUT_STEPS = [
  "An agency hires you and pays the agreed amount into escrow.",
  "You deliver the work in the job's workspace.",
  "The agency approves it, which releases the money to you.",
  `You withdraw to your bank account, minus the ${PLATFORM_FEE_PERCENT}% platform fee.`,
]

export default function FundedJobs() {
  const escrowsQuery = useMyEscrowsQuery()
  const [disputingId, setDisputingId] = useState<string | null>(null)
  const escrows = (escrowsQuery.data?.escrows ?? []).filter((e) => e.role === "freelancer" && e.status_v2 !== "pending" && e.status_v2 !== "awaiting")

  const sum = (pred: (e: MyEscrow) => boolean) => escrows.filter(pred).reduce((t, e) => t + (Number(e.amount_kobo) || 0), 0)
  const readyToWithdraw = escrows
    .filter((e) => e.status_v2 === "released" && !["processing", "pending", "success"].includes(e.latest_payout?.status ?? ""))
    .reduce((t, e) => t + netOf(Number(e.amount_kobo) || 0), 0)
  const summary = [
    { label: "Held in escrow", value: formatKobo(sum((e) => e.status_v2 === "funded" || e.status_v2 === "disputed")), hint: "For work in progress" },
    { label: "Ready to withdraw", value: formatKobo(readyToWithdraw), hint: "After the platform fee" },
    { label: "Paid out", value: formatKobo(sum((e) => e.status_v2 === "paid_out")), hint: "Before the platform fee" },
  ]

  return (
    <PageContainer>
      <PageHeader title="My jobs" description="Jobs agencies have paid into escrow for you, and your payouts." />

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-5">
          {!escrowsQuery.isLoading && !escrowsQuery.isError && escrows.length > 0 && (
            <dl className="grid grid-cols-1 divide-y divide-border rounded-lg border border-border bg-card sm:grid-cols-3 sm:divide-x sm:divide-y-0">
              {summary.map((s) => (
                <div key={s.label} className="px-4 py-3">
                  <dt className="text-xs text-muted-foreground">{s.label}</dt>
                  <dd className="mt-1 font-heading text-xl font-semibold tabular-nums text-foreground">{s.value}</dd>
                  <dd className="text-[11px] text-muted-foreground">{s.hint}</dd>
                </div>
              ))}
            </dl>
          )}

          {escrowsQuery.isLoading ? (
            <div data-testid="funded-jobs-loading" className="space-y-3" aria-label="Loading your jobs">
              <SkeletonBlock className="h-20" />
              <SkeletonBlock className="h-28" />
            </div>
          ) : escrowsQuery.isError ? (
            <ErrorState title="Couldn't load your funded jobs" description="Please try refreshing the page." />
          ) : escrows.length === 0 ? (
            <EmptyState
              icon={<Wallet className="h-5 w-5" />}
              title="No funded jobs yet"
              description="When an agency hires you and pays into escrow, the job shows up here."
              action={
                <Button asChild variant="outline">
                  <Link to="/freelancer/marketplace">Find work</Link>
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
                        <span className="inline-flex items-center gap-1">
                          <Briefcase className="h-3 w-3" aria-hidden />
                          {escrow.agency_name ?? "Agency"}
                        </span>
                        <span className="font-medium tabular-nums text-foreground">{formatKobo(escrow.amount_kobo)}</span>
                        {escrow.funded_at && <span>Funded {formatTimeAgo(escrow.funded_at)}</span>}
                      </div>
                      {escrow.status_v2 === "funded" && escrow.submission_status === "changes_requested" && (
                        <p className="text-xs text-warning">The agency asked for changes. Open the workspace to see their feedback.</p>
                      )}
                      <PayoutState escrow={escrow} />
                    </div>

                    <div className="flex shrink-0 flex-wrap items-center gap-2">
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

        <aside className="space-y-5" aria-label="Payouts">
          <BankDetailsCard />
          <Panel title="How payouts work">
            <ol className="space-y-3">
              {PAYOUT_STEPS.map((step, i) => (
                <li key={step} className="flex gap-3 text-sm text-foreground">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-border text-[11px] font-semibold text-muted-foreground" aria-hidden>
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </Panel>
        </aside>
      </div>
    </PageContainer>
  )
}
