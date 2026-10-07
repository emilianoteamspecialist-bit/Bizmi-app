import { useMemo, useState } from "react"
import { useNavigate, Navigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Reveal } from "@/components/shared/reveal"
import { Modal } from "@/components/shared/modal"
import { StatBadge } from "@/components/shared/stat-badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { useAuth } from "@/contexts/AuthContext"
import { useJobsQuery, useToggleBookmarkMutation } from "@/lib/queries/jobs"
import { useDashboardQuery } from "@/lib/queries/user"
import { useSubmitProposalMutation } from "@/lib/queries/proposals"
import { getAvatarUrl } from "@/lib/avatar"
import { ALL_CATEGORIES, getSkillsForCategory, type Category } from "@/lib/categories"
import {
  MapPin,
  Search,
  Send,
  Loader2,
  CheckCircle,
  Bookmark,
  BadgeCheck,
  Briefcase,
  CreditCard,
} from "lucide-react"

function transformJob(job: any) {
  return {
    ...job,
    budget: `₦ ${(job.budget_min ?? 0).toLocaleString()} - ₦ ${(job.budget_max ?? 0).toLocaleString()}`,
    isBookmarked: !!job.is_bookmarked,
    agencyInfo: {
      ...job.agency_info,
      name: job.agency_info?.company_name || job.agency_info?.full_name || "Unknown Agency",
      logo: getAvatarUrl(job.agency_info?.logo_path),
    },
  }
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { profile } = useAuth()

  const [selectedJob, setSelectedJob] = useState<any>(null)
  const [showFilterModal, setShowFilterModal] = useState(false)
  const [showPlaceBidModal, setShowPlaceBidModal] = useState(false)
  const [showAgencyModal, setShowAgencyModal] = useState(false)
  const [selectedAgency, setSelectedAgency] = useState<any>(null)
  const [filters, setFilters] = useState({ keywords: "", category: "" })
  const [bidData, setBidData] = useState({ proposal: "", timeline: "", budget: "" })

  const jobsParams = useMemo(
    () => ({
      searchQuery: filters.keywords,
      limit: 6,
      categorySkills: filters.category ? (getSkillsForCategory(filters.category as Category) as unknown as string[]) : undefined,
    }),
    [filters]
  )

  const dashboardQuery = useDashboardQuery()
  const jobsQuery = useJobsQuery(jobsParams)
  const toggleBookmark = useToggleBookmarkMutation()
  const submitProposal = useSubmitProposalMutation()

  const isLoading = dashboardQuery.isLoading || jobsQuery.isLoading

  if (isLoading) {
    return (
      <div data-testid="dashboard-skeleton" className="min-h-screen bg-surface pb-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-pulse">
          <div className="space-y-2">
            <div className="h-3 w-24 bg-foreground/5 rounded" />
            <div className="h-7 w-64 bg-foreground/5 rounded" />
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 bg-card border border-border rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (dashboardQuery.isError || jobsQuery.isError) {
    return (
      <div className="min-h-screen bg-surface pb-20 flex items-center justify-center">
        <div className="text-center space-y-2">
          <p className="text-sm font-semibold text-foreground">Couldn't load your dashboard</p>
          <p className="text-sm text-muted-foreground">Please try refreshing the page.</p>
        </div>
      </div>
    )
  }

  if (profile && profile.account_type !== "freelancer") {
    return <Navigate to="/" replace />
  }

  const dashboardData = dashboardQuery.data
  const profileData = dashboardData?.profile ?? profile
  const creditBalance = dashboardData?.credits ?? 0
  const totalBalance = dashboardData?.balance ?? 0
  const isNINVerified = !!dashboardData?.isVerified
  const jobs = (jobsQuery.data?.jobs ?? []).map(transformJob)

  const greeting = (() => {
    const hour = new Date().getHours()
    if (hour < 12) return "Good morning"
    if (hour < 17) return "Good afternoon"
    return "Good evening"
  })()
  const firstName = profileData?.full_name?.split(" ")[0] || "there"
  const openBriefs = jobs.length

  const profileFields: { key: string; label: string }[] = [
    { key: "full_name", label: "display name" },
    { key: "bio", label: "a professional bio" },
    { key: "skills", label: "your skills" },
    { key: "location", label: "your location" },
    { key: "hourly_rate", label: "an hourly rate" },
    { key: "experience_level", label: "experience level" },
  ]
  const completedFields = profileFields.filter((f) => {
    const v = (profileData as any)?.[f.key]
    return Array.isArray(v) ? v.length > 0 : !!v
  })
  const profileCompletion = Math.round((completedFields.length / profileFields.length) * 100)
  const missing = profileFields.filter((f) => !completedFields.find((c) => c.key === f.key))

  const handleJobAction = (job: any, action: "bookmark" | "view" | "apply") => {
    if (action === "view") {
      setSelectedAgency(job.agencyInfo)
      setShowAgencyModal(true)
    } else if (action === "apply") {
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
    } else if (action === "bookmark") {
      toggleBookmark.mutate(
        { jobId: job.id, isBookmarked: !!job.isBookmarked },
        { onError: () => alert("Couldn't update bookmark. Please try again.") }
      )
    }
  }

  const applyFilters = () => setShowFilterModal(false)
  const resetFilters = () => setFilters({ keywords: "", category: "" })

  const submitBid = () => {
    if (!selectedJob) return
    submitProposal.mutate(
      {
        jobId: selectedJob.id,
        proposal_text: bidData.proposal,
        timeline: bidData.timeline,
        budget: bidData.budget,
        creditCost: selectedJob.credit_cost,
      },
      {
        onSuccess: (result) => {
          if (!result.success) {
            alert(result.error === "Unauthorized" ? "You must be signed in to submit a proposal." : `Error submitting proposal: ${result.error}`)
            return
          }
          alert(result.alreadySubmitted ? "You have already submitted a proposal for this job." : `Proposal submitted! ${selectedJob.credit_cost} credits deducted.`)
          setShowPlaceBidModal(false)
          setBidData({ proposal: "", timeline: "", budget: "" })
        },
        onError: () => alert("Error submitting proposal. Please try again."),
      }
    )
  }

  return (
    <div className="min-h-screen bg-surface pb-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div className="space-y-1 min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {greeting}, {firstName}
            </p>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              {openBriefs > 0 ? `${openBriefs} ${openBriefs === 1 ? "brief" : "briefs"} match your stack` : "Let's find your next brief"}
            </h1>
            <p className="text-sm text-muted-foreground">Find projects, file proposals, and track your standing.</p>
          </div>
        </header>

        <Reveal>
          <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <button onClick={() => navigate("/freelancer/profile")} className="text-left rounded-xl border border-border bg-card p-4 hover:border-foreground/20 transition-colors">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground">Profile</p>
                <BadgeCheck className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground tabular-nums">
                {profileCompletion}
                <span className="text-lg text-muted-foreground">%</span>
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{profileCompletion === 100 ? "Hire-ready" : `${missing.length} field${missing.length !== 1 ? "s" : ""} to go`}</p>
            </button>

            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground">Credits</p>
                <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground tabular-nums">{creditBalance}</p>
            </div>

            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground">Escrow</p>
              </div>
              <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground tabular-nums">₦{totalBalance.toLocaleString()}</p>
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

        <Reveal delay={0.08}>
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-sm font-semibold text-foreground">
                Matched to your stack <span className="font-normal text-muted-foreground">· {jobs.length}</span>
              </h2>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setShowFilterModal(true)}>
                <Search className="h-3.5 w-3.5" /> Refine
              </Button>
            </div>

            {jobs.length === 0 ? (
              <div className="rounded-xl border border-border bg-card py-16 px-6 text-center">
                <div className="mx-auto h-11 w-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <Briefcase className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-sm font-semibold text-foreground">No briefs match yet</h3>
                <p className="mt-1 text-sm text-muted-foreground max-w-sm mx-auto">Add a few more skills to your profile so we can match you to the right work.</p>
              </div>
            ) : (
              <div className="rounded-xl border border-border bg-card divide-y divide-border overflow-hidden">
                {jobs.map((job) => (
                  <div key={job.id} className="p-4 sm:p-5 transition-colors hover:bg-surface/60">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <h3 className="text-sm font-semibold text-foreground">{job.title}</h3>
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
                        {job.description && <p className="text-sm text-muted-foreground line-clamp-1 max-w-2xl">{job.description}</p>}
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          <span className="font-medium text-foreground tabular-nums">{job.budget}</span>
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {job.location || "Remote"}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <Button variant="ghost" size="sm" onClick={() => handleJobAction(job, "view")}>Agency</Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleJobAction(job, "bookmark")} aria-label={job.isBookmarked ? "Saved" : "Save"}>
                          <Bookmark className={`h-4 w-4 ${job.isBookmarked ? "fill-primary text-primary" : ""}`} />
                        </Button>
                        <Button size="sm" onClick={() => handleJobAction(job, "apply")} disabled={job.has_applied}>
                          {job.has_applied ? "Applied" : "Quick apply"}
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </Reveal>
      </div>

      <Modal isOpen={showFilterModal} onClose={() => setShowFilterModal(false)} title="Refine Market" maxWidth="md">
        <div className="space-y-6">
          <div className="space-y-2.5">
            <Label className="eyebrow">Contextual Keywords</Label>
            <Input placeholder="Skills, companies, or titles..." value={filters.keywords} onChange={(e) => setFilters({ ...filters, keywords: e.target.value })} />
          </div>
          <div className="space-y-2.5">
            <Label className="eyebrow">Professional Field</Label>
            <Select value={filters.category} onValueChange={(v) => setFilters({ ...filters, category: v })}>
              <SelectTrigger className="bg-surface">
                <SelectValue placeholder="All Specializations" />
              </SelectTrigger>
              <SelectContent>
                {ALL_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-4 pt-6">
            <Button variant="ghost" className="flex-1" onClick={resetFilters}>Reset</Button>
            <Button className="flex-1" onClick={applyFilters}>Update Results</Button>
          </div>
        </div>
      </Modal>

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
                  <StatBadge variant="success">Verified Listing</StatBadge>
                  <h4 className="font-bold font-heading text-foreground text-2xl leading-tight">{selectedJob.title}</h4>
                </div>
              )}
              <div className="space-y-10">
                <div className="space-y-4">
                  <Label className="eyebrow">Professional Pitch</Label>
                  <Textarea className="min-h-[250px] p-6" value={bidData.proposal} onChange={(e) => setBidData({ ...bidData, proposal: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <Label className="eyebrow">Execution Timeline</Label>
                    <Input value={bidData.timeline} onChange={(e) => setBidData({ ...bidData, timeline: e.target.value })} />
                  </div>
                  <div className="space-y-4">
                    <Label className="eyebrow">Project Fee (₦)</Label>
                    <Input value={bidData.budget} onChange={(e) => setBidData({ ...bidData, budget: e.target.value })} className="font-bold" />
                  </div>
                </div>
              </div>
            </div>
            <div className="p-10 border-t border-border bg-surface/50">
              <Button size="lg" className="w-full h-16 text-lg" onClick={submitBid} disabled={submitProposal.isPending || !bidData.proposal || !bidData.timeline || !bidData.budget}>
                {submitProposal.isPending ? <Loader2 className="animate-spin mr-2" /> : <Send className="mr-2 h-5 w-5" />}
                Launch Proposal
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <Modal isOpen={showAgencyModal} onClose={() => setShowAgencyModal(false)} srLabel="Agency details" maxWidth="2xl">
        {selectedAgency && (
          <div className="space-y-6">
            <div className="flex items-center gap-6">
              <Avatar className="h-20 w-20 rounded-lg">
                <AvatarImage src={selectedAgency.logo} />
                <AvatarFallback className="bg-slate-900 text-white text-2xl font-black">{selectedAgency.name.charAt(0)}</AvatarFallback>
              </Avatar>
              <h3 className="text-2xl font-bold font-heading text-foreground">{selectedAgency.name}</h3>
            </div>
            <div className="pt-6 border-t border-border flex justify-end">
              <Button variant="outline" onClick={() => setShowAgencyModal(false)}>Close</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
