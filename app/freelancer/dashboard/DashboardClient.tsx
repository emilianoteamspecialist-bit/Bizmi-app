"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import type React from "react"
import { Button } from "@/components/ui/button"
import { Reveal } from "@/components/reveal"
import {
  MapPin,
  Search,
  Send,
  Loader2,
  CheckCircle,
  ArrowUpRight,
  Eye,
  EyeOff,
  Bookmark,
  BadgeCheck,
  Briefcase,
  CreditCard,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { ALL_CATEGORIES, getSkillsForCategory, type Category } from "@/lib/categories"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { getJobs, toggleBookmark } from "@/app/actions/jobs"
import { submitProposal } from "@/app/actions/proposals"
import { getAvatarUrl } from "@/lib/avatar-url"
import { formatDate } from "@/lib/date"
import { Modal } from "@/components/shared/modal"
import { StatBadge } from "@/components/shared/stat-badge"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"

const JOBS_PER_PAGE = 9

export default function FreelancerDashboard({
  initialUser,
  initialProfile,
  initialCredits,
  initialBalance,
  initialJobs,
  initialTotalJobsCount,
  initialIsVerified,
}: {
  initialUser: any
  initialProfile: any
  initialCredits: number
  initialBalance: number
  initialJobs: any[]
  initialTotalJobsCount: number
  initialIsVerified: boolean
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
  const [totalBalance] = useState(initialBalance || 0)
  const [isBalanceVisible, setIsBalanceVisible] = useState(true)
  const [profile] = useState<any>(initialProfile)
  // NIN verification status is fetched server-side and passed in, so the
  // "apply" gate doesn't need a browser round-trip when the user clicks.
  const [isNINVerified] = useState<boolean>(!!initialIsVerified)

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
      dateFilter?: { fromDate: string; toDate: string },
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
          fromDate: dateFilter?.fromDate,
          toDate: dateFilter?.toDate,
          maxCredits: creditsFilter ? Number.parseInt(creditsFilter) : undefined,
          jobType: jobTypeFilter,
          categorySkills: categorySkills as unknown as string[],
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
                founded: job.agency_info.created_at ? new Date(job.agency_info.created_at).getFullYear().toString() : "—",
                employees: job.agency_info.company_size || "—",
                description: job.agency_info.bio || "No description provided.",
                memberSince: job.agency_info.created_at ? new Date(job.agency_info.created_at).getFullYear().toString() : "—",
                totalJobs: job.agency_info.total_jobs || 0,
              },
            })) || []

          // has_applied is now provided by getJobs (server-side), so the
          // transformed jobs already carry it — no extra browser query needed.
          setJobs((prevJobs) => (append ? [...prevJobs, ...transformedJobs] : transformedJobs))
          setHasMoreJobs(currentOffset + transformedJobs.length < (totalCount || 0))
          setJobsOffset(currentOffset + transformedJobs.length)
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

  const handleJobAction = async (job: any, action: "bookmark" | "view" | "apply") => {
    if (action === "view") {
      setSelectedAgency(job.agencyInfo)
      setShowAgencyModal(true)
    } else if (action === "apply") {
      if (!currentUser?.id) return

      try {
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
    loadJobs(0, filters.keywords, false, undefined, filters.credits, filters.category, filters.jobType)
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

  const greeting = useMemo(() => {
    const hour = new Date().getHours()
    if (hour < 12) return "Good morning"
    if (hour < 17) return "Good afternoon"
    return "Good evening"
  }, [])

  const firstName = profile?.full_name?.split(" ")[0] || "there"
  const openBriefs = jobs.length

  // ─── derived insights — all from real profile data ───
  const profileFields: { key: string; label: string }[] = [
    { key: "full_name", label: "display name" },
    { key: "bio", label: "a professional bio" },
    { key: "skills", label: "your skills" },
    { key: "location", label: "your location" },
    { key: "hourly_rate", label: "an hourly rate" },
    { key: "experience_level", label: "experience level" },
  ]
  const completedFields = profileFields.filter((f) => {
    const v = (profile as any)?.[f.key]
    return Array.isArray(v) ? v.length > 0 : !!v
  })
  const profileCompletion = Math.round((completedFields.length / profileFields.length) * 100)
  const missing = profileFields.filter((f) => !completedFields.find((c) => c.key === f.key))

  // Skill overlap between this job and the freelancer's listed skills — a real,
  // explainable signal (not an invented score).
  const calcMatch = (jobSkills?: string[]) => {
    if (!jobSkills?.length || !Array.isArray(profile?.skills) || profile.skills.length === 0) return null
    const lower = (profile.skills as string[]).map((s) => s.toLowerCase())
    const overlap = jobSkills.filter((s) => lower.includes(s.toLowerCase())).length
    return Math.round((overlap / jobSkills.length) * 100)
  }
  const isFresh = (createdAt: string) => (Date.now() - new Date(createdAt).getTime()) / 86400000 < 2
  const competitionLevel = (count: number): { label: string; tone: string } =>
    count < 5 ? { label: "low competition", tone: "text-success" }
    : count < 12 ? { label: "moderate", tone: "text-warning" }
    : { label: "crowded", tone: "text-muted-foreground" }

  if (loading) {
    return (
      <div className="min-h-screen bg-surface pb-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-pulse">
          <div className="space-y-2">
            <div className="h-3 w-24 bg-foreground/5 rounded" />
            <div className="h-7 w-64 bg-foreground/5 rounded" />
            <div className="h-3 w-80 bg-foreground/5 rounded" />
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 bg-card border border-border rounded-xl" />
            ))}
          </div>
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-card border border-border rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface pb-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8 space-y-8">

        {/* Toolbar header */}
        <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div className="space-y-1 min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{greeting}, {firstName}</p>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              {openBriefs > 0
                ? `${openBriefs} ${openBriefs === 1 ? "brief" : "briefs"} match your stack`
                : "Let's find your next brief"}
            </h1>
            <p className="text-sm text-muted-foreground">Find projects, file proposals, and track your standing.</p>
          </div>
          <Button
            onClick={() => router.push("/freelancer/marketplace")}
            className="h-10 px-4 rounded-lg gap-2 shrink-0 w-full sm:w-auto justify-center"
          >
            {openBriefs > 0 ? "Browse marketplace" : "Find projects"}
            <ArrowUpRight className="h-4 w-4" />
          </Button>
        </header>

        {/* Metric tiles */}
        <Reveal>
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <button
            onClick={() => router.push("/freelancer/profile")}
            className="text-left rounded-xl border border-border bg-card p-4 hover:border-foreground/20 transition-colors"
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">Profile</p>
              <BadgeCheck className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground tabular-nums">
              {profileCompletion}
              <span className="text-lg text-muted-foreground">%</span>
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {profileCompletion === 100 ? "Hire-ready" : `${missing.length} field${missing.length !== 1 ? "s" : ""} to go`}
            </p>
          </button>

          <button
            onClick={() => router.push("/freelancer/bizpal")}
            className="text-left rounded-xl border border-border bg-card p-4 hover:border-foreground/20 transition-colors"
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">Credits</p>
              <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground tabular-nums">{creditBalance}</p>
            <p className="mt-1 inline-flex items-center gap-1 text-xs text-primary">Top up <ArrowUpRight className="h-3 w-3" /></p>
          </button>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">Escrow</p>
              <button
                onClick={() => setIsBalanceVisible(!isBalanceVisible)}
                className="text-muted-foreground hover:text-foreground transition-colors"
                aria-label={isBalanceVisible ? "Hide balance" : "Show balance"}
              >
                {isBalanceVisible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground tabular-nums">
              {isBalanceVisible ? `₦${totalBalance.toLocaleString()}` : "₦••••"}
            </p>
            <button
              onClick={() => router.push("/freelancer/bizpal")}
              className="mt-1 inline-flex items-center gap-1 text-xs text-primary"
            >
              Withdraw <ArrowUpRight className="h-3 w-3" />
            </button>
          </div>

          <div className="rounded-xl border border-primary/30 bg-card p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">Open briefs</p>
              <Briefcase className="h-3.5 w-3.5 text-primary" />
            </div>
            <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground tabular-nums">{openBriefs}</p>
            <p className="mt-1 text-xs text-muted-foreground">Matched to you</p>
          </div>
        </section>

        </Reveal>

        {/* Matched briefs */}
        <Reveal delay={0.08}>
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-sm font-semibold text-foreground">
              Matched to your stack <span className="font-normal text-muted-foreground">· {jobs.length}</span>
            </h2>
            <div className="flex items-center gap-2 shrink-0">
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setShowFilterModal(true)}>
                <Search className="h-3.5 w-3.5" /> Refine
              </Button>
              <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => router.push("/freelancer/marketplace")}>
                View all <ArrowUpRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {jobsLoading && jobs.length === 0 ? (
            <div className="rounded-xl border border-border bg-card divide-y divide-border overflow-hidden">
              {[1, 2, 3].map((i) => (
                <div key={i} className="p-5 space-y-2 animate-pulse">
                  <div className="h-4 w-2/3 bg-foreground/5 rounded" />
                  <div className="h-3 w-1/2 bg-foreground/5 rounded" />
                </div>
              ))}
            </div>
          ) : jobs.length === 0 ? (
            <div className="rounded-xl border border-border bg-card py-16 px-6 text-center">
              <div className="mx-auto h-11 w-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <Briefcase className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-sm font-semibold text-foreground">No briefs match yet</h3>
              <p className="mt-1 text-sm text-muted-foreground max-w-sm mx-auto">
                Add a few more skills to your profile so we can match you to the right work.
              </p>
              <Button className="mt-5 gap-2" onClick={() => router.push("/freelancer/profile")}>
                Improve your profile <ArrowUpRight className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-card divide-y divide-border overflow-hidden">
              {jobs.slice(0, 6).map((job) => {
                const match = calcMatch(job.skills)
                const comp = competitionLevel(job.proposals ?? 0)
                const fresh = isFresh(job.created_at)
                return (
                  <div key={job.id} className="p-4 sm:p-5 transition-colors hover:bg-surface/60">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <h3 className="text-sm font-semibold text-foreground">{job.title}</h3>
                          {fresh && <span className="text-[11px] font-medium text-primary">Fresh</span>}
                          {job.has_applied && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-success/10 text-success">
                              <CheckCircle className="h-3 w-3" /> Applied
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Avatar className="h-4 w-4 rounded-sm">
                            <AvatarImage src={job.agencyInfo?.logo} className="object-cover" />
                            <AvatarFallback className="rounded-sm bg-foreground text-white text-[8px] font-semibold">
                              {job.agencyInfo?.name?.[0]?.toUpperCase() ?? "A"}
                            </AvatarFallback>
                          </Avatar>
                          <span className="truncate">{job.agencyInfo?.name}</span>
                        </div>
                        {job.description && (
                          <p className="text-sm text-muted-foreground line-clamp-1 max-w-2xl">{job.description}</p>
                        )}
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          <span className="font-medium text-foreground tabular-nums">{job.budget}</span>
                          <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{job.location || "Remote"}</span>
                          {match !== null && <span className="text-primary">{match}% match</span>}
                          <span className={comp.tone}>
                            {job.proposals ?? 0} {(job.proposals ?? 0) === 1 ? "bid" : "bids"} · {comp.label}
                          </span>
                        </div>
                        {!!job.skills?.length && (
                          <div className="flex flex-wrap gap-1.5 pt-0.5">
                            {job.skills.slice(0, 6).map((s: string) => (
                              <span key={s} className="px-2 py-0.5 rounded-md bg-surface-2 text-muted-foreground text-[11px]">{s}</span>
                            ))}
                            {job.skills.length > 6 && (
                              <span className="px-2 py-0.5 text-[11px] text-muted-foreground">+{job.skills.length - 6}</span>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <Button variant="ghost" size="sm" onClick={() => handleJobAction(job, "view")}>Agency</Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleJobAction(job, "bookmark")}
                          aria-label={job.isBookmarked ? "Saved" : "Save"}
                        >
                          <Bookmark className={`h-4 w-4 ${job.isBookmarked ? "fill-primary text-primary" : ""}`} />
                        </Button>
                        <Button size="sm" onClick={() => handleJobAction(job, "apply")} disabled={job.has_applied}>
                          {job.has_applied ? "Applied" : "Quick apply"}
                        </Button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        </Reveal>

        {/* Your standing */}
        <Reveal delay={0.16}>
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground">Your standing</h2>
          <div className="grid lg:grid-cols-3 gap-4">
            <div className="rounded-xl border border-border bg-card p-5 space-y-4">
              <p className="text-sm text-muted-foreground leading-relaxed">
                {profileCompletion === 100
                  ? "Your profile is complete — agencies see the full picture."
                  : `A complete profile gets seen first. You're ${profileCompletion}% there.`}
              </p>
              {isNINVerified ? (
                <p className="flex items-center gap-2 text-sm">
                  <BadgeCheck className="h-4 w-4 text-success" strokeWidth={2.5} />
                  <span className="text-foreground font-medium">Identity verified</span>
                  <span className="text-xs text-muted-foreground">· NIN</span>
                </p>
              ) : (
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => router.push("/freelancer/identity")}>
                  Verify your identity <ArrowUpRight className="h-3.5 w-3.5" />
                </Button>
              )}
              {Array.isArray(profile?.skills) && profile.skills.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  {profile.skills.slice(0, 6).map((s: string) => (
                    <span key={s} className="px-2 py-0.5 rounded-md bg-surface-2 text-muted-foreground text-[11px]">{s}</span>
                  ))}
                  {profile.hourly_rate && (
                    <span className="ml-1 text-xs text-muted-foreground tabular-nums">₦{Number(profile.hourly_rate).toLocaleString()}/hr</span>
                  )}
                </div>
              )}
            </div>

            <div className="lg:col-span-2">
              {missing.length > 0 ? (
                <div className="rounded-xl border border-border bg-card divide-y divide-border overflow-hidden">
                  {missing.map((field) => (
                    <button
                      key={field.key}
                      onClick={() => router.push("/freelancer/profile")}
                      className="w-full flex items-center justify-between gap-4 p-4 text-left transition-colors hover:bg-surface/60 group"
                    >
                      <span className="text-sm text-foreground">Add {field.label}</span>
                      <ArrowUpRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
                    </button>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-border bg-card py-12 px-6 text-center h-full flex flex-col items-center justify-center">
                  <div className="mx-auto h-11 w-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                    <Briefcase className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 text-sm font-semibold text-foreground">Profile complete</h3>
                  <p className="mt-1 text-sm text-muted-foreground">Agencies see the full picture.</p>
                </div>
              )}
            </div>
          </div>
        </section>
        </Reveal>
      </div>

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
              onChange={(e) => setFilters({ ...filters, keywords: e.target.value })}
            />
          </div>
          <div className="space-y-2.5">
            <Label className="eyebrow">Professional Field</Label>
            <Select value={filters.category} onValueChange={(v) => setFilters({ ...filters, category: v })}>
              <SelectTrigger className="bg-surface">
                <SelectValue placeholder="All Specializations" />
              </SelectTrigger>
              <SelectContent>
                {ALL_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
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
              <SheetDescription>Explain why you&rsquo;re the best fit for this project.</SheetDescription>
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
                    onChange={(e) => setBidData({ ...bidData, proposal: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <Label className="eyebrow">Execution Timeline</Label>
                    <Input
                      placeholder="e.g. 10 Working Days"
                      value={bidData.timeline}
                      onChange={(e) => setBidData({ ...bidData, timeline: e.target.value })}
                    />
                  </div>
                  <div className="space-y-4">
                    <Label className="eyebrow">Project Fee (₦)</Label>
                    <Input
                      placeholder="Final bid price"
                      value={bidData.budget}
                      onChange={(e) => setBidData({ ...bidData, budget: e.target.value })}
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
        srLabel="Agency details"
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
                    <MapPin className="h-4 w-4 text-primary" /> {selectedAgency.location || "Lagos, Nigeria"}
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
