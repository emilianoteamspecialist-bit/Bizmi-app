import { useState } from "react"
import { Navigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Briefcase, Filter, Loader2, MapPin, Search, ShieldCheck, X } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { useFindFreelancersQuery, type FreelancerSearchResult } from "@/lib/queries/freelancers"
import { ALL_CATEGORIES, getCategoriesForSkills, type Category } from "@/lib/categories"
import FreelancerProfileModal from "./FreelancerProfileModal"

function trustBadge(verificationStatus: string | null, jobsCompleted: number) {
  if (verificationStatus === "verified" && jobsCompleted >= 5) {
    return { label: "Fully Verified", className: "bg-success/10 text-success" }
  }
  if (verificationStatus === "verified") {
    return { label: "Verified", className: "bg-primary/10 text-primary" }
  }
  return { label: "New", className: "bg-muted text-muted-foreground" }
}

export default function FindFreelancers() {
  const { profile } = useAuth()
  const [searchTerm, setSearchTerm] = useState("")
  const [searchBoxValue, setSearchBoxValue] = useState("")
  const [showFilterModal, setShowFilterModal] = useState(false)
  const [selectedFreelancer, setSelectedFreelancer] = useState<FreelancerSearchResult | null>(null)
  const [filters, setFilters] = useState({ category: "" as Category | "", keywords: "", trustLevel: "" })

  const query = useFindFreelancersQuery(searchTerm, true)

  if (profile && profile.account_type !== "agency") {
    return <Navigate to="/" replace />
  }

  if (query.isLoading) {
    return (
      <div data-testid="find-freelancers-skeleton" className="min-h-screen bg-surface pb-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8 space-y-6 animate-pulse">
          <div className="h-7 w-56 bg-foreground/5 rounded" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-64 rounded-xl border border-border bg-card" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (query.isError) {
    return (
      <div className="min-h-screen bg-surface pb-20 flex items-center justify-center">
        <div className="text-center space-y-2">
          <p className="text-sm font-semibold text-foreground">Couldn't load freelancers</p>
          <p className="text-sm text-muted-foreground">Please try refreshing the page.</p>
        </div>
      </div>
    )
  }

  const freelancers = query.data?.pages.flatMap((page) => page.freelancers) ?? []

  const filtered = freelancers.filter((f) => {
    if (filters.category) {
      const categories = getCategoriesForSkills(f.skills)
      if (!categories.includes(filters.category as Category)) return false
    }
    if (filters.trustLevel) {
      const badge = trustBadge(f.verification_status, f.jobs_completed)
      if (filters.trustLevel === "Fully Verified" && badge.label !== "Fully Verified") return false
      if (filters.trustLevel === "Verified" && badge.label !== "Verified" && badge.label !== "Fully Verified") return false
    }
    return true
  })

  const runSearch = () => setSearchTerm(searchBoxValue)

  const applyFilters = () => {
    setSearchTerm(filters.keywords || searchBoxValue)
    setShowFilterModal(false)
  }

  const resetFilters = () => {
    setFilters({ category: "", keywords: "", trustLevel: "" })
    setSearchBoxValue("")
    setSearchTerm("")
  }

  return (
    <div className="min-h-screen bg-surface pb-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <header className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Marketplace</p>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Find freelancers</h1>
          <p className="text-sm text-muted-foreground">Search and connect with vetted talent across Nigeria.</p>
        </header>

        <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, skills, or keywords..."
                value={searchBoxValue}
                onChange={(e) => setSearchBoxValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && runSearch()}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={runSearch} className="h-10 px-4 rounded-lg gap-2">
                <Search className="h-4 w-4" />
                Search
              </Button>
              <Button variant="outline" className="h-10 px-4 rounded-lg gap-2" onClick={() => setShowFilterModal(true)}>
                <Filter className="h-4 w-4" />
                Filters
              </Button>
            </div>
          </div>
        </div>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">
              Freelancers <span className="font-normal text-muted-foreground">· {filtered.length}</span>
            </h2>
            {(filters.category || filters.trustLevel || filters.keywords) && (
              <Button variant="ghost" size="sm" onClick={resetFilters} className="text-primary">
                Clear filters
              </Button>
            )}
          </div>

          {filtered.length === 0 ? (
            <div className="rounded-xl border border-border bg-card py-16 px-6 text-center">
              <div className="mx-auto h-11 w-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <Search className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-sm font-semibold text-foreground">No freelancers found</h3>
              <p className="mt-1 text-sm text-muted-foreground max-w-sm mx-auto">Try adjusting your search or filters.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filtered.map((freelancer) => {
                  const badge = trustBadge(freelancer.verification_status, freelancer.jobs_completed)
                  const mainSkill = freelancer.skills[0] || "Freelancer"

                  return (
                    <Card
                      key={freelancer.id}
                      className="group overflow-hidden rounded-xl border border-border bg-card shadow-none hover:border-foreground/20 transition-colors"
                    >
                      <CardContent className="p-5">
                        <div className="flex items-start gap-4 mb-4">
                          <Avatar className="h-14 w-14 flex-shrink-0">
                            <AvatarImage src={freelancer.logo || undefined} alt={freelancer.full_name} />
                            <AvatarFallback className="bg-primary text-white text-lg font-semibold">
                              {freelancer.full_name?.charAt(0).toUpperCase() || "F"}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-semibold text-foreground truncate">{freelancer.full_name}</h3>
                              <Badge className={`text-xs border-0 ${badge.className}`}>
                                {badge.label !== "New" && <ShieldCheck className="h-3 w-3 mr-1" />}
                                {badge.label}
                              </Badge>
                            </div>
                            <p className="text-sm text-primary font-medium mt-0.5">{mainSkill}</p>
                            {freelancer.location && (
                              <p className="text-xs text-muted-foreground flex items-center mt-1">
                                <MapPin className="h-3 w-3 mr-1" />
                                {freelancer.location}
                              </p>
                            )}
                          </div>
                        </div>

                        {freelancer.bio && <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{freelancer.bio}</p>}

                        <div className="flex flex-wrap gap-1.5 mb-4">
                          {freelancer.skills.slice(0, 4).map((skill) => (
                            <span key={skill} className="px-2 py-0.5 rounded-md bg-surface-2 text-muted-foreground text-[11px]">
                              {skill}
                            </span>
                          ))}
                          {freelancer.skills.length > 4 && (
                            <span className="px-2 py-0.5 text-[11px] text-muted-foreground">+{freelancer.skills.length - 4}</span>
                          )}
                        </div>

                        <div className="flex items-center justify-between text-xs text-muted-foreground mb-4 pb-4 border-b border-border">
                          <div className="flex items-center gap-1.5">
                            <Briefcase className="h-3.5 w-3.5" />
                            <span>
                              {freelancer.jobs_completed} job{freelancer.jobs_completed !== 1 ? "s" : ""} done
                            </span>
                          </div>
                        </div>

                        <Button variant="outline" size="sm" className="w-full" onClick={() => setSelectedFreelancer(freelancer)}>
                          View profile
                        </Button>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>

              {query.hasNextPage && (
                <div className="flex justify-center mt-6">
                  <Button variant="outline" onClick={() => query.fetchNextPage()} disabled={query.isFetchingNextPage}>
                    {query.isFetchingNextPage ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Loading...
                      </>
                    ) : (
                      "Load more freelancers"
                    )}
                  </Button>
                </div>
              )}
            </>
          )}
        </section>
      </div>

      {showFilterModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Filter Freelancers</CardTitle>
                <Button variant="ghost" size="icon" onClick={() => setShowFilterModal(false)} aria-label="Close">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Keywords</label>
                <Input
                  placeholder='e.g. "logo", "UI/UX", "WordPress"'
                  value={filters.keywords}
                  onChange={(e) => setFilters({ ...filters, keywords: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Skill Category</label>
                <Select value={filters.category} onValueChange={(value) => setFilters({ ...filters, category: value as Category })}>
                  <SelectTrigger>
                    <SelectValue placeholder="All categories" />
                  </SelectTrigger>
                  <SelectContent>
                    {ALL_CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Trust Level</label>
                <Select value={filters.trustLevel} onValueChange={(value) => setFilters({ ...filters, trustLevel: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="All trust levels" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Verified">Verified & above</SelectItem>
                    <SelectItem value="Fully Verified">Fully Verified only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex space-x-2 pt-4">
                <Button
                  variant="outline"
                  className="flex-1 bg-transparent"
                  onClick={() => setFilters({ category: "", keywords: "", trustLevel: "" })}
                >
                  Reset
                </Button>
                <Button className="flex-1" onClick={applyFilters}>
                  Apply Filters
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <FreelancerProfileModal
        freelancer={selectedFreelancer}
        isOpen={!!selectedFreelancer}
        onClose={() => setSelectedFreelancer(null)}
      />
    </div>
  )
}
