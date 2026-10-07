import { useEffect, useState } from "react"
import { Navigate, useSearchParams } from "react-router-dom"
import { Loader2, Search, SlidersHorizontal, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { useAuth } from "@/contexts/AuthContext"
import { useFindFreelancersQuery, type FreelancerSearchResult } from "@/lib/queries/freelancers"
import { ALL_CATEGORIES, getCategoriesForSkills, type Category } from "@/lib/categories"
import { FilterGroup } from "@/components/marketplace/FilterGroup"
import { FreelancerCard, FreelancerCardSkeleton, isIdentityVerified } from "@/components/marketplace/FreelancerCard"
import { EmptyState, ErrorState, PageContainer, PageHeader } from "@/components/marketplace/primitives"
import FreelancerProfileModal from "./FreelancerProfileModal"

type Filters = { category: string; trust: string }
const NO_FILTERS: Filters = { category: "", trust: "" }

function TalentFilters({ filters, onChange }: { filters: Filters; onChange: (next: Filters) => void }) {
  return (
    <div className="space-y-4">
      <FilterGroup
        legend="Category"
        name="talent-category"
        value={filters.category}
        onChange={(category) => onChange({ ...filters, category })}
        options={[{ value: "", label: "All categories" }, ...ALL_CATEGORIES.map((c) => ({ value: c, label: c }))]}
      />
      <FilterGroup
        legend="Trust"
        name="talent-trust"
        value={filters.trust}
        onChange={(trust) => onChange({ ...filters, trust })}
        options={[
          { value: "", label: "Anyone" },
          { value: "verified", label: "Identity verified" },
          { value: "track-record", label: "Verified with completed jobs" },
        ]}
      />
    </div>
  )
}

export default function FindFreelancers() {
  const { profile } = useAuth()
  // ?q= comes from the marketplace header search.
  const [searchParams] = useSearchParams()
  const urlQuery = searchParams.get("q") ?? ""
  const [searchTerm, setSearchTerm] = useState(urlQuery)
  const [searchBoxValue, setSearchBoxValue] = useState(urlQuery)
  useEffect(() => {
    setSearchTerm(urlQuery)
    setSearchBoxValue(urlQuery)
  }, [urlQuery])
  const [filters, setFilters] = useState<Filters>(NO_FILTERS)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [selectedFreelancer, setSelectedFreelancer] = useState<FreelancerSearchResult | null>(null)

  const query = useFindFreelancersQuery(searchTerm, true)

  if (profile && profile.account_type !== "agency") {
    return <Navigate to="/" replace />
  }

  const freelancers = query.data?.pages.flatMap((page) => page.freelancers) ?? []
  // Category and trust filter the loaded results (the API searches by text).
  const filtered = freelancers.filter((f) => {
    if (filters.category && !getCategoriesForSkills(f.skills ?? []).includes(filters.category as Category)) return false
    if (filters.trust === "verified" && !isIdentityVerified(f)) return false
    if (filters.trust === "track-record" && !(isIdentityVerified(f) && Number(f.jobs_completed) > 0)) return false
    return true
  })
  const activeFilterCount = Object.values(filters).filter(Boolean).length

  return (
    <PageContainer>
      <PageHeader title="Find talent" description="Search freelancers by name, skill or keyword. Verified identity and completed jobs come from Bizimi's own records." />

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
            <TalentFilters filters={filters} onChange={setFilters} />
          </div>
        </aside>

        <div className="min-w-0 space-y-4">
          <form
            role="search"
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              setSearchTerm(searchBoxValue)
            }}
          >
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input
                aria-label="Search freelancers"
                placeholder="Search by name, skill or keyword"
                value={searchBoxValue}
                onChange={(e) => setSearchBoxValue(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button type="submit">Search</Button>
            <Button type="button" variant="outline" className="lg:hidden" onClick={() => setFiltersOpen(true)} aria-label="Filters">
              <SlidersHorizontal />
              {activeFilterCount > 0 && <span className="tabular-nums">{activeFilterCount}</span>}
            </Button>
          </form>

          {query.isLoading ? (
            <div data-testid="find-freelancers-skeleton" className="grid gap-3 md:grid-cols-2">
              {[1, 2, 3, 4].map((i) => (
                <FreelancerCardSkeleton key={i} />
              ))}
            </div>
          ) : query.isError && !query.data ? (
            <ErrorState title="Couldn't load freelancers" description="Please try refreshing the page." onRetry={() => query.refetch?.()} />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={<Users className="h-5 w-5" />}
              title="No freelancers found"
              description={freelancers.length > 0 ? "No one on this page matches your filters." : "Try a different name or skill."}
              action={
                activeFilterCount > 0 || searchTerm ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setFilters(NO_FILTERS)
                      setSearchBoxValue("")
                      setSearchTerm("")
                    }}
                  >
                    Clear search and filters
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <>
              <p className="text-sm text-foreground" aria-live="polite">
                Showing {filtered.length} {filtered.length === 1 ? "freelancer" : "freelancers"}
              </p>
              <div className="grid gap-3 md:grid-cols-2">
                {filtered.map((f) => (
                  <FreelancerCard key={f.id} freelancer={f} onView={setSelectedFreelancer} />
                ))}
              </div>
            </>
          )}

          {query.hasNextPage && (
            <div className="flex justify-center pt-2">
              <Button variant="outline" onClick={() => query.fetchNextPage()} disabled={query.isFetchingNextPage}>
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
          <TalentFilters filters={filters} onChange={setFilters} />
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

      <FreelancerProfileModal freelancer={selectedFreelancer} isOpen={!!selectedFreelancer} onClose={() => setSelectedFreelancer(null)} />
    </PageContainer>
  )
}
