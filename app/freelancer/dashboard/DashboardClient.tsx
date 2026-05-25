"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import type React from "react"
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
  ArrowUpRight,
  Eye,
  EyeOff,
  Sparkles,
  Bookmark,
  FileText,
  Wallet as WalletIcon,
  ChevronRight,
  Pencil,
  BadgeCheck,
  TrendingUp,
  Building2,
  Calendar,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { ALL_CATEGORIES, getSkillsForCategory, type Category } from "@/lib/categories"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { getJobs, toggleBookmark } from "@/app/actions/jobs"
import { submitProposal } from "@/app/actions/proposals"
import { getUserCredits, getProfile, getTotalBalance } from "@/app/actions/user"
import { getAvatarUrl } from "@/lib/avatar-url"
import { formatDate } from "@/lib/date"
import { JobCard } from "@/components/shared/job-card"
import { MarketplaceJobCard } from "@/components/shared/marketplace-job-card"
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
  const [totalBalance, setTotalBalance] = useState(initialBalance || 0)
  const [isBalanceVisible, setIsBalanceVisible] = useState(true)
  const [profile] = useState<any>(initialProfile)

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
          categorySkills: categorySkills as unknown as string[]
        })

        if (!error) {
          const transformedJobs =
            jobsData?.map((job: any) => ({
              ...job,
              budget: `₦ ${job.budget_min?.toLocaleString()} - ₦ ${job.budget_max?.toLocaleString()}`,
              postedDate: new Date(job.created_at).toLocaleDateString(),
              proposals: job.proposal_count || 0,
              rating: 4.8,
              isLiked: false,
              agencyInfo: {
                ...job.agency_info,
                name: job.agency_info.company_name || job.agency_info.full_name || "Unknown Agency",
                logo: getAvatarUrl(job.agency_info?.logo_path),
                rating: 4.8,
                reviews: 156,
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
      // Works whether the job is on the current page or further down in the list.
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

  const savedJobsCount = jobs.filter((job) => job.isBookmarked).length

  const greeting = useMemo(() => {
    const hour = new Date().getHours()
    if (hour < 12) return "Good morning"
    if (hour < 17) return "Good afternoon"
    return "Good evening"
  }, [])

  const firstName = profile?.full_name?.split(" ")[0] || "there"
  const newToday = jobs.length

  // ─── derived insights (used across hero, sidebar, and job cards) ───
  const profileFields: { key: string; label: string }[] = [
    { key: "full_name", label: "display name" },
    { key: "bio", label: "a professional bio" },
    { key: "skills", label: "your skills" },
    { key: "location", label: "your location" },
    { key: "hourly_rate", label: "an hourly rate" },
    { key: "experience_level", label: "experience level" },
  ]
  const completedFields = profileFields.filter(f => {
    const v = (profile as any)?.[f.key]
    return Array.isArray(v) ? v.length > 0 : !!v
  })
  const profileCompletion = Math.round((completedFields.length / profileFields.length) * 100)
  const missing = profileFields.filter(f => !completedFields.find(c => c.key === f.key))
  const matchScore = Math.min(99, Math.max(35, profileCompletion + (profile?.skills?.length ? Math.min(15, profile.skills.length * 2) : 0)))
  const aheadPercent = Math.min(95, Math.max(20, Math.round(profileCompletion * 0.85)))
  const calcMatch = (jobSkills?: string[]) => {
    if (!jobSkills?.length) return 55
    if (!Array.isArray(profile?.skills) || profile.skills.length === 0) return 30
    const lower = (profile.skills as string[]).map(s => s.toLowerCase())
    const overlap = jobSkills.filter(s => lower.includes(s.toLowerCase())).length
    return Math.max(35, Math.min(99, Math.round((overlap / jobSkills.length) * 70 + 30)))
  }
  const isFresh = (createdAt: string) => (Date.now() - new Date(createdAt).getTime()) / 86400000 < 2
  const competitionLevel = (count: number): { label: string; tone: string } =>
    count < 5 ? { label: "Low competition", tone: "text-success" }
    : count < 12 ? { label: "Moderate", tone: "text-warning" }
    : { label: "Crowded", tone: "text-muted-foreground" }

  if (loading) {
    return (
      <div className="min-h-screen bg-surface">
        <div className="editorial-shell py-8 space-y-6 animate-pulse">
          <div className="h-44 bg-card rounded-3xl shadow-[var(--shadow-soft)]" />
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-7">
            <div className="space-y-6">
              <div className="grid grid-cols-4 gap-3">
                <div className="col-span-2 h-28 bg-card rounded-2xl" />
                <div className="h-28 bg-card rounded-2xl" />
                <div className="h-28 bg-card rounded-2xl" />
              </div>
              <div className="h-52 bg-card rounded-2xl" />
              <div className="h-20 bg-card rounded-2xl" />
              <div className="h-20 bg-card rounded-2xl" />
            </div>
            <div className="space-y-4">
              <div className="h-72 bg-card rounded-2xl" />
              <div className="h-40 bg-card rounded-2xl" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface pb-20 selection:bg-primary/10 font-bricolage">

      <main className="editorial-shell py-8 space-y-7">

        {/* ════════════════════════ HERO ════════════════════════ */}
        <section className="relative rounded-3xl overflow-hidden shadow-[var(--shadow-grounded)] animate-fade-up">
          {/* warm gradient backdrop */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary-soft via-paper to-card" aria-hidden />
          <div className="absolute inset-0 grain pointer-events-none opacity-60" aria-hidden />
          <div className="absolute -top-24 -right-24 w-80 h-80 bg-primary/15 rounded-full blur-3xl" aria-hidden />
          <div className="absolute -bottom-32 -left-16 w-64 h-64 bg-foreground/5 rounded-full blur-3xl" aria-hidden />

          <div className="relative grid grid-cols-1 lg:grid-cols-12 gap-7 p-6 sm:p-8 lg:p-10">
            {/* Left: insight + CTAs */}
            <div className="lg:col-span-7 xl:col-span-8 space-y-5">
              <p className="eyebrow">{greeting} · {formatDate(new Date())}</p>
              <h1 className="text-3xl sm:text-4xl lg:text-[44px] font-semibold text-foreground leading-[1.05] tracking-tight">
                {newToday > 0 ? (
                  <>
                    <span className="font-display italic text-primary numeric">{newToday}</span>{" "}
                    <span className="font-display italic">{newToday === 1 ? "brief" : "briefs"}</span> match your stack today, {firstName}.
                  </>
                ) : (
                  <>Welcome back, <span className="font-display italic">{firstName}</span>. Let's get you hired.</>
                )}
              </h1>
              <p className="text-base text-muted-foreground max-w-xl leading-relaxed">
                You're ahead of{" "}
                <span className="font-semibold text-foreground numeric">{aheadPercent}%</span>{" "}
                of freelancers in your category. Submit a proposal before noon — that's when reply rates peak.
              </p>
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Button
                  onClick={() => router.push("/freelancer/marketplace")}
                  size="lg"
                  className="h-12 px-6 rounded-xl text-sm font-semibold shadow-md hover:shadow-lg transition-shadow"
                >
                  <Send className="h-4 w-4 mr-2" />
                  {newToday > 0 ? "Submit a proposal" : "Find projects"}
                </Button>
                <button
                  onClick={() => router.push("/freelancer/marketplace")}
                  className="h-12 px-5 rounded-xl text-sm font-medium text-foreground hover:bg-surface-2 transition-colors inline-flex items-center gap-1.5"
                >
                  Browse all matches <ArrowUpRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Right: hero metric — dark ink panel with match score */}
            <button
              onClick={() => router.push("/freelancer/profile")}
              className="lg:col-span-5 xl:col-span-4 group relative rounded-2xl text-left overflow-hidden bg-foreground text-white p-6 shadow-xl hover:shadow-2xl transition-all hover:-translate-y-0.5"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-primary/35 via-transparent to-transparent" aria-hidden />
              <div className="absolute -top-10 -right-10 w-32 h-32 bg-primary/30 rounded-full blur-2xl" aria-hidden />
              <div className="relative space-y-5">
                <div className="flex items-center justify-between">
                  <p className="eyebrow-light">Match Score</p>
                  <Sparkles className="h-4 w-4 text-primary" />
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="font-display text-[80px] numeric leading-none">{matchScore}</span>
                  <span className="text-white/55 text-2xl font-light">/100</span>
                </div>
                <div className="space-y-2">
                  <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-primary to-primary/70 rounded-full transition-all duration-700"
                      style={{ width: `${matchScore}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-white/70 flex items-center gap-1.5">
                    <TrendingUp className="h-3 w-3 text-success" />
                    {missing.length === 0
                      ? <span>You're hire-ready · keep applying</span>
                      : <span><span className="text-white font-semibold">{missing.length}</span> profile boost{missing.length !== 1 ? "s" : ""} available →</span>}
                  </p>
                </div>
              </div>
            </button>
          </div>
        </section>

        {/* ════════════ TWO-COLUMN BODY ════════════ */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-7 items-start">

          {/* ─── MAIN COLUMN ─── */}
          <div className="space-y-8 animate-fade-up delay-100 min-w-0">

            {/* PERFORMANCE — asymmetric 2+1+1 */}
            <section className="space-y-3.5">
              <div className="flex items-end justify-between">
                <div className="space-y-0.5">
                  <p className="eyebrow">Performance · last 30 days</p>
                  <h2 className="text-lg font-semibold text-foreground">Where you stand.</h2>
                </div>
                <button
                  onClick={() => router.push("/freelancer/proposals")}
                  className="text-sm font-medium text-primary hover:text-primary-hover transition-colors inline-flex items-center gap-1"
                >
                  Open activity <ArrowUpRight className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {/* Primary metric — spans 2 cols, larger numeral, mini chart */}
                <button
                  onClick={() => router.push("/freelancer/proposals")}
                  className="col-span-2 group relative overflow-hidden rounded-2xl bg-card p-5 text-left shadow-[var(--shadow-soft)] hover:shadow-[var(--shadow-grounded)] transition-shadow"
                >
                  <div className="absolute -bottom-10 -right-10 w-48 h-48 bg-primary/5 rounded-full blur-2xl" aria-hidden />
                  <div className="relative flex items-start justify-between gap-4">
                    <div className="space-y-3 min-w-0">
                      <p className="eyebrow">Proposals sent</p>
                      <div className="flex items-baseline gap-2">
                        <span className="text-4xl font-semibold text-foreground numeric leading-none">0</span>
                        <span className="text-xs text-muted-foreground font-medium">this month</span>
                      </div>
                      <p className="caption">
                        Start your streak — top freelancers send <span className="text-foreground font-semibold">8+</span> proposals/wk.
                      </p>
                    </div>
                    {/* mini bar visual */}
                    <div className="flex items-end gap-1 h-12 shrink-0 pt-2">
                      {[20, 35, 25, 50, 30, 60, 45].map((h, i) => (
                        <span
                          key={i}
                          className="w-1.5 bg-primary/25 rounded-full group-hover:bg-primary/55 transition-colors duration-300"
                          style={{ height: `${h}%`, transitionDelay: `${i * 30}ms` }}
                        />
                      ))}
                    </div>
                  </div>
                </button>

                {/* Supporting: matches today */}
                <button
                  onClick={() => router.push("/freelancer/marketplace")}
                  className="rounded-2xl bg-card p-5 text-left shadow-[var(--shadow-soft)] hover:shadow-[var(--shadow-grounded)] transition-shadow space-y-3 group"
                >
                  <div className="flex items-center justify-between">
                    <p className="eyebrow">Smart matches</p>
                    <Sparkles className="h-3.5 w-3.5 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-2xl font-semibold text-foreground numeric leading-none">{newToday}</span>
                    {newToday > 0 && (
                      <span className="text-[10px] text-success font-semibold inline-flex items-center gap-0.5">
                        <TrendingUp className="h-2.5 w-2.5" /> fresh
                      </span>
                    )}
                  </div>
                  <p className="caption">{newToday > 0 ? "ready to apply" : "none today"}</p>
                </button>

                {/* Supporting: saved */}
                <button
                  onClick={() => router.push("/freelancer/saved-jobs")}
                  className="rounded-2xl bg-card p-5 text-left shadow-[var(--shadow-soft)] hover:shadow-[var(--shadow-grounded)] transition-shadow space-y-3"
                >
                  <p className="eyebrow">Saved</p>
                  <span className="text-2xl font-semibold text-foreground numeric leading-none block">{savedJobsCount}</span>
                  <p className="caption">{savedJobsCount === 1 ? "in your shortlist" : "in your shortlist"}</p>
                </button>
              </div>
            </section>

            {/* RECOMMENDED — 1 featured + dense list */}
            <section className="space-y-3.5">
              <div className="flex items-end justify-between">
                <div className="space-y-0.5">
                  <p className="eyebrow">Curated · matched to your skills</p>
                  <h2 className="text-lg font-semibold text-foreground">Today's opportunities.</h2>
                </div>
                <button
                  onClick={() => router.push("/freelancer/marketplace")}
                  className="text-sm font-medium text-primary hover:text-primary-hover transition-colors inline-flex items-center gap-1"
                >
                  View all <ArrowUpRight className="h-3.5 w-3.5" />
                </button>
              </div>

              {jobsLoading && jobs.length === 0 ? (
                <div className="space-y-3">
                  <div className="h-52 rounded-2xl bg-card shadow-[var(--shadow-soft)] animate-pulse" />
                  <div className="h-20 rounded-2xl bg-card shadow-[var(--shadow-soft)] animate-pulse" />
                  <div className="h-20 rounded-2xl bg-card shadow-[var(--shadow-soft)] animate-pulse" />
                </div>
              ) : jobs.length === 0 ? (
                <div className="rounded-2xl bg-card shadow-[var(--shadow-soft)] py-14 px-6 text-center">
                  <div className="h-12 w-12 mx-auto rounded-2xl bg-primary-soft flex items-center justify-center text-primary">
                    <Briefcase className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 text-sm font-semibold text-foreground">No matches in the pipeline yet</h3>
                  <p className="caption max-w-sm mx-auto mt-1.5">
                    Add a few more skills to your profile — that's how Smart Match finds you the right work.
                  </p>
                  <Button size="sm" className="mt-5" onClick={() => router.push("/freelancer/profile")}>
                    Improve profile <ArrowUpRight className="h-3.5 w-3.5 ml-1" />
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* ─── Featured (job 0) ─── */}
                  {(() => {
                    const job = jobs[0]
                    const match = calcMatch(job.skills)
                    const fresh = isFresh(job.created_at)
                    const comp = competitionLevel(job.proposals ?? 0)
                    return (
                      <article className="group relative rounded-2xl bg-card shadow-[var(--shadow-grounded)] overflow-hidden hover:-translate-y-0.5 transition-transform">
                        {/* primary accent rail */}
                        <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-primary via-primary/80 to-transparent" aria-hidden />
                        <div className="p-6 lg:p-7 space-y-5">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="flex items-start gap-3.5 min-w-0">
                              <Avatar className="h-12 w-12 rounded-xl border border-border shrink-0">
                                <AvatarImage src={job.agencyInfo?.logo} className="object-cover" />
                                <AvatarFallback className="rounded-xl bg-foreground text-white font-semibold">
                                  {job.agencyInfo?.name?.[0]?.toUpperCase() ?? "A"}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                  <span className="truncate">{job.agencyInfo?.name}</span>
                                  {job.agencyInfo?.rating && (
                                    <>
                                      <span className="text-border">·</span>
                                      <span className="numeric">★ {job.agencyInfo.rating}</span>
                                    </>
                                  )}
                                </div>
                                <h3 className="text-lg font-semibold text-foreground leading-tight mt-0.5">{job.title}</h3>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {fresh && (
                                <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.18em] font-semibold text-primary bg-primary-soft px-2.5 py-1 rounded-full">
                                  <Sparkles className="h-3 w-3" /> Fresh
                                </span>
                              )}
                              <button
                                onClick={() => handleJobAction(job, "bookmark")}
                                className="h-9 w-9 rounded-full bg-surface-2 hover:bg-primary-soft text-muted-foreground hover:text-primary transition-colors flex items-center justify-center"
                                aria-label="Save"
                              >
                                <Bookmark className={`h-4 w-4 ${job.isBookmarked ? "fill-primary text-primary" : ""}`} />
                              </button>
                            </div>
                          </div>

                          {/* Stats row */}
                          <div className="grid grid-cols-3 gap-4 py-3.5 border-y border-border">
                            <div>
                              <p className="eyebrow mb-1.5">Budget</p>
                              <p className="text-sm font-semibold text-foreground numeric truncate">{job.budget}</p>
                            </div>
                            <div>
                              <p className="eyebrow mb-1.5">Match</p>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold text-foreground numeric">{match}%</span>
                                <div className="flex-1 h-1 bg-surface-2 rounded-full overflow-hidden max-w-[64px]">
                                  <div className="h-full bg-primary rounded-full transition-all duration-700" style={{ width: `${match}%` }} />
                                </div>
                              </div>
                            </div>
                            <div>
                              <p className="eyebrow mb-1.5">Competition</p>
                              <p className={`text-sm font-semibold ${comp.tone}`}>
                                <span className="numeric">{job.proposals ?? 0}</span>
                                <span className="text-muted-foreground font-normal text-xs"> · {comp.label.toLowerCase()}</span>
                              </p>
                            </div>
                          </div>

                          {/* Skills with match highlighting */}
                          {!!job.skills?.length && (
                            <div className="flex flex-wrap gap-1.5">
                              {job.skills.slice(0, 6).map((s: string) => {
                                const matching = Array.isArray(profile?.skills) && profile.skills.some((u: string) => u.toLowerCase() === s.toLowerCase())
                                return (
                                  <span
                                    key={s}
                                    className={`px-2.5 py-1 text-[11px] font-medium rounded-md ${matching ? "bg-primary-soft text-primary" : "bg-surface-2 text-muted-foreground"}`}
                                  >
                                    {matching && "✓ "}{s}
                                  </span>
                                )
                              })}
                              {job.skills.length > 6 && (
                                <span className="px-2.5 py-1 text-[11px] text-muted-foreground italic">+{job.skills.length - 6}</span>
                              )}
                            </div>
                          )}

                          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                            <div className="flex items-center gap-2.5 text-xs text-muted-foreground min-w-0">
                              <span className="inline-flex items-center gap-1 truncate"><MapPin className="h-3 w-3 shrink-0" />{job.location || "Remote"}</span>
                              <span className="text-border">·</span>
                              <span className="truncate">Posted {formatDate(job.created_at)}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button variant="outline" size="sm" onClick={() => handleJobAction(job, "view")}>Details</Button>
                              <Button
                                size="sm"
                                onClick={() => handleJobAction(job, "apply")}
                                disabled={job.has_applied}
                                className="shadow-md hover:shadow-lg transition-shadow"
                              >
                                {job.has_applied ? "Applied ✓" : (<>Quick apply <ArrowUpRight className="h-3.5 w-3.5 ml-1" /></>)}
                              </Button>
                            </div>
                          </div>
                        </div>
                      </article>
                    )
                  })()}

                  {/* ─── Dense list (jobs 1-4) ─── */}
                  {jobs.slice(1, 5).map((job) => {
                    const match = calcMatch(job.skills)
                    const comp = competitionLevel(job.proposals ?? 0)
                    return (
                      <article
                        key={job.id}
                        className="group flex items-center gap-3.5 rounded-2xl bg-card px-4 py-3.5 shadow-[var(--shadow-soft)] hover:shadow-[var(--shadow-grounded)] transition-shadow"
                      >
                        <Avatar className="h-10 w-10 rounded-xl border border-border shrink-0">
                          <AvatarImage src={job.agencyInfo?.logo} className="object-cover" />
                          <AvatarFallback className="rounded-xl bg-foreground/90 text-white text-sm font-semibold">
                            {job.agencyInfo?.name?.[0]?.toUpperCase() ?? "A"}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0 space-y-0.5">
                          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                            <span className="truncate">{job.agencyInfo?.name}</span>
                            <span className="text-border">·</span>
                            <span className={comp.tone}>{job.proposals ?? 0} bids</span>
                          </div>
                          <h4 className="text-sm font-semibold text-foreground truncate">{job.title}</h4>
                        </div>
                        <div className="hidden md:flex flex-col items-end gap-0.5 shrink-0">
                          <p className="text-sm font-semibold text-foreground numeric whitespace-nowrap">{job.budget}</p>
                          <p className="text-[11px]">
                            <span className="text-primary font-medium numeric">{match}%</span>
                            <span className="text-muted-foreground"> match</span>
                          </p>
                        </div>
                        <button
                          onClick={() => handleJobAction(job, "apply")}
                          disabled={job.has_applied}
                          className="h-9 w-9 rounded-full bg-primary-soft text-primary hover:bg-primary hover:text-white transition-colors flex items-center justify-center shrink-0 disabled:opacity-40 disabled:cursor-not-allowed group-hover:scale-105"
                          aria-label={job.has_applied ? "Applied" : "Apply"}
                        >
                          {job.has_applied ? <CheckCircle className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                        </button>
                      </article>
                    )
                  })}
                </div>
              )}
            </section>

            {/* WALLET — deprioritized dense strip */}
            <section className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-card p-4 shadow-[var(--shadow-soft)] flex items-center gap-3.5">
                <div className="h-11 w-11 rounded-xl bg-primary-soft text-primary flex items-center justify-center shrink-0">
                  <WalletIcon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="caption">Escrow</p>
                    <button onClick={() => setIsBalanceVisible(!isBalanceVisible)} className="text-muted-foreground hover:text-foreground transition-colors" aria-label={isBalanceVisible ? "Hide" : "Show"}>
                      {isBalanceVisible ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                    </button>
                  </div>
                  <p className="text-base font-semibold text-foreground numeric leading-tight">
                    {isBalanceVisible ? `₦${totalBalance.toLocaleString()}` : "₦••••"}
                  </p>
                  <button onClick={() => router.push("/freelancer/bizpal")} className="text-xs text-primary font-medium hover:underline mt-0.5 inline-flex items-center gap-0.5">
                    Withdraw <ArrowUpRight className="h-3 w-3" />
                  </button>
                </div>
              </div>
              <div className="rounded-2xl bg-card p-4 shadow-[var(--shadow-soft)] flex items-center gap-3.5">
                <div className="h-11 w-11 rounded-xl bg-foreground text-primary flex items-center justify-center shrink-0">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="caption">Bidding credits</p>
                  <p className="text-base font-semibold text-foreground numeric leading-tight">{creditBalance}</p>
                  <button onClick={() => router.push("/freelancer/bizpal")} className="text-xs text-primary font-medium hover:underline mt-0.5 inline-flex items-center gap-0.5">
                    Top up <ArrowUpRight className="h-3 w-3" />
                  </button>
                </div>
              </div>
            </section>
          </div>

          {/* ─── SIDEBAR — Profile Health ─── */}
          <aside className="space-y-4 lg:sticky lg:top-6 animate-fade-up delay-200">

            {/* Profile health */}
            <div className="rounded-2xl bg-card shadow-[var(--shadow-soft)] overflow-hidden">
              <div className="relative px-5 pt-5 pb-5">
                <div className="absolute -top-16 -right-16 w-44 h-44 bg-primary/10 rounded-full blur-3xl" aria-hidden />

                {/* identity row */}
                <div className="relative flex items-start gap-3.5">
                  <div className="relative shrink-0">
                    <Avatar className="h-14 w-14 rounded-2xl">
                      <AvatarImage src={profile?.logo} className="object-cover" />
                      <AvatarFallback className="rounded-2xl bg-foreground text-white text-lg font-semibold">
                        {firstName.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-success border-2 border-card flex items-center justify-center">
                      <BadgeCheck className="h-3 w-3 text-white" strokeWidth={3} />
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="text-sm font-semibold text-foreground truncate">
                          {profile?.full_name || firstName}
                        </h3>
                        <p className="text-xs text-muted-foreground truncate capitalize">
                          {profile?.experience_level || "Freelancer"}
                          {profile?.location ? ` · ${profile.location}` : ""}
                        </p>
                      </div>
                      <button
                        onClick={() => router.push("/freelancer/profile")}
                        className="h-7 w-7 rounded-full text-muted-foreground hover:bg-surface-2 hover:text-foreground transition-colors flex items-center justify-center shrink-0"
                        aria-label="Edit profile"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                    </div>
                    <span className="inline-flex items-center gap-1.5 mt-2 px-2 py-0.5 bg-success/10 text-success text-[10px] font-semibold rounded-full">
                      <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
                      Available
                    </span>
                  </div>
                </div>

                {/* Completion ring */}
                <div className="relative mt-5 flex items-center gap-4">
                  <div className="relative h-16 w-16 shrink-0">
                    <svg viewBox="0 0 36 36" className="h-16 w-16 -rotate-90">
                      <circle cx="18" cy="18" r="14" fill="none" stroke="currentColor" strokeWidth="3" className="text-surface-2" />
                      <circle
                        cx="18"
                        cy="18"
                        r="14"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeDasharray={`${(profileCompletion / 100) * 88} 88`}
                        className="text-primary transition-all duration-700"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-sm font-semibold text-foreground numeric">{profileCompletion}%</span>
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-foreground">Profile health</p>
                    <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">
                      {profileCompletion === 100
                        ? "Looking sharp — you're fully hire-ready."
                        : `Complete ${missing.length} field${missing.length !== 1 ? "s" : ""} to lift your visibility.`}
                    </p>
                  </div>
                </div>

                {/* Missing-field checklist */}
                {missing.length > 0 && (
                  <ul className="relative mt-4 space-y-0.5">
                    {missing.slice(0, 3).map(field => (
                      <li key={field.key}>
                        <button
                          onClick={() => router.push("/freelancer/profile")}
                          className="w-full flex items-center justify-between gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors py-1.5 px-2 -mx-2 rounded-md hover:bg-surface-2 group/item"
                        >
                          <span className="flex items-center gap-2 min-w-0">
                            <span className="h-1.5 w-1.5 rounded-full bg-primary/60 shrink-0" />
                            <span className="truncate">Add {field.label}</span>
                          </span>
                          <ArrowUpRight className="h-3 w-3 text-muted-foreground/50 group-hover/item:text-primary group-hover/item:translate-x-0.5 transition-all shrink-0" />
                        </button>
                      </li>
                    ))}
                    {missing.length > 3 && (
                      <li className="text-[10px] text-muted-foreground italic pl-4 pt-1">
                        +{missing.length - 3} more in profile
                      </li>
                    )}
                  </ul>
                )}
              </div>

              {/* Verification strip */}
              <div className="px-5 py-3.5 border-t border-border bg-surface/40 flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <BadgeCheck className="h-4 w-4 text-success shrink-0" strokeWidth={2.5} />
                  <p className="text-xs font-medium text-foreground truncate">Identity verified</p>
                </div>
                <span className="text-[10px] uppercase tracking-[0.18em] text-success font-bold">NIN</span>
              </div>
            </div>

            {/* Top skills (compressed) */}
            {profile?.skills && Array.isArray(profile.skills) && profile.skills.length > 0 && (
              <div className="rounded-2xl bg-card shadow-[var(--shadow-soft)] p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="eyebrow">Your edge</p>
                  {profile?.hourly_rate && (
                    <p className="text-[11px] text-muted-foreground numeric">
                      ₦{Number(profile.hourly_rate).toLocaleString()}<span className="text-muted-foreground/60">/hr</span>
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {profile.skills.slice(0, 5).map((s: string) => (
                    <span key={s} className="px-2.5 py-1 bg-surface-2 text-foreground text-[11px] font-medium rounded-md">
                      {s}
                    </span>
                  ))}
                  {profile.skills.length > 5 && (
                    <span className="px-2.5 py-1 text-[11px] text-muted-foreground italic">
                      +{profile.skills.length - 5}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Smart Match CTA — dark, opportunity-driven */}
            <div className="relative rounded-2xl bg-foreground text-white p-5 shadow-[var(--shadow-grounded)] overflow-hidden">
              <div className="absolute -bottom-10 -right-10 w-36 h-36 bg-primary/25 rounded-full blur-3xl" aria-hidden />
              <div className="absolute inset-0 grain pointer-events-none opacity-30" aria-hidden />
              <div className="relative space-y-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <p className="text-sm font-semibold">Smart Match</p>
                </div>
                <p className="text-xs text-white/70 leading-relaxed">
                  Pull briefs that fit{" "}
                  {profile?.skills?.[0]
                    ? <>your top skill: <span className="text-primary font-semibold">{profile.skills[0]}</span>.</>
                    : <span>your strongest specialty.</span>}
                </p>
                <button
                  onClick={() => {
                    const userSkills = profile?.skills
                    if (Array.isArray(userSkills) && userSkills.length > 0) {
                      router.push(`/freelancer/marketplace?q=${encodeURIComponent(userSkills[0])}`)
                    } else {
                      router.push("/freelancer/profile")
                    }
                  }}
                  className="w-full mt-1 h-10 rounded-lg bg-primary hover:bg-primary-hover text-white text-sm font-semibold flex items-center justify-center gap-1.5 transition-colors group"
                >
                  Match me <ArrowUpRight className="h-4 w-4 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 transition-transform" />
                </button>
              </div>
            </div>
          </aside>
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
                { label: "Platform Rating", val: `${selectedAgency.rating} ★` },
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
