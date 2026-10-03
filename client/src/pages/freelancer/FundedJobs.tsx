import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { Banknote, Briefcase, FileText, Landmark, Loader2, ShieldAlert, Wallet } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import EscrowStatusBadge from "@/components/shared/EscrowStatusBadge"
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
    <section className="rounded-xl border border-border bg-card p-5" aria-labelledby="payout-account-heading">
      <div className="flex items-center gap-2">
        <Landmark className="h-4 w-4 text-primary" />
        <h2 id="payout-account-heading" className="text-sm font-semibold text-foreground">Payout account</h2>
      </div>

      {bankQuery.isLoading ? (
        <p className="mt-3 text-sm text-muted-foreground">Loading…</p>
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
        <form onSubmit={handleSave} className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
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
          <Button type="submit" disabled={save.isPending || accountNumber.length !== 10 || !bankCode}>
            {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify & save"}
          </Button>
          {error && <p className="text-sm text-destructive sm:col-span-3">{error}</p>}
          <p className="text-xs text-muted-foreground sm:col-span-3">We confirm the account name with your bank before saving.</p>
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
    return <p className="text-xs text-muted-foreground">Payout of {formatKobo(payout.net_amount_kobo)} is on its way — usually 24–48 hours.</p>
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

export default function FundedJobs() {
  const escrowsQuery = useMyEscrowsQuery()
  const [disputingId, setDisputingId] = useState<string | null>(null)
  const escrows = (escrowsQuery.data?.escrows ?? []).filter((e) => e.role === "freelancer" && e.status_v2 !== "pending" && e.status_v2 !== "awaiting")

  return (
    <div className="min-h-screen bg-surface pb-20">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <header className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Earnings</p>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Funded jobs</h1>
          <p className="text-sm text-muted-foreground">Jobs agencies have paid into escrow for you, and your payouts.</p>
        </header>

        <BankDetailsCard />

        {escrowsQuery.isLoading ? (
          <div data-testid="funded-jobs-loading" className="h-32 rounded-xl border border-border bg-card animate-pulse" />
        ) : escrowsQuery.isError ? (
          <div className="rounded-xl border border-border bg-card p-8 text-center">
            <p className="text-sm font-semibold text-foreground">Couldn't load your funded jobs</p>
            <p className="text-sm text-muted-foreground">Please try refreshing the page.</p>
          </div>
        ) : escrows.length === 0 ? (
          <div className="rounded-xl border border-border bg-card py-16 px-6 text-center">
            <div className="mx-auto h-11 w-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <Wallet className="h-5 w-5" />
            </div>
            <h3 className="mt-4 text-sm font-semibold text-foreground">No funded jobs yet</h3>
            <p className="mt-1 text-sm text-muted-foreground">When an agency funds a job you've won, it shows up here.</p>
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
                      <span className="inline-flex items-center gap-1">
                        <Briefcase className="h-3 w-3" />
                        {escrow.agency_name ?? "Agency"}
                      </span>
                      <span className="font-medium text-foreground tabular-nums">{formatKobo(escrow.amount_kobo)}</span>
                      {escrow.funded_at && <span>Funded {new Date(escrow.funded_at).toLocaleDateString()}</span>}
                    </div>
                    {escrow.status_v2 === "funded" && escrow.submission_status === "changes_requested" && (
                      <p className="text-xs text-warning">The agency requested changes — see the workspace.</p>
                    )}
                    <PayoutState escrow={escrow} />
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
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
      </div>
    </div>
  )
}
