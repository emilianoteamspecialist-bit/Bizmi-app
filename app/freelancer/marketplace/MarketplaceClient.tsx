"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Calendar,
  X,
  MapPin,
  Star,
  Filter,
  Search,
  Wallet,
  CreditCard,
  Send,
  Loader2,
  TrendingUp,
  Sparkles,
  CheckCircle,
  Shield,
  Bookmark,
  ArrowRight,
  Briefcase,
  Zap,
  ShieldCheck,
  ChevronRight,
  ArrowUpRight,
  Plus,
  History,
  LayoutGrid,
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
import { JobCard } from "@/components/shared/job-card"
import { Modal } from "@/components/shared/modal"
import { StatBadge } from "@/components/shared/stat-badge"
import { Section } from "@/components/ui/section"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"

const JOBS_PER_PAGE = 20

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
              rating: 4.8,
              isLiked: false,
              agencyInfo: {
                ...job.agency_info,
                name: job.agency_info.company_name || job.agency_info.full_name || "Unknown Agency",
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

  const handleLoadMoreJobs = () => loadJobs(jobsOffset, searchQuery, true)

  if (loading) {
    return (
      <div className="min-h-screen bg-surface">
        <Section spacing="md">
           <div className="animate-pulse space-y-8">
             <div className="h-48 bg-card rounded-lg border border-border"></div>
             <div className="h-96 bg-card rounded-lg border border-border"></div>
           </div>
        </Section>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface pb-20 selection:bg-primary/10">
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
        <div className="space-y-10">
          
          <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-8 bg-slate-900 p-8 md:p-10 rounded-lg shadow-2xl shadow-slate-900/20 overflow-hidden border border-slate-800">
            <div className="absolute top-0 right-0 w-80 h-80 bg-white/5 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
            <div className="space-y-4 relative z-10 flex-1">
              <h1 className="text-3xl md:text-4xl font-bold font-heading text-white tracking-tight leading-tight">
                Freelancer Marketplace
              </h1>
              <p className="text-slate-400 font-medium max-w-xl text-sm md:text-base leading-relaxed">
                Discover verified projects that match your expertise. Use smart filters to find your next big opportunity.
              </p>
            </div>
            
            {/* Stats Display */}
            <div className="relative z-10 flex flex-col items-start md:items-end gap-3 w-full md:w-auto">
               
               {/* Trust Score */}
               <div className="w-full md:w-[260px] bg-emerald-500/10 border border-emerald-500/20 backdrop-blur-md rounded-lg p-3 flex items-center gap-4 shadow-inner">
                  <div className="h-10 w-10 rounded-md bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30 shrink-0">
                     <ShieldCheck className="h-5 w-5 text-emerald-400" />
                  </div>
                  <div className="flex-1">
                     <p className="text-[9px] font-black uppercase tracking-[0.2em] text-emerald-500 mb-0.5">Trust Score</p>
                     <div className="flex items-baseline gap-1">
                        <span className="text-xl font-black text-white">98</span>
                        <span className="text-[10px] font-bold text-emerald-500">/100</span>
                     </div>
                  </div>
               </div>

               {/* Credit Balance */}
               <div className="w-full md:w-[260px] bg-slate-800/50 border border-slate-700/50 backdrop-blur-md rounded-lg p-3 flex items-center gap-4 shadow-inner">
                  <div className="h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center border border-primary/20 shrink-0">
                     <Zap className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                     <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 mb-0.5">Bidding Power</p>
                     <div className="flex items-baseline gap-1.5">
                        <span className="text-xl font-black text-white">{creditBalance}</span>
                        <span className="text-[10px] font-bold text-slate-500">CRD</span>
                     </div>
                  </div>
                  <Button 
                     size="icon" 
                     variant="secondary"
                     className="shrink-0 h-8 w-8 rounded-full"
                     onClick={() => router.push('/freelancer/bizpal')}
                  >
                     <Plus className="h-4 w-4" />
                  </Button>
               </div>

            </div>
          </div>

          <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
              <div className="flex items-center gap-3 w-full">
                 <div className="relative flex-1">
                   <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                   <Input 
                     placeholder="Search projects, skills..." 
                     value={searchQuery}
                     onChange={(e) => setSearchQuery(e.target.value)}
                     onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          loadJobs(0, searchQuery, false)
                        }
                     }}
                   />
                 </div>
                 <Button 
                   className="h-12 px-6"
                   onClick={() => loadJobs(0, searchQuery, false)}
                 >
                   Search
                 </Button>
                 <Button variant="outline" className="h-12 px-5" onClick={() => setShowFilterModal(true)}>
                   <Filter className="h-4 w-4 md:mr-2" /> <span className="hidden md:inline">Filter</span>
                 </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
              {jobsLoading && jobs.length === 0 ? (
                Array.from({length: 6}).map((_, i) => (
                  <div key={i} className="h-80 bg-card rounded-lg border border-border animate-pulse"></div>
                ))
              ) : jobs.length === 0 ? (
                <Card className="col-span-full py-24 text-center border-dashed border-2">
                  <div className="h-16 w-16 bg-surface rounded-full flex items-center justify-center mx-auto mb-6">
                    <Briefcase className="h-8 w-8 text-muted-foreground/30" />
                  </div>
                  <h3 className="text-xl font-bold font-heading text-foreground">No projects found</h3>
                  <p className="text-muted-foreground text-sm max-w-xs mx-auto font-medium mt-2">Try resetting your filters to see more verified listings from our active market.</p>
                  <Button variant="outline" className="mt-8 px-8" onClick={resetFilters}>Reset Market</Button>
                </Card>
              ) : (
                jobs.map((job) => (
                  <JobCard 
                    key={job.id} 
                    job={job} 
                    creditBalance={creditBalance}
                    onAction={handleJobAction}
                  />
                ))
              )}
            </div>

            {hasMoreJobs && jobs.length > 0 && (
              <div className="flex justify-center pt-8">
                 <Button 
                   variant="outline" 
                   size="lg"
                   className="px-12 group"
                   onClick={handleLoadMoreJobs}
                   disabled={jobsLoading}
                 >
                   {jobsLoading ? <Loader2 className="animate-spin mr-2 h-5 w-5"/> : <History className="mr-2 h-5 w-5 transition-colors" />}
                   Load More Projects
                 </Button>
              </div>
            )}
          </div>
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
            <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Contextual Keywords</Label>
            <Input 
              placeholder="Skills, companies, or titles..."
              value={filters.keywords}
              onChange={(e) => setFilters({...filters, keywords: e.target.value})}
            />
          </div>
          <div className="space-y-2.5">
            <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Professional Field</Label>
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
                  <Label className="text-[10px] font-black uppercase tracking-[0.25em] text-muted-foreground">Professional Pitch</Label>
                  <Textarea 
                    className="min-h-[250px] p-6" 
                    placeholder="Explain why your expertise is the perfect match for this project..."
                    value={bidData.proposal}
                    onChange={(e) => setBidData({...bidData, proposal: e.target.value})}
                  />
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <Label className="text-[10px] font-black uppercase tracking-[0.25em] text-muted-foreground">Execution Timeline</Label>
                    <Input 
                      placeholder="e.g. 10 Working Days"
                      value={bidData.timeline}
                      onChange={(e) => setBidData({...bidData, timeline: e.target.value})}
                    />
                  </div>
                  <div className="space-y-4">
                    <Label className="text-[10px] font-black uppercase tracking-[0.25em] text-muted-foreground">Project Fee (₦)</Label>
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
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">{s.label}</p>
                  <p className="text-base font-bold text-foreground">{s.val}</p>
                </div>
              ))}
            </div>

            <div className="space-y-4">
              <Label className="text-[10px] font-black uppercase tracking-[0.25em] text-muted-foreground">Professional Dossier</Label>
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
