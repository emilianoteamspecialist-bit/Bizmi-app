"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  MapPin,
  Filter,
  Search,
  CreditCard,
  Send,
  Loader2,
  CheckCircle,
  Briefcase,
  Sparkles,
  ArrowUpDown,
  Coins,
  LayoutGrid,
  List,
  X,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { getAvatarUrl } from "@/lib/avatar-url"
import { ALL_CATEGORIES, getSkillsForCategory, type Category } from "@/lib/categories"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { getJobs, toggleBookmark } from "@/app/actions/jobs"
import { submitProposal } from "@/app/actions/proposals"
import { JobCard } from "@/components/shared/job-card"
import { MarketplaceJobCard } from "@/components/shared/marketplace-job-card"
import { cn } from "@/lib/utils"
import { Modal } from "@/components/shared/modal"
import { StatBadge } from "@/components/shared/stat-badge"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"

const JOBS_PER_PAGE = 20

function FilterGroup({
  title,
  options,
  selected,
  onChange,
}: {
  title: string
  options: string[]
  selected: string
  onChange: (value: string) => void
}) {
  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold text-foreground">{title}</p>
      <div className="grid grid-cols-2 gap-x-3 gap-y-2.5">
        {options.map((opt) => {
          const checked = selected === opt
          return (
            <label
              key={opt}
              className="flex items-center gap-2 cursor-pointer group"
            >
              <span
                className={cn(
                  "h-4 w-4 rounded-[3px] border flex items-center justify-center shrink-0 transition-colors",
                  checked
                    ? "bg-primary border-primary"
                    : "border-border group-hover:border-rule bg-card"
                )}
                onClick={(e) => {
                  e.preventDefault()
                  onChange(opt)
                }}
              >
                {checked && (
                  <svg viewBox="0 0 12 12" className="h-2.5 w-2.5 text-white">
                    <path
                      d="M2.5 6 5 8.5 9.5 4"
                      stroke="currentColor"
                      strokeWidth="2"
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </span>
              <input
                type="checkbox"
                checked={checked}
                onChange={() => onChange(opt)}
                className="sr-only"
              />
              <span className="text-xs text-foreground/80 group-hover:text-foreground transition-colors">
                {opt}
              </span>
            </label>
          )
        })}
      </div>
    </div>
  )
}

function Chip({ children, onRemove }: { children: React.ReactNode; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-primary bg-primary-soft border border-primary-border rounded-md">
      {children}
      <button onClick={onRemove} aria-label="Remove" className="hover:text-primary-hover">
        <X className="h-3 w-3" />
      </button>
    </span>
  )
}

export default function MarketplaceClient({
  initialUser,
  initialProfile,
  initialCredits,
  initialBalance,
  initialJobs,
  initialTotalJobsCount
}: {
  initialUser: any;
  initialProfile: any;
  initialCredits: number;
  initialBalance: number;
  initialJobs: any[];
  initialTotalJobsCount: number;
}) {
  const [selectedJob, setSelectedJob] = useState<any>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [jobs, setJobs] = useState<any[]>(initialJobs || [])
  const [loading, setLoading] = useState(false)
  const [jobsLoading, setJobsLoading] = useState(false)
  const [jobsOffset, setJobsOffset] = useState(initialJobs?.length || 0)
  const [hasMoreJobs, setHasMoreJobs] = useState((initialJobs?.length || 0) < initialTotalJobsCount)
  const [currentUser] = useState<any>(initialUser)
  const router = useRouter()
  const [showFilterModal, setShowFilterModal] = useState(false)
  const [showPlaceBidModal, setShowPlaceBidModal] = useState(false)
  const [showAgencyModal, setShowAgencyModal] = useState(false)
  const [filters, setFilters] = useState({
    keywords: "",
    minBudget: "",
    maxBudget: "",
    credits: "",
    category: "" as string,
    jobType: "" as string,
  })
  const [bidData, setBidData] = useState({
    proposal: "",
    timeline: "",
    budget: "",
  })
  const [selectedAgency, setSelectedAgency] = useState<any>(null)
  const [creditBalance, setCreditBalance] = useState(initialCredits || 0)
  const [isSubmittingBid, setIsSubmittingBid] = useState(false)
  // Synchronous double-submit guard; immune to React state batching lag.
  const isSubmittingBidRef = useRef(false)
  const [profile] = useState<any>(initialProfile)
  const [location, setLocation] = useState<string>("")
  const [budgetRange, setBudgetRange] = useState<string>("any")
  const [sortBy, setSortBy] = useState<string>("latest")
  const [lastUpdated, setLastUpdated] = useState<string>("any")
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")

  useEffect(() => {
    if (!initialUser) {
      router.push("/login")
    }
  }, [initialUser, router])

  const loadJobs = useCallback(
    async (
      currentOffset: number,
      currentSearchQuery: string,
      append = false,
      creditsFilter?: string,
      categoryFilter?: string,
      jobTypeFilter?: string,
    ) => {
      setJobsLoading(true)
      try {
        const categorySkills = categoryFilter ? getSkillsForCategory(categoryFilter as Category) : undefined
        
        const { jobs: jobsData, totalCount, error } = await getJobs({
          searchQuery: currentSearchQuery,
          offset: currentOffset,
          limit: JOBS_PER_PAGE,
          maxCredits: creditsFilter ? Number.parseInt(creditsFilter) : undefined,
          jobType: jobTypeFilter,
          categorySkills: categorySkills as unknown as string[]
        })

        if (!error) {
          const transformedJobs =
            jobsData?.map((job: any) => ({
              ...job,
              budget: `₦ ${job.budget_min?.toLocaleString()} - ₦ ${job.budget_max?.toLocaleString()}`,
              postedDate: new Date(job.created_at).toLocaleDateString(),
              proposals: job.proposal_count || 0,
              isLiked: false,
              agencyInfo: {
                ...job.agency_info,
                name: job.agency_info.company_name || job.agency_info.full_name || "Unknown Agency",
                logo: getAvatarUrl(job.agency_info?.logo_path),
                founded: job.agency_info.created_at ? new Date(job.agency_info.created_at).getFullYear().toString() : "2020",
                employees: job.agency_info.company_size || "10-50",
                description: job.agency_info.bio || "Professional agency providing quality services.",
                memberSince: job.agency_info.created_at ? new Date(job.agency_info.created_at).getFullYear().toString() : "2020",
                totalJobs: job.agency_info.total_jobs || 0,
              },
            })) || []

          let finalJobs = transformedJobs
          if (currentUser?.id && finalJobs.length > 0) {
            const jobIds = finalJobs.map((j: any) => j.id)
            const { data: userProposals } = await supabase
              .from("proposals")
              .select("job_id")
              .eq("freelancer_id", currentUser.id)
              .in("job_id", jobIds)
            
            const appliedJobIds = new Set(userProposals?.map(p => p.job_id) || [])
            finalJobs = finalJobs.map((j: any) => ({
              ...j,
              has_applied: appliedJobIds.has(j.id)
            }))
          }

          setJobs((prevJobs) => (append ? [...prevJobs, ...finalJobs] : finalJobs))
          setHasMoreJobs(currentOffset + finalJobs.length < (totalCount || 0))
          setJobsOffset(currentOffset + finalJobs.length)
        }
      } catch (error) {
        console.error(error)
      } finally {
        setJobsLoading(false)
        setLoading(false)
      }
    },
    [currentUser],
  )

  const checkNINVerification = async (userId: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase
        .from("freelancer_verification")
        .select("status")
        .eq("freelancer_id", userId)
        .eq("status", "verified")
        .single()
      
      if (error) return false
      return !!data
    } catch (err) {
      console.error(err)
      return false
    }
  }

  const handleJobAction = async (job: any, action: "bookmark" | "view" | "apply") => {
    if (action === "view") {
      setSelectedAgency(job.agencyInfo)
      setShowAgencyModal(true)
    } else if (action === "apply") {
      if (!currentUser?.id) return

      try {
        const isNINVerified = await checkNINVerification(currentUser.id)
        if (!isNINVerified) {
          alert("Please verify your identity (NIN) before placing a bid.")
          return
        }
        
        if (creditBalance < job.credit_cost) {
          alert(`Insufficient credits! You need ${job.credit_cost} credits.`)
          return
        }
        
        setSelectedJob(job)
        setShowPlaceBidModal(true)
      } catch (err) {
        console.error(err)
      }
    } else if (action === "bookmark") {
      try {
        const currentlyBookmarked = !!job.isBookmarked
        await toggleBookmark(job.id, currentlyBookmarked)
        setJobs(jobs.map((j) => (j.id === job.id ? { ...j, isBookmarked: !currentlyBookmarked } : j)))
      } catch (error) {
        console.error(error)
      }
    }
  }

  const applyFilters = () => {
    setJobsOffset(0)
    setHasMoreJobs(true)
    loadJobs(0, filters.keywords, false, filters.credits, filters.category, filters.jobType)
    setShowFilterModal(false)
  }

  const resetFilters = () => {
    setFilters({ keywords: "", minBudget: "", maxBudget: "", credits: "", category: "", jobType: "" })
    setSearchQuery("")
    setJobsOffset(0)
    setHasMoreJobs(true)
    loadJobs(0, "", false)
  }

  const submitBid = async () => {
    if (!selectedJob) return
    if (isSubmittingBidRef.current) return
    isSubmittingBidRef.current = true

    try {
      setIsSubmittingBid(true)
      const result = await submitProposal(
        selectedJob.id,
        {
          proposal_text: bidData.proposal,
          timeline: bidData.timeline,
          budget: bidData.budget,
        },
        selectedJob.credit_cost,
      )

      if (!result.success) {
        const msg = result.error === "Unauthorized"
          ? "You must be signed in to submit a proposal."
          : `Error submitting proposal: ${result.error}`
        alert(msg)
        return
      }

      if (result.alreadySubmitted) {
        alert("You have already submitted a proposal for this job.")
      } else {
        setCreditBalance(Math.max(0, creditBalance - selectedJob.credit_cost))
        alert(`Proposal submitted! ${selectedJob.credit_cost} credits deducted.`)
      }

      // Optimistic update: flip the applied flag on the local job so the card
      // shows "Applied" immediately rather than waiting on the refetch below.
      const appliedJobId = selectedJob.id
      setJobs((prev) =>
        prev.map((j) => (j.id === appliedJobId ? { ...j, has_applied: true } : j)),
      )

      setShowPlaceBidModal(false)
      setBidData({ proposal: "", timeline: "", budget: "" })
      loadJobs(0, searchQuery, false)
    } catch (error) {
      console.error(error)
      alert("Error submitting proposal. Please try again.")
    } finally {
      setIsSubmittingBid(false)
      isSubmittingBidRef.current = false
    }
  }

  const handleLoadMoreJobs = () => loadJobs(jobsOffset, searchQuery, true)

  if (loading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <p className="eyebrow">Loading marketplace…</p>
      </div>
    )
  }

  const jobTypeOptions = ["Full-time", "Part-time", "Freelance", "Contract", "Internship"]
  const experienceOptions = ["Entry", "Mid", "Senior", "Lead"]
  const workTypeOptions = ["Remote", "On-site", "Hybrid"]
  const popularSearches = ["UI/UX Design", "Programming", "Marketing", "Writing", "Mobile dev"]
  const budgetRanges = [
    { value: "any", label: "Any budget" },
    { value: "0-100000", label: "₦0 – ₦100k" },
    { value: "100000-500000", label: "₦100k – ₦500k" },
    { value: "500000-1000000", label: "₦500k – ₦1M" },
    { value: "1000000+", label: "₦1M+" },
  ]

  const triggerSearch = () => loadJobs(0, searchQuery, false)

  return (
    <div className="min-h-screen bg-surface pb-20">
      {/* Top search section */}
      <section className="bg-card border-b border-border">
        <div className="editorial-shell py-6 space-y-4 animate-fade-up">
          {/* Segmented search bar */}
          <div className="grid grid-cols-1 md:grid-cols-[1fr_220px_200px_180px_auto] gap-2">
            {/* Keyword */}
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Search projects, skills, agencies…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") triggerSearch()
                }}
                className="pl-10 h-12 bg-card border-border rounded-lg shadow-none"
              />
            </div>
            {/* Location */}
            <div className="relative">
              <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Anywhere"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="pl-10 h-12 bg-card border-border rounded-lg shadow-none"
              />
            </div>
            {/* Budget */}
            <Select value={budgetRange} onValueChange={setBudgetRange}>
              <SelectTrigger className="h-12 bg-card border-border rounded-lg shadow-none pl-10 relative">
                <Coins className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <SelectValue placeholder="Any budget" />
              </SelectTrigger>
              <SelectContent>
                {budgetRanges.map((b) => (
                  <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {/* Sort */}
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="h-12 bg-card border-border rounded-lg shadow-none pl-10 relative">
                <ArrowUpDown className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <SelectValue placeholder="Latest" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="latest">Sort: Latest</SelectItem>
                <SelectItem value="budget_high">Sort: Highest budget</SelectItem>
                <SelectItem value="budget_low">Sort: Lowest budget</SelectItem>
                <SelectItem value="popular">Sort: Most proposals</SelectItem>
              </SelectContent>
            </Select>
            {/* Search button */}
            <Button onClick={triggerSearch} className="h-12 px-7 rounded-lg">
              <Search className="h-4 w-4 sm:hidden" />
              <span className="hidden sm:inline">Search</span>
            </Button>
          </div>

          {/* Popular searches */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground font-medium">Popular searches:</span>
            {popularSearches.map((p) => (
              <button
                key={p}
                onClick={() => {
                  setSearchQuery(p)
                  loadJobs(0, p, false)
                }}
                className="px-3 py-1 text-xs font-medium text-foreground bg-surface border border-border rounded-md hover:border-primary hover:text-primary transition-colors"
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Two-column layout */}
      <main className="editorial-shell py-8">
        <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-8 items-start">
          {/* LEFT: Filter sidebar */}
          <aside className="space-y-5 lg:sticky lg:top-8 animate-fade-up delay-100">
            <Card className="p-5 space-y-5 bg-card border-border shadow-none rounded-xl">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-foreground">Filter</p>
                <button
                  onClick={resetFilters}
                  className="text-xs font-medium text-primary hover:text-primary-hover"
                >
                  Clear filter
                </button>
              </div>

              {/* Job type group */}
              <FilterGroup
                title="Job type"
                options={jobTypeOptions}
                selected={filters.jobType}
                onChange={(v) => setFilters({ ...filters, jobType: filters.jobType === v ? "" : v })}
              />

              {/* Experience group */}
              <FilterGroup
                title="Experience"
                options={experienceOptions}
                selected={filters.category}
                onChange={(v) => setFilters({ ...filters, category: filters.category === v ? "" : v })}
              />

              {/* Work type group */}
              <FilterGroup
                title="Work type"
                options={workTypeOptions}
                selected={""}
                onChange={() => {}}
              />

              <div className="space-y-2">
                <p className="eyebrow">Last updated</p>
                <Select value={lastUpdated} onValueChange={setLastUpdated}>
                  <SelectTrigger className="h-10 bg-card border-border rounded-md shadow-none">
                    <SelectValue placeholder="Any time" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any time</SelectItem>
                    <SelectItem value="24h">Past 24 hours</SelectItem>
                    <SelectItem value="7d">Past 7 days</SelectItem>
                    <SelectItem value="30d">Past 30 days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </Card>

            {/* Smart Match CTA */}
            <Card className="p-5 bg-paper border-border shadow-none rounded-xl space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <p className="text-sm font-semibold text-foreground">Use Smart Match</p>
              </div>
              <p className="caption">
                Let Bizimi recommend projects based on your skills and past experience.
              </p>
              <Button
                onClick={() => {
                  const userSkills = profile?.skills
                  if (Array.isArray(userSkills) && userSkills.length > 0) {
                    setSearchQuery(userSkills[0])
                    loadJobs(0, userSkills[0], false)
                  } else {
                    router.push("/freelancer/profile")
                  }
                }}
                className="w-full h-10"
              >
                Match me
              </Button>
            </Card>
          </aside>

          {/* RIGHT: Job grid */}
          <section className="space-y-5 animate-fade-up delay-200">
            {/* Result header */}
            <div className="flex items-center justify-between">
              <p className="text-sm text-foreground">
                <span className="font-semibold">{initialTotalJobsCount}</span>
                <span className="text-muted-foreground"> projects found</span>
              </p>
              <div className="flex items-center gap-1 border border-border rounded-md p-0.5 bg-card">
                <button
                  onClick={() => setViewMode("grid")}
                  className={cn(
                    "h-7 w-7 flex items-center justify-center rounded-[5px] transition-colors",
                    viewMode === "grid"
                      ? "bg-paper text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  aria-label="Grid view"
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => setViewMode("list")}
                  className={cn(
                    "h-7 w-7 flex items-center justify-center rounded-[5px] transition-colors",
                    viewMode === "list"
                      ? "bg-paper text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  aria-label="List view"
                >
                  <List className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Active filters chips */}
            {(filters.jobType || filters.category || budgetRange !== "any" || location) && (
              <div className="flex items-center gap-2 flex-wrap">
                {filters.jobType && (
                  <Chip onRemove={() => setFilters({ ...filters, jobType: "" })}>
                    {filters.jobType}
                  </Chip>
                )}
                {filters.category && (
                  <Chip onRemove={() => setFilters({ ...filters, category: "" })}>
                    {filters.category}
                  </Chip>
                )}
                {location && (
                  <Chip onRemove={() => setLocation("")}>{location}</Chip>
                )}
                {budgetRange !== "any" && (
                  <Chip onRemove={() => setBudgetRange("any")}>
                    {budgetRanges.find((b) => b.value === budgetRange)?.label}
                  </Chip>
                )}
              </div>
            )}

            {/* Job grid / list */}
            <div
              className={cn(
                "grid gap-4",
                viewMode === "grid"
                  ? "grid-cols-1 md:grid-cols-2 xl:grid-cols-3"
                  : "grid-cols-1"
              )}
            >
              {jobsLoading && jobs.length === 0 ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-64 bg-card rounded-xl border border-border animate-pulse"
                  />
                ))
              ) : jobs.length === 0 ? (
                <Card className="col-span-full py-20 text-center border-dashed border-2 bg-card">
                  <div className="h-14 w-14 bg-surface rounded-full flex items-center justify-center mx-auto mb-5">
                    <Briefcase className="h-7 w-7 text-muted-foreground/40" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground">No projects match</h3>
                  <p className="body-muted max-w-xs mx-auto mt-2">
                    Reset your filters, or check back tomorrow.
                  </p>
                  <Button variant="outline" className="mt-6 px-7" onClick={resetFilters}>
                    Reset filters
                  </Button>
                </Card>
              ) : (
                jobs.map((job) => (
                  <MarketplaceJobCard
                    key={job.id}
                    job={job}
                    onAction={handleJobAction}
                  />
                ))
              )}
            </div>

            {hasMoreJobs && jobs.length > 0 && (
              <div className="flex justify-center pt-3">
                <Button
                  variant="outline"
                  onClick={handleLoadMoreJobs}
                  disabled={jobsLoading}
                  className="px-10 h-11"
                >
                  {jobsLoading ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : null}
                  Load more
                </Button>
              </div>
            )}
          </section>
        </div>
      </main>

      {/* Filter Modal */}
      <Modal
        isOpen={showFilterModal}
        onClose={() => setShowFilterModal(false)}
        title="Refine Market"
        description="Verified high-impact opportunities selected for you."
        maxWidth="md"
      >
        <div className="space-y-6">
          <div className="space-y-2.5">
            <Label className="eyebrow">Contextual Keywords</Label>
            <Input 
              placeholder="Skills, companies, or titles..."
              value={filters.keywords}
              onChange={(e) => setFilters({...filters, keywords: e.target.value})}
            />
          </div>
          <div className="space-y-2.5">
            <Label className="eyebrow">Professional Field</Label>
            <Select value={filters.category} onValueChange={(v) => setFilters({...filters, category: v})}>
              <SelectTrigger className="bg-surface">
                <SelectValue placeholder="All Specializations" />
              </SelectTrigger>
              <SelectContent>
                {ALL_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-4 pt-6">
            <Button variant="ghost" className="flex-1" onClick={resetFilters}>Reset</Button>
            <Button className="flex-1" onClick={applyFilters}>Update Results</Button>
          </div>
        </div>
      </Modal>

      {/* Submit Proposal Sheet */}
      <Sheet open={showPlaceBidModal} onOpenChange={setShowPlaceBidModal}>
        <SheetContent className="sm:max-w-xl p-0">
          <div className="flex flex-col h-full">
            <SheetHeader className="p-10 border-b border-border">
              <SheetTitle className="text-2xl font-bold font-heading">Submit Proposal</SheetTitle>
              <SheetDescription>Explain why you're the best fit for this project.</SheetDescription>
            </SheetHeader>
            
            <div className="flex-1 overflow-y-auto p-10 space-y-10">
              {selectedJob && (
                <div className="p-8 bg-surface rounded-lg border border-border space-y-5">
                  <div className="flex items-center gap-3">
                    <StatBadge variant="success">Verified Listing</StatBadge>
                    <span className="text-muted-foreground text-xs font-bold">• {selectedJob.proposals} active bids</span>
                  </div>
                  <h4 className="font-bold font-heading text-foreground text-2xl leading-tight">{selectedJob.title}</h4>
                  <div className="flex gap-4 pt-3">
                    <div className="bg-card px-5 py-3 rounded-md border border-border flex items-center gap-2.5 shadow-sm">
                      <span className="text-primary font-black text-sm">₦</span> 
                      <span className="text-foreground font-bold text-sm">{selectedJob.budget.replace("₦", "")}</span>
                    </div>
                    <div className="bg-card px-5 py-3 rounded-md border border-border flex items-center gap-2.5 shadow-sm">
                      <CreditCard className="h-4 w-4 text-info" /> 
                      <span className="text-foreground font-bold text-sm">{selectedJob.credit_cost} CRD</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-10">
                <div className="space-y-4">
                  <Label className="eyebrow">Professional Pitch</Label>
                  <Textarea 
                    className="min-h-[250px] p-6" 
                    placeholder="Explain why your expertise is the perfect match for this project..."
                    value={bidData.proposal}
                    onChange={(e) => setBidData({...bidData, proposal: e.target.value})}
                  />
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <Label className="eyebrow">Execution Timeline</Label>
                    <Input 
                      placeholder="e.g. 10 Working Days"
                      value={bidData.timeline}
                      onChange={(e) => setBidData({...bidData, timeline: e.target.value})}
                    />
                  </div>
                  <div className="space-y-4">
                    <Label className="eyebrow">Project Fee (₦)</Label>
                    <Input 
                      placeholder="Final bid price"
                      value={bidData.budget}
                      onChange={(e) => setBidData({...bidData, budget: e.target.value})}
                      className="font-bold"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="p-10 border-t border-border bg-surface/50">
              <Button 
                size="lg"
                className="w-full h-16 text-lg"
                onClick={submitBid}
                disabled={isSubmittingBid || !bidData.proposal || !bidData.timeline || !bidData.budget}
              >
                {isSubmittingBid ? <Loader2 className="animate-spin mr-2" /> : <Send className="mr-2 h-5 w-5" />}
                Launch Proposal
              </Button>
              <p className="text-center text-[10px] font-bold text-muted-foreground mt-5 uppercase tracking-[0.25em]">Automated Escrow Protection Enabled</p>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Agency Details Modal */}
      <Modal
        isOpen={showAgencyModal}
        onClose={() => setShowAgencyModal(false)}
        maxWidth="2xl"
      >
        {selectedAgency && (
          <div className="space-y-10">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-8">
                <div className="relative">
                  <Avatar className="h-32 w-32 rounded-lg border-4 border-surface shadow-2xl">
                    <AvatarImage src={selectedAgency.logo} />
                    <AvatarFallback className="bg-slate-900 text-white text-5xl font-black">{selectedAgency.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div className="absolute -bottom-3 -right-3 h-10 w-10 bg-success rounded-full border-4 border-white flex items-center justify-center shadow-lg">
                    <CheckCircle className="h-5 w-5 text-white" />
                  </div>
                </div>
                <div className="space-y-2">
                  <h3 className="text-4xl font-bold font-heading text-foreground tracking-tighter">{selectedAgency.name}</h3>
                  <p className="text-muted-foreground font-bold text-xs flex items-center gap-2 uppercase tracking-[0.2em]">
                    <MapPin className="h-4 w-4 text-primary" /> {selectedAgency.location || 'Lagos, Nigeria'}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
              {[
                { label: "Founded", val: selectedAgency.founded },
                { label: "Total Jobs", val: selectedAgency.totalJobs },
                { label: "Team Size", val: selectedAgency.employees },
              ].map((s, i) => (
                <div key={i} className="bg-surface p-6 rounded-lg text-center space-y-2 border border-border shadow-inner">
                  <p className="eyebrow">{s.label}</p>
                  <p className="text-base font-bold text-foreground">{s.val}</p>
                </div>
              ))}
            </div>

            <div className="space-y-4">
              <Label className="eyebrow">Professional Dossier</Label>
              <p className="text-muted-foreground font-medium text-lg leading-relaxed">{selectedAgency.description}</p>
            </div>

            <div className="pt-10 border-t border-border flex justify-end gap-4">
              <Button variant="outline" size="lg" className="px-10" onClick={() => setShowAgencyModal(false)}>Close Dossier</Button>
              <Button size="lg" className="px-12">Message Agency</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
