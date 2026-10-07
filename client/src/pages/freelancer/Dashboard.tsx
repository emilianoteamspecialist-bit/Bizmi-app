import { useMemo, useState } from "react"
import { Link, Navigate } from "react-router-dom"
import { Briefcase, Coins, MessageSquare, ShieldAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/contexts/AuthContext"
import { useJobsQuery, useToggleBookmarkMutation } from "@/lib/queries/jobs"
import { useDashboardQuery } from "@/lib/queries/user"
import { useMyProposalsQuery } from "@/lib/queries/proposals"
import { formatKobo, useMyEscrowsQuery } from "@/lib/queries/escrow"
import { useShellQuery } from "@/lib/queries/shell"
import { formatTimeAgo } from "@/lib/format"
import EscrowStatusBadge from "@/components/shared/EscrowStatusBadge"
import { JobCard, JobCardSkeleton, type MarketplaceJob } from "@/components/marketplace/JobCard"
import { JobDetailsSheet } from "@/components/marketplace/JobDetailsSheet"
import { useJobApplication } from "@/components/marketplace/useJobApplication"
import { EmptyState, ErrorState, PageContainer, Panel, SkeletonBlock } from "@/components/marketplace/primitives"
import { ProfileCompleteness, freelancerCompleteness } from "@/components/marketplace/ProfileCompleteness"

const PROPOSAL_STATUS: Record<string, { label: string; className: string }> = {
  pending: { label: "Pending", className: "text-warning" },
  accepted: { label: "Accepted", className: "text-success" },
  rejected: { label: "Not selected", className: "text-muted-foreground" },
}

function greeting() {
  const hour = new Date().getHours()
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening"
}

export default function Dashboard() {
  const { profile } = useAuth()
  const dashboardQuery = useDashboardQuery()
  const profileData: any = dashboardQuery.data?.profile ?? profile
  const skills: string[] = Array.isArray(profileData?.skills) ? profileData.skills : []
  const jobsParams = useMemo(() => ({ limit: 5, categorySkills: skills.length ? skills : undefined }), [skills.join("|")])
  const jobsQuery = useJobsQuery(jobsParams)
  const proposalsQuery = useMyProposalsQuery("")
  const escrowsQuery = useMyEscrowsQuery()
  const shell = useShellQuery("freelancer")
  const bookmark = useToggleBookmarkMutation()
  const credits = dashboardQuery.data?.credits ?? 0
  const verified = !!dashboardQuery.data?.isVerified
  const application = useJobApplication({ credits, verified })
  const [bookmarkOverrides, setBookmarkOverrides] = useState<Record<string, boolean>>({})

  if (profile && profile.account_type !== "freelancer") {
    return <Navigate to="/" replace />
  }

  if (dashboardQuery.isLoading || jobsQuery.isLoading) {
    return (
      <PageContainer>
        <div data-testid="dashboard-skeleton" className="space-y-6" aria-label="Loading your dashboard">
          <SkeletonBlock className="h-8 w-72" />
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-3">
              <JobCardSkeleton />
              <JobCardSkeleton />
            </div>
            <SkeletonBlock className="h-64" />
          </div>
        </div>
      </PageContainer>
    )
  }

  if (dashboardQuery.isError || jobsQuery.isError) {
    return (
      <PageContainer>
        <ErrorState title="Couldn't load your dashboard" description="Please try refreshing the page." />
      </PageContainer>
    )
  }

  const jobs: MarketplaceJob[] = jobsQuery.data?.jobs ?? []
  const firstName = profileData?.full_name?.split(" ")[0] || "there"
  const proposals = (proposalsQuery.data?.pages.flatMap((p) => p.proposals) ?? []).slice(0, 5)
  const escrows = (escrowsQuery.data?.escrows ?? []).filter((e) => e.role === "freelancer")
  const contracts = escrows.filter((e) => e.status_v2 === "funded" || e.status_v2 === "disputed")
  const awaitingPayout = escrows.filter((e) => e.status_v2 === "released").reduce((t, e) => t + Number(e.amount_kobo || 0), 0)
  const paidOut = escrows
    .filter((e) => e.status_v2 === "paid_out")
    .reduce((t, e) => t + Number(e.latest_payout?.net_amount_kobo ?? e.amount_kobo ?? 0), 0)
  const unread = shell.data?.recentUnread ?? []

  const isSaved = (job: MarketplaceJob) => bookmarkOverrides[job.id] ?? !!job.is_bookmarked
  const toggleSave = (job: MarketplaceJob) => {
    const current = isSaved(job)
    setBookmarkOverrides((o) => ({ ...o, [job.id]: !current }))
    bookmark.mutate({ jobId: job.id, isBookmarked: current })
  }

  const completeness = freelancerCompleteness({
    hasPhoto: !!shell.data?.avatar,
    bio: profileData?.bio,
    skills,
    hourlyRate: profileData?.hourly_rate,
    location: profileData?.location,
    identityVerified: verified,
  })

  // "What should I do next?" -- the few things blocking work or pay.
  const actions: { key: string; text: string; to: string; cta: string }[] = []
  if (!verified) actions.push({ key: "verify", text: "Verify your identity so agencies can hire you.", to: "/freelancer/identity", cta: "Verify identity" })
  if (credits < 5) actions.push({ key: "credits", text: `You have ${credits} credits — most jobs need 5 or more to apply.`, to: "/freelancer/bizpal", cta: "Buy credits" })
  const released = escrows.filter((e) => e.status_v2 === "released" && e.latest_payout?.status !== "processing")
  if (released.length) actions.push({ key: "payout", text: `${released.length === 1 ? "A job has" : `${released.length} jobs have`} been approved — withdraw your earnings.`, to: "/freelancer/funded-jobs", cta: "Withdraw" })
  const changes = contracts.filter((e) => e.submission_status === "changes_requested")
  if (changes.length) actions.push({ key: "changes", text: `An agency asked for changes on ${changes[0].job_title ?? "a job"}.`, to: `/workspace/${changes[0].job_id}`, cta: "Open workspace" })

  return (
    <PageContainer>
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
          {greeting()}, {firstName}
        </h1>
        <p className="text-sm text-muted-foreground">
          {contracts.length > 0
            ? `You have ${contracts.length} active ${contracts.length === 1 ? "contract" : "contracts"}.`
            : "Find a job that fits your skills and send a proposal."}
        </p>
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
        <div className="min-w-0 space-y-6">
          <section aria-labelledby="recommended-heading" className="space-y-3">
            <div className="flex items-baseline justify-between">
              <h2 id="recommended-heading" className="text-base font-semibold text-foreground">
                {skills.length ? "Jobs matching your skills" : "Recent jobs"}
              </h2>
              <Link to="/freelancer/marketplace" className="text-sm font-medium text-primary hover:underline">
                See all jobs
              </Link>
            </div>
            {jobs.length === 0 ? (
              <EmptyState
                icon={<Briefcase className="h-5 w-5" />}
                title="No matching jobs right now"
                description="New briefs are posted daily. Browse everything on Find Work."
                action={
                  <Button asChild size="sm">
                    <Link to="/freelancer/marketplace">Find work</Link>
                  </Button>
                }
              />
            ) : (
              jobs.map((job) => <JobCard key={job.id} job={job} onOpen={application.openJob} saved={isSaved(job)} onToggleSave={toggleSave} action={application.cardAction(job)} />)
            )}
          </section>

          <Panel title="Current contracts" action={<Link to="/freelancer/funded-jobs" className="text-sm font-medium text-primary hover:underline">My jobs</Link>} bodyClassName="p-0">
            {contracts.length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted-foreground">No active contracts. When an agency funds a job you've won, it appears here.</p>
            ) : (
              <ul className="divide-y divide-border">
                {contracts.map((c) => (
                  <li key={c.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{c.job_title ?? "Job"}</p>
                      <p className="text-xs text-muted-foreground">
                        {c.agency_name ?? "Agency"} · <span className="tabular-nums">{formatKobo(c.amount_kobo)}</span> in escrow
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <EscrowStatusBadge status={c.status_v2} />
                      <Link to={`/workspace/${c.job_id}`} className="text-sm font-medium text-primary hover:underline">
                        Workspace
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Active proposals" action={<Link to="/freelancer/proposals" className="text-sm font-medium text-primary hover:underline">All proposals</Link>} bodyClassName="p-0">
            {proposals.length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted-foreground">You haven't sent any proposals yet.</p>
            ) : (
              <ul className="divide-y divide-border">
                {proposals.map((p) => {
                  const st = PROPOSAL_STATUS[p.status] ?? { label: p.status, className: "text-muted-foreground" }
                  return (
                    <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">{p.job_title ?? "Job"}</p>
                        <p className="text-xs text-muted-foreground">
                          {p.agency_name ?? "Agency"} · sent {formatTimeAgo(p.created_at)}
                        </p>
                      </div>
                      <span className={`shrink-0 text-xs font-medium ${st.className}`}>{st.label}</span>
                    </li>
                  )
                })}
              </ul>
            )}
          </Panel>
        </div>

        <aside className="space-y-5" aria-label="Your account">
          <Panel title="Credits">
            <p className="flex items-baseline gap-2">
              <span className="font-heading text-2xl font-semibold tabular-nums text-foreground">{credits}</span>
              <span className="text-sm text-muted-foreground">available</span>
            </p>
            <p className="mt-1 text-xs text-muted-foreground">Each proposal uses the job's credit cost.</p>
            <Button asChild variant="outline" size="sm" className="mt-3 w-full">
              <Link to="/freelancer/bizpal">
                <Coins /> Buy credits
              </Link>
            </Button>
          </Panel>

          <Panel title="Earnings">
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Paid out</dt>
                <dd className="font-semibold tabular-nums text-foreground">{formatKobo(paidOut)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Approved, ready to withdraw</dt>
                <dd className="font-semibold tabular-nums text-foreground">{formatKobo(awaitingPayout)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">In escrow</dt>
                <dd className="font-semibold tabular-nums text-foreground">{formatKobo(contracts.reduce((t, e) => t + Number(e.amount_kobo || 0), 0))}</dd>
              </div>
            </dl>
          </Panel>

          <Panel title="Unread messages" action={<Link to="/freelancer/messages" className="text-sm font-medium text-primary hover:underline">Open</Link>} bodyClassName="p-0">
            {unread.length === 0 ? (
              <p className="flex items-center gap-2 px-4 py-4 text-sm text-muted-foreground">
                <MessageSquare className="h-4 w-4" aria-hidden /> You're all caught up.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {unread.slice(0, 4).map((m) => (
                  <li key={m.id}>
                    <Link to={`/freelancer/messages?conversationId=${m.conversation_id}`} className="block px-4 py-2.5 hover:bg-surface-2">
                      <p className="truncate text-sm font-medium text-foreground">{m.sender_name}</p>
                      <p className="truncate text-xs text-muted-foreground">{m.message_text}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <ProfileCompleteness items={completeness} />
        </aside>
      </div>

      <JobDetailsSheet
        job={application.selectedJob}
        open={!!application.selectedJob}
        onOpenChange={(open) => !open && application.closeJob()}
        saved={application.selectedJob ? isSaved(application.selectedJob) : false}
        onToggleSave={toggleSave}
        cta={application.selectedJob ? application.detailsCta(application.selectedJob) : null}
      >
        {application.proposalForm}
      </JobDetailsSheet>
    </PageContainer>
  )
}

