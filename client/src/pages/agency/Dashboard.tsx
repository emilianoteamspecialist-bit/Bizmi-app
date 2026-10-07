import { useEffect, useState } from "react"
import { Link, Navigate, useSearchParams } from "react-router-dom"
import { Edit, FileText, MessageSquare, MoreHorizontal, Pause, Play, Plus, ShieldAlert, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { useAuth } from "@/contexts/AuthContext"
import { useAgencyJobsQuery, useUpdateJobStatusMutation, type AgencyJob } from "@/lib/queries/jobs"
import { formatKobo, useMyEscrowsQuery } from "@/lib/queries/escrow"
import { useShellQuery } from "@/lib/queries/shell"
import { formatBudgetRange, formatTimeAgo } from "@/lib/format"
import EscrowStatusBadge from "@/components/shared/EscrowStatusBadge"
import { EmptyState, ErrorState, PageContainer, Panel, SkeletonBlock } from "@/components/marketplace/primitives"
import PostJobModal from "./PostJobModal"
import ProposalsModal from "./ProposalsModal"

const JOB_STATUS: Record<string, { label: string; className: string }> = {
  active: { label: "Open", className: "bg-success/10 text-success" },
  paused: { label: "Paused", className: "bg-warning/10 text-warning" },
  closed: { label: "Closed", className: "bg-surface-2 text-muted-foreground" },
}

function greeting() {
  const hour = new Date().getHours()
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening"
}

export default function AgencyDashboard() {
  const { profile } = useAuth()
  const [showPostJobModal, setShowPostJobModal] = useState(false)
  const [editingJob, setEditingJob] = useState<AgencyJob | null>(null)
  const [viewingProposalsJob, setViewingProposalsJob] = useState<AgencyJob | null>(null)

  const agencyJobsQuery = useAgencyJobsQuery()
  const updateJobStatus = useUpdateJobStatusMutation()
  const escrowsQuery = useMyEscrowsQuery()
  const shell = useShellQuery("agency")
  const [searchParams, setSearchParams] = useSearchParams()

  // The header's "Post a Job" links to ?post=true: open the composer, then
  // drop the param so a refresh doesn't reopen it.
  useEffect(() => {
    if (searchParams.get("post") === "true") {
      setEditingJob(null)
      setShowPostJobModal(true)
      setSearchParams({}, { replace: true })
    }
  }, [searchParams, setSearchParams])

  if (agencyJobsQuery.isLoading) {
    return (
      <PageContainer>
        <div data-testid="agency-dashboard-skeleton" className="space-y-6" aria-label="Loading your dashboard">
          <SkeletonBlock className="h-8 w-72" />
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            <SkeletonBlock className="h-80" />
            <SkeletonBlock className="h-64" />
          </div>
        </div>
      </PageContainer>
    )
  }

  if (agencyJobsQuery.isError && !agencyJobsQuery.data) {
    return (
      <PageContainer>
        <ErrorState title="Couldn't load your hiring desk" description="Please try refreshing the page." />
      </PageContainer>
    )
  }

  if (profile && profile.account_type !== "agency") {
    return <Navigate to="/" replace />
  }

  const jobs: AgencyJob[] = agencyJobsQuery.data?.jobs ?? []
  const agencyName = profile?.company_name || profile?.full_name || ""
  const openJobs = jobs.filter((j) => j.status === "active")
  const newProposals = openJobs.reduce((sum, j) => sum + (Number(j.proposals) || 0), 0)
  const escrows = (escrowsQuery.data?.escrows ?? []).filter((e) => e.role === "agency")
  const contracts = escrows.filter((e) => e.status_v2 === "funded" || e.status_v2 === "disputed")
  const inEscrow = contracts.reduce((t, e) => t + Number(e.amount_kobo || 0), 0)
  const unread = shell.data?.recentUnread ?? []

  // Pending actions: work waiting for review, checkouts left unpaid, open disputes.
  const actions: { key: string; text: string; to: string; cta: string }[] = []
  for (const e of contracts.filter((c) => c.submission_status === "submitted").slice(0, 3)) {
    actions.push({ key: `review-${e.id}`, text: `${e.freelancer_name ?? "Your freelancer"} submitted work for ${e.job_title ?? "a job"}.`, to: `/workspace/${e.job_id}`, cta: "Review work" })
  }
  const unpaid = escrows.filter((e) => e.status_v2 === "awaiting")
  if (unpaid.length) actions.push({ key: "unpaid", text: `${unpaid.length === 1 ? "A job is" : `${unpaid.length} jobs are`} waiting for you to finish paying into escrow.`, to: "/agency/wallet", cta: "Complete payment" })
  const disputes = escrows.filter((e) => e.open_dispute_id)
  if (disputes[0]) actions.push({ key: "dispute", text: `There's an open dispute on ${disputes[0].job_title ?? "a job"}.`, to: `/disputes/${disputes[0].open_dispute_id}`, cta: "View dispute" })

  const openPostJobModal = () => {
    setEditingJob(null)
    setShowPostJobModal(true)
  }

  const handlePauseResume = (job: AgencyJob) => {
    const newStatus = job.status === "paused" ? "active" : "paused"
    updateJobStatus.mutate({ jobId: job.id, status: newStatus }, { onError: () => alert("Error updating job. Please try again.") })
  }

  const handleClose = (job: AgencyJob) => {
    if (!confirm("Close this job permanently? This action cannot be undone.")) return
    updateJobStatus.mutate({ jobId: job.id, status: "closed" }, { onError: () => alert("Error updating job. Please try again.") })
  }

  return (
    <PageContainer>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="font-heading text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
            {greeting()}
            {agencyName ? `, ${agencyName}` : ""}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {openJobs.length} open {openJobs.length === 1 ? "job" : "jobs"} · {newProposals} {newProposals === 1 ? "proposal" : "proposals"} to review · {contracts.length} active{" "}
            {contracts.length === 1 ? "contract" : "contracts"}
          </p>
        </div>
        <Button onClick={openPostJobModal} className="shrink-0">
          <Plus /> Post a job
        </Button>
      </div>

      {actions.length > 0 && (
        <section aria-label="Action items" className="mt-5 divide-y divide-border rounded-lg border border-border bg-card">
          {actions.map((a) => (
            <div key={a.key} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="flex items-start gap-2 text-sm text-foreground">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                {a.text}
              </p>
              <Button asChild size="sm" variant="outline" className="shrink-0">
                <Link to={a.to}>{a.cta}</Link>
              </Button>
            </div>
          ))}
        </section>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section aria-labelledby="your-jobs" className="min-w-0 space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 id="your-jobs" className="text-base font-semibold text-foreground">
              Your jobs <span className="font-normal text-muted-foreground">({jobs.length})</span>
            </h2>
            <Link to="/agency/posts" className="text-sm font-medium text-primary hover:underline">
              All posts
            </Link>
          </div>

          {jobs.length === 0 ? (
            <EmptyState
              icon={<FileText className="h-5 w-5" />}
              title="No jobs yet"
              description="Post your first brief and freelancers can start sending proposals."
              action={
                <Button size="sm" onClick={openPostJobModal}>
                  <Plus /> Post a job
                </Button>
              }
            />
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border bg-card">
              {jobs.map((job) => {
                const st = JOB_STATUS[job.status] ?? JOB_STATUS.closed
                return (
                  <li key={job.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate text-sm font-semibold text-foreground">{job.title}</h3>
                        <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${st.className}`}>{st.label}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        <span className="font-medium tabular-nums text-foreground">{formatBudgetRange(job.budget_min, job.budget_max)}</span>
                        {job.duration ? ` · ${job.duration}` : ""} · {job.location || "Remote"} · posted {formatTimeAgo(job.created_at)}
                      </p>
                      <p className="text-xs font-medium text-primary">
                        {job.proposals} {job.proposals === 1 ? "proposal" : "proposals"}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <Button variant="outline" size="sm" onClick={() => setViewingProposalsJob(job)}>
                        Review bids
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`More actions for ${job.title}`}>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-52">
                          <DropdownMenuItem
                            onClick={() => {
                              setEditingJob(job)
                              setShowPostJobModal(true)
                            }}
                          >
                            <Edit className="mr-2 h-4 w-4 text-muted-foreground" /> Edit brief
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handlePauseResume(job)}>
                            {job.status === "paused" ? <Play className="mr-2 h-4 w-4 text-muted-foreground" /> : <Pause className="mr-2 h-4 w-4 text-muted-foreground" />}
                            {job.status === "paused" ? "Resume hiring" : "Pause hiring"}
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => handleClose(job)}>
                            <X className="mr-2 h-4 w-4" /> Close listing
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <aside className="space-y-5" aria-label="Contracts and messages">
          <Panel title="Active contracts" action={<Link to="/agency/wallet" className="text-sm font-medium text-primary hover:underline">Payments</Link>} bodyClassName="p-0">
            {contracts.length === 0 ? (
              <p className="px-4 py-4 text-sm text-muted-foreground">Fund an accepted proposal to start a contract.</p>
            ) : (
              <ul className="divide-y divide-border">
                {contracts.slice(0, 5).map((c) => (
                  <li key={c.id}>
                    <Link to={`/workspace/${c.job_id}`} className="block px-4 py-2.5 hover:bg-surface-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-medium text-foreground">{c.job_title ?? "Job"}</p>
                        <EscrowStatusBadge status={c.status_v2} />
                      </div>
                      <p className="truncate text-xs text-muted-foreground">
                        {c.freelancer_name ?? "Freelancer"} · <span className="tabular-nums">{formatKobo(c.amount_kobo)}</span>
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            {contracts.length > 0 && (
              <p className="border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
                <span className="font-medium tabular-nums text-foreground">{formatKobo(inEscrow)}</span> held in escrow
              </p>
            )}
          </Panel>

          <Panel title="Unread messages" action={<Link to="/agency/messages" className="text-sm font-medium text-primary hover:underline">Open</Link>} bodyClassName="p-0">
            {unread.length === 0 ? (
              <p className="flex items-center gap-2 px-4 py-4 text-sm text-muted-foreground">
                <MessageSquare className="h-4 w-4" aria-hidden /> You're all caught up.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {unread.slice(0, 4).map((m) => (
                  <li key={m.id}>
                    <Link to={`/agency/messages?conversationId=${m.conversation_id}`} className="block px-4 py-2.5 hover:bg-surface-2">
                      <p className="truncate text-sm font-medium text-foreground">{m.sender_name}</p>
                      <p className="truncate text-xs text-muted-foreground">{m.message_text}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Find the right freelancer">
            <p className="text-sm text-muted-foreground">Browse identity-verified freelancers by skill while you wait for proposals.</p>
            <Button asChild variant="outline" size="sm" className="mt-3 w-full">
              <Link to="/agency/find-freelancers">Find talent</Link>
            </Button>
          </Panel>
        </aside>
      </div>

      <PostJobModal
        isOpen={showPostJobModal}
        onClose={() => {
          setShowPostJobModal(false)
          setEditingJob(null)
        }}
        editingJob={editingJob}
        onSuccess={() => {
          setShowPostJobModal(false)
          setEditingJob(null)
          alert(editingJob ? "Job updated successfully!" : "Job posted successfully!")
        }}
      />

      <ProposalsModal job={viewingProposalsJob} isOpen={!!viewingProposalsJob} onClose={() => setViewingProposalsJob(null)} />
    </PageContainer>
  )
}
