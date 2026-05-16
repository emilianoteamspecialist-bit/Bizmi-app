"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
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
    if (!currentUser || !selectedJob) return
    setIsSubmittingBid(true)
    try {
      const { data: existingProposal } = await supabase.from("proposals").select("id").eq("job_id", selectedJob.id).eq("freelancer_id", currentUser.id).single()
      if (existingProposal) {
        alert("You have already submitted a proposal for this job!")
        setIsSubmittingBid(false)
        return
      }

      const { error: proposalError } = await supabase.from("proposals").insert([{
        job_id: selectedJob.id,
        freelancer_id: currentUser.id,
        proposal_text: bidData.proposal,
        timeline: bidData.timeline,
        budget: bidData.budget,
        status: "pending",
      }])

      if (proposalError) throw proposalError

      await supabase.from("purchase_credits").insert([{
        freelancer_id: currentUser.id,
        amount: selectedJob.credit_cost * 50,
        credits_amount: -selectedJob.credit_cost,
        status: "completed",
        paystack_reference: `job_bid_${selectedJob.id}_${currentUser.id}_${Date.now()}`,
      }])

      const newCreditBalance = Math.max(0, creditBalance - selectedJob.credit_cost)
      setCreditBalance(newCreditBalance)
      alert(`Proposal submitted! ${selectedJob.credit_cost} credits deducted.`)
      setShowPlaceBidModal(false)
      setBidData({ proposal: "", timeline: "", budget: "" })
      loadJobs(0, searchQuery, false)
    } catch (error) {
      console.error(error)
      alert("Error submitting proposal.")
    } finally {
      setIsSubmittingBid(false)
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

  if (loading) {
    return (
      <div className="min-h-screen bg-surface">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8 animate-pulse">
          <div className="h-32 bg-card rounded-lg border border-border" />
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-8 h-96 bg-card rounded-lg border border-border" />
            <div className="lg:col-span-4 h-96 bg-card rounded-lg border border-border" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface pb-20 selection:bg-primary/10 font-bricolage">

      <main className="editorial-shell py-8">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6 items-start">
          {/* MAIN COLUMN */}
          <div className="space-y-8 animate-fade-up">
            {/* Greeting */}
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground font-medium">
                {greeting} · {formatDate(new Date())}
              </p>
              <h1 className="text-2xl sm:text-[26px] font-semibold text-foreground leading-tight">
                Good {greeting.toLowerCase().includes("morning") ? "morning" : greeting.toLowerCase().includes("afternoon") ? "afternoon" : "evening"}, {firstName}
              </h1>
            </div>

            {/* 2x2 stat tiles */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                {
                  icon: TrendingUp,
                  value: newToday,
                  label: "Matched today",
                  href: "/freelancer/marketplace",
                },
                {
                  icon: Send,
                  value: 0,
                  label: "Applications sent",
                  href: "/freelancer/proposals",
                },
                {
                  icon: CheckCircle,
                  value: savedJobsCount,
                  label: "Saved jobs",
                  href: "/freelancer/saved-jobs",
                },
                {
                  icon: Calendar,
                  value: 0,
                  label: "Active projects",
                  href: "/freelancer/funded-jobs",
                },
              ].map((stat, i) => (
                <button
                  key={i}
                  onClick={() => router.push(stat.href)}
                  className="flex items-center gap-4 px-5 py-4 bg-card rounded-2xl shadow-[var(--shadow-soft)] hover:shadow-[var(--shadow-grounded)] transition-shadow text-left group"
                >
                  <div className="h-11 w-11 rounded-xl bg-primary-soft flex items-center justify-center text-primary shrink-0">
                    <stat.icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xl font-semibold text-foreground numeric leading-none">
                      {stat.value}
                    </p>
                    <p className="caption mt-1.5">{stat.label}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
                </button>
              ))}
            </div>

            {/* Recommended */}
            <section className="space-y-4">
              <div className="flex items-end justify-between">
                <h2 className="text-lg font-semibold text-foreground">Recommended for you</h2>
                <button
                  onClick={() => router.push("/freelancer/marketplace")}
                  className="text-sm font-medium text-primary hover:text-primary-hover transition-colors shrink-0"
                >
                  View all
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {jobsLoading && jobs.length === 0 ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <div
                      key={i}
                      className="h-56 bg-card rounded-2xl shadow-[var(--shadow-soft)] animate-pulse"
                    />
                  ))
                ) : jobs.length === 0 ? (
                  <div className="col-span-full py-12 text-center bg-card rounded-2xl shadow-[var(--shadow-soft)]">
                    <div className="h-12 w-12 bg-paper rounded-full flex items-center justify-center mx-auto mb-4">
                      <Briefcase className="h-5 w-5 text-muted-foreground/50" />
                    </div>
                    <h3 className="text-sm font-semibold text-foreground">No matches yet</h3>
                    <p className="caption max-w-xs mx-auto mt-1.5">
                      Browse the marketplace or update your skills.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-4"
                      onClick={() => router.push("/freelancer/marketplace")}
                    >
                      Browse marketplace
                    </Button>
                  </div>
                ) : (
                  jobs.slice(0, 3).map((job) => (
                    <MarketplaceJobCard
                      key={job.id}
                      job={job}
                      onAction={handleJobAction}
                    />
                  ))
                )}
              </div>
            </section>

            {/* Wallet strip — moved from right rail, inline like the reference's 'most viewed' */}
            <section className="space-y-4">
              <h2 className="text-lg font-semibold text-foreground">Your wallet</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="rounded-2xl p-5 bg-card shadow-[var(--shadow-soft)] flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <p className="caption">Escrow balance</p>
                    <button
                      onClick={() => setIsBalanceVisible(!isBalanceVisible)}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                      aria-label={isBalanceVisible ? "Hide" : "Show"}
                    >
                      {isBalanceVisible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                  <p className="text-2xl font-semibold text-foreground numeric mt-4">
                    {isBalanceVisible ? `₦${totalBalance.toLocaleString()}` : "₦••••"}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-4 w-full"
                    onClick={() => router.push("/freelancer/bizpal")}
                  >
                    Withdraw
                  </Button>
                </div>
                <div className="rounded-2xl p-5 bg-card shadow-[var(--shadow-soft)] flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <p className="caption">Bidding credits</p>
                    <Sparkles className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <p className="text-2xl font-semibold text-foreground numeric mt-4">
                    {creditBalance}
                  </p>
                  <Button
                    size="sm"
                    className="mt-4 w-full"
                    onClick={() => router.push("/freelancer/bizpal")}
                  >
                    Top up
                  </Button>
                </div>
              </div>
            </section>
          </div>

          {/* RIGHT RAIL — profile card */}
          <aside className="space-y-5 lg:sticky lg:top-6 animate-fade-up delay-100">
            <div className="rounded-2xl bg-card shadow-[var(--shadow-soft)] overflow-hidden">
              {/* Decorative band */}
              <div className="relative h-20 bg-gradient-to-br from-primary/20 via-primary-soft to-paper">
                <div className="absolute inset-0 grain pointer-events-none" />
              </div>
              {/* Profile content */}
              <div className="px-5 pb-5 -mt-10 space-y-4">
                <div className="flex items-end justify-between">
                  <Avatar className="h-20 w-20 rounded-full border-4 border-card shadow-[var(--shadow-soft)]">
                    <AvatarImage src={profile?.logo} className="object-cover" />
                    <AvatarFallback className="bg-foreground text-white text-xl font-semibold rounded-full">
                      {firstName.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => router.push("/freelancer/profile")}
                    className="h-8 px-3 text-xs rounded-full mb-2"
                  >
                    <Pencil className="h-3 w-3 mr-1.5" />
                    Edit
                  </Button>
                </div>

                <div>
                  <h3 className="text-base font-semibold text-foreground leading-tight">
                    {profile?.full_name || firstName}
                  </h3>
                  <p className="caption mt-0.5 capitalize">
                    {profile?.experience_level
                      ? `${profile.experience_level} freelancer`
                      : "Freelancer"}
                    {profile?.location ? ` · ${profile.location}` : ""}
                  </p>
                </div>

                <div className="hairline-b pt-4 space-y-2.5">
                  <p className="eyebrow">Availability</p>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-success/10 text-success text-xs font-medium rounded-full">
                    <span className="h-1.5 w-1.5 rounded-full bg-success" />
                    Available for work
                  </span>
                </div>

                {profile?.skills && Array.isArray(profile.skills) && profile.skills.length > 0 && (
                  <div className="hairline-b pt-4 space-y-3">
                    <p className="eyebrow">Skills</p>
                    <div className="flex flex-wrap gap-1.5">
                      {profile.skills.slice(0, 6).map((s: string) => (
                        <span
                          key={s}
                          className="px-2.5 py-1 bg-surface-2 text-foreground text-[11px] font-medium rounded-md"
                        >
                          {s}
                        </span>
                      ))}
                      {profile.skills.length > 6 && (
                        <span className="px-2.5 py-1 text-[11px] text-muted-foreground italic">
                          +{profile.skills.length - 6}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                <div className="hairline-b pt-4 space-y-3">
                  <p className="eyebrow">Status</p>
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-lg bg-primary-soft flex items-center justify-center text-primary shrink-0">
                        <BadgeCheck className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-foreground">Identity verified</p>
                        <p className="text-[11px] text-muted-foreground">NIN confirmed</p>
                      </div>
                    </div>
                    {profile?.hourly_rate && (
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-lg bg-paper flex items-center justify-center text-foreground shrink-0">
                          <CreditCard className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-foreground numeric">
                            ₦{Number(profile.hourly_rate).toLocaleString()}/hr
                          </p>
                          <p className="text-[11px] text-muted-foreground">Listed rate</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Smart Match CTA */}
            <div className="rounded-2xl p-5 bg-paper shadow-[var(--shadow-soft)] space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <p className="text-sm font-semibold text-foreground">Smart Match</p>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Get curated project recommendations based on your skills.
              </p>
              <Button
                onClick={() => {
                  const userSkills = profile?.skills
                  if (Array.isArray(userSkills) && userSkills.length > 0) {
                    router.push(`/freelancer/marketplace?q=${encodeURIComponent(userSkills[0])}`)
                  } else {
                    router.push("/freelancer/profile")
                  }
                }}
                className="w-full h-9 text-xs"
              >
                Match me
              </Button>
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
