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
} from "lucide-react"
import { useRouter } from "next/navigation"
import { useTheme } from "next-themes"
import { supabase } from "@/lib/supabase"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const JOBS_PER_PAGE = 100 // New constant for pagination

export default function FreelancerDashboard() {
  const [isDarkMode, setIsDarkMode] = useState(false)
  const [showJobDetails, setShowJobDetails] = useState(false) // Not currently used, but kept
  const [selectedJob, setSelectedJob] = useState<any>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]) // Not currently used, but kept
  const [jobs, setJobs] = useState<any[]>([])
  const [loading, setLoading] = useState(true) // Overall page loading
  const [jobsLoading, setJobsLoading] = useState(true) // Loading state for job list pagination
  const [jobsOffset, setJobsOffset] = useState(0)
  const [hasMoreJobs, setHasMoreJobs] = useState(true)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const [logoPreview, setLogoPreview] = useState<string>("") // Not currently used, but kept
  const [showFilterModal, setShowFilterModal] = useState(false)
  const [showPlaceBidModal, setShowPlaceBidModal] = useState(false)
  const [showAgencyModal, setShowAgencyModal] = useState(false) // Fixed type issue
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [filters, setFilters] = useState({
    keywords: "",
    minBudget: "",
    maxBudget: "",
    credits: "",
  })
  const [bidData, setBidData] = useState({
    proposal: "",
    timeline: "",
    budget: "",
  })
  const [selectedAgency, setSelectedAgency] = useState<any>(null)
  const [agencyImage, setAgencyImage] = useState<string>("") // This state is no longer used for the avatar, but kept if needed elsewhere
  const [creditBalance, setCreditBalance] = useState(0) // New state for user-specific credits
  const [isSubmittingBid, setIsSubmittingBid] = useState(false) // Loading state for bid submission
  const [totalBalance, setTotalBalance] = useState(0) // New state for total balance from funded jobs
  const [showLatestModal, setShowLatestModal] = useState(false)
  const [dateFilters, setDateFilters] = useState({
    fromDate: "",
    toDate: "",
  })

  // Initial user and logo fetch on component mount
  useEffect(() => {
    console.log("useEffect: Starting fetchInitialData...") // Added log
    const fetchInitialData = async () => {
      setLoading(true) // Start overall page loading
      const {
        data: { user },
      } = await supabase.auth.getUser()
      console.log("useEffect: Supabase getUser result:", user) // Added log
      if (user) {
        setCurrentUser(user)
        const { data: logoData, error: userLogoError } = await supabase // Added error check
          .from("freelancer_logos")
          .select("logo_data")
          .eq("freelancer_id", user.id)
          .single()
        if (userLogoError) {
          // Log error for user logo fetch
          console.error("Error fetching current user logo:", userLogoError)
        } else if (logoData) {
          setLogoPreview(logoData.logo_data)
        }
        // Fetch user-specific credits from purchase_credits table
        await loadUserCredits(user.id)
        // Fetch total balance from funded jobs
        await loadTotalBalance(user.id)

        // Load jobs after user is set
        await loadJobsForUser(user)
      } else {
        console.log("useEffect: No user found, redirecting or stopping loading.") // Added log
        setLoading(false) // If no user, stop loading
        // Optionally redirect to login if user is required for this page
        // router.push("/login");
      }
    }
    fetchInitialData()
  }, [])

  // Function to load total balance from funded jobs
  const loadTotalBalance = async (userId: string) => {
    try {
      const { data: fundedJobs, error } = await supabase
        .from("Funded_jobs101")
        .select("amount, status, payout_successful")
        .eq("freelancer_id", userId)

      if (error) {
        console.error("Error fetching funded jobs for balance:", error)
        setTotalBalance(0)
      } else {
        // Calculate total amount - only verified jobs that haven't been paid out
        const totalAmount =
          fundedJobs
            ?.filter((job) => job.status === "verified" && !job.payout_successful)
            .reduce((sum, job) => sum + Number(job.amount), 0) || 0

        setTotalBalance(totalAmount)
        console.log("Total balance calculated:", totalAmount)
      }
    } catch (error) {
      console.error("Error loading total balance:", error)
      setTotalBalance(0)
    }
  }

  // Create a separate function to load jobs that doesn't depend on currentUser state
  const loadJobsForUser = async (user: any) => {
    setJobsLoading(true)
    console.log("loadJobsForUser: Attempting to load jobs for user:", user.id)
    try {
      // Load saved jobs for this user
      const { data: savedJobsData, error: savedJobsError } = await supabase
        .from("saved_jobs")
        .select("job_id")
        .eq("freelancer_id", user.id)

      if (savedJobsError) {
        console.error("loadJobsForUser: Error fetching saved jobs:", savedJobsError)
      }
      const savedJobIds = savedJobsData?.map((item) => item.job_id) || []

      const query = supabase
        .from("jobs")
        .select(
          `
        *,
        profiles!jobs_agency_id_fkey (
          id,
          full_name,
          company_name,
          company_size,
          bio,
          location,
          phone,
          website,
          created_at,
          account_type
        ),
        proposals!inner(count)
      `,
          { count: "exact" },
        )
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .range(0, JOBS_PER_PAGE - 1)

      const { data: jobsData, error: jobsError, count } = await query

      if (jobsError) {
        console.error("loadJobsForUser: Error loading jobs:", jobsError)
      } else {
        console.log("loadJobsForUser: Jobs data received:", jobsData)
        console.log("loadJobsForUser: Total jobs count:", count)

        const agencyIds = [...new Set(jobsData?.map((job) => job.profiles?.id).filter(Boolean))]
        const agencyJobCounts: { [key: string]: number } = {}
        const agencyLogos: { [key: string]: string } = {} // New: Store agency logos

        if (agencyIds.length > 0) {
          // Fetch total job counts for each agency
          for (const agencyId of agencyIds) {
            const { count: agencyCount, error: agencyCountError } = await supabase
              .from("jobs")
              .select("*", { count: "exact", head: true })
              .eq("agency_id", agencyId)
            if (agencyCountError) {
              console.error("loadJobsForUser: Error fetching agency job count for", agencyId, ":", agencyCountError)
            }
            agencyJobCounts[agencyId] = agencyCount || 0
          }

          // Fetch agency images (using image_data as per schema)
          const { data: agencyImagesData, error: agencyImagesError } = await supabase
            .from("agency_image")
            .select("agency_id, image_data") // Changed back to image_data
            .in("agency_id", agencyIds)

          if (agencyImagesError) {
            console.error("loadJobsForUser: Error fetching agency images:", agencyImagesError)
          } else {
            console.log("loadJobsForUser: Agency images data received:", agencyImagesData)
            agencyImagesData?.forEach((image) => {
              agencyLogos[image.agency_id] = image.image_data // Use image_data
            })
          }
        }

        const transformedJobs =
          jobsData?.map((job: any) => {
            console.log("Processing job:", job.id, "Agency profile:", job.profiles)
            console.log("Agency logo for", job.profiles?.id, ":", agencyLogos[job.profiles?.id])

            return {
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
                logo: agencyLogos[job.profiles?.id] || "/placeholder.svg?height=60&width=60",
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
            }
          }) || []

        setJobs(transformedJobs)
        setHasMoreJobs(transformedJobs.length < (count || 0))
        setJobsOffset(transformedJobs.length)
      }
    } catch (error) {
      console.error("loadJobsForUser: Caught unexpected error:", error)
    } finally {
      console.log("loadJobsForUser: Setting jobsLoading to false and overall loading to false.")
      setJobsLoading(false)
      setLoading(false)
    }
  }

  // Function to load user credits - Updated to calculate net credits properly
  const loadUserCredits = async (userId: string) => {
    try {
      const { data: creditsData, error: creditsError } = await supabase
        .from("purchase_credits")
        .select("credits_amount")
        .eq("freelancer_id", userId)
        .eq("status", "completed")

      if (creditsError) {
        console.error("Error fetching credits:", creditsError)
        setCreditBalance(0)
      } else {
        // Calculate net credits (positive purchases minus negative deductions)
        const totalCredits =
          creditsData?.reduce((sum, purchase) => {
            return sum + (purchase.credits_amount || 0)
          }, 0) || 0

        // Ensure credits don't go below 0
        const finalCredits = Math.max(0, totalCredits)
        setCreditBalance(finalCredits)
        console.log("Total credits calculated:", finalCredits)
      }
    } catch (error) {
      console.error("Error loading user credits:", error)
      setCreditBalance(0)
    }
  }

  // Job loading function with pagination and search
  const loadJobs = useCallback(
    async (
      currentOffset: number,
      currentSearchQuery: string,
      append = false,
      dateFilter?: { fromDate: string; toDate: string },
      creditsFilter?: string,
    ) => {
      setJobsLoading(true) // Start loading for job list
      console.log("loadJobs: Called with offset", currentOffset, "and query", currentSearchQuery) // Added log
      if (!currentUser) {
        console.log("loadJobs: No current user, cannot load jobs.") // Added log
        setJobsLoading(false)
        setLoading(false) // Ensure overall loading stops if no user
        return
      }
      console.log("loadJobs: Attempting to load jobs for user:", currentUser.id) // Added log
      try {
        // Load saved jobs for this user
        const { data: savedJobsData, error: savedJobsError } = await supabase // Added error check
          .from("saved_jobs")
          .select("job_id")
          .eq("freelancer_id", currentUser.id)

        if (savedJobsError) {
          // Log error for saved jobs fetch
          console.error("loadJobs: Error fetching saved jobs:", savedJobsError)
        }
        const savedJobIds = savedJobsData?.map((item) => item.job_id) || []

        let query = supabase
          .from("jobs")
          .select(
            `
          *,
          profiles!jobs_agency_id_fkey (
            id,
            full_name,
            company_name,
            company_size,
            bio,
            location,
            phone,
            website,
            created_at,
            account_type
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

        if (dateFilter?.fromDate) {
          query = query.gte("created_at", dateFilter.fromDate)
        }
        if (dateFilter?.toDate) {
          query = query.lte("created_at", dateFilter.toDate + "T23:59:59")
        }

        if (creditsFilter) {
          console.log("[v0] Filtering by credits:", creditsFilter, "as number:", Number.parseInt(creditsFilter))
          console.log("[v0] Query before credits filter:", query)
          query = query.lte("credit_cost", Number.parseInt(creditsFilter))
          console.log("[v0] Query after credits filter applied")
        }

        const { data: jobsData, error: jobsError, count } = await query

        console.log("[v0] Query executed, jobsData:", jobsData)
        console.log("[v0] Query error:", jobsError)
        console.log("[v0] Query count:", count)

        if (jobsError) {
          console.error("loadJobs: Error loading jobs:", jobsError) // Existing log
        } else {
          console.log("loadJobs: Jobs data received:", jobsData) // Existing log
          console.log("loadJobs: Total jobs count:", count) // Existing log

          if (creditsFilter && jobsData) {
            console.log("[v0] Jobs with credit_cost values:")
            jobsData.forEach((job, index) => {
              console.log(`[v0] Job ${index + 1}: id=${job.id}, credit_cost=${job.credit_cost}, title=${job.title}`)
            })
          }

          const agencyIds = [...new Set(jobsData?.map((job) => job.profiles?.id).filter(Boolean))]
          const agencyJobCounts: { [key: string]: number } = {}
          const agencyLogos: { [key: string]: string } = {} // New: Store agency logos

          if (agencyIds.length > 0) {
            // Fetch total job counts for each agency
            for (const agencyId of agencyIds) {
              const { count: agencyCount, error: agencyCountError } = await supabase // Added error check
                .from("jobs")
                .select("*", { count: "exact", head: true })
                .eq("agency_id", agencyId)
              if (agencyCountError) {
                // Log error for agency job count fetch
                console.error("loadJobs: Error fetching agency job count for", agencyId, ":", agencyCountError)
              }
              agencyJobCounts[agencyId] = agencyCount || 0
            }

            // Fetch agency images (using image_data as per schema)
            const { data: agencyImagesData, error: agencyImagesError } = await supabase
              .from("agency_image")
              .select("agency_id, image_data") // Changed back to image_data
              .in("agency_id", agencyIds)

            if (agencyImagesError) {
              console.error("loadJobs: Error fetching agency images:", agencyImagesError)
            } else {
              console.log("loadJobs: Agency images data received:", agencyImagesData)
              agencyImagesData?.forEach((image) => {
                agencyLogos[image.agency_id] = image.image_data // Use image_data
              })
            }
          }

          const transformedJobs =
            jobsData?.map((job: any) => {
              console.log("Processing job:", job.id, "Agency profile:", job.profiles)
              console.log("Agency logo for", job.profiles?.id, ":", agencyLogos[job.profiles?.id])

              return {
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
                  logo: agencyLogos[job.profiles?.id] || "/placeholder.svg?height=60&width=60",
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
              }
            }) || []

          setJobs((prevJobs) => (append ? [...prevJobs, ...transformedJobs] : transformedJobs))
          setHasMoreJobs(currentOffset + transformedJobs.length < (count || 0))
          setJobsOffset(currentOffset + transformedJobs.length)
        }
      } catch (error) {
        console.error("loadJobs: Caught unexpected error:", error) // Added log for unexpected errors
      } finally {
        console.log("loadJobs: Setting jobsLoading to false and overall loading to false.") // Added log
        setJobsLoading(false)
        setLoading(false) // Overall loading done after jobs are loaded
      }
    },
    [currentUser], // Depend on currentUser
  )

  const handleSignOut = () => {
    router.push("/")
  }

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode)
    document.documentElement.classList.toggle("dark")
  }

  const handleJobAction = async (job: any, action: "bookmark" | "like" | "view" | "placeBid") => {
    if (action === "view") {
      setSelectedAgency(job.agencyInfo)
      setShowAgencyModal(true)
    } else if (action === "placeBid") {
      // Check if user has sufficient credits before opening modal
      if (creditBalance < job.credit_cost) {
        alert(
          `Insufficient credits! You need ${job.credit_cost} credits but only have ${creditBalance}. Please purchase more credits to place a bid.`,
        )
        return
      }
      setSelectedJob(job)
      setShowPlaceBidModal(true)
    } else if (action === "bookmark") {
      try {
        if (job.isBookmarked) {
          const { error } = await supabase
            .from("saved_jobs")
            .delete()
            .eq("freelancer_id", currentUser.id)
            .eq("job_id", job.id)
          if (error) {
            console.error("Error unsaving job:", error)
          } else {
            setJobs(jobs.map((j) => (j.id === job.id ? { ...j, isBookmarked: false } : j)))
          }
        } else {
          const { error } = await supabase.from("saved_jobs").insert([
            {
              freelancer_id: currentUser.id,
              job_id: job.id,
            },
          ])
          if (error) {
            console.error("Error saving job:", error)
          } else {
            setJobs(jobs.map((j) => (j.id === job.id ? { ...j, isBookmarked: true } : j)))
          }
        }
      } catch (error) {
        console.error("Error toggling bookmark:", error)
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

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark")
  }

  const applyFilters = () => {
    console.log("[v0] Applying filters with credits:", filters.credits)
    setJobsOffset(0)
    setHasMoreJobs(true)
    loadJobs(0, filters.keywords, false, undefined, filters.credits)
    setShowFilterModal(false)
  }

  const resetFilters = () => {
    setFilters({
      keywords: "",
      minBudget: "",
      maxBudget: "",
      credits: "",
    })
    // When filters are reset, reload jobs from scratch
    setSearchQuery("") // Clear search as well
    setJobsOffset(0)
    setHasMoreJobs(true)
    loadJobs(0, "", false)
  }

  const submitBid = async () => {
    if (!currentUser || !selectedJob) return
    setIsSubmittingBid(true)

    try {
      // Double-check if user has sufficient credits
      if (creditBalance < selectedJob.credit_cost) {
        alert(`Insufficient credits! You need ${selectedJob.credit_cost} credits but only have ${creditBalance}.`)
        setIsSubmittingBid(false)
        return
      }

      // Check if user already submitted a proposal for this job
      const { data: existingProposal } = await supabase
        .from("proposals")
        .select("id")
        .eq("job_id", selectedJob.id)
        .eq("freelancer_id", currentUser.id)
        .single()

      if (existingProposal) {
        alert("You have already submitted a proposal for this job!")
        setIsSubmittingBid(false)
        return
      }

      // Submit the proposal first
      const proposalData = {
        job_id: selectedJob.id,
        freelancer_id: currentUser.id,
        proposal_text: bidData.proposal,
        timeline: bidData.timeline,
        budget: bidData.budget,
        attachments: selectedFiles.map((file) => file.name),
        status: "pending",
      }

      const { error: proposalError } = await supabase.from("proposals").insert([proposalData])

      if (proposalError) {
        console.error("Error submitting proposal:", proposalError)
        alert("Error submitting proposal: " + proposalError.message)
        setIsSubmittingBid(false)
        return
      }

      // Now deduct credits by inserting a deduction record
      const deductionRecord = {
        freelancer_id: currentUser.id,
        amount: selectedJob.credit_cost * 50, // Cost in naira (₦50 per credit)
        credits_amount: -selectedJob.credit_cost, // Negative to represent deduction
        status: "completed",
        paystack_reference: `job_bid_${selectedJob.id}_${currentUser.id}_${Date.now()}`,
        created_at: new Date().toISOString(),
      }

      const { data: deductionData, error: deductionError } = await supabase
        .from("purchase_credits")
        .insert([deductionRecord])
        .select()

      if (deductionError) {
        console.error("Error deducting credits:", deductionError)
        alert("Proposal submitted but error deducting credits: " + deductionError.message)
        setIsSubmittingBid(false)
        return
      }

      // Update local credit balance immediately
      const newCreditBalance = Math.max(0, creditBalance - selectedJob.credit_cost)
      setCreditBalance(newCreditBalance)

      // Show success alert with credit deduction info
      alert(
        ` Proposal submitted successfully!\n\n  ${selectedJob.credit_cost} credits deducted\n Remaining balance: ${newCreditBalance} credits`,
      )

      // Close modal and reset form
      setShowPlaceBidModal(false)
      setBidData({ proposal: "", timeline: "", budget: "" })
      setSelectedFiles([])

      // Reload jobs to update proposal counts
      loadJobs(0, searchQuery, false)
    } catch (error) {
      console.error("Error submitting bid:", error)
      alert("Error submitting proposal. Please try again.")
    } finally {
      setIsSubmittingBid(false)
    }
  }

  const handleLoadMoreJobs = () => {
    loadJobs(jobsOffset, searchQuery, true)
  }

  // Helper function for number formatting
  const formatNumber = (num: number): string => {
    if (num >= 1000000000000) {
      return (num / 1000000000000).toFixed(1).replace(/\.0$/, "") + "T"
    }
    if (num >= 1000000000) {
      return (num / 1000000000).toFixed(1).replace(/\.0$/, "") + "B"
    }
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1).replace(/\.0$/, "") + "M"
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1).replace(/\.0$/, "") + "K"
    }
    return num.toString()
  }

  const savedJobs = jobs.filter((job) => job.isBookmarked).length

  const applyDateFilters = () => {
    setJobsOffset(0)
    setHasMoreJobs(true)
    loadJobs(0, searchQuery, false, dateFilters)
    setShowLatestModal(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <FreelancerNavbar />
        <div className="max-w-7xl mx-auto py-8 px-4">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-300 rounded w-1/4 mb-6"></div>
            <div className="space-y-4">
              {/* Skeleton for welcome card */}
              <div className="h-32 bg-gray-300 rounded"></div>
              {/* Skeletons for metric cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                <div className="h-24 bg-gray-300 rounded"></div>
                <div className="h-24 bg-gray-300 rounded"></div>
                <div className="h-24 bg-gray-300 rounded"></div>
              </div>
              {/* Skeleton for filter section */}
              <div className="h-16 bg-gray-300 rounded"></div>
              {/* Skeletons for job cards */}
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-64 bg-gray-300 rounded"></div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`min-h-screen bg-gray-50 dark:bg-gray-900 ${isDarkMode ? "dark" : ""}`}>
      <FreelancerNavbar />
      <div className="max-w-7xl mx-auto py-4 sm:py-6 px-4 sm:px-6 lg:px-8">
        {/* Welcome Card */}
        <Card className="bg-gradient-to-br from-orange-500 via-orange-600 to-orange-700 text-white overflow-hidden relative mb-6">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-16 translate-x-16"></div>
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-12 -translate-x-12"></div>
          <CardContent className="p-4 sm:p-6 relative z-10">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex-1">
               <h2 className="text-xl sm:text-2xl font-bold mb-2">
                  Welcome back, {profile?.username || profile?.full_name || "Freelancer"}!
                </h2>
                <p className="text-orange-100 mb-4 text-sm sm:text-base">
                  Discover amazing opportunities and grow your freelance career
                </p>
                <Button
                  variant="secondary"
                  size="sm"
                  className="bg-white/20 hover:bg-white/30 text-white border-white/30"
                  onClick={() => router.push("/dashboard")}
                >
                  <Search className="h-4 w-4 mr-2" />
                  Browse Jobs
                </Button>
              </div>
              <div className="text-center sm:text-right">
                <div className="text-2xl sm:text-3xl font-bold">{formatNumber(jobs.length)}</div>
                <div className="text-orange-200 text-xs sm:text-sm">Available Jobs</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Metrics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 mb-6">
          <Card className="border-l-4 border-l-orange-500 bg-white dark:bg-gray-800 hover:shadow-md transition-shadow">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-muted-foreground text-sm font-medium truncate">Total Balance</p>
                  <p className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
                    ₦{totalBalance.toLocaleString()}
                  </p>
                  <p className="text-xs sm:text-sm text-orange-600 flex items-center mt-1">
                    <Wallet className="h-3 w-3 sm:h-4 sm:w-4 mr-1 flex-shrink-0" />
                    <span className="truncate">Available funds</span>
                  </p>
                </div>
                <div className="bg-orange-100 dark:bg-orange-900/20 p-3 rounded-full flex-shrink-0 ml-3">
                  <Wallet className="h-5 w-5 sm:h-6 sm:w-6 text-orange-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-orange-500 bg-white dark:bg-gray-800 hover:shadow-md transition-shadow">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-muted-foreground text-sm font-medium truncate">Credit Balance</p>
                  <p className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">{creditBalance}</p>
                  <p className="text-xs sm:text-sm text-orange-600 flex items-center mt-1">
                    <CreditCard className="h-3 w-3 sm:h-4 sm:w-4 mr-1 flex-shrink-0" />
                    <span className="truncate">Available credits</span>
                  </p>
                </div>
                <div className="bg-orange-100 dark:bg-orange-900/20 p-3 rounded-full flex-shrink-0 ml-3">
                  <CreditCard className="h-5 w-5 sm:h-6 sm:w-6 text-orange-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-orange-500 bg-white dark:bg-gray-800 hover:shadow-md transition-shadow">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-muted-foreground text-sm font-medium truncate">Saved Jobs</p>
                  <p className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">{savedJobs}</p>
                  <p className="text-xs sm:text-sm text-orange-600 flex items-center mt-1">
                    <Bookmark className="h-3 w-3 sm:h-4 sm:w-4 mr-1 flex-shrink-0" />
                    <span className="truncate">Bookmarked</span>
                  </p>
                </div>
                <div className="bg-orange-100 dark:bg-orange-900/20 p-3 rounded-full flex-shrink-0 ml-3">
                  <Bookmark className="h-5 w-5 sm:h-6 sm:w-6 text-orange-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filter Section */}
        <Card className="mb-6">
          <CardContent className="p-4 sm:p-6">
            <div className="flex justify-center">
              <Button variant="outline" className="bg-transparent" onClick={() => setShowFilterModal(true)}>
                <Filter className="h-4 w-4 mr-2" />
                Filter Jobs
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Jobs Section */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <CardTitle className="text-lg sm:text-xl">Available Jobs ({formatNumber(jobs.length)})</CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="bg-transparent" onClick={() => setShowLatestModal(true)}>
                  <Calendar className="h-4 w-4 mr-2" />
                  Latest
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {jobsLoading && jobs.length === 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4 sm:p-6">
                {[...Array(JOBS_PER_PAGE)].map((_, i) => (
                  <Card key={i} className="h-64 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse"></Card>
                ))}
              </div>
            ) : jobs.length === 0 ? (
              <div className="p-8 text-center">
                <Search className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">No Jobs Available</h3>
                <p className="text-muted-foreground">Check back later for new opportunities</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4 sm:p-6">
                {jobs.map((job) => (
                  <Card
                    key={job.id}
                    className="group relative overflow-hidden rounded-lg shadow-md hover:shadow-lg transition-all duration-300 border border-gray-200 dark:border-gray-700"
                  >
                    {/* Bookmark Button - positioned absolutely */}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleJobAction(job, "bookmark")}
                      className={`absolute top-3 right-3 z-10 h-8 w-8 rounded-full bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm ${job.isBookmarked ? "text-orange-600" : "text-gray-400"} hover:bg-white dark:hover:bg-gray-700`}
                    >
                      <Bookmark className={`h-4 w-4 ${job.isBookmarked ? "fill-current" : ""}`} />
                      <span className="sr-only">Bookmark Job</span>
                    </Button>
                    <CardHeader className="p-4 sm:p-6 pb-0">
                      <div className="flex items-start gap-4">
                        {/* Agency Avatar */}
                        <Avatar className="h-10 w-10 sm:h-12 sm:w-12 flex-shrink-0">
                          <AvatarImage src={job.agencyInfo.logo || "/placeholder.svg"} alt="Agency Logo" />
                          <AvatarFallback className="bg-orange-500 text-white text-base sm:text-lg font-semibold">
                            {job.agencyInfo.name.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white line-clamp-1">
                            {job.title}
                          </CardTitle>
                          <p className="text-sm text-muted-foreground mt-1">{job.agencyInfo.name}</p>
                          <div className="flex items-center text-xs text-muted-foreground mt-1">
                            <Calendar className="h-3 w-3 mr-1" />
                            <span>Posted {job.postedDate}</span>
                            <span className="mx-2">•</span>
                            <Star className="h-3 w-3 mr-1 text-yellow-500" />
                            <span>{job.rating}</span>
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="p-4 sm:p-6 pt-3">
                      <p className="text-sm text-gray-700 dark:text-gray-300 mb-4 line-clamp-3">{job.description}</p>

                      {job.comments && (
                        <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                          <p className="text-xs text-muted-foreground mb-1">Comments</p>
                          <p className="text-sm text-gray-700 dark:text-gray-300">{job.comments}</p>
                        </div>
                      )}

                      {/* Key Metrics Grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4 text-sm">
                        <div className="flex items-center gap-2">
                          <span className="h-4 w-4 text-orange-500 flex-shrink-0">₦</span>
                          <div className="min-w-0">
                            <p className="text-xs text-muted-foreground">Budget</p>
                            <p className="font-medium text-gray-900 dark:text-white truncate">{job.budget}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-orange-500 flex-shrink-0" />
                          <div className="min-w-0">
                            <p className="text-xs text-muted-foreground">Duration</p>
                            <p className="font-medium text-gray-900 dark:text-white truncate">{job.duration}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-orange-500 flex-shrink-0" />
                          <div className="min-w-0">
                            <p className="text-xs text-muted-foreground">Location</p>
                            <p className="font-medium text-gray-900 dark:text-white truncate">{job.location}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Briefcase className="h-4 w-4 text-orange-500 flex-shrink-0" />
                          <div className="min-w-0">
                            <p className="text-xs text-muted-foreground">Job Type</p>
                            <p className="font-medium text-gray-900 dark:text-white truncate">{job.job_type}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-orange-500 flex-shrink-0" />
                          <div className="min-w-0">
                            <p className="text-xs text-muted-foreground">Proposals</p>
                            <p className="font-medium text-gray-900 dark:text-white">{job.proposals}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <CreditCard className="h-4 w-4 text-orange-500 flex-shrink-0" />
                          <div className="min-w-0">
                            <p className="text-xs text-muted-foreground">Credits</p>
                            <p className="font-medium text-gray-900 dark:text-white">{job.credit_cost}</p>
                          </div>
                        </div>
                      </div>
                      {/* Skills */}
                      <div className="flex flex-wrap gap-2 mb-4">
                        {job.skills?.slice(0, 5).map((skill: string, skillIndex: number) => (
                          <Badge
                            key={skillIndex}
                            variant="secondary"
                            className="text-xs bg-orange-50 text-orange-700 dark:bg-orange-900/20 dark:text-orange-300"
                          >
                            {skill}
                          </Badge>
                        ))}
                        {job.skills?.length > 5 && (
                          <Badge
                            variant="secondary"
                            className="text-xs bg-orange-50 text-orange-700 dark:bg-orange-900/20 dark:text-orange-300"
                          >
                            +{job.skills.length - 5} more
                          </Badge>
                        )}
                      </div>
                      {/* Action Buttons */}
                      <div className="flex gap-2 pt-4 border-t border-gray-100 dark:border-gray-700">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleJobAction(job, "view")}
                          className="flex-1 bg-transparent hover:bg-orange-50 dark:hover:bg-gray-700"
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          View
                        </Button>
                        <Button
                          className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
                          onClick={() => handleJobAction(job, "placeBid")}
                          disabled={creditBalance < job.credit_cost}
                        >
                          <Send className="h-4 w-4 mr-1" />
                          <span className="hidden md:inline">Place Bid</span>
                        </Button>
                        {/* Insufficient credits warning */}
                        {creditBalance < job.credit_cost && (
                          <p className="text-xs text-red-500 mt-2 text-center">
                            Insufficient credits ({creditBalance}/{job.credit_cost}) - Purchase more credits to bid
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
            {hasMoreJobs && jobs.length > 0 && (
              <div className="p-6 border-t border-gray-200 dark:border-gray-700">
                <div className="flex justify-center">
                  <Button
                    variant="outline"
                    className="bg-transparent hover:bg-orange-50 hover:border-orange-500 hover:text-orange-600"
                    onClick={handleLoadMoreJobs}
                    disabled={jobsLoading}
                  >
                    {jobsLoading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Users className="h-4 w-4 mr-2" />
                    )}
                    {jobsLoading ? "Loading More..." : "Load More Jobs"}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Filter Modal */}
      {showFilterModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Filter Jobs</CardTitle>
                <Button variant="ghost" size="icon" onClick={() => setShowFilterModal(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Keywords</label>
                <Input
                  placeholder="Search by title, company, or skills..."
                  value={filters.keywords}
                  onChange={(e) => setFilters({ ...filters, keywords: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Min Budget</label>
                  <Input
                    type="number"
                    placeholder="₦0"
                    value={filters.minBudget}
                    onChange={(e) => setFilters({ ...filters, minBudget: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Max Budget</label>
                  <Input
                    type="number"
                    placeholder="₦1,000,000"
                    value={filters.maxBudget}
                    onChange={(e) => setFilters({ ...filters, maxBudget: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Max Credits</label>
                <Select value={filters.credits} onValueChange={(value) => setFilters({ ...filters, credits: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select max credits" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">Up to 5 credits</SelectItem>
                    <SelectItem value="10">Up to 10 credits</SelectItem>
                    <SelectItem value="15">Up to 15 credits</SelectItem>
                    <SelectItem value="20">Up to 20 credits</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex space-x-2 pt-4">
                <Button variant="outline" className="flex-1 bg-transparent" onClick={resetFilters}>
                  Reset
                </Button>
                <Button className="flex-1 bg-orange-500 hover:bg-orange-600" onClick={applyFilters}>
                  Apply Filters
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Agency Profile Modal */}
      {showAgencyModal && selectedAgency && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <Avatar className="h-16 w-16">
                    <AvatarImage src={selectedAgency.logo || "/placeholder.svg"} alt="Agency Logo" />
                    <AvatarFallback className="text-lg font-semibold bg-orange-500 text-white">
                      {selectedAgency.fullName?.charAt(0).toUpperCase() ||
                        selectedAgency.companyName?.charAt(0).toUpperCase() ||
                        selectedAgency.name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="flex items-center space-x-2">
                      <CardTitle className="text-xl">{selectedAgency.name}</CardTitle>
                      <img src="/images/verified-tick.png" alt="Verified" className="h-5 w-5" />
                    </div>
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setShowAgencyModal(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h4 className="font-semibold mb-2">About</h4>
                <p className="text-sm text-muted-foreground">{selectedAgency.description}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="font-semibold mb-1">Location</h4>
                  <p className="text-sm text-muted-foreground">{selectedAgency.location}</p>
                </div>
                <div>
                  <h4 className="font-semibold mb-1">Total Jobs</h4>
                  <p className="text-sm text-muted-foreground">{selectedAgency.totalJobs}</p>
                </div>
                <div>
                  <h4 className="font-semibold mb-1">Team Size</h4>
                  <p className="text-sm text-muted-foreground">{selectedAgency.employees}</p>
                </div>
                <div>
                  <h4 className="font-semibold mb-1">Member Since</h4>
                  <p className="text-sm text-muted-foreground">{selectedAgency.memberSince}</p>
                </div>
              </div>
              {selectedAgency.phone && (
                <div>
                  <h4 className="font-semibold mb-1">Phone</h4>
                  <p className="text-sm text-muted-foreground">{selectedAgency.phone}</p>
                </div>
              )}
              {selectedAgency.website && (
                <div>
                  <h4 className="font-semibold mb-1">Website</h4>
                  <p className="text-sm text-muted-foreground">{selectedAgency.website}</p>
                </div>
              )}
              {selectedAgency.email && (
                <div>
                  <h4 className="font-semibold mb-1">Email</h4>
                  <p className="text-sm text-muted-foreground">{selectedAgency.email}</p>
                </div>
              )}
              {selectedAgency.companyName &&
                selectedAgency.fullName &&
                selectedAgency.companyName !== selectedAgency.fullName && (
                  <div>
                    <h4 className="font-semibold mb-1">Contact Person</h4>
                    <p className="text-sm text-muted-foreground">{selectedAgency.fullName}</p>
                  </div>
                )}
              <div className="flex justify-center pt-4">
                <Button variant="outline" className="bg-transparent" onClick={() => setShowAgencyModal(false)}>
                  Close
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Place Bid Modal */}
      {showPlaceBidModal && selectedJob && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end justify-end z-50">
          <div className="bg-white dark:bg-gray-800 w-full max-w-md h-full overflow-y-auto animate-in slide-in-from-right">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold">Place Your Bid</h3>
                <Button variant="ghost" size="icon" onClick={() => setShowPlaceBidModal(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="space-y-4 mb-6">
                <div>
                  <h4 className="font-semibold mb-2">{selectedJob.title}</h4>
                  <p className="text-sm text-muted-foreground mb-2">{selectedJob.agencyInfo.name}</p>
                  <div className="flex items-center space-x-4 text-sm">
                    <span className="flex items-center">
                      <span className="text-orange-500 mr-1">₦</span>
                      {selectedJob.budget.replace("₦", "")}
                    </span>
                    <span className="flex items-center">
                      <CreditCard className="h-4 w-4 mr-1 text-blue-500" />
                      {selectedJob.credit_cost} credits
                    </span>
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Your Proposal</label>
                  <Textarea
                    placeholder="Describe your approach to this project..."
                    value={bidData.proposal}
                    onChange={(e) => setBidData({ ...bidData, proposal: e.target.value })}
                    rows={4}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Timeline</label>
                  <Input
                    placeholder="e.g., 2 weeks"
                    value={bidData.timeline}
                    onChange={(e) => setBidData({ ...bidData, timeline: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Your Budget</label>
                  <Input
                    placeholder="₦0"
                    value={bidData.budget}
                    onChange={(e) => setBidData({ ...bidData, budget: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Attachments</label>
                  <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-4">
                    <input type="file" multiple onChange={handleFileSelect} className="hidden" id="file-upload" />
                    <label htmlFor="file-upload" className="cursor-pointer">
                      <div className="text-center">
                        <Upload className="h-8 w-8 mx-auto text-gray-400 mb-2" />
                        <p className="text-sm text-muted-foreground">Click to upload files</p>
                      </div>
                    </label>
                  </div>
                  {selectedFiles.length > 0 && (
                    <div className="mt-2 space-y-2">
                      {selectedFiles.map((file, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between bg-gray-100 dark:bg-gray-700 p-2 rounded"
                        >
                          <span className="text-sm truncate">{file.name}</span>
                          <Button variant="ghost" size="sm" onClick={() => removeFile(index)}>
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {/* Credit Balance Display */}
                <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Your Credit Balance:</span>
                    <span className="text-lg font-bold text-orange-600">{creditBalance}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Credits Required:</span>
                    <span className="text-lg font-bold text-orange-600">{selectedJob.credit_cost}</span>
                  </div>
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-orange-200 dark:border-orange-800">
                    <span className="text-sm font-medium">Remaining After:</span>
                    <span
                      className={`text-lg font-bold ${creditBalance >= selectedJob.credit_cost ? "text-green-600" : "text-red-600"}`}
                    >
                      {Math.max(0, creditBalance - selectedJob.credit_cost)}
                    </span>
                  </div>
                  {creditBalance < selectedJob.credit_cost && (
                    <p className="text-xs text-red-500 mt-2">
                      Insufficient credits! You need {selectedJob.credit_cost - creditBalance} more credits.
                    </p>
                  )}
                </div>
                <Button
                  className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
                  onClick={submitBid}
                  disabled={
                    !bidData.proposal ||
                    !bidData.timeline ||
                    !bidData.budget ||
                    creditBalance < selectedJob.credit_cost ||
                    isSubmittingBid
                  }
                >
                  {isSubmittingBid ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4 mr-2" />
                  )}
                  {isSubmittingBid ? "Submitting..." : "Submit Proposal"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Latest/Date Filter Modal */}
      {showLatestModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Filter by Date</CardTitle>
                <Button variant="ghost" size="icon" onClick={() => setShowLatestModal(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">From Date</label>
                <Input
                  type="date"
                  value={dateFilters.fromDate}
                  onChange={(e) => setDateFilters({ ...dateFilters, fromDate: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">To Date</label>
                <Input
                  type="date"
                  value={dateFilters.toDate}
                  onChange={(e) => setDateFilters({ ...dateFilters, toDate: e.target.value })}
                />
              </div>
              <div className="flex space-x-2 pt-4">
                <Button
                  variant="outline"
                  className="flex-1 bg-transparent"
                  onClick={() => {
                    setDateFilters({ fromDate: "", toDate: "" })
                    setJobsOffset(0)
                    setHasMoreJobs(true)
                    loadJobs(0, searchQuery, false)
                    setShowLatestModal(false)
                  }}
                >
                  Reset
                </Button>
                <Button className="flex-1 bg-orange-500 hover:bg-orange-600" onClick={applyDateFilters}>
                  Apply
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
