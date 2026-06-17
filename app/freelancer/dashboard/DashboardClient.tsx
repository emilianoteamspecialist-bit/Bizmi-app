"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import type React from "react"
import { Button } from "@/components/ui/button"
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
      <div className="min-h-screen bg-paper relative">
        <div className="grain absolute inset-0 pointer-events-none" aria-hidden />
        <div className="editorial-shell relative py-10 lg:py-14 space-y-10">
          <div className="hairline-b pb-3 flex justify-between">
            <div className="h-3 w-48 bg-foreground/5 animate-pulse" />
            <div className="h-3 w-40 bg-foreground/5 animate-pulse" />
          </div>
          <div className="space-y-6">
            <div className="h-3 w-32 bg-foreground/5 animate-pulse" />
            <div className="h-16 w-2/3 bg-foreground/5 animate-pulse" />
            <div className="h-4 w-1/2 bg-foreground/5 animate-pulse" />
          </div>
          <div className="hairline-strong" />
          <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-border">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="py-7 px-6 space-y-3">
                <div className="h-3 w-12 bg-foreground/5 animate-pulse" />
                <div className="h-12 w-16 bg-foreground/5 animate-pulse" />
              </div>
            ))}
          </div>
          <div className="hairline-strong" />
        </div>
      </div>
    )
  }

  const today = new Date().toLocaleDateString("en-NG", { weekday: "long", day: "numeric", month: "long", year: "numeric" })

  return (
    <div className="min-h-screen bg-paper relative pb-20 selection:bg-primary/15 selection:text-primary">
      <div className="grain absolute inset-0 pointer-events-none" aria-hidden />

      <main className="editorial-shell relative py-10 lg:py-14 space-y-14 lg:space-y-20">

        {/* ─────────────── MASTHEAD ─────────────── */}
        <header className="space-y-9 animate-fade-up">
          <div className="flex flex-wrap items-center justify-between gap-3 hairline-b pb-3">
            <p className="eyebrow">Bizimi · The Wire · {firstName}&rsquo;s desk</p>
            <p className="marginalia">{greeting} · {today}</p>
          </div>

          <div className="grid lg:grid-cols-12 gap-8 lg:gap-12 items-end">
            <div className="lg:col-span-8 space-y-5 animate-fade-up delay-100">
              <p className="eyebrow-primary">Today&rsquo;s brief</p>
              <h1 className="display-2xl">
                {openBriefs > 0 ? (
                  <>
                    <span className="italic text-primary numeric">{String(openBriefs).padStart(2, "0")}</span>{" "}
                    <span className="italic">{openBriefs === 1 ? "brief" : "briefs"}</span> match your stack, {firstName}.
                  </>
                ) : (
                  <>Welcome back, <span className="italic">{firstName}</span>. Let&rsquo;s find your next brief.</>
                )}
              </h1>
              <p className="lede">
                Proposals filed before noon get read first. Compose yours while the desk is warm.
              </p>
            </div>

            <div className="lg:col-span-4 space-y-3 lg:text-right animate-fade-up delay-200">
              <Button
                onClick={() => router.push("/freelancer/marketplace")}
                className="h-12 px-7 rounded-none bg-ink text-white font-medium hover:bg-ink/90 group"
              >
                {openBriefs > 0 ? "Browse the marketplace" : "Find projects"}
                <ArrowUpRight className="ml-2 h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </Button>
              <p className="marginalia">Filed from Lagos · for {profile?.full_name || firstName}</p>
            </div>
          </div>
        </header>

        {/* ─────────────── LEDGER STRIP (honest stats) ─────────────── */}
        <section className="animate-fade-up delay-300">
          <div className="hairline-strong" />
          <div className="grid grid-cols-2 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-border">
            <button onClick={() => router.push("/freelancer/profile")} className="text-left py-7 px-2 md:px-6 first:md:pl-0 group">
              <p className="eyebrow mb-2">Profile</p>
              <p className="font-display text-5xl md:text-6xl leading-none tracking-tight numeric text-ink">
                {profileCompletion}<span className="text-2xl text-muted-foreground">%</span>
              </p>
              <p className="marginalia mt-3">
                {profileCompletion === 100 ? "hire-ready" : `${missing.length} field${missing.length !== 1 ? "s" : ""} to go`}
              </p>
            </button>

            <button onClick={() => router.push("/freelancer/bizpal")} className="text-left py-7 px-2 md:px-6 group">
              <p className="eyebrow mb-2">Credits</p>
              <p className="font-display text-5xl md:text-6xl leading-none tracking-tight numeric text-ink">
                {String(creditBalance).padStart(2, "0")}
              </p>
              <p className="marginalia mt-3 text-primary inline-flex items-center gap-1">for bidding · top up <ArrowUpRight className="h-3 w-3" /></p>
            </button>

            <div className="py-7 px-2 md:px-6">
              <div className="flex items-center gap-2 mb-2">
                <p className="eyebrow">Escrow</p>
                <button
                  onClick={() => setIsBalanceVisible(!isBalanceVisible)}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={isBalanceVisible ? "Hide balance" : "Show balance"}
                >
                  {isBalanceVisible ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                </button>
              </div>
              <p className="font-display text-3xl md:text-4xl leading-none tracking-tight numeric text-ink">
                {isBalanceVisible ? `₦${totalBalance.toLocaleString()}` : "₦••••"}
              </p>
              <button onClick={() => router.push("/freelancer/bizpal")} className="marginalia mt-3 text-primary inline-flex items-center gap-1">
                withdraw <ArrowUpRight className="h-3 w-3" />
              </button>
            </div>

            <div className="py-7 px-2 md:px-6 last:md:pr-0">
              <p className="eyebrow-primary mb-2">Open briefs</p>
              <p className="font-display text-5xl md:text-6xl leading-none tracking-tight numeric text-ink">
                {String(openBriefs).padStart(2, "0")}
              </p>
              <p className="mt-3 inline-flex items-center text-[10px] uppercase tracking-[0.18em] text-primary font-medium">
                <span className="w-3 h-px bg-primary mr-2" /> matched to you
              </p>
            </div>
          </div>
          <div className="hairline-strong" />
        </section>

        {/* ─────────────── SECTION 01 · MATCHED BRIEFS ─────────────── */}
        <section className="space-y-8 animate-fade-up delay-400">
          <div className="flex items-baseline justify-between gap-4">
            <div className="space-y-1">
              <p className="eyebrow">Section · 01</p>
              <h2 className="display-md italic">Matched to your stack.</h2>
            </div>
            <div className="flex items-center gap-5">
              <button onClick={() => setShowFilterModal(true)} className="link-quiet hover:text-ink">
                Refine <Search className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => router.push("/freelancer/marketplace")} className="link-arrow">
                View all <ArrowUpRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {jobsLoading && jobs.length === 0 ? (
            <div className="space-y-px">
              {[1, 2, 3].map((i) => (
                <div key={i} className="py-8 hairline space-y-3">
                  <div className="h-6 w-2/3 bg-foreground/5 animate-pulse" />
                  <div className="h-3 w-1/2 bg-foreground/5 animate-pulse" />
                </div>
              ))}
            </div>
          ) : jobs.length === 0 ? (
            <div className="border border-border surface-paper px-8 py-20 lg:py-24 text-center space-y-5 relative overflow-hidden">
              <div className="absolute inset-0 grain pointer-events-none opacity-50" aria-hidden />
              <p className="eyebrow-primary relative">An empty desk</p>
              <h3 className="display-lg italic relative">No briefs match yet.</h3>
              <p className="lede mx-auto relative">
                Add a few more skills to your profile — that&rsquo;s how we match you to the right work.
              </p>
              <div className="pt-2 relative">
                <Button
                  onClick={() => router.push("/freelancer/profile")}
                  className="h-12 px-7 rounded-none bg-ink text-white font-medium hover:bg-ink/90 group"
                >
                  Improve your profile
                  <ArrowUpRight className="ml-2 h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                </Button>
              </div>
            </div>
          ) : (
            <ol className="hairline-b">
              {jobs.slice(0, 6).map((job, idx) => {
                const match = calcMatch(job.skills)
                const comp = competitionLevel(job.proposals ?? 0)
                const fresh = isFresh(job.created_at)
                return (
                  <li
                    key={job.id}
                    className="group relative grid grid-cols-12 gap-4 md:gap-8 py-8 hairline transition-colors duration-300 hover:bg-primary-soft/40"
                  >
                    <span
                      className="absolute left-0 top-0 bottom-0 w-[2px] bg-primary scale-y-0 group-hover:scale-y-100 origin-top transition-transform duration-300"
                      aria-hidden
                    />

                    {/* numeral */}
                    <div className="col-span-2 md:col-span-1 pl-2 md:pl-3">
                      <p className="font-display text-3xl md:text-4xl leading-none text-muted-foreground/40 numeric group-hover:text-primary/70 transition-colors">
                        {String(idx + 1).padStart(2, "0")}
                      </p>
                    </div>

                    {/* main */}
                    <div className="col-span-10 md:col-span-7 space-y-3">
                      <div className="flex flex-wrap items-baseline gap-3">
                        <h3 className="display-sm">{job.title}</h3>
                        {fresh && (
                          <span className="text-[10px] uppercase tracking-[0.22em] font-medium text-primary">· fresh</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Avatar className="h-5 w-5 rounded-sm border border-border">
                          <AvatarImage src={job.agencyInfo?.logo} className="object-cover" />
                          <AvatarFallback className="rounded-sm bg-ink text-white text-[9px] font-semibold">
                            {job.agencyInfo?.name?.[0]?.toUpperCase() ?? "A"}
                          </AvatarFallback>
                        </Avatar>
                        <span className="truncate">{job.agencyInfo?.name}</span>
                      </div>
                      {job.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2 max-w-[60ch] leading-relaxed">
                          {job.description}
                        </p>
                      )}
                      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] uppercase tracking-[0.18em] font-medium text-muted-foreground numeric">
                        <span>{job.budget}</span>
                        <span className="text-border">/</span>
                        <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{job.location || "Remote"}</span>
                        {match !== null && (
                          <>
                            <span className="text-border">/</span>
                            <span className="text-primary">{match}% skill match</span>
                          </>
                        )}
                        <span className="text-border">/</span>
                        <span className={comp.tone}>{job.proposals ?? 0} {(job.proposals ?? 0) === 1 ? "bid" : "bids"} · {comp.label}</span>
                      </p>
                      {!!job.skills?.length && (
                        <p className="text-xs italic text-muted-foreground/80 font-display">
                          {job.skills.slice(0, 6).join("  ·  ")}
                          {job.skills.length > 6 && `  ·  +${job.skills.length - 6}`}
                        </p>
                      )}
                    </div>

                    {/* actions */}
                    <div className="col-span-12 md:col-span-4 flex flex-row md:flex-col flex-wrap md:flex-nowrap md:items-end gap-x-5 gap-y-2 md:gap-y-2.5 pt-2 md:pt-1">
                      <button onClick={() => handleJobAction(job, "view")} className="link-quiet hover:text-ink">
                        Agency <ArrowUpRight className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => handleJobAction(job, "bookmark")} className="link-quiet hover:text-ink">
                        {job.isBookmarked ? "Saved" : "Save"}
                        <Bookmark className={`h-3.5 w-3.5 ${job.isBookmarked ? "fill-primary text-primary" : ""}`} />
                      </button>
                      <button
                        onClick={() => handleJobAction(job, "apply")}
                        disabled={job.has_applied}
                        className="link-arrow text-primary disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {job.has_applied ? (
                          <>Applied <CheckCircle className="h-3.5 w-3.5" /></>
                        ) : (
                          <>Quick apply <ArrowUpRight className="h-3.5 w-3.5" /></>
                        )}
                      </button>
                    </div>
                  </li>
                )
              })}
            </ol>
          )}
        </section>

        {/* ─────────────── SECTION 02 · YOUR STANDING ─────────────── */}
        <section className="space-y-8 animate-fade-up delay-500">
          <div className="hairline-strong" />
          <div className="grid lg:grid-cols-12 gap-8 lg:gap-12 pt-2">
            <div className="lg:col-span-5 space-y-4">
              <p className="eyebrow">Section · 02</p>
              <h2 className="display-md italic">Your standing.</h2>
              <p className="text-sm text-muted-foreground leading-relaxed max-w-[42ch]">
                {profileCompletion === 100
                  ? "Your profile is complete — agencies see the full picture."
                  : `A complete profile gets seen first. You're ${profileCompletion}% there.`}
              </p>
              <div className="pt-1">
                {isNINVerified ? (
                  <p className="flex items-center gap-2 text-sm">
                    <BadgeCheck className="h-4 w-4 text-success" strokeWidth={2.5} />
                    <span className="text-foreground font-medium">Identity verified</span>
                    <span className="marginalia">· NIN</span>
                  </p>
                ) : (
                  <button onClick={() => router.push("/freelancer/identity")} className="link-arrow text-primary">
                    Verify your identity to bid <ArrowUpRight className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              {Array.isArray(profile?.skills) && profile.skills.length > 0 && (
                <div className="pt-4 flex flex-wrap items-center gap-2">
                  <span className="eyebrow mr-1">Your edge</span>
                  {profile.skills.slice(0, 6).map((s: string) => (
                    <span key={s} className="px-2.5 py-1 bg-surface-2 text-foreground text-[11px] font-medium border border-border">
                      {s}
                    </span>
                  ))}
                  {profile.hourly_rate && (
                    <span className="marginalia ml-1 numeric">₦{Number(profile.hourly_rate).toLocaleString()}/hr</span>
                  )}
                </div>
              )}
            </div>

            <div className="lg:col-span-7">
              {missing.length > 0 ? (
                <ol className="hairline-b">
                  {missing.map((field, i) => (
                    <li key={field.key}>
                      <button
                        onClick={() => router.push("/freelancer/profile")}
                        className="w-full flex items-center justify-between gap-4 py-4 hairline group text-left transition-colors hover:bg-primary-soft/40"
                      >
                        <span className="flex items-center gap-3 min-w-0">
                          <span className="font-display text-xl text-muted-foreground/40 numeric">{String(i + 1).padStart(2, "0")}</span>
                          <span className="text-sm text-foreground">Add {field.label}</span>
                        </span>
                        <ArrowUpRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
                      </button>
                    </li>
                  ))}
                </ol>
              ) : (
                <div className="h-full border border-border surface-paper px-8 py-12 flex flex-col items-center justify-center text-center space-y-3">
                  <Briefcase className="h-6 w-6 text-primary" />
                  <p className="eyebrow-primary">All set</p>
                  <h3 className="display-sm italic">Profile complete.</h3>
                </div>
              )}
            </div>
          </div>
          <div className="hairline-strong" />
        </section>

        {/* colophon */}
        <footer className="pt-6 hairline flex flex-wrap items-center justify-between gap-2">
          <p className="marginalia">Bizimi Trade Sheet · Freelancer Edition</p>
          <p className="marginalia">Set in Instrument Serif &amp; Inter · Filed in Lagos</p>
        </footer>
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
