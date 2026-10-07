import { useState } from "react"
import { CheckCircle, FileText, Loader2, MapPin, Search, Wallet, XCircle } from "lucide-react"
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { FreelancerAvatar, jobsCompletedLabel } from "@/components/marketplace/FreelancerCard"
import { EmptyState, ErrorState, SkeletonBlock, TrustBadge } from "@/components/marketplace/primitives"
import { formatNaira, formatTimeAgo } from "@/lib/format"
import { cn } from "@/lib/utils"
import { useJobProposalsQuery, type AgencyJob, type JobProposal } from "@/lib/queries/jobs"
import { useRespondToProposalMutation } from "@/lib/queries/proposals"
import { useFreelancerLogosQuery } from "@/lib/queries/user"
import { useInitializeEscrowMutation, useJobEscrowQuery } from "@/lib/queries/escrow"

const STATUS_LABEL: Record<JobProposal["status"], string> = { pending: "Awaiting your decision", accepted: "Hired", rejected: "Declined" }
const STATUS_CLASS: Record<JobProposal["status"], string> = {
  pending: "text-muted-foreground",
  accepted: "text-success",
  rejected: "text-destructive",
}

type Notice = { tone: "success" | "error"; text: string } | null

/**
 * Review bids for one job: each bid leads with who the freelancer is and the
 * trust facts Bizimi actually holds (identity check, jobs completed through
 * escrow), then their pitch, price and timeline, then the decision.
 */
export default function ProposalsModal({ job, isOpen, onClose }: { job: AgencyJob | null; isOpen: boolean; onClose: () => void }) {
  const [searchTerm, setSearchTerm] = useState("")
  const [notice, setNotice] = useState<Notice>(null)
  const proposalsQuery = useJobProposalsQuery(job?.id, isOpen)
  const respond = useRespondToProposalMutation()

  const proposals: JobProposal[] = proposalsQuery.data?.proposals ?? []
  const logosQuery = useFreelancerLogosQuery(proposals.map((p) => p.freelancer_id))
  const logos = logosQuery.data?.logos ?? {}
  const escrowQuery = useJobEscrowQuery(job?.id, isOpen)
  const escrowStatus = escrowQuery.data?.escrow?.status_v2 ?? null
  const initEscrow = useInitializeEscrowMutation()

  if (!isOpen || !job) return null

  const term = searchTerm.trim().toLowerCase()
  const filteredProposals = proposals.filter((p) =>
    !term
      ? true
      : [p.profiles?.full_name, p.profiles?.location, p.profiles?.bio, p.proposal_text].some((v) => (v ?? "").toLowerCase().includes(term))
  )

  // Funding hands off to Paystack's hosted checkout; the agency comes back to
  // /agency/escrow/return. The amount is taken server-side from the proposal.
  const handleFund = (proposalId: string) => {
    setNotice(null)
    initEscrow.mutate(proposalId, {
      onSuccess: ({ authorization_url }) => window.location.assign(authorization_url),
      onError: (err) => setNotice({ tone: "error", text: err instanceof Error ? err.message : "Could not start funding. Try again." }),
    })
  }

  const handleClose = () => {
    setSearchTerm("")
    setNotice(null)
    onClose()
  }

  const handleRespond = (proposalId: string, action: "accept" | "reject") => {
    setNotice(null)
    respond.mutate(
      { proposalId, jobId: job.id, action },
      {
        onSuccess: (result) => {
          if (!result.success) {
            setNotice({
              tone: "error",
              text: result.error === "Forbidden" ? "You can only act on bids for your own jobs." : `Couldn't update the bid: ${result.error}`,
            })
            return
          }
          setNotice({
            tone: "success",
            text: action === "accept" ? "Freelancer hired. Fund the job to secure payment and start work." : "Bid declined.",
          })
        },
        onError: () => setNotice({ tone: "error", text: "Couldn't update the bid. Check your connection and try again." }),
      }
    )
  }

  const funded = !!escrowStatus && escrowStatus !== "pending" && escrowStatus !== "awaiting"

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 bg-surface p-0 sm:max-w-2xl">
        <div className="border-b border-border bg-card px-5 py-5 pr-12 sm:px-6">
          <SheetTitle className="font-heading text-lg font-semibold text-foreground">Review bids</SheetTitle>
          <SheetDescription className="mt-0.5 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{job.title}</span> · {proposals.length} bid{proposals.length === 1 ? "" : "s"}
            {term && ` · ${filteredProposals.length} matching`}
          </SheetDescription>
          {proposals.length > 1 && (
            <div className="relative mt-4">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input
                aria-label="Search bids"
                placeholder="Search freelancers by name, location or pitch"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
          )}
          {notice && (
            <p role={notice.tone === "error" ? "alert" : "status"} className={cn("mt-3 text-sm", notice.tone === "error" ? "text-destructive" : "text-success")}>
              {notice.text}
            </p>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          {proposalsQuery.isLoading ? (
            <div className="space-y-4" aria-label="Loading bids">
              <SkeletonBlock className="h-44" />
              <SkeletonBlock className="h-44" />
            </div>
          ) : proposalsQuery.isError ? (
            <ErrorState title="Couldn't load bids" onRetry={() => proposalsQuery.refetch?.()} />
          ) : proposals.length === 0 ? (
            <EmptyState
              icon={<FileText className="h-5 w-5" />}
              title="No bids yet"
              description="Freelancers who apply to this job will show up here. Jobs with a clear scope and budget get bids faster."
            />
          ) : filteredProposals.length === 0 ? (
            <EmptyState icon={<Search className="h-5 w-5" />} title="No bids match your search" description="Try a name, a city or a word from their pitch." />
          ) : (
            <ul className="space-y-4">
              {filteredProposals.map((proposal) => (
                <BidCard
                  key={proposal.id}
                  proposal={proposal}
                  logo={logos[proposal.freelancer_id]}
                  busy={respond.isPending}
                  onRespond={handleRespond}
                  funding={
                    proposal.status === "accepted" ? (
                      funded ? (
                        <p className="inline-flex items-center gap-1.5 text-sm font-medium text-success">
                          <CheckCircle className="h-4 w-4" aria-hidden /> Funded — money is held in escrow
                        </p>
                      ) : (
                        <Button onClick={() => handleFund(proposal.id)} disabled={initEscrow.isPending || escrowQuery.isLoading}>
                          {initEscrow.isPending ? <Loader2 className="animate-spin" /> : <Wallet />}
                          {escrowStatus === "awaiting" ? "Complete payment" : "Fund job"}
                        </Button>
                      )
                    ) : null
                  }
                />
              ))}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

function BidCard({
  proposal,
  logo,
  busy,
  onRespond,
  funding,
}: {
  proposal: JobProposal
  logo?: string
  busy: boolean
  onRespond: (id: string, action: "accept" | "reject") => void
  funding: React.ReactNode
}) {
  const name = proposal.profiles?.full_name || "Freelancer"
  const price = formatNaira(proposal.budget)
  const [expanded, setExpanded] = useState(false)
  const longPitch = (proposal.proposal_text?.length ?? 0) > 360

  return (
    <li className="rounded-lg border border-border bg-card">
      <div className="flex items-start gap-3 p-4">
        <FreelancerAvatar freelancer={{ full_name: name, logo: logo ?? null }} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <h3 className="truncate text-sm font-semibold text-foreground">{name}</h3>
            <span className={cn("text-xs font-medium", STATUS_CLASS[proposal.status])}>{STATUS_LABEL[proposal.status]}</span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {proposal.identity_verified ? <TrustBadge kind="identity" /> : <span>Identity not yet verified</span>}
            <span>{jobsCompletedLabel(proposal.jobs_completed)}</span>
            {proposal.profiles?.location && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3 w-3" aria-hidden />
                {proposal.profiles.location}
              </span>
            )}
          </div>
        </div>
      </div>

      <dl className="grid grid-cols-3 border-y border-border text-sm">
        <div className="px-4 py-3">
          <dt className="text-xs text-muted-foreground">Bid</dt>
          <dd className="mt-0.5 font-semibold tabular-nums text-foreground">{price ?? "Not given"}</dd>
        </div>
        <div className="border-l border-border px-4 py-3">
          <dt className="text-xs text-muted-foreground">Timeline</dt>
          <dd className="mt-0.5 font-medium text-foreground">{proposal.timeline || "Not given"}</dd>
        </div>
        <div className="border-l border-border px-4 py-3">
          <dt className="text-xs text-muted-foreground">Sent</dt>
          <dd className="mt-0.5 text-foreground">{formatTimeAgo(proposal.created_at) || "—"}</dd>
        </div>
      </dl>

      <div className="space-y-3 p-4">
        <div>
          <p className={cn("whitespace-pre-wrap text-sm leading-relaxed text-foreground", longPitch && !expanded && "line-clamp-5")}>{proposal.proposal_text}</p>
          {longPitch && (
            <button onClick={() => setExpanded((v) => !v)} className="mt-1 text-sm font-medium text-primary hover:underline">
              {expanded ? "Show less" : "Read full pitch"}
            </button>
          )}
        </div>
        {proposal.profiles?.bio && (
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">About {name.split(" ")[0]}: </span>
            {proposal.profiles.bio}
          </p>
        )}
      </div>

      {(proposal.status === "pending" || funding) && (
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border px-4 py-3">
          {proposal.status === "pending" ? (
            <>
              <Button variant="outline" onClick={() => onRespond(proposal.id, "reject")} disabled={busy}>
                <XCircle /> Decline
              </Button>
              <Button onClick={() => onRespond(proposal.id, "accept")} disabled={busy}>
                <CheckCircle /> Hire {name.split(" ")[0]}
              </Button>
            </>
          ) : (
            funding
          )}
        </div>
      )}
    </li>
  )
}
