"use client"

import { useState, useEffect, useCallback } from "react"
import type React from "react"
import FreelancerNavbar from "@/components/freelancer-navbar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Eye,
  Calendar,
  X,
  MapPin,
  Clock,
  Users,
  Star,
  Bookmark,
  Filter,
  Search,
  Wallet,
  CreditCard,
  Upload,
  Send,
  Loader2,
  Briefcase,
  TrendingUp,
  Sparkles,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { useTheme } from "next-themes"
import { supabase } from "@/lib/supabase"
import { ALL_CATEGORIES, getSkillsForCategory, type Category } from "@/lib/categories"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const JOBS_PER_PAGE = 100

export default function FreelancerDashboard() {
  const [isDarkMode, setIsDarkMode] = useState(false)
  const [selectedJob, setSelectedJob] = useState<any>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [jobs, setJobs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [jobsLoading, setJobsLoading] = useState(true)
  const [jobsOffset, setJobsOffset] = useState(0)
  const [hasMoreJobs, setHasMoreJobs] = useState(true)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const [showFilterModal, setShowFilterModal] = useState(false)
  const [showPlaceBidModal, setShowPlaceBidModal] = useState(false)
  const [showAgencyModal, setShowAgencyModal] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
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
  const [creditBalance, setCreditBalance] = useState(0)
  const [isSubmittingBid, setIsSubmittingBid] = useState(false)
  const [totalBalance, setTotalBalance] = useState(0)
  const [showLatestModal, setShowLatestModal] = useState(false)
  const [dateFilters, setDateFilters] = useState({
    fromDate: "",
    toDate: "",
  })
  const [profile, setProfile] = useState<any>(null)

  const loadUserProfile = async (userId: string) => {
    try {
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("username, full_name")
        .eq("id", userId)
        .single()

      if (profileError) {
        console.error("Error fetching user profile:", profileError)
        setProfile(null)
      } else {
        setProfile(profileData)
      }
    } catch (error) {
      console.error("Error loading user profile:", error)
      setProfile(null)
    }
  }

  useEffect(() => {
    const fetchInitialData = async () => {
      setLoading(true)
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (user) {
        setCurrentUser(user)
        await loadUserProfile(user.id)
        await loadUserCredits(user.id)
        await loadTotalBalance(user.id)
        await loadJobsForUser(user)
      } else {
        setLoading(false)
        router.push("/login")
      }
    }
    fetchInitialData()
  }, [])

  const loadTotalBalance = async (userId: string) => {
    try {
      const { data: fundedJobs, error } = await supabase
        .from("Funded_jobs101")
        .select("amount, status, payout_successful")
        .eq("freelancer_id", userId)

      if (error) {
        setTotalBalance(0)
      } else {
        const totalAmount =
          fundedJobs
            ?.filter((job) => job.status === "verified" && !job.payout_successful)
            .reduce((sum, job) => sum + Number(job.amount), 0) || 0
        setTotalBalance(totalAmount)
      }
    } catch (error) {
      setTotalBalance(0)
    }
  }

  const loadJobsForUser = async (user: any) => {
    setJobsLoading(true)
    try {
      const { data: savedJobsData } = await supabase
        .from("saved_jobs")
        .select("job_id")
        .eq("freelancer_id", user.id)

      const savedJobIds = savedJobsData?.map((item) => item.job_id) || []

      const query = supabase
        .from("jobs")
        .select(
          `
        *,
        profiles!jobs_agency_id_fkey (
          id, full_name, company_name, company_size, bio, location, phone, website, created_at, account_type
        ),
        proposals!inner(count)
      `,
          { count: "exact" },
        )
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .range(0, JOBS_PER_PAGE - 1)

      const { data: jobsData, error: jobsError, count } = await query

      if (!jobsError) {
        const agencyIds = [...new Set(jobsData?.map((job) => job.profiles?.id).filter(Boolean))]
        const agencyJobCounts: { [key: string]: number } = {}
        const agencyLogos: { [key: string]: string } = {}

        if (agencyIds.length > 0) {
          for (const agencyId of agencyIds) {
            const { count: agencyCount } = await supabase
              .from("jobs")
              .select("*", { count: "exact", head: true })
              .eq("agency_id", agencyId)
            agencyJobCounts[agencyId] = agencyCount || 0
          }

          const { data: agencyImagesData } = await supabase
            .from("agency_image")
            .select("agency_id, image_data")
            .in("agency_id", agencyIds)

          agencyImagesData?.forEach((image) => {
            agencyLogos[image.agency_id] = image.image_data
          })
        }

        const transformedJobs =
          jobsData?.map((job: any) => ({
            ...job,
            budget: `₦${job.budget_min?.toLocaleString()} - ₦${job.budget_max?.toLocaleString()}`,
            postedDate: new Date(job.created_at).toLocaleDateString(),
            proposals: job.proposals?.[0]?.count || 0,
            rating: 4.8,
            isBookmarked: savedJobIds.includes(job.id),
            isLiked: false,
            agencyInfo: {
              id: job.profiles?.id,
              name: job.profiles?.company_name || job.profiles?.full_name || "Unknown Agency",
              logo: agencyLogos[job.profiles?.id] || null,
              rating: 4.8,
              reviews: 156,
              location: job.profiles?.location || "Nigeria",
              founded: new Date(job.profiles?.created_at).getFullYear().toString() || "2020",
              employees: job.profiles?.company_size || "10-50",
              description: job.profiles?.bio || "Professional agency providing quality services.",
              memberSince: new Date(job.profiles?.created_at).getFullYear().toString() || "2020",
              phone: job.profiles?.phone,
              website: job.profiles?.website,
              email: job.profiles?.email,
              fullName: job.profiles?.full_name,
              companyName: job.profiles?.company_name,
              totalJobs: agencyJobCounts[job.profiles?.id] || 0,
              accountType: job.profiles?.account_type,
            },
          })) || []

        setJobs(transformedJobs)
        setHasMoreJobs(transformedJobs.length < (count || 0))
        setJobsOffset(transformedJobs.length)
      }
    } catch (error) {
      console.error(error)
    } finally {
      setJobsLoading(false)
      setLoading(false)
    }
  }

  const loadUserCredits = async (userId: string) => {
    try {
      const { data: creditsData } = await supabase
        .from("purchase_credits")
        .select("credits_amount")
        .eq("freelancer_id", userId)
        .eq("status", "completed")

      const totalCredits = creditsData?.reduce((sum, purchase) => sum + (purchase.credits_amount || 0), 0) || 0
      setCreditBalance(Math.max(0, totalCredits))
    } catch (error) {
      setCreditBalance(0)
    }
  }

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
      if (!currentUser) return
      try {
        const { data: savedJobsData } = await supabase
          .from("saved_jobs")
          .select("job_id")
          .eq("freelancer_id", currentUser.id)

        const savedJobIds = savedJobsData?.map((item) => item.job_id) || []

        let query = supabase
          .from("jobs")
          .select(
            `
          *,
          profiles!jobs_agency_id_fkey (
            id, full_name, company_name, company_size, bio, location, phone, website, created_at, account_type
          ),
          proposals!inner(count)
        `,
            { count: "exact" },
          )
          .eq("status", "active")
          .order("created_at", { ascending: false })
          .range(currentOffset, currentOffset + JOBS_PER_PAGE - 1)

        if (currentSearchQuery) {
          query = query.or(`title.ilike.%${currentSearchQuery}%,description.ilike.%${currentSearchQuery}%`)
        }
        if (dateFilter?.fromDate) query = query.gte("created_at", dateFilter.fromDate)
        if (dateFilter?.toDate) query = query.lte("created_at", dateFilter.toDate + "T23:59:59")
        if (creditsFilter) query = query.lte("credit_cost", Number.parseInt(creditsFilter))
        if (jobTypeFilter) query = query.eq("job_type", jobTypeFilter)
        if (categoryFilter) {
          const categorySkills = getSkillsForCategory(categoryFilter as Category)
          query = query.overlaps("skills", categorySkills as unknown as string[])
        }

        const { data: jobsData, error: jobsError, count } = await query

        if (!jobsError) {
          const agencyIds = [...new Set(jobsData?.map((job) => job.profiles?.id).filter(Boolean))]
          const agencyJobCounts: { [key: string]: number } = {}
          const agencyLogos: { [key: string]: string } = {}

          if (agencyIds.length > 0) {
            for (const agencyId of agencyIds) {
              const { count: agencyCount } = await supabase
                .from("jobs")
                .select("*", { count: "exact", head: true })
                .eq("agency_id", agencyId)
              agencyJobCounts[agencyId] = agencyCount || 0
            }
            const { data: agencyImagesData } = await supabase
              .from("agency_image")
              .select("agency_id, image_data")
              .in("agency_id", agencyIds)

            agencyImagesData?.forEach((image) => {
              agencyLogos[image.agency_id] = image.image_data
            })
          }

          const transformedJobs =
            jobsData?.map((job: any) => ({
              ...job,
              budget: `₦${job.budget_min?.toLocaleString()} - ₦${job.budget_max?.toLocaleString()}`,
              postedDate: new Date(job.created_at).toLocaleDateString(),
              proposals: job.proposals?.[0]?.count || 0,
              rating: 4.8,
              isBookmarked: savedJobIds.includes(job.id),
              isLiked: false,
              agencyInfo: {
                id: job.profiles?.id,
                name: job.profiles?.company_name || job.profiles?.full_name || "Unknown Agency",
                logo: agencyLogos[job.profiles?.id] || null,
                rating: 4.8,
                reviews: 156,
                location: job.profiles?.location || "Nigeria",
                founded: new Date(job.profiles?.created_at).getFullYear().toString() || "2020",
                employees: job.profiles?.company_size || "10-50",
                description: job.profiles?.bio || "Professional agency providing quality services.",
                memberSince: new Date(job.profiles?.created_at).getFullYear().toString() || "2020",
                phone: job.profiles?.phone,
                website: job.profiles?.website,
                email: job.profiles?.email,
                fullName: job.profiles?.full_name,
                companyName: job.profiles?.company_name,
                totalJobs: agencyJobCounts[job.profiles?.id] || 0,
                accountType: job.profiles?.account_type,
              },
            })) || []

          setJobs((prevJobs) => (append ? [...prevJobs, ...transformedJobs] : transformedJobs))
          setHasMoreJobs(currentOffset + transformedJobs.length < (count || 0))
          setJobsOffset(currentOffset + transformedJobs.length)
        }
      } catch (error) {
        console.error(error)
      } finally {
        setJobsLoading(false)
      }
    },
    [currentUser],
  )

  const checkNINVerification = async (userId: string): Promise<boolean> => {
    try {
      const { data } = await supabase
        .from("freelancer_verification")
        .select("status")
        .eq("freelancer_id", userId)
        .eq("status", "verified")
        .single()
      return !!data
    } catch {
      return false
    }
  }

  const handleJobAction = async (job: any, action: "bookmark" | "like" | "view" | "placeBid") => {
    if (action === "view") {
      setSelectedAgency(job.agencyInfo)
      setShowAgencyModal(true)
    } else if (action === "placeBid") {
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
    } else if (action === "bookmark") {
      try {
        if (job.isBookmarked) {
          await supabase.from("saved_jobs").delete().eq("freelancer_id", currentUser.id).eq("job_id", job.id)
          setJobs(jobs.map((j) => (j.id === job.id ? { ...j, isBookmarked: false } : j)))
        } else {
          await supabase.from("saved_jobs").insert([{ freelancer_id: currentUser.id, job_id: job.id }])
          setJobs(jobs.map((j) => (j.id === job.id ? { ...j, isBookmarked: true } : j)))
        }
      } catch (error) {
        console.error(error)
      }
    }
  }

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])
    setSelectedFiles((prev) => [...prev, ...files])
  }

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index))
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
        attachments: selectedFiles.map((file) => file.name),
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
      setSelectedFiles([])
      loadJobs(0, searchQuery, false)
    } catch (error) {
      console.error(error)
      alert("Error submitting proposal.")
    } finally {
      setIsSubmittingBid(false)
    }
  }

  const handleLoadMoreJobs = () => loadJobs(jobsOffset, searchQuery, true)

  const formatNumber = (num: number): string => {
    if (num >= 1000) return (num / 1000).toFixed(1).replace(/\.0$/, "") + "K"
    return num.toString()
  }

  const savedJobs = jobs.filter((job) => job.isBookmarked).length

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <FreelancerNavbar />
        <div className="max-w-7xl mx-auto py-8 px-4 space-y-6">
          <div className="h-40 bg-slate-200 rounded-[2rem]"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="h-32 bg-slate-200 rounded-3xl"></div>
            <div className="h-32 bg-slate-200 rounded-3xl"></div>
            <div className="h-32 bg-slate-200 rounded-3xl"></div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20 selection:bg-orange-100 selection:text-orange-900">
      <FreelancerNavbar />
      
      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-8">
        {/* Welcome Hero */}
        <Card className="bg-slate-900 border-none rounded-[2.5rem] overflow-hidden relative shadow-2xl shadow-slate-200">
          <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
          <CardContent className="p-8 sm:p-12 relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="text-center md:text-left space-y-4">
              <Badge className="bg-orange-500 hover:bg-orange-600 text-white border-none px-4 py-1.5 rounded-full font-black uppercase tracking-wider text-[10px]">
                Freelancer Dashboard
              </Badge>
              <h2 className="text-3xl sm:text-5xl font-black text-white leading-tight">
                Welcome back, <br/>
                <span className="text-orange-500">
                  {profile?.full_name || currentUser?.email?.split("@")[0]}
                </span>
              </h2>
              <p className="text-slate-400 font-medium max-w-md">
                You have <span className="text-white font-bold">{creditBalance}</span> credits available. Explore new high-impact projects today.
              </p>
              <div className="flex flex-wrap gap-3 pt-2">
                 <Button className="bg-orange-500 hover:bg-orange-600 rounded-full px-8 font-bold h-12 shadow-lg shadow-orange-500/25">
                   <Search className="mr-2 h-4 w-4" /> Browse Jobs
                 </Button>
                 <Button variant="outline" className="border-slate-700 bg-transparent text-white hover:bg-slate-800 rounded-full px-8 font-bold h-12">
                   <Sparkles className="mr-2 h-4 w-4" /> Smart Match
                 </Button>
              </div>
            </div>
            <div className="flex flex-col items-center md:items-end gap-2 bg-white/5 backdrop-blur-xl p-8 rounded-[2rem] border border-white/10 min-w-[200px]">
               <div className="text-5xl font-black text-white">{formatNumber(jobs.length)}</div>
               <div className="text-orange-500 font-black uppercase tracking-widest text-[10px]">Jobs Available</div>
            </div>
          </CardContent>
        </Card>

        {/* Finance & Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="border-none shadow-xl shadow-slate-200/50 rounded-[2rem] bg-white group hover:border-orange-500/50 border transition-all">
            <CardContent className="p-8">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-orange-50 rounded-2xl">
                  <Wallet className="h-6 w-6 text-orange-500" />
                </div>
                <TrendingUp className="h-5 w-5 text-green-500" />
              </div>
              <p className="text-slate-500 font-bold text-xs uppercase tracking-widest">Total Earnings</p>
              <h3 className="text-3xl font-black text-slate-900 mt-1">₦{totalBalance.toLocaleString()}</h3>
              <p className="text-slate-400 text-xs mt-4 font-medium">Verified & pending payout</p>
            </CardContent>
          </Card>

          <Card className="border-none shadow-xl shadow-slate-200/50 rounded-[2rem] bg-white group hover:border-orange-500/50 border transition-all">
            <CardContent className="p-8">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-blue-50 rounded-2xl">
                  <CreditCard className="h-6 w-6 text-blue-500" />
                </div>
                <div className="px-2.5 py-1 bg-green-100 text-green-700 rounded-lg text-[10px] font-black uppercase tracking-wider">Active</div>
              </div>
              <p className="text-slate-500 font-bold text-xs uppercase tracking-widest">Credit Balance</p>
              <h3 className="text-3xl font-black text-slate-900 mt-1">{creditBalance}</h3>
              <p className="text-slate-400 text-xs mt-4 font-medium">Required for project bidding</p>
            </CardContent>
          </Card>

          <Card className="border-none shadow-xl shadow-slate-200/50 rounded-[2rem] bg-white group hover:border-orange-500/50 border transition-all">
            <CardContent className="p-8">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-purple-50 rounded-2xl">
                  <Bookmark className="h-6 w-6 text-purple-500" />
                </div>
              </div>
              <p className="text-slate-500 font-bold text-xs uppercase tracking-widest">Saved Projects</p>
              <h3 className="text-3xl font-black text-slate-900 mt-1">{savedJobs}</h3>
              <p className="text-slate-400 text-xs mt-4 font-medium">Items in your watchlist</p>
            </CardContent>
          </Card>
        </div>

        {/* Marketplace Section */}
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
            <div className="space-y-1">
               <h3 className="text-2xl font-black text-slate-900 tracking-tight">Project Marketplace</h3>
               <p className="text-slate-400 text-sm font-medium">Discover opportunities that match your expertise.</p>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="rounded-xl border-slate-200 font-bold h-11" onClick={() => setShowFilterModal(true)}>
                <Filter className="h-4 w-4 mr-2" /> Filter
              </Button>
              <Button variant="outline" className="rounded-xl border-slate-200 font-bold h-11" onClick={() => setShowLatestModal(true)}>
                <Calendar className="h-4 w-4 mr-2" /> Latest
              </Button>
            </div>
          </div>

          {/* Job Feed */}
          {jobsLoading && jobs.length === 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="h-80 bg-white rounded-[2rem] border border-slate-100 shadow-sm animate-pulse"></div>
              ))}
            </div>
          ) : jobs.length === 0 ? (
            <Card className="rounded-[2.5rem] border-dashed border-2 border-slate-200 p-20 text-center">
              <Search className="h-16 w-16 mx-auto mb-6 text-slate-200" />
              <h3 className="text-2xl font-black text-slate-900 mb-2">No projects found</h3>
              <p className="text-slate-400 font-medium">Try adjusting your filters or search terms.</p>
              <Button variant="outline" className="mt-8 rounded-full px-8" onClick={resetFilters}>Reset Marketplace</Button>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {jobs.map((job) => (
                <Card key={job.id} className="border border-slate-100 shadow-xl shadow-slate-200/30 rounded-[2.5rem] bg-white overflow-hidden flex flex-col group hover:border-orange-500/30 transition-all">
                  <div className="p-8 flex-1 space-y-6">
                    <div className="flex items-start justify-between">
                      <Avatar className="h-14 w-14 rounded-2xl border-4 border-slate-50 group-hover:scale-105 transition-transform duration-500">
                        <AvatarImage src={job.agencyInfo.logo} />
                        <AvatarFallback className="bg-orange-500 text-white font-black text-xl">
                          {job.agencyInfo.name.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <button 
                        onClick={() => handleJobAction(job, "bookmark")}
                        className={`p-3 rounded-2xl border transition-all ${job.isBookmarked ? 'bg-orange-500 border-orange-500 text-white' : 'bg-slate-50 border-slate-100 text-slate-400 hover:text-orange-500'}`}
                      >
                        <Bookmark className={`h-5 w-5 ${job.isBookmarked ? 'fill-current' : ''}`} />
                      </button>
                    </div>

                    <div className="space-y-2">
                       <h4 className="text-xl font-black text-slate-900 leading-tight group-hover:text-orange-600 transition-colors line-clamp-2">{job.title}</h4>
                       <div className="flex items-center gap-2 text-slate-400 text-[10px] font-black uppercase tracking-widest">
                          <span>{job.agencyInfo.name}</span>
                          <span>•</span>
                          <span className="flex items-center gap-1"><Star className="h-3 w-3 text-yellow-500 fill-current"/> {job.rating}</span>
                       </div>
                    </div>

                    <p className="text-slate-500 text-sm font-medium line-clamp-3 leading-relaxed">
                      {job.description}
                    </p>

                    <div className="grid grid-cols-2 gap-4 py-4 border-y border-slate-50">
                       <div className="space-y-1">
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-300">Budget</p>
                          <p className="text-sm font-black text-slate-900 truncate">{job.budget}</p>
                       </div>
                       <div className="space-y-1">
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-300">Duration</p>
                          <p className="text-sm font-black text-slate-900 truncate">{job.duration}</p>
                       </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                       {job.skills?.slice(0, 3).map((s: string) => (
                         <Badge key={s} variant="secondary" className="bg-slate-50 text-slate-600 border-none font-bold text-[10px] rounded-lg">{s}</Badge>
                       ))}
                       {job.skills?.length > 3 && <Badge variant="secondary" className="bg-slate-50 text-slate-400 border-none font-bold text-[10px] rounded-lg">+{job.skills.length - 3}</Badge>}
                    </div>
                  </div>

                  <div className="p-4 bg-slate-50/50 flex gap-3 border-t border-slate-50">
                     <Button 
                       variant="outline" 
                       className="flex-1 rounded-2xl bg-white border-slate-200 font-bold h-12 text-slate-600 hover:bg-slate-50"
                       onClick={() => handleJobAction(job, "view")}
                     >
                       Details
                     </Button>
                     <Button 
                       className="flex-1 rounded-2xl bg-orange-500 hover:bg-orange-600 text-white font-black h-12 shadow-lg shadow-orange-500/20"
                       onClick={() => handleJobAction(job, "placeBid")}
                       disabled={creditBalance < job.credit_cost}
                     >
                       {creditBalance < job.credit_cost ? 'Need Credits' : 'Apply Now'}
                     </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {hasMoreJobs && jobs.length > 0 && (
            <div className="flex justify-center pt-10">
               <Button 
                 variant="outline" 
                 className="rounded-full px-12 h-14 border-slate-200 font-black text-slate-500 hover:text-orange-500 hover:border-orange-500"
                 onClick={handleLoadMoreJobs}
                 disabled={jobsLoading}
               >
                 {jobsLoading ? <Loader2 className="animate-spin mr-2"/> : null}
                 Load More Opportunities
               </Button>
            </div>
          )}
        </div>
      </div>

      {/* Reusable Filter Modal Style */}
      {showFilterModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
           <Card className="w-full max-w-md rounded-[2.5rem] border-none shadow-2xl overflow-hidden">
             <CardHeader className="p-8 pb-4">
                <div className="flex items-center justify-between">
                   <CardTitle className="text-2xl font-black text-slate-900">Filter Search</CardTitle>
                   <Button variant="ghost" size="icon" onClick={() => setShowFilterModal(false)} className="rounded-full h-10 w-10">
                      <X className="h-5 w-5" />
                   </Button>
                </div>
             </CardHeader>
             <CardContent className="p-8 pt-0 space-y-6">
                <div className="space-y-2">
                   <Label className="font-bold text-slate-700">Keywords</Label>
                   <Input 
                     className="h-12 rounded-xl border-slate-200" 
                     placeholder="Search title or skills..."
                     value={filters.keywords}
                     onChange={(e) => setFilters({...filters, keywords: e.target.value})}
                   />
                </div>
                <div className="grid grid-cols-2 gap-4">
                   <div className="space-y-2">
                      <Label className="font-bold text-slate-700">Min Budget (₦)</Label>
                      <Input 
                        type="number" 
                        className="h-12 rounded-xl border-slate-200"
                        value={filters.minBudget}
                        onChange={(e) => setFilters({...filters, minBudget: e.target.value})}
                      />
                   </div>
                   <div className="space-y-2">
                      <Label className="font-bold text-slate-700">Max Budget (₦)</Label>
                      <Input 
                        type="number" 
                        className="h-12 rounded-xl border-slate-200"
                        value={filters.maxBudget}
                        onChange={(e) => setFilters({...filters, maxBudget: e.target.value})}
                      />
                   </div>
                </div>
                <div className="space-y-2">
                   <Label className="font-bold text-slate-700">Job Category</Label>
                   <Select value={filters.category} onValueChange={(v) => setFilters({...filters, category: v})}>
                      <SelectTrigger className="h-12 rounded-xl border-slate-200">
                         <SelectValue placeholder="All Categories" />
                      </SelectTrigger>
                      <SelectContent>
                         {ALL_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                   </Select>
                </div>
                <div className="flex gap-3 pt-4">
                   <Button variant="outline" className="flex-1 rounded-xl h-12 font-bold" onClick={resetFilters}>Reset</Button>
                   <Button className="flex-1 rounded-xl h-12 bg-orange-500 hover:bg-orange-600 font-black" onClick={applyFilters}>Apply Filters</Button>
                </div>
             </CardContent>
           </Card>
        </div>
      )}

      {/* Place Bid Sidebar/Modal */}
      {showPlaceBidModal && selectedJob && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex justify-end z-[100]">
           <div className="w-full max-w-lg bg-white h-full shadow-2xl flex flex-col">
              <div className="p-8 border-b border-slate-100 flex items-center justify-between">
                 <h3 className="text-2xl font-black text-slate-900">Submit Proposal</h3>
                 <Button variant="ghost" size="icon" onClick={() => setShowPlaceBidModal(false)} className="rounded-full">
                    <X className="h-6 w-6" />
                 </Button>
              </div>
              <div className="flex-1 overflow-y-auto p-8 space-y-8">
                 <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100">
                    <h4 className="font-black text-slate-900 text-lg mb-1">{selectedJob.title}</h4>
                    <p className="text-slate-500 font-medium text-sm mb-4">{selectedJob.agencyInfo.name}</p>
                    <div className="flex gap-4">
                       <div className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 flex items-center gap-1.5">
                          <span className="text-orange-500">₦</span> {selectedJob.budget.replace("₦", "")}
                       </div>
                       <div className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 flex items-center gap-1.5">
                          <CreditCard className="h-3.5 w-3.5 text-blue-500" /> {selectedJob.credit_cost} Credits
                       </div>
                    </div>
                 </div>

                 <div className="space-y-6">
                    <div className="space-y-2">
                       <Label className="font-black text-slate-900 uppercase tracking-widest text-[10px]">Your Proposal</Label>
                       <Textarea 
                         className="min-h-[160px] rounded-2xl border-slate-200 focus:ring-orange-500" 
                         placeholder="Describe why you're the best fit for this project..."
                         value={bidData.proposal}
                         onChange={(e) => setBidData({...bidData, proposal: e.target.value})}
                       />
                    </div>
                    <div className="grid grid-cols-2 gap-6">
                       <div className="space-y-2">
                          <Label className="font-black text-slate-900 uppercase tracking-widest text-[10px]">Estimated Timeline</Label>
                          <Input 
                            className="h-12 rounded-xl" 
                            placeholder="e.g. 10 days"
                            value={bidData.timeline}
                            onChange={(e) => setBidData({...bidData, timeline: e.target.value})}
                          />
                       </div>
                       <div className="space-y-2">
                          <Label className="font-black text-slate-900 uppercase tracking-widest text-[10px]">Bid Amount (₦)</Label>
                          <Input 
                            className="h-12 rounded-xl" 
                            placeholder="Enter amount"
                            value={bidData.budget}
                            onChange={(e) => setBidData({...bidData, budget: e.target.value})}
                          />
                       </div>
                    </div>
                    
                    <div className="p-6 bg-orange-50 rounded-2xl space-y-3">
                       <div className="flex items-center justify-between text-xs font-bold uppercase tracking-widest text-orange-800/50">
                          <span>Required Credits</span>
                          <span>{selectedJob.credit_cost}</span>
                       </div>
                       <div className="flex items-center justify-between text-sm font-black text-orange-900 pt-3 border-t border-orange-200">
                          <span>Remaining Balance</span>
                          <span>{creditBalance - selectedJob.credit_cost}</span>
                       </div>
                    </div>
                 </div>
              </div>
              <div className="p-8 border-t border-slate-100 bg-slate-50">
                 <Button 
                   className="w-full h-14 rounded-2xl bg-orange-500 hover:bg-orange-600 text-white font-black text-lg shadow-xl shadow-orange-500/25"
                   onClick={submitBid}
                   disabled={isSubmittingBid || !bidData.proposal || !bidData.timeline || !bidData.budget}
                 >
                   {isSubmittingBid ? <Loader2 className="animate-spin mr-2" /> : <Send className="mr-2 h-5 w-5" />}
                   Submit Bid Now
                 </Button>
              </div>
           </div>
        </div>
      )}

      {/* Agency Details Modal */}
      {showAgencyModal && selectedAgency && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
           <Card className="w-full max-w-2xl rounded-[3rem] border-none shadow-2xl overflow-hidden bg-white">
              <div className="p-10 space-y-8">
                 <div className="flex items-start justify-between">
                    <div className="flex items-center gap-6">
                       <Avatar className="h-24 w-24 rounded-3xl border-8 border-slate-50">
                          <AvatarImage src={selectedAgency.logo} />
                          <AvatarFallback className="bg-orange-500 text-white text-3xl font-black">{selectedAgency.name.charAt(0)}</AvatarFallback>
                       </Avatar>
                       <div className="space-y-1">
                          <div className="flex items-center gap-2">
                             <h3 className="text-3xl font-black text-slate-900">{selectedAgency.name}</h3>
                             <CheckCircle className="h-6 w-6 text-blue-500 fill-current" />
                          </div>
                          <p className="text-slate-400 font-bold text-sm flex items-center gap-2">
                             <MapPin className="h-4 w-4" /> {selectedAgency.location}
                          </p>
                       </div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => setShowAgencyModal(false)} className="rounded-full">
                       <X className="h-6 w-6" />
                    </Button>
                 </div>

                 <div className="space-y-2">
                    <Label className="font-black text-slate-900 uppercase tracking-widest text-[10px]">About the Agency</Label>
                    <p className="text-slate-500 font-medium leading-relaxed">{selectedAgency.description}</p>
                 </div>

                 <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="bg-slate-50 p-4 rounded-2xl text-center space-y-1">
                       <p className="text-[8px] font-black uppercase tracking-widest text-slate-400">Founded</p>
                       <p className="text-sm font-black text-slate-900">{selectedAgency.founded}</p>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-2xl text-center space-y-1">
                       <p className="text-[8px] font-black uppercase tracking-widest text-slate-400">Total Jobs</p>
                       <p className="text-sm font-black text-slate-900">{selectedAgency.totalJobs}</p>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-2xl text-center space-y-1">
                       <p className="text-[8px] font-black uppercase tracking-widest text-slate-400">Team Size</p>
                       <p className="text-sm font-black text-slate-900">{selectedAgency.employees}</p>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-2xl text-center space-y-1">
                       <p className="text-[8px] font-black uppercase tracking-widest text-slate-400">Rating</p>
                       <p className="text-sm font-black text-slate-900 flex items-center justify-center gap-1">
                          <Star className="h-3 w-3 text-yellow-500 fill-current" /> {selectedAgency.rating}
                       </p>
                    </div>
                 </div>

                 <div className="pt-4 border-t border-slate-100 flex justify-end">
                    <Button variant="outline" className="rounded-full px-10 h-12 font-bold" onClick={() => setShowAgencyModal(false)}>Close Profile</Button>
                 </div>
              </div>
           </Card>
        </div>
      )}

      {/* Date Filter Modal */}
      {showLatestModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
           <Card className="w-full max-w-sm rounded-[2.5rem] border-none shadow-2xl overflow-hidden">
             <CardHeader className="p-8 pb-4">
                <CardTitle className="text-2xl font-black text-slate-900">Custom Date Range</CardTitle>
             </CardHeader>
             <CardContent className="p-8 pt-0 space-y-6">
                <div className="space-y-2">
                   <Label className="font-bold">From</Label>
                   <Input type="date" className="h-12 rounded-xl" value={dateFilters.fromDate} onChange={(e) => setDateFilters({...dateFilters, fromDate: e.target.value})} />
                </div>
                <div className="space-y-2">
                   <Label className="font-bold">To</Label>
                   <Input type="date" className="h-12 rounded-xl" value={dateFilters.toDate} onChange={(e) => setDateFilters({...dateFilters, toDate: e.target.value})} />
                </div>
                <div className="flex gap-3 pt-2">
                   <Button variant="outline" className="flex-1 h-12 rounded-xl font-bold" onClick={() => setShowLatestModal(false)}>Cancel</Button>
                   <Button className="flex-1 h-12 rounded-xl bg-orange-500 hover:bg-orange-600 font-black" onClick={applyDateFilters}>Apply Range</Button>
                </div>
             </CardContent>
           </Card>
        </div>
      )}
    </div>
  )
}
