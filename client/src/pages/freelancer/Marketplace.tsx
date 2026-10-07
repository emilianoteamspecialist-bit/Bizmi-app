import { useEffect, useState } from "react"
import { Link, Navigate, useSearchParams } from "react-router-dom"
import { Briefcase, Loader2, Search, ShieldAlert, SlidersHorizontal } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { useDashboardQuery } from "@/lib/queries/user"
import { useMarketplaceQuery } from "@/lib/queries/marketplace"
import { useToggleBookmarkMutation } from "@/lib/queries/jobs"
import { ALL_CATEGORIES, getSkillsForCategory, type Category } from "@/lib/categories"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { JobCard, JobCardSkeleton, type MarketplaceJob } from "@/components/marketplace/JobCard"
import { JobDetailsSheet } from "@/components/marketplace/JobDetailsSheet"
import { FilterGroup } from "@/components/marketplace/FilterGroup"
import { useJobApplication } from "@/components/marketplace/useJobApplication"
import { EmptyState, ErrorState, PageContainer, PageHeader } from "@/components/marketplace/primitives"

type Filters = { category: string; jobType: string; maxCredits: string; posted: string }
const NO_FILTERS: Filters = { category: "", jobType: "", maxCredits: "", posted: "" }

const POSTED_DAYS: Record<string, number> = { "1": 1, "7": 7, "30": 30 }

function fromDateFor(posted: string): string | undefined {
  const days = POSTED_DAYS[posted]
  return days ? new Date(Date.now() - days * 86400000).toISOString() : undefined
}

function JobFilters({ filters, onChange }: { filters: Filters; onChange: (next: Filters) => void }) {
  const set = (key: keyof Filters) => (value: string) => onChange({ ...filters, [key]: value })
  return (
    <div className="space-y-4">
      <FilterGroup
        legend="Category"
        name="category"
        value={filters.category}
        onChange={set("category")}
        options={[{ value: "", label: "All categories" }, ...ALL_CATEGORIES.map((c) => ({ value: c, label: c }))]}
      />
      <FilterGroup
        legend="Work type"
        name="jobType"
        value={filters.jobType}
        onChange={set("jobType")}
        options={[
          { value: "", label: "Any" },
          { value: "Remote", label: "Remote" },
          { value: "Hybrid", label: "Hybrid" },
          { value: "On-site", label: "On-site" },
        ]}
      />
      <FilterGroup
        legend="Credits to apply"
        name="maxCredits"
        value={filters.maxCredits}
        onChange={set("maxCredits")}
        options={[
          { value: "", label: "Any" },
          { value: "5", label: "5 or fewer" },
          { value: "10", label: "10 or fewer" },
        ]}
      />
      <FilterGroup
        legend="Date posted"
        name="posted"
        value={filters.posted}
        onChange={set("posted")}
        options={[
          { value: "", label: "Any time" },
          { value: "1", label: "Last 24 hours" },
          { value: "7", label: "Last 7 days" },
          { value: "30", label: "Last 30 days" },
        ]}
      />
    </div>
  )
}

export default function Marketplace() {
  const { profile } = useAuth()
  const isFreelancer = !profile || profile.account_type === "freelancer"
  const dashboard = useDashboardQuery(isFreelancer)
  // ?q= comes from the marketplace header search.
  const [searchParams] = useSearchParams()
  const urlQuery = searchParams.get("q") ?? ""
  const [searchQuery, setSearchQuery] = useState(urlQuery)
  const [draftSearch, setDraftSearch] = useState(urlQuery)
  useEffect(() => {
    setDraftSearch(urlQuery)
    setSearchQuery(urlQuery)
  }, [urlQuery])
  const [filters, setFilters] = useState<Filters>(NO_FILTERS)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [bookmarkOverrides, setBookmarkOverrides] = useState<Record<string, boolean>>({})

  const params = {
    searchQuery,
    jobType: filters.jobType,
    maxCredits: filters.maxCredits ? Number(filters.maxCredits) : undefined,
    categorySkills: filters.category ? [...getSkillsForCategory(filters.category as Category)] : undefined,
    fromDate: fromDateFor(filters.posted),
  }
  const query = useMarketplaceQuery(params, isFreelancer)
  const bookmark = useToggleBookmarkMutation()
  const application = useJobApplication({ credits: dashboard.data?.credits ?? 0, verified: !!dashboard.data?.isVerified })

  if (profile && profile.account_type !== "freelancer") return <Navigate to="/" replace />

  const jobs: MarketplaceJob[] = query.data?.pages.flatMap((page) => page.jobs) ?? []
  const total = query.data?.pages[0]?.totalCount ?? jobs.length
  const verified = !!dashboard.data?.isVerified
  const activeFilterCount = Object.values(filters).filter(Boolean).length

  const isSaved = (job: MarketplaceJob) => bookmarkOverrides[job.id] ?? !!job.is_bookmarked
  const toggleSave = (job: MarketplaceJob) => {
    const current = isSaved(job)
    setBookmarkOverrides((o) => ({ ...o, [job.id]: !current }))
    bookmark.mutate({ jobId: job.id, isBookmarked: current })
  }
  return (
    <PageContainer>
      <PageHeader title="Find work" description="Open projects from agencies, newest first." />

      {dashboard.data && !verified && (
        <div className="mt-5 flex flex-col gap-3 rounded-lg border border-warning/40 bg-warning/5 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-start gap-2 text-sm text-foreground">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden />
            Verify your identity to start sending proposals.
          </p>
          <Button asChild size="sm" variant="outline">
            <Link to="/freelancer/identity">Verify identity</Link>
          </Button>
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="hidden lg:block" aria-label="Filters">
          <div className="sticky top-20 rounded-lg border border-border bg-card p-4">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">Filters</h2>
              {activeFilterCount > 0 && (
                <button onClick={() => setFilters(NO_FILTERS)} className="text-xs font-medium text-primary hover:underline">
                  Clear all
                </button>
              )}
            </div>
            <JobFilters filters={filters} onChange={setFilters} />
          </div>
        </aside>

        <div className="min-w-0 space-y-4">
          <form
            role="search"
            className="flex gap-2"
            onSubmit={(event) => {
              event.preventDefault()
              setSearchQuery(draftSearch)
            }}
          >
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input
                aria-label="Search projects"
                role="searchbox"
                value={draftSearch}
                onChange={(e) => setDraftSearch(e.target.value)}
                placeholder="Search by title, skill or keyword"
                className="pl-9"
              />
            </div>
            <Button type="submit">Search</Button>
            <Button type="button" variant="outline" className="lg:hidden" onClick={() => setFiltersOpen(true)} aria-label="Filters">
              <SlidersHorizontal />
              {activeFilterCount > 0 && <span className="tabular-nums">{activeFilterCount}</span>}
            </Button>
          </form>

          <div className="flex items-center justify-between text-sm">
            <p className="text-foreground" aria-live="polite">
              {total === 1 ? "1 project found" : `${total} projects found`}
            </p>
            <p className="text-xs text-muted-foreground">{query.isFetching && !query.isLoading ? "Updating…" : "Newest first"}</p>
          </div>

          {query.isError && !query.data ? (
            <ErrorState title="Couldn't load projects" description="Please try refreshing the page." onRetry={() => query.refetch()} />
          ) : query.isLoading && !query.data ? (
            <div className="space-y-3" aria-label="Loading projects">
              {[1, 2, 3].map((i) => (
                <JobCardSkeleton key={i} />
              ))}
            </div>
          ) : jobs.length === 0 ? (
            <EmptyState
              icon={<Briefcase className="h-5 w-5" />}
              title="No projects match"
              description="Try a different search or clear your filters."
              action={
                activeFilterCount > 0 || searchQuery ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setFilters(NO_FILTERS)
                      setDraftSearch("")
                      setSearchQuery("")
                    }}
                  >
                    Clear search and filters
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <div className="space-y-3">
              {jobs.map((job) => (
                <JobCard key={job.id} job={job} onOpen={application.openJob} saved={isSaved(job)} onToggleSave={toggleSave} action={application.cardAction(job)} />
              ))}
            </div>
          )}

          {query.isFetchNextPageError && (
            <div role="alert" className="flex items-center justify-between rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
              <span>Couldn't load more projects.</span>
              <Button variant="outline" size="sm" onClick={() => query.fetchNextPage()}>
                Retry load more
              </Button>
            </div>
          )}
          {query.hasNextPage && (
            <div className="flex justify-center pt-2">
              <Button variant="outline" disabled={query.isFetchingNextPage} onClick={() => query.fetchNextPage()}>
                {query.isFetchingNextPage && <Loader2 className="animate-spin" />}
                Load more
              </Button>
            </div>
          )}
        </div>
      </div>

      <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
        <SheetContent side="left" className="w-80 overflow-y-auto">
          <SheetTitle className="mb-4 text-base font-semibold">Filters</SheetTitle>
          <JobFilters filters={filters} onChange={setFilters} />
          <div className="mt-6 flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setFilters(NO_FILTERS)}>
              Clear
            </Button>
            <Button className="flex-1" onClick={() => setFiltersOpen(false)}>
              Show results
            </Button>
          </div>
        </SheetContent>
      </Sheet>

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
