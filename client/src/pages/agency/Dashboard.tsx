import { useState } from "react"
import { Navigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Reveal } from "@/components/shared/reveal"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Calendar, Clock, Edit, FileText, MapPin, MoreHorizontal, Pause, Play, Plus, Users, X } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { useAgencyJobsQuery, useUpdateJobStatusMutation, type AgencyJob } from "@/lib/queries/jobs"
import PostJobModal from "./PostJobModal"
import ProposalsModal from "./ProposalsModal"

function statusColor(status: string) {
  switch (status) {
    case "active":
      return "bg-success/10 text-success border-success/30"
    case "paused":
      return "bg-warning/10 text-warning border-warning/30"
    default:
      return "bg-muted text-muted-foreground border-border"
  }
}

function statusIcon(status: string) {
  switch (status) {
    case "active":
      return <Play className="h-3 w-3" />
    case "paused":
      return <Pause className="h-3 w-3" />
    case "closed":
      return <X className="h-3 w-3" />
    default:
      return null
  }
}

export default function AgencyDashboard() {
  const { profile } = useAuth()
  const [showPostJobModal, setShowPostJobModal] = useState(false)
  const [editingJob, setEditingJob] = useState<AgencyJob | null>(null)
  const [viewingProposalsJob, setViewingProposalsJob] = useState<AgencyJob | null>(null)

  const agencyJobsQuery = useAgencyJobsQuery()
  const updateJobStatus = useUpdateJobStatusMutation()

  if (agencyJobsQuery.isLoading) {
    return (
      <div data-testid="agency-dashboard-skeleton" className="min-h-screen bg-surface pb-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-pulse">
          <div className="h-7 w-56 bg-foreground/5 rounded" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 bg-card border border-border rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (agencyJobsQuery.isError && !agencyJobsQuery.data) {
    return (
      <div className="min-h-screen bg-surface pb-20 flex items-center justify-center">
        <div className="text-center space-y-2">
          <p className="text-sm font-semibold text-foreground">Couldn't load your hiring desk</p>
          <p className="text-sm text-muted-foreground">Please try refreshing the page.</p>
        </div>
      </div>
    )
  }

  if (profile && profile.account_type !== "agency") {
    return <Navigate to="/" replace />
  }

  const jobs: AgencyJob[] = agencyJobsQuery.data?.jobs ?? []
  const agencyName = profile?.company_name || profile?.full_name || "Your"

  const activeJobs = jobs.filter((j) => j.status === "active").length
  const pausedJobs = jobs.filter((j) => j.status === "paused").length
  const closedJobs = jobs.filter((j) => j.status === "closed").length
  const totalProposals = jobs.reduce((sum, j) => sum + j.proposals, 0)

  const openPostJobModal = () => {
    setEditingJob(null)
    setShowPostJobModal(true)
  }

  const handlePauseResume = (job: AgencyJob) => {
    const newStatus = job.status === "paused" ? "active" : "paused"
    updateJobStatus.mutate(
      { jobId: job.id, status: newStatus },
      { onError: () => alert("Error updating job. Please try again.") }
    )
  }

  const handleClose = (job: AgencyJob) => {
    if (!confirm("Close this job permanently? This action cannot be undone.")) return
    updateJobStatus.mutate(
      { jobId: job.id, status: "closed" },
      { onError: () => alert("Error updating job. Please try again.") }
    )
  }

  return (
    <div className="min-h-screen bg-surface pb-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div className="space-y-1 min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Hiring desk</p>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground truncate">
              {agencyName === "Your" ? "Your hiring desk" : agencyName}
            </h1>
            <p className="text-sm text-muted-foreground">Compose briefs, weigh proposals, hire decisively.</p>
          </div>
          <Button onClick={openPostJobModal} className="h-10 px-4 rounded-lg gap-2 shrink-0 w-full sm:w-auto justify-center">
            <Plus className="h-4 w-4" /> Post a job
          </Button>
        </header>

        <Reveal>
          <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: "Active", value: activeJobs, icon: Play, tone: "text-success", accent: false },
              { label: "Paused", value: pausedJobs, icon: Pause, tone: "text-warning", accent: false },
              { label: "Closed", value: closedJobs, icon: X, tone: "text-muted-foreground", accent: false },
              { label: "Proposals", value: totalProposals, icon: Users, tone: "text-primary", accent: true },
            ].map((stat) => (
              <div key={stat.label} className={`rounded-xl border bg-card p-4 ${stat.accent ? "border-primary/30" : "border-border"}`}>
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-muted-foreground">{stat.label}</p>
                  <stat.icon className={`h-3.5 w-3.5 ${stat.tone}`} />
                </div>
                <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground tabular-nums">{stat.value}</p>
              </div>
            ))}
          </section>
        </Reveal>

        <Reveal delay={0.08}>
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-foreground">
              Your jobs <span className="font-normal text-muted-foreground">· {jobs.length}</span>
            </h2>

            {jobs.length === 0 ? (
              <div className="rounded-xl border border-border bg-card py-16 px-6 text-center">
                <div className="mx-auto h-11 w-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <FileText className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-sm font-semibold text-foreground">No jobs yet</h3>
                <p className="mt-1 text-sm text-muted-foreground max-w-sm mx-auto">
                  Post your first opportunity and we'll bring qualified freelancers to your door.
                </p>
                <Button className="mt-5 gap-2" onClick={openPostJobModal}>
                  <Plus className="h-4 w-4" /> Post a job
                </Button>
              </div>
            ) : (
              <div className="rounded-xl border border-border bg-card divide-y divide-border overflow-hidden">
                {jobs.map((job) => (
                  <div key={job.id} className="p-4 sm:p-5 transition-colors hover:bg-surface/60">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <div className="flex items-center gap-2.5">
                          <h3 className="text-sm font-semibold text-foreground truncate">{job.title}</h3>
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border ${statusColor(job.status)}`}>
                            {statusIcon(job.status)}
                            {job.status}
                          </span>
                        </div>
                        {job.description && <p className="text-sm text-muted-foreground line-clamp-1 max-w-2xl">{job.description}</p>}
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          <span className="font-medium text-foreground tabular-nums">
                            ₦{job.budget_min?.toLocaleString() ?? "—"} – ₦{job.budget_max?.toLocaleString() ?? "—"}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {job.duration || "Flexible"}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {job.location || "Remote"}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(job.created_at).toLocaleDateString("en-NG", { day: "numeric", month: "short" })}
                          </span>
                          <span className="font-medium text-primary">
                            {job.proposals} {job.proposals === 1 ? "proposal" : "proposals"}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Button variant="outline" size="sm" onClick={() => setViewingProposalsJob(job)}>
                          Review bids
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
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
                              <Pause className="mr-2 h-4 w-4 text-muted-foreground" /> {job.status === "paused" ? "Resume hiring" : "Pause hiring"}
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => handleClose(job)}>
                              <X className="mr-2 h-4 w-4" /> Close listing
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                    {!!job.skills?.length && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {job.skills.slice(0, 6).map((sk) => (
                          <span key={sk} className="px-2 py-0.5 rounded-md bg-surface-2 text-muted-foreground text-[11px]">
                            {sk}
                          </span>
                        ))}
                        {job.skills.length > 6 && <span className="px-2 py-0.5 text-[11px] text-muted-foreground">+{job.skills.length - 6}</span>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </Reveal>
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
    </div>
  )
}
