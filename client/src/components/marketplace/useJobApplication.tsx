import { useRef, useState } from "react"
import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useSubmitProposalMutation } from "@/lib/queries/proposals"
import type { MarketplaceJob } from "./JobCard"

/**
 * The apply flow shared by every job list (Find Work, Saved jobs, the
 * dashboard): open a job, check eligibility (identity verified, enough
 * credits, not already applied), write and send a proposal -- with a
 * double-submit guard and an optimistic "Applied" that rolls back on failure.
 */
export function useJobApplication({ credits, verified }: { credits: number; verified: boolean }) {
  const submit = useSubmitProposalMutation()
  const [selectedJob, setSelectedJob] = useState<MarketplaceJob | null>(null)
  const [proposing, setProposing] = useState(false)
  const [proposal, setProposal] = useState({ proposal_text: "", timeline: "", budget: "" })
  const [applied, setApplied] = useState<Set<string>>(new Set())
  const submittingRef = useRef(false)

  const isApplied = (job: MarketplaceJob) => !!job.has_applied || applied.has(job.id)
  const cost = (job: MarketplaceJob) => Number(job.credit_cost ?? 0)
  const canApply = (job: MarketplaceJob) => verified && credits >= cost(job) && !isApplied(job)
  const applyLabel = (job: MarketplaceJob) =>
    isApplied(job) ? "Applied" : !verified ? "Verify identity to apply" : credits < cost(job) ? "Insufficient credits" : "Apply"

  const openJob = (job: MarketplaceJob) => {
    setSelectedJob(job)
    setProposing(false)
  }
  const closeJob = () => setSelectedJob(null)
  const startProposal = (job: MarketplaceJob) => {
    if (!canApply(job)) return
    setSelectedJob(job)
    setProposal({ proposal_text: "", timeline: "", budget: "" })
    setProposing(true)
  }

  const sendProposal = () => {
    if (!selectedJob || submittingRef.current || !proposal.proposal_text || !proposal.timeline || !proposal.budget) return
    submittingRef.current = true
    const jobId = selectedJob.id
    setApplied((current) => new Set(current).add(jobId))
    const undo = () =>
      setApplied((current) => {
        const next = new Set(current)
        next.delete(jobId)
        return next
      })
    submit
      .mutateAsync({ jobId, ...proposal, creditCost: cost(selectedJob) })
      .then((result) => {
        submittingRef.current = false
        if (result.success) setSelectedJob(null)
        else undo()
      })
      .catch(() => {
        submittingRef.current = false
        undo()
      })
  }

  /** The apply area of the job-details sidebar. */
  const detailsCta = (job: MarketplaceJob) => {
    if (proposing) return null
    if (isApplied(job))
      return (
        <Button className="w-full" variant="outline" disabled>
          Applied
        </Button>
      )
    if (!verified)
      return (
        <>
          <Button asChild className="w-full">
            <Link to="/freelancer/identity">Verify identity to apply</Link>
          </Button>
          <p className="text-xs text-muted-foreground">Agencies only hire identity-verified freelancers.</p>
        </>
      )
    if (credits < cost(job))
      return (
        <>
          <Button asChild className="w-full">
            <Link to="/freelancer/bizpal">Buy credits to apply</Link>
          </Button>
          <p className="text-xs text-muted-foreground">
            This job needs {cost(job)} credits; you have {credits}.
          </p>
        </>
      )
    return (
      <>
        <Button className="w-full" onClick={() => startProposal(job)}>
          Submit a proposal
        </Button>
        <p className="text-xs text-muted-foreground">
          Uses {cost(job)} of your {credits} credits.
        </p>
      </>
    )
  }

  /** The compact Apply / Applied button for a job card. */
  const cardAction = (job: MarketplaceJob) => (
    <Button size="sm" disabled={!canApply(job)} variant={isApplied(job) ? "outline" : "default"} aria-label={applyLabel(job)} onClick={() => startProposal(job)}>
      {isApplied(job) ? "Applied" : "Apply"}
    </Button>
  )

  /** The proposal form, shown inside the job-details sheet while proposing. */
  const proposalForm =
    proposing && selectedJob ? (
      <form
        onSubmit={(event) => {
          event.preventDefault()
          sendProposal()
        }}
        className="space-y-4 rounded-lg border border-border bg-card p-4 sm:p-5"
      >
        <div>
          <h2 className="text-base font-semibold text-foreground">Send a proposal</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">Uses {cost(selectedJob)} credits. The agency sees your cover letter, timeline and price.</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="proposal-text">Cover letter</Label>
          <Textarea
            id="proposal-text"
            aria-label="Your proposal"
            rows={7}
            value={proposal.proposal_text}
            onChange={(e) => setProposal((c) => ({ ...c, proposal_text: e.target.value }))}
            placeholder="Explain how you'll deliver this brief and why you're a good fit"
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="proposal-timeline">Timeline</Label>
            <Input id="proposal-timeline" aria-label="Timeline" value={proposal.timeline} onChange={(e) => setProposal((c) => ({ ...c, timeline: e.target.value }))} placeholder="e.g. 3 weeks" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="proposal-budget">Your price (₦)</Label>
            <Input id="proposal-budget" aria-label="Your budget (₦)" inputMode="numeric" value={proposal.budget} onChange={(e) => setProposal((c) => ({ ...c, budget: e.target.value }))} placeholder="e.g. 150000" />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={submit.isPending || !proposal.proposal_text || !proposal.timeline || !proposal.budget}>
            {submit.isPending ? "Sending…" : "Send proposal"}
          </Button>
          <Button type="button" variant="ghost" onClick={() => setProposing(false)}>
            Back to job
          </Button>
        </div>
      </form>
    ) : undefined

  return { selectedJob, openJob, closeJob, startProposal, isApplied, canApply, cardAction, detailsCta, proposalForm }
}
