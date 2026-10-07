import { useState } from "react"
import { Link, Navigate } from "react-router-dom"
import { FileText, Plus, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useAuth } from "@/contexts/AuthContext"
import { useAgencyJobsQuery, type AgencyJob } from "@/lib/queries/jobs"
import { formatBudgetRange, formatTimeAgo } from "@/lib/format"
import { cn } from "@/lib/utils"
import { EmptyState, ErrorState, PageContainer, PageHeader, SkeletonBlock } from "@/components/marketplace/primitives"
import ProposalsModal from "./ProposalsModal"

const STATUS: Record<AgencyJob["status"], { label: string; className: string }> = {
  active: { label: "Open", className: "bg-success/10 text-success" },
  paused: { label: "Paused", className: "bg-warning/10 text-warning" },
  closed: { label: "Closed", className: "bg-surface-2 text-muted-foreground" },
}

const FILTERS = [
  { value: "all", label: "All" },
  { value: "active", label: "Open" },
  { value: "paused", label: "Paused" },
  { value: "closed", label: "Closed" },
] as const
type Filter = (typeof FILTERS)[number]["value"]

// Every job post the agency has made, with its bids one click away. Search and
// the status filter work on the already-loaded list (the agency jobs query
// returns every job). Editing, pausing and closing live on the dashboard.
export default function AgencyPosts() {
  const { profile } = useAuth()
  const [searchTerm, setSearchTerm] = useState("")
  const [filter, setFilter] = useState<Filter>("all")
  const [viewingProposalsJob, setViewingProposalsJob] = useState<AgencyJob | null>(null)

  const agencyJobsQuery = useAgencyJobsQuery()

  if (profile?.account_type === "freelancer") {
    return <Navigate to="/freelancer/dashboard" replace />
  }
  if (profile?.account_type === "admin") {
    return <Navigate to="/admin/dashboard" replace />
  }

  const postButton = (
    <Button asChild>
      <Link to="/agency/dashboard?post=true">
        <Plus /> Post a job
      </Link>
    </Button>
  )

  if (agencyJobsQuery.isError && !agencyJobsQuery.data) {
    return (
      <PageContainer width="narrow">
        <ErrorState title="Couldn't load your job posts" description="Please try refreshing the page." onRetry={() => agencyJobsQuery.refetch?.()} />
      </PageContainer>
    )
  }

  const jobs: AgencyJob[] = agencyJobsQuery.data?.jobs ?? []
  const term = searchTerm.trim().toLowerCase()
  const filteredJobs = jobs.filter(
    (job) =>
      (filter === "all" || job.status === filter) &&
      (!term || (job.title?.toLowerCase() || "").includes(term) || (job.description?.toLowerCase() || "").includes(term))
  )
  const counts = Object.fromEntries(FILTERS.map((f) => [f.value, f.value === "all" ? jobs.length : jobs.filter((j) => j.status === f.value).length]))

  return (
    <PageContainer>
      <PageHeader title="Job posts" description="Every job you've posted, with its bids one click away." actions={postButton} />

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div role="tablist" aria-label="Filter by status" className="flex flex-wrap gap-1">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              role="tab"
              aria-selected={filter === f.value}
              onClick={() => setFilter(f.value)}
              className={cn(
                "h-8 rounded-md px-3 text-sm font-medium transition-colors",
                filter === f.value ? "bg-foreground text-background" : "text-muted-foreground hover:bg-surface-2 hover:text-foreground"
              )}
            >
              {f.label} <span className="tabular-nums opacity-70">{counts[f.value]}</span>
            </button>
          ))}
        </div>
        <div className="relative sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            type="search"
            aria-label="Search job posts"
            placeholder="Search job posts by title or description"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <div className="mt-4">
        {agencyJobsQuery.isLoading ? (
          <div data-testid="agency-posts-skeleton" className="space-y-3" aria-label="Loading job posts">
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonBlock key={i} className="h-28" />
            ))}
          </div>
        ) : filteredJobs.length === 0 ? (
          jobs.length === 0 ? (
            <EmptyState
              icon={<FileText className="h-5 w-5" />}
              title="No job posts yet"
              description="Post your first job and the bids freelancers send will land here."
              action={postButton}
            />
          ) : (
            <EmptyState icon={<Search className="h-5 w-5" />} title="No matching job posts" description="Try a different keyword or status." />
          )
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border bg-card">
            {filteredJobs.map((job) => {
              const status = STATUS[job.status] ?? STATUS.active
              const bids = Number(job.proposals) || 0
              return (
                <li key={job.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-6">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate text-sm font-semibold text-foreground">{job.title}</h2>
                      <span className={cn("rounded px-1.5 py-0.5 text-[11px] font-medium", status.className)}>{status.label}</span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{job.description}</p>
                    <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span className="tabular-nums text-foreground">{formatBudgetRange(job.budget_min, job.budget_max)}</span>
                      {job.duration && <span>{job.duration}</span>}
                      <span>Posted {formatTimeAgo(job.created_at)}</span>
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-4 sm:flex-col sm:items-end sm:gap-2">
                    <span className={cn("text-sm font-medium tabular-nums", bids ? "text-primary" : "text-muted-foreground")}>
                      {bids} {bids === 1 ? "proposal" : "proposals"}
                    </span>
                    <Button variant="outline" size="sm" onClick={() => setViewingProposalsJob(job)}>
                      Review bids ({bids})
                    </Button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <ProposalsModal job={viewingProposalsJob} isOpen={!!viewingProposalsJob} onClose={() => setViewingProposalsJob(null)} />
    </PageContainer>
  )
}
