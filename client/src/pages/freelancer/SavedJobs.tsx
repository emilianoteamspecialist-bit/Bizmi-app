import { useState } from "react"
import { Link } from "react-router-dom"
import { Bookmark } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useSavedJobsQuery, useToggleBookmarkMutation } from "@/lib/queries/jobs"
import { useDashboardQuery } from "@/lib/queries/user"
import { JobCard, JobCardSkeleton, type MarketplaceJob } from "@/components/marketplace/JobCard"
import { JobDetailsSheet } from "@/components/marketplace/JobDetailsSheet"
import { useJobApplication } from "@/components/marketplace/useJobApplication"
import { EmptyState, ErrorState, PageContainer, PageHeader } from "@/components/marketplace/primitives"

// /api/jobs/saved returns the raw job plus legacy-shaped fields; normalise to
// the shared job-card shape.
function toMarketplaceJob(job: any): MarketplaceJob {
  return {
    ...job,
    proposal_count: job.proposal_count ?? job.proposals ?? 0,
    is_bookmarked: true,
    agency_info: job.agency_info ?? (job.agencyInfo?.name ? { company_name: job.agencyInfo.name } : null),
  }
}

export default function SavedJobs() {
  const savedJobsQuery = useSavedJobsQuery()
  const dashboard = useDashboardQuery()
  const bookmark = useToggleBookmarkMutation()
  const application = useJobApplication({ credits: dashboard.data?.credits ?? 0, verified: !!dashboard.data?.isVerified })
  const [removed, setRemoved] = useState<Set<string>>(new Set())

  const jobs = (savedJobsQuery.data?.jobs ?? []).map(toMarketplaceJob).filter((j) => !removed.has(j.id))

  // Unsaving removes the job from this list straight away.
  const unsave = (job: MarketplaceJob) => {
    setRemoved((current) => new Set(current).add(job.id))
    if (application.selectedJob?.id === job.id) application.closeJob()
    bookmark.mutate({ jobId: job.id, isBookmarked: true })
  }

  return (
    <PageContainer width="narrow">
      <PageHeader
        title="Saved jobs"
        description={savedJobsQuery.data ? `${jobs.length} saved ${jobs.length === 1 ? "job" : "jobs"}` : "Jobs you've saved to come back to."}
        actions={
          <Button asChild variant="outline" size="sm">
            <Link to="/freelancer/marketplace">Find more work</Link>
          </Button>
        }
      />

      <div className="mt-6 space-y-3">
        {savedJobsQuery.isLoading ? (
          [1, 2].map((i) => <JobCardSkeleton key={i} />)
        ) : savedJobsQuery.isError ? (
          <ErrorState title="Couldn't load your saved jobs" description="Please try refreshing the page." onRetry={() => savedJobsQuery.refetch?.()} />
        ) : jobs.length === 0 ? (
          <EmptyState
            icon={<Bookmark className="h-5 w-5" />}
            title="No saved jobs yet"
            description="Save jobs from Find Work to compare them here before you apply."
            action={
              <Button asChild size="sm">
                <Link to="/freelancer/marketplace">Browse jobs</Link>
              </Button>
            }
          />
        ) : (
          jobs.map((job) => <JobCard key={job.id} job={job} onOpen={application.openJob} saved onToggleSave={unsave} action={application.cardAction(job)} />)
        )}
      </div>

      <JobDetailsSheet
        job={application.selectedJob}
        open={!!application.selectedJob}
        onOpenChange={(open) => !open && application.closeJob()}
        saved
        onToggleSave={unsave}
        cta={application.selectedJob ? application.detailsCta(application.selectedJob) : null}
      >
        {application.proposalForm}
      </JobDetailsSheet>
    </PageContainer>
  )
}
