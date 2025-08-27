"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Plus,
  MoreHorizontal,
  TrendingUp,
  Eye,
  Calendar,
  FileText,
  Play,
  Pause,
  X,
  Edit,
  MapPin,
  Clock,
  Users,
  CheckCircle,
  XCircle,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import AgencyNavbar from "@/components/agency-navbar"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import PaymentModal from "@/components/payment-modal"

// Available skills for selection
const availableSkills = [
 "Web Development",
  "Mobile App Development",
  "Frontend Development",
  "Backend Development",
  "Full-Stack Development",
  "UI/UX Design",
  "Software Development",
  

]

export default function AgencyDashboard() {
  const [isDarkMode, setIsDarkMode] = useState(false)
  const [showJobActionModal, setShowJobActionModal] = useState(false)
  const [selectedJob, setSelectedJob] = useState<any>(null)
  const [actionType, setActionType] = useState<"edit" | "pause" | "close" | null>(null)
  const [showPostJobModal, setShowPostJobModal] = useState(false)
  const [postJobStep, setPostJobStep] = useState(1)
  const [selectedSkills, setSelectedSkills] = useState<string[]>([])
  const [agencyJobs, setAgencyJobs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showProposalsModal, setShowProposalsModal] = useState(false)
  const [loadingProposals, setLoadingProposals] = useState(false)
  const [selectedJobProposals, setSelectedJobProposals] = useState<any[]>([])
  const [freelancerImages, setFreelancerImages] = useState<{ [key: string]: string }>({})
  const [jobFormData, setJobFormData] = useState({
    title: "",
    description: "",
    budgetMin: "",
    budgetMax: "",
    duration: "",
    location: "",
    jobType: "",
    credits: 5,
    comments: "",
  })
  const router = useRouter()
  const [profileImage, setProfileImage] = useState<string>("")
  const [profile, setProfile] = useState<any>(null)
  const [messageInputOpenForProposalId, setMessageInputOpenForProposalId] = useState<string | null>(null)
  const [currentMessageText, setCurrentMessageText] = useState<string>("")
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [selectedProposal, setSelectedProposal] = useState<any>(null)
  const [isPosting, setIsPosting] = useState(false)

  useEffect(() => {
    loadProfileAndJobs()
  }, [])

  const loadProfileAndJobs = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (user) {
        console.log("Current user ID:", user.id)

        // Load profile data
        const { data: profileData } = await supabase.from("profiles").select("*").eq("id", user.id).single()
        if (profileData) {
          setProfile(profileData)
          console.log("Profile loaded:", profileData)
        }

        // Load profile image from agency_image table
        const { data: imageData } = await supabase
          .from("agency_image")
          .select("image_data")
          .eq("agency_id", user.id)
          .single()
        if (imageData) {
          setProfileImage(imageData.image_data)
        }

        // Load agency jobs with proposal counts
        const { data: jobsData, error: jobsError } = await supabase
          .from("jobs")
          .select(
            `
            *,
            proposals(count)
          `,
          )
          .eq("agency_id", user.id)
          .order("created_at", { ascending: false })

        if (jobsError) {
          console.error("Error loading jobs:", jobsError)
        } else {
          console.log("Jobs loaded:", jobsData)
          const transformedJobs =
            jobsData?.map((job: any) => ({
              ...job,
              proposals: job.proposals?.[0]?.count || 0,
            })) || []
          setAgencyJobs(transformedJobs)
        }
      }
    } catch (error) {
      console.error("Error loading profile and jobs:", error)
    } finally {
      setLoading(false)
    }
  }

  const loadFreelancerImages = async (freelancerIds: string[]) => {
    try {
      const imagePromises = freelancerIds.map(async (freelancerId) => {
        const { data: imageData } = await supabase
          .from("freelancer_logos")
          .select("logo_data")
          .eq("freelancer_id", freelancerId)
          .single()
        return {
          freelancerId,
          imageData: imageData?.logo_data || "",
        }
      })
      const results = await Promise.all(imagePromises)
      const imageMap: { [key: string]: string } = {}
      results.forEach(({ freelancerId, imageData }) => {
        imageMap[freelancerId] = imageData
      })
      setFreelancerImages(imageMap)
    } catch (error) {
      console.error("Error loading freelancer images:", error)
    }
  }

  const handleJobAction = async (job: any, action: "edit" | "pause" | "close") => {
    if (action === "edit") {
      setSelectedJob(job)
      setActionType(action)
      setShowJobActionModal(true)
    } else {
      try {
        const newStatus = action === "pause" ? (job.status === "paused" ? "active" : "paused") : "closed"
        const { error } = await supabase
          .from("jobs")
          .update({ status: newStatus, updated_at: new Date().toISOString() })
          .eq("id", job.id)
        if (error) {
          console.error("Error updating job status:", error)
          alert("Error updating job status")
          return
        }
        loadProfileAndJobs()
        alert(`Job ${newStatus === "active" ? "resumed" : newStatus} successfully!`)
      } catch (error) {
        console.error("Error updating job:", error)
        alert("Error updating job. Please try again.")
      }
    }
  }

  const handleViewProposals = async (job: any) => {
    console.log("🔍 Loading proposals for job:", job.id)
    setSelectedJob(job)
    setShowProposalsModal(true)
    setLoadingProposals(true)

    try {
      // First, let's check if we can see the proposals directly
      const { data: directProposals, error: directError } = await supabase
        .from("proposals")
        .select("*")
        .eq("job_id", job.id)

      console.log("Direct proposals query result:", { directProposals, directError })

      // Now let's try the full query with joins
      const { data: proposalsData, error } = await supabase
        .from("proposals")
        .select(`
          id,
          job_id,
          freelancer_id,
          proposal_text,
          budget,
          timeline,
          attachments,
          status,
          created_at,
          updated_at,
          profiles!proposals_freelancer_id_fkey (
            id,
            full_name,
            bio,
            location,
            phone,
            website
          )
        `)
        .eq("job_id", job.id)
        .order("created_at", { ascending: false })

      console.log("Proposals query result:", { proposalsData, error })

      if (error) {
        console.error("Error loading proposals:", error)
        alert("Error loading proposals: " + error.message)
        return
      }

      setSelectedJobProposals(proposalsData || [])

      // Load freelancer images for all proposals
      const freelancerIds = proposalsData?.map((proposal) => proposal.freelancer_id) || []
      console.log("Freelancer IDs to load images for:", freelancerIds)

      if (freelancerIds.length > 0) {
        await loadFreelancerImages(freelancerIds)
      }
    } catch (error) {
      console.error("Error loading proposals:", error)
      alert("Error loading proposals. Please try again.")
    } finally {
      setLoadingProposals(false)
    }
  }

  const handleProposalAction = async (proposalId: string, action: "accept" | "reject") => {
    try {
      console.log(`${action}ing proposal:`, proposalId)

      const { error } = await supabase
        .from("proposals")
        .update({
          status: action === "accept" ? "accepted" : "rejected",
          updated_at: new Date().toISOString(),
        })
        .eq("id", proposalId)

      if (error) {
        console.error("Error updating proposal:", error)
        alert("Error updating proposal: " + error.message)
        return
      }

      // Reload proposals
      handleViewProposals(selectedJob)
      alert(`Proposal ${action}ed successfully!`)
    } catch (error) {
      console.error("Error updating proposal:", error)
      alert("Error updating proposal. Please try again.")
    }
  }

  const handleSendMessage = async (freelancerId: string, agencyId: string, message: string) => {
    if (!message.trim()) {
      alert("Message cannot be empty.")
      return
    }
    try {
      // Check if a conversation already exists
      const { data: existingConversation, error: conversationError } = await supabase
        .from("conversations")
        .select("id")
        .or(
          `and(participant1_id.eq.${agencyId},participant2_id.eq.${freelancerId}),and(participant1_id.eq.${freelancerId},participant2_id.eq.${agencyId})`,
        )
        .single()

      let conversationId
      if (conversationError && conversationError.code === "PGRST116") {
        // No rows found, create a new conversation
        const { data: newConversation, error: newConversationError } = await supabase
          .from("conversations")
          .insert([{ participant1_id: agencyId, participant2_id: freelancerId }])
          .select("id")
          .single()

        if (newConversationError) {
          console.error("Error creating new conversation:", newConversationError)
          alert("Error creating conversation.")
          return
        }
        conversationId = newConversation.id
      } else if (conversationError) {
        console.error("Error fetching conversation:", conversationError)
        alert("Error fetching conversation.")
        return
      } else {
        conversationId = existingConversation.id
      }

      // Insert the message
      const { error: messageError } = await supabase.from("messages").insert([
        {
          conversation_id: conversationId,
          sender_id: agencyId,
          receiver_id: freelancerId,
          message_text: message,
        },
      ])

      if (messageError) {
        console.error("Error sending message:", messageError)
        alert("Error sending message.")
        return
      }

      // Update last_message_at for the conversation
      await supabase
        .from("conversations")
        .update({ last_message_at: new Date().toISOString() })
        .eq("id", conversationId)

      alert("Message sent successfully!")
      setCurrentMessageText("")
      setMessageInputOpenForProposalId(null)
    } catch (error) {
      console.error("Error in sending message process:", error)
      alert("Error sending message. Please try again.")
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-800 border-green-200"
      case "paused":
        return "bg-yellow-100 text-yellow-800 border-yellow-200"
      case "closed":
        return "bg-gray-100 text-gray-800 border-gray-200"
      default:
        return "bg-gray-100 text-gray-800 border-gray-200"
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "active":
        return <Play className="h-3 w-3" />
      case "paused":
        return <Pause className="h-3 w-3" />
      case "closed":
        return <X className="h-3 w-3" />
      default:
        return null
    }
  }

  const addSkill = (skill: string) => {
    if (!selectedSkills.includes(skill)) {
      setSelectedSkills([...selectedSkills, skill])
    }
  }

  const removeSkill = (skill: string) => {
    setSelectedSkills(selectedSkills.filter((s) => s !== skill))
  }

  const handlePostJob = async () => {
    try {
      setIsPosting(true)
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      const jobData = {
        agency_id: user.id,
        title: jobFormData.title,
        description: jobFormData.description,
        budget_min: jobFormData.budgetMin ? Number.parseInt(jobFormData.budgetMin) : null,
        budget_max: jobFormData.budgetMax ? Number.parseInt(jobFormData.budgetMax) : null,
        duration: jobFormData.duration,
        location: jobFormData.location,
        job_type: jobFormData.jobType,
        skills: selectedSkills,
        credit_cost: jobFormData.credits,
        status: "active",
      }

      const { error } = await supabase.from("jobs").insert([jobData])
      if (error) {
        console.error("Error posting job:", error)
        alert("Error posting job: " + error.message)
        setIsPosting(false)
        return
      }

      alert("Job posted successfully!")
      setShowPostJobModal(false)
      setPostJobStep(1)
      setSelectedSkills([])
      setJobFormData({
        title: "",
        description: "",
        budgetMin: "",
        budgetMax: "",
        duration: "",
        location: "",
        jobType: "",
        credits: 5,
        comments: "",
      })
      setIsPosting(false)
    } catch (error) {
      console.error("Error posting job:", error)
      alert("Error posting job. Please try again.")
      setIsPosting(false)
    }
  }

  // Calculate metrics
  const activeJobs = agencyJobs.filter((job) => job.status === "active").length
  const pausedJobs = agencyJobs.filter((job) => job.status === "paused").length
  const closedJobs = agencyJobs.filter((job) => job.status === "closed").length
  const totalProposals = agencyJobs.reduce((sum, job) => sum + job.proposals, 0)

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <AgencyNavbar onPostJobClick={() => setShowPostJobModal(true)} />
        <div className="max-w-7xl mx-auto py-8 px-4">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-300 rounded w-1/4 mb-6"></div>
            <div className="space-y-4">
              <div className="h-32 bg-gray-300 rounded"></div>
              <div className="h-20 bg-gray-300 rounded"></div>
              <div className="h-20 bg-gray-300 rounded"></div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`min-h-screen bg-gray-50 dark:bg-gray-900 ${isDarkMode ? "dark" : ""}`}>
      <AgencyNavbar onPostJobClick={() => setShowPostJobModal(true)} />
      {/* Main Content */}
      <div className="max-w-7xl mx-auto py-4 sm:py-6 px-4 sm:px-6 lg:px-8">
        {/* Welcome Card */}
        <Card className="bg-gradient-to-br from-orange-500 via-orange-600 to-orange-700 text-white overflow-hidden relative mb-6">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-16 translate-x-16"></div>
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-12 -translate-x-12"></div>
          <CardContent className="p-4 sm:p-6 relative z-10">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex-1">
                <h2 className="text-xl sm:text-2xl font-bold mb-2">
                  Welcome back, {profile?.company_name || profile?.full_name || "Agency"}!
                </h2>
                <p className="text-orange-100 mb-4 text-sm sm:text-base">
                  Manage your job posts and find the best talent
                </p>
                <Button
                  variant="secondary"
                  size="sm"
                  className="bg-white/20 hover:bg-white/30 text-white border-white/30"
                  onClick={() => setShowPostJobModal(true)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Post New Job
                </Button>
              </div>
              <div className="text-center sm:text-right">
                <div className="text-2xl sm:text-3xl font-bold">{agencyJobs.length}</div>
                <div className="text-orange-200 text-xs sm:text-sm">Total Jobs Posted</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Metrics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
          <Card className="border-l-4 border-l-green-500 bg-white dark:bg-gray-800 hover:shadow-md transition-shadow">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-muted-foreground text-sm font-medium truncate">Active Jobs</p>
                  <p className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">{activeJobs}</p>
                  <p className="text-xs sm:text-sm text-green-600 flex items-center mt-1">
                    <Play className="h-3 w-3 sm:h-4 sm:w-4 mr-1 flex-shrink-0" />
                    <span className="truncate">Currently hiring</span>
                  </p>
                </div>
                <div className="bg-green-100 dark:bg-green-900/20 p-3 rounded-full flex-shrink-0 ml-3">
                  <Play className="h-5 w-5 sm:h-6 sm:w-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-yellow-500 bg-white dark:bg-gray-800 hover:shadow-md transition-shadow">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-muted-foreground text-sm font-medium truncate">Paused</p>
                  <p className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">{pausedJobs}</p>
                  <p className="text-xs sm:text-sm text-yellow-600 flex items-center mt-1">
                    <Pause className="h-3 w-3 sm:h-4 sm:w-4 mr-1 flex-shrink-0" />
                    <span className="truncate">Temporarily paused</span>
                  </p>
                </div>
                <div className="bg-yellow-100 dark:bg-yellow-900/20 p-3 rounded-full flex-shrink-0 ml-3">
                  <Pause className="h-5 w-5 sm:h-6 sm:w-6 text-yellow-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-gray-500 bg-white dark:bg-gray-800 hover:shadow-md transition-shadow">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-muted-foreground text-sm font-medium truncate">Closed</p>
                  <p className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">{closedJobs}</p>
                  <p className="text-xs sm:text-sm text-gray-600 flex items-center mt-1">
                    <X className="h-3 w-3 sm:h-4 sm:w-4 mr-1 flex-shrink-0" />
                    <span className="truncate">Completed/Closed</span>
                  </p>
                </div>
                <div className="bg-gray-100 dark:bg-gray-700 p-3 rounded-full flex-shrink-0 ml-3">
                  <X className="h-5 w-5 sm:h-6 sm:w-6 text-gray-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-orange-500 bg-white dark:bg-gray-800 hover:shadow-md transition-shadow">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-muted-foreground text-sm font-medium truncate">Total Proposals</p>
                  <p className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">{totalProposals}</p>
                  <p className="text-xs sm:text-sm text-orange-600 flex items-center mt-1">
                    <TrendingUp className="h-3 w-3 sm:h-4 sm:w-4 mr-1 flex-shrink-0" />
                    <span className="truncate">Across all jobs</span>
                  </p>
                </div>
                <div className="bg-orange-100 dark:bg-orange-900/20 p-3 rounded-full flex-shrink-0 ml-3">
                  <FileText className="h-5 w-5 sm:h-6 sm:w-6 text-orange-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Job Posts Section */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <CardTitle className="text-lg sm:text-xl">Your Job Posts</CardTitle>
              <Button
                className="bg-orange-500 hover:bg-orange-600 w-full sm:w-auto"
                onClick={() => setShowPostJobModal(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Post New Job
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {agencyJobs.length === 0 ? (
              <div className="p-8 text-center">
                <FileText className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">No Jobs Posted Yet</h3>
                <p className="text-muted-foreground mb-4">
                  Start by posting your first job to find talented freelancers
                </p>
                <Button className="bg-orange-500 hover:bg-orange-600" onClick={() => setShowPostJobModal(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Post Your First Job
                </Button>
              </div>
            ) : (
              <div className="space-y-0">
                {agencyJobs.map((job, index) => (
                  <div
                    key={job.id}
                    className={`p-4 sm:p-6 ${index !== agencyJobs.length - 1 ? "border-b border-gray-200 dark:border-gray-700" : ""}`}
                  >
                    <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                      {/* Job Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 mb-3">
                          <div className="flex-1 min-w-0">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1 line-clamp-1">
                              {job.title}
                            </h3>
                            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground mb-2">
                              <span className="flex items-center">
                                <Calendar className="h-4 w-4 mr-1" />
                                {new Date(job.created_at).toLocaleDateString()}
                              </span>
                              <span className="flex items-center">
                                <Eye className="h-4 w-4 mr-1" />0 views
                              </span>
                              <span className="flex items-center">
                                <Users className="h-4 w-4 mr-1" />
                                {job.proposals} proposals
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge className={`${getStatusColor(job.status)} flex items-center gap-1 text-xs`}>
                              {getStatusIcon(job.status)}
                              {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
                            </Badge>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleJobAction(job, "edit")}>
                                  <Edit className="mr-2 h-4 w-4" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleJobAction(job, "pause")}>
                                  <Pause className="mr-2 h-4 w-4" />
                                  {job.status === "paused" ? "Resume" : "Pause"}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleJobAction(job, "close")}>
                                  <X className="mr-2 h-4 w-4" />
                                  Close
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{job.description}</p>
                        <div className="flex flex-wrap gap-1 mb-3">
                          {job.skills?.slice(0, 4).map((skill: string, skillIndex: number) => (
                            <Badge key={skillIndex} variant="outline" className="text-xs">
                              {skill}
                            </Badge>
                          ))}
                          {job.skills?.length > 4 && (
                            <Badge variant="outline" className="text-xs">
                              +{job.skills.length - 4} more
                            </Badge>
                          )}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4 text-sm">
                          <div className="flex items-center">
                            <span className="font-semibold text-orange-600 truncate">
                              ₦{job.budget_min?.toLocaleString()} - ₦{job.budget_max?.toLocaleString()}
                            </span>
                          </div>
                          <div className="flex items-center">
                            <Clock className="h-4 w-4 text-muted-foreground mr-1 flex-shrink-0" />
                            <span className="truncate">{job.duration}</span>
                          </div>
                          <div className="flex items-center">
                            <MapPin className="h-4 w-4 text-muted-foreground mr-1 flex-shrink-0" />
                            <span className="truncate">{job.location}</span>
                          </div>
                        </div>
                      </div>
                      {/* Action Button */}
                      <div className="flex-shrink-0">
                        <Button
                          variant="outline"
                          className="w-full sm:w-auto bg-transparent border-orange-500 text-orange-500 hover:bg-orange-50"
                          onClick={() => handleViewProposals(job)}
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          View Proposals ({job.proposals})
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Proposals Modal */}
      {showProposalsModal && selectedJob && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-full sm:max-w-lg md:max-w-2xl lg:max-w-4xl max-h-[90vh] overflow-y-auto rounded-lg">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl">Proposals for "{selectedJob.title}"</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    {selectedJobProposals.length} proposal{selectedJobProposals.length !== 1 ? "s" : ""} received
                  </p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setShowProposalsModal(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loadingProposals ? (
                <div className="text-center py-8">
                  <div className="animate-spin inline-block w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full" />
                  <p className="text-muted-foreground mt-4">Loading proposals...</p>
                </div>
              ) : selectedJobProposals.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-semibold mb-2">No Proposals Yet</h3>
                  <p className="text-muted-foreground">Freelancers haven't submitted any proposals for this job yet.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {selectedJobProposals.map((proposal) => (
                    <div key={proposal.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center space-x-3">
                          <Avatar className="h-12 w-12">
                            <AvatarImage
                              src={freelancerImages[proposal.freelancer_id] || "/placeholder.svg?height=48&width=48"}
                              alt="Freelancer"
                            />
                            <AvatarFallback>{proposal.profiles?.full_name?.charAt(0) || "F"}</AvatarFallback>
                          </Avatar>
                          <div>
                            <h4 className="font-semibold">{proposal.profiles?.full_name || "Unknown Freelancer"}</h4>
                            <p className="text-sm text-muted-foreground">
                              {proposal.profiles?.location || "Location not specified"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Submitted {new Date(proposal.created_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Badge
                            className={`${
                              proposal.status === "accepted"
                                ? "bg-green-100 text-green-800"
                                : proposal.status === "rejected"
                                  ? "bg-red-100 text-red-800"
                                  : "bg-yellow-100 text-yellow-800"
                            }`}
                          >
                            {proposal.status.charAt(0).toUpperCase() + proposal.status.slice(1)}
                          </Badge>
                        </div>
                      </div>
                      <div className="space-y-3">
                        <div>
                          <h5 className="font-medium mb-2">Proposal</h5>
                          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{proposal.proposal_text}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <h5 className="font-medium mb-1">Timeline</h5>
                            <p className="text-sm text-muted-foreground">{proposal.timeline || "Not specified"}</p>
                          </div>
                          <div>
                            <h5 className="font-medium mb-1">Budget</h5>
                            <p className="text-sm font-semibold text-orange-600">
                              {proposal.budget || "Not specified"}
                            </p>
                          </div>
                        </div>
                        {proposal.profiles?.bio && (
                          <div>
                            <h5 className="font-medium mb-1">About Freelancer</h5>
                            <p className="text-sm text-muted-foreground">{proposal.profiles.bio}</p>
                          </div>
                        )}
                        {/* Action buttons based on proposal status */}
                        {proposal.status === "pending" && (
                          <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2 pt-4">
                            <Button
                              variant="outline"
                              className="flex-1 bg-transparent border-red-500 text-red-500 hover:bg-red-50"
                              onClick={() => handleProposalAction(proposal.id, "reject")}
                            >
                              <XCircle className="h-4 w-4 mr-2" />
                              Reject
                            </Button>
                            <Button
                              className="flex-1 bg-green-500 hover:bg-green-600"
                              onClick={() => handleProposalAction(proposal.id, "accept")}
                            >
                              <CheckCircle className="h-4 w-4 mr-2" />
                              Accept
                            </Button>
                          </div>
                        )}
                        {proposal.status === "accepted" && (
                          <div className="pt-4">
                            {!messageInputOpenForProposalId || messageInputOpenForProposalId !== proposal.id ? (
                              <div className="flex flex-col sm:flex-row gap-2">
                                <Button
                                  className="flex-1 bg-orange-500 hover:bg-orange-600"
                                  onClick={() => {
                                    setMessageInputOpenForProposalId(proposal.id)
                                    setCurrentMessageText("")
                                  }}
                                >
                                  Message Freelancer
                                </Button>
                                <Button
                                  className="flex-1 bg-orange-500 hover:bg-orange-600"
                                  onClick={() => {
                                    setSelectedProposal(proposal)
                                    setShowPaymentModal(true)
                                    setShowProposalsModal(false)
                                  }}
                                >
                                  Fund Job
                                </Button>
                              </div>
                            ) : (
                              <div className="space-y-3">
                                <Textarea
                                  placeholder={`Send a message to ${proposal.profiles?.full_name || "this freelancer"}...`}
                                  value={currentMessageText}
                                  onChange={(e) => setCurrentMessageText(e.target.value)}
                                  rows={4}
                                />
                                <div className="flex justify-end space-x-2">
                                  <Button
                                    variant="outline"
                                    onClick={() => {
                                      setMessageInputOpenForProposalId(null)
                                      setCurrentMessageText("")
                                    }}
                                  >
                                    Cancel
                                  </Button>
                                  <Button
                                    className="bg-orange-500 hover:bg-orange-600"
                                    onClick={() =>
                                      handleSendMessage(proposal.freelancer_id, profile?.id, currentMessageText)
                                    }
                                  >
                                    Send Message
                                  </Button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && selectedProposal && selectedJob && (
        <PaymentModal
          isOpen={showPaymentModal}
          onClose={() => {
            setShowPaymentModal(false)
            setSelectedProposal(null)
          }}
          jobData={{
            id: selectedJob.id,
            title: selectedJob.title,
            freelancer: {
              id: selectedProposal.freelancer_id,
              name: selectedProposal.profiles?.full_name || "Unknown Freelancer",
              email: selectedProposal.profiles?.email || "No email",
            },
            amount: selectedJob.budget_max || 0,
          }}
          onSuccess={() => {
            setShowPaymentModal(false)
            setSelectedProposal(null)
          }}
        />
      )}

      {/* Post Job Modal */}
      {showPostJobModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50">
          <div className="fixed right-0 top-0 h-full w-full max-w-sm sm:max-w-md lg:max-w-2xl bg-white dark:bg-gray-800 shadow-xl transform transition-transform duration-300 ease-in-out">
            <div className="h-full flex flex-col">
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Post a Job</h3>
                  <p className="text-sm text-muted-foreground">
                    Step {postJobStep} of 4 -{" "}
                    {postJobStep === 1
                      ? "Job Details"
                      : postJobStep === 2
                        ? "Skills & Credits"
                        : postJobStep === 3
                          ? "Job Type & Budget"
                          : "Review & Post"}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setShowPostJobModal(false)
                    setPostJobStep(1)
                    setSelectedSkills([])
                    setJobFormData({
                      title: "",
                      description: "",
                      budgetMin: "",
                      budgetMax: "",
                      duration: "",
                      location: "",
                      jobType: "",
                      credits: 5,
                      comments: "",
                    })
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              {/* Progress Bar */}
              <div className="px-6 py-3 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center space-x-2">
                  {[1, 2, 3, 4].map((step) => (
                    <div key={step} className="flex items-center">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                          step <= postJobStep
                            ? "bg-orange-500 text-white"
                            : "bg-gray-200 dark:bg-gray-600 text-gray-500 dark:text-gray-400"
                        }`}
                      >
                        {step}
                      </div>
                      {step < 4 && (
                        <div
                          className={`w-12 h-1 mx-2 ${
                            step < postJobStep ? "bg-orange-500" : "bg-gray-200 dark:bg-gray-600"
                          }`}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
              {/* Scrollable Content */}
              <div className="flex-1 overflow-y-auto p-6">
                {/* Step 1: Job Details */}
                {postJobStep === 1 && (
                  <div className="space-y-6">
                    <div>
                      <Label className="text-sm font-medium mb-3 block text-gray-900 dark:text-white">
                        Job Title *
                      </Label>
                      <Input
                        type="text"
                        placeholder="e.g. Full-Stack Developer for E-commerce Platform"
                        className="w-full"
                        value={jobFormData.title}
                        onChange={(e) => setJobFormData({ ...jobFormData, title: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label className="text-sm font-medium mb-3 block text-gray-900 dark:text-white">
                        Job Description *
                      </Label>
                      <Textarea
                        rows={8}
                        placeholder="Describe your project in detail. Include requirements, expectations, deliverables, and any specific instructions for freelancers..."
                        className="w-full resize-none"
                        value={jobFormData.description}
                        onChange={(e) => setJobFormData({ ...jobFormData, description: e.target.value })}
                      />
                      <p className="text-xs text-muted-foreground mt-2">
                        {jobFormData.description.length}/2000 characters
                      </p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium mb-3 block text-gray-900 dark:text-white">Duration *</Label>
                      <Input
                        type="text"
                        placeholder="e.g. 2 weeks, 1 month, 3 months"
                        className="w-full"
                        value={jobFormData.duration}
                        onChange={(e) => setJobFormData({ ...jobFormData, duration: e.target.value })}
                      />
                    </div>
                  </div>
                )}
                {/* Step 2: Skills & Credits */}
                {postJobStep === 2 && (
                  <div className="space-y-6">
                    <div>
                      <Label className="text-sm font-medium mb-3 block text-gray-900 dark:text-white">
                        Required Skills *
                      </Label>
                      <div className="border border-gray-300 dark:border-gray-600 rounded-lg p-4 max-h-80 overflow-y-auto bg-white dark:bg-gray-700">
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                          {availableSkills.map((skill) => (
                            <label
                              key={skill}
                              className="flex items-center space-x-2 cursor-pointer p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-600"
                            >
                              <input
                                type="checkbox"
                                checked={selectedSkills.includes(skill)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    addSkill(skill)
                                  } else {
                                    removeSkill(skill)
                                  }
                                }}
                                className="rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                              />
                              <span className="text-sm text-gray-900 dark:text-white">{skill}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>
                    {selectedSkills.length > 0 && (
                      <div className="mt-4">
                        <p className="text-sm font-medium mb-3 text-gray-900 dark:text-white">
                          Selected Skills ({selectedSkills.length}):
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {selectedSkills.map((skill) => (
                            <Badge
                              key={skill}
                              variant="secondary"
                              className="bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-300"
                            >
                              {skill}
                              <button
                                onClick={() => removeSkill(skill)}
                                className="ml-2 hover:text-orange-900 dark:hover:text-orange-100"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    <div>
                      <Label className="text-sm font-medium mb-3 block text-gray-900 dark:text-white">
                        Credits Required *
                      </Label>
                      <Select
                        value={jobFormData.credits.toString()}
                        onValueChange={(value) => setJobFormData({ ...jobFormData, credits: Number.parseInt(value) })}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select credits" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="5">5 Credits</SelectItem>
                          <SelectItem value="10">10 Credits</SelectItem>
                          <SelectItem value="15">15 Credits</SelectItem>
                          <SelectItem value="20">20 Credits (Maximum)</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground mt-2">
                        Higher credits attract more qualified freelancers
                      </p>
                    </div>
                  </div>
                )}
                {/* Step 3: Job Type & Budget */}
                {postJobStep === 3 && (
                  <div className="space-y-6">
                    <div>
                      <Label className="text-sm font-medium mb-3 block text-gray-900 dark:text-white">Job Type *</Label>
                      <Select
                        value={jobFormData.jobType}
                        onValueChange={(value) => setJobFormData({ ...jobFormData, jobType: value })}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select job type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Remote">Remote</SelectItem>
                          <SelectItem value="Hybrid">Hybrid</SelectItem>
                          <SelectItem value="On-site">On-site</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-sm font-medium mb-3 block text-gray-900 dark:text-white">Location *</Label>
                      <Input
                        type="text"
                        placeholder="e.g. Lagos, Nigeria"
                        className="w-full"
                        value={jobFormData.location}
                        onChange={(e) => setJobFormData({ ...jobFormData, location: e.target.value })}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-sm font-medium mb-3 block text-gray-900 dark:text-white">
                          Min Budget (₦) *
                        </Label>
                        <Input
                          type="number"
                          placeholder="100000"
                          className="w-full"
                          value={jobFormData.budgetMin}
                          onChange={(e) => setJobFormData({ ...jobFormData, budgetMin: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label className="text-sm font-medium mb-3 block text-gray-900 dark:text-white">
                          Max Budget (₦) *
                        </Label>
                        <Input
                          type="number"
                          placeholder="500000"
                          className="w-full"
                          value={jobFormData.budgetMax}
                          onChange={(e) => setJobFormData({ ...jobFormData, budgetMax: e.target.value })}
                        />
                      </div>
                    </div>
                    <div>
                      <Label className="text-sm font-medium mb-3 block text-gray-900 dark:text-white">
                        Additional Comments (Optional)
                      </Label>
                      <Textarea
                        rows={6}
                        placeholder="Add any additional requirements, preferences, or information that would help freelancers understand your project better..."
                        className="w-full resize-none"
                        value={jobFormData.comments}
                        onChange={(e) => setJobFormData({ ...jobFormData, comments: e.target.value })}
                      />
                    </div>
                  </div>
                )}
                {/* Step 4: Review */}
                {postJobStep === 4 && (
                  <div className="space-y-6">
                    <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
                      <h4 className="font-semibold mb-4 text-gray-900 dark:text-white">Job Preview</h4>
                      <div className="space-y-4">
                        <div>
                          <p className="text-sm font-medium text-muted-foreground mb-1">Title</p>
                          <p className="font-semibold text-gray-900 dark:text-white">{jobFormData.title}</p>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-muted-foreground mb-1">Description</p>
                          <p className="text-sm text-gray-900 dark:text-white whitespace-pre-wrap">
                            {jobFormData.description}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-muted-foreground mb-2">
                            Required Skills ({selectedSkills.length})
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {selectedSkills.map((skill) => (
                              <Badge key={skill} variant="outline" className="text-xs">
                                {skill}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-sm font-medium text-muted-foreground mb-1">Budget Range</p>
                            <p className="font-semibold text-gray-900 dark:text-white">
                              ₦{Number.parseInt(jobFormData.budgetMin || "0").toLocaleString()} - ₦
                              {Number.parseInt(jobFormData.budgetMax || "0").toLocaleString()}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-muted-foreground mb-1">Duration</p>
                            <p className="font-semibold text-gray-900 dark:text-white">{jobFormData.duration}</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-sm font-medium text-muted-foreground mb-1">Job Type</p>
                            <p className="font-semibold text-gray-900 dark:text-white">{jobFormData.jobType}</p>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-muted-foreground mb-1">Location</p>
                            <p className="font-semibold text-gray-900 dark:text-white">{jobFormData.location}</p>
                          </div>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-muted-foreground mb-1">Credits Required</p>
                          <p className="font-semibold flex items-center text-gray-900 dark:text-white">
                            <span className="w-2 h-2 bg-orange-500 rounded-full mr-2"></span>
                            {jobFormData.credits} Credits
                          </p>
                        </div>
                        {jobFormData.comments && (
                          <div>
                            <p className="text-sm font-medium text-muted-foreground mb-1">Additional Comments</p>
                            <p className="text-sm text-gray-900 dark:text-white whitespace-pre-wrap">
                              {jobFormData.comments}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-lg border border-orange-200 dark:border-orange-800">
                      <div className="flex items-start space-x-3">
                        <div className="bg-orange-100 dark:bg-orange-900/40 p-2 rounded-full">
                          <Eye className="h-4 w-4 text-orange-600" />
                        </div>
                        <div>
                          <h5 className="font-medium text-orange-800 dark:text-orange-200">Ready to Post?</h5>
                          <p className="text-sm text-orange-700 dark:text-orange-300 mt-1">
                            Your job will be visible to all freelancers on the platform. You'll start receiving
                            proposals shortly after posting.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              {/* Footer */}
              <div className="border-t border-gray-200 dark:border-gray-700 p-6">
                <div className="flex justify-between">
                  <Button
                    variant="outline"
                    onClick={() => {
                      if (postJobStep > 1) {
                        setPostJobStep(postJobStep - 1)
                      } else {
                        setShowPostJobModal(false)
                        setPostJobStep(1)
                        setSelectedSkills([])
                        setJobFormData({
                          title: "",
                          description: "",
                          budgetMin: "",
                          budgetMax: "",
                          duration: "",
                          location: "",
                          jobType: "",
                          credits: 5,
                          comments: "",
                        })
                      }
                    }}
                    className="bg-transparent"
                  >
                    {postJobStep === 1 ? "Cancel" : "Back"}
                  </Button>
                  <Button
                    className="bg-orange-500 hover:bg-orange-600"
                    onClick={() => {
                      if (postJobStep < 4) {
                        setPostJobStep(postJobStep + 1)
                      } else {
                        handlePostJob()
                      }
                    }}
                    disabled={
                      isPosting ||
                      (postJobStep === 1 &&
                        (!jobFormData.title || !jobFormData.description || !jobFormData.duration)) ||
                      (postJobStep === 2 && (selectedSkills.length === 0 || !jobFormData.credits)) ||
                      (postJobStep === 3 &&
                        (!jobFormData.jobType ||
                          !jobFormData.location ||
                          !jobFormData.budgetMin ||
                          !jobFormData.budgetMax))
                    }
                  >
                    {postJobStep === 4 ? (isPosting ? "Posting..." : "Post Job") : "Next"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Job Action Modal */}
      {showJobActionModal && selectedJob && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">
                  {actionType === "edit" && "Edit Job"}
                  {actionType === "pause" && (selectedJob.status === "paused" ? "Resume Job" : "Pause Job")}
                  {actionType === "close" && "Close Job"}
                </CardTitle>
                <Button variant="ghost" size="icon" onClick={() => setShowJobActionModal(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                  <h4 className="font-semibold text-sm mb-1">{selectedJob.title}</h4>
                  <p className="text-xs text-muted-foreground">{selectedJob.proposals} proposals received</p>
                </div>
                <p className="text-sm text-muted-foreground">
                  {actionType === "edit" && "Edit functionality will be available soon."}
                  {actionType === "pause" &&
                    selectedJob.status === "paused" &&
                    "Resume this job to start receiving new proposals again."}
                  {actionType === "pause" &&
                    selectedJob.status !== "paused" &&
                    "Pause this job to temporarily stop receiving new proposals."}
                  {actionType === "close" && "Close this job permanently. This action cannot be undone."}
                </p>
                <div className="flex space-x-2 pt-4">
                  <Button
                    variant="outline"
                    className="flex-1 bg-transparent"
                    onClick={() => setShowJobActionModal(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    className={`flex-1 ${
                      actionType === "close" ? "bg-red-500 hover:bg-red-600" : "bg-orange-500 hover:bg-orange-600"
                    }`}
                    onClick={() => {
                      if (actionType === "edit") {
                        alert("Edit functionality coming soon!")
                      } else {
                        handleJobAction(selectedJob, actionType)
                      }
                      setShowJobActionModal(false)
                    }}
                  >
                    {actionType === "edit" && "Edit Job"}
                    {actionType === "pause" && (selectedJob.status === "paused" ? "Resume" : "Pause")}
                    {actionType === "close" && "Close Job"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
