"use client"

import type React from "react"
import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Textarea } from "@/components/ui/textarea"
import { Search, Loader2, X, FileText, CheckCircle, XCircle, Eye } from "lucide-react"
import PaymentModal from "@/components/payment-modal"

interface JobPost {
  id: string
  title: string
  description: string
  budget_min: number
  budget_max: number
  created_at: string
  proposals: number
  duration: string
  location: string
  job_type: string
  skills: string[]
  funding_status?: string
  job_status?: string
  funding_count?: number
}

const ITEMS_PER_PAGE = 15

export default function AgencyPostsPage() {
  const [jobs, setJobs] = useState<JobPost[]>([])
  const [loading, setLoading] = useState(true)
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("")
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const router = useRouter()
  const [showProposalsModal, setShowProposalsModal] = useState(false)
  const [selectedJob, setSelectedJob] = useState<any>(null)
  const [selectedJobProposals, setSelectedJobProposals] = useState<any[]>([])
  const [freelancerImages, setFreelancerImages] = useState<{ [key: string]: string }>({})
  const [messageInputOpenForProposalId, setMessageInputOpenForProposalId] = useState<string | null>(null)
  const [currentMessageText, setCurrentMessageText] = useState<string>("")
  const [proposalSearchTerm, setProposalSearchTerm] = useState("")

  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [selectedJobForPayment, setSelectedJobForPayment] = useState<JobPost | null>(null)
  const [selectedFreelancerForPayment, setSelectedFreelancerForPayment] = useState<any>(null)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm)
    }, 500)

    return () => {
      clearTimeout(handler)
    }
  }, [searchTerm])

  const loadJobs = useCallback(
    async (currentOffset: number, searchVal: string, append = false) => {
      setLoading(true)
      if (!currentUserId) {
        setLoading(false)
        return
      }

      let jobIdsToFilter: string[] = []
      if (searchVal) {
        const { data: matchingJobs, error: searchError } = await supabase
          .from("jobs")
          .select("id")
          .eq("agency_id", currentUserId)
          .or(`title.ilike.%${searchVal}%,description.ilike.%${searchVal}%`)

        if (searchError) {
          console.error("Error searching jobs:", searchError)
          setLoading(false)
          return
        }
        jobIdsToFilter = matchingJobs?.map((job) => job.id) || []
        if (jobIdsToFilter.length === 0) {
          setJobs(append ? jobs : [])
          setHasMore(false)
          setLoading(false)
          return
        }
      }

      let query = supabase
        .from("jobs")
        .select(
          `id,
          title,
          description,
          budget_min,
          budget_max,
          created_at,
          duration,
          location,
          job_type,
          skills,
          proposals(count),
          job_funding_status(funding_status, job_status)`,
          { count: "exact" },
        )
        .eq("agency_id", currentUserId)
        .order("created_at", { ascending: false })
        .range(currentOffset, currentOffset + ITEMS_PER_PAGE - 1)

      if (searchVal && jobIdsToFilter.length > 0) {
        query = query.in("id", jobIdsToFilter)
      } else if (searchVal && jobIdsToFilter.length === 0) {
        setJobs(append ? jobs : [])
        setHasMore(false)
        setLoading(false)
        return
      }

      const { data, error, count } = await query

      if (error) {
        console.error("Error fetching jobs:", error)
      } else {
        const fetchedJobs: JobPost[] =
          data?.map((job: any) => ({
            ...job,
            proposals: job.proposals?.[0]?.count || 0,
            funding_status: job.job_funding_status?.[0]?.funding_status || "pending",
            job_status: job.job_funding_status?.[0]?.job_status || "open",
          })) || []

        setJobs((prevJobs) => (append ? [...prevJobs, ...fetchedJobs] : fetchedJobs))
        setHasMore(currentOffset + fetchedJobs.length < (count || 0))
        setOffset(currentOffset + fetchedJobs.length)
      }
      setLoading(false)
    },
    [currentUserId],
  )

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

  const handleViewProposals = async (job: JobPost) => {
    try {
      const { data: proposalsData, error } = await supabase
        .from("proposals")
        .select(
          `*,
          profiles!proposals_freelancer_id_fkey (
            id,
            full_name,
            bio,
            location,
            phone,
            website,
            email
          )
        `,
        )
        .eq("job_id", job.id)
        .order("created_at", { ascending: false })

      if (error) {
        console.error("Error loading proposals:", error)
        return
      }

      setSelectedJobProposals(proposalsData || [])
      setSelectedJob(job)
      setProposalSearchTerm("")
      const freelancerIds = proposalsData?.map((proposal) => proposal.freelancer_id) || []
      if (freelancerIds.length > 0) {
        await loadFreelancerImages(freelancerIds)
      }
      setShowProposalsModal(true)
    } catch (error) {
      console.error("Error loading proposals:", error)
    }
  }

  const handleProposalAction = async (proposalId: string, action: "accept" | "reject") => {
    try {
      const { error } = await supabase
        .from("proposals")
        .update({ status: action === "accept" ? "accepted" : "rejected" })
        .eq("id", proposalId)

      if (error) {
        console.error("Error updating proposal:", error)
        alert("Error updating proposal")
        return
      }

      handleViewProposals(selectedJob)
      loadJobs(0, debouncedSearchTerm, false)
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
      const { data: existingConversation, error: conversationError } = await supabase
        .from("conversations")
        .select("id")
        .or(
          `and(participant1_id.eq.${agencyId},participant2_id.eq.${freelancerId}),and(participant1_id.eq.${freelancerId},participant2_id.eq.${agencyId})`,
        )
        .single()

      let conversationId
      if (conversationError && conversationError.code === "PGRST116") {
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

  const handleFundFreelancerClick = (job: JobPost, freelancer: any) => {
    setSelectedJobForPayment(job)
    setSelectedFreelancerForPayment(freelancer)
    setShowProposalsModal(false)
    setShowPaymentModal(true)
  }

  const handlePaymentSuccess = () => {
    loadJobs(0, debouncedSearchTerm, false)
    if (selectedJob) {
      handleViewProposals(selectedJob)
    }
  }

  const handleJobDone = async (jobId: string) => {
    try {
      const response = await fetch("/api/paystack/mark-complete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          jobId,
        }),
      })

      const data = await response.json()

      if (response.ok && data.success) {
        alert("Job marked as completed!")
        loadJobs(0, debouncedSearchTerm, false)
      } else {
        alert("Error marking job as done: " + (data.error || "Unknown error"))
      }
    } catch (error) {
      console.error("Error marking job as done:", error)
      alert("Error marking job as done. Please try again.")
    }
  }

  const checkIfFreelancerStartedWork = async (jobId: string) => {
    try {
      const { data, error } = await supabase
        .from("freelancer_proposal_status")
        .select("freelancer_status")
        .eq("job_id", jobId)
        .eq("freelancer_status", "started")
        .single()

      if (error && error.code !== "PGRST116") {
        console.error("Error checking freelancer status:", error)
        return false
      }

      return !!data
    } catch (error) {
      console.error("Error checking freelancer status:", error)
      return false
    }
  }

  const checkIfFreelancerFunded = async (jobId: string, freelancerId: string) => {
    try {
      const { data, error } = await supabase
        .from("Funded_jobs101")
        .select("id")
        .eq("job_id", jobId)
        .eq("freelancer_id", freelancerId)
        .single()

      if (error && error.code !== "PGRST116") {
        console.error("Error checking funding status:", error)
        return false
      }

      return !!data
    } catch (error) {
      console.error("Error checking funding status:", error)
      return false
    }
  }

  useEffect(() => {
    const fetchUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (user) {
        setCurrentUserId(user.id)
      } else {
        setLoading(false)
      }
    }
    fetchUser()
  }, [])

  useEffect(() => {
    if (currentUserId) {
      setOffset(0)
      setHasMore(true)
      loadJobs(0, debouncedSearchTerm, false)
    }
  }, [currentUserId, debouncedSearchTerm, loadJobs])

  const handleLoadMore = () => {
    loadJobs(offset, debouncedSearchTerm, true)
  }

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value)
  }

  const filteredProposals = selectedJobProposals.filter((proposal) => {
    if (!proposalSearchTerm) return true

    const searchLower = proposalSearchTerm.toLowerCase()
    const freelancerName = proposal.profiles?.full_name?.toLowerCase() || ""
    const freelancerLocation = proposal.profiles?.location?.toLowerCase() || ""
    const freelancerBio = proposal.profiles?.bio?.toLowerCase() || ""
    const proposalText = proposal.proposal_text?.toLowerCase() || ""

    return (
      freelancerName.includes(searchLower) ||
      freelancerLocation.includes(searchLower) ||
      freelancerBio.includes(searchLower) ||
      proposalText.includes(searchLower)
    )
  })

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 dark:bg-slate-900">
      <main className="flex-1 p-4 sm:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-primaryxl font-bold text-slate-900 dark:text-gray-50 mb-6">Manage Job Posts</h1>
          <div className="mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
              <Input
                type="text"
                placeholder="Search job posts by title or description..."
                value={searchTerm}
                onChange={handleSearchChange}
                className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-300 dark:border-gray-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-gray-50 focus:ring-primary focus:border-primary"
              />
            </div>
          </div>
          {loading && jobs.length === 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.from({ length: ITEMS_PER_PAGE }).map((_, i) => (
                <Card key={i} className="animate-pulse">
                  <CardHeader>
                    <div className="h-6 bg-slate-200 dark:bg-gray-700 rounded w-3/4 mb-2"></div>
                    <div className="h-4 bg-slate-200 dark:bg-gray-700 rounded w-1/2"></div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="h-4 bg-slate-200 dark:bg-gray-700 rounded"></div>
                    <div className="h-4 bg-slate-200 dark:bg-gray-700 rounded w-5/6"></div>
                    <div className="h-4 bg-slate-200 dark:bg-gray-700 rounded w-2/3"></div>
                    <div className="h-8 bg-slate-200 dark:bg-gray-700 rounded w-full mt-4"></div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : jobs.length === 0 ? (
            <div className="text-center py-12 text-slate-500 dark:text-slate-400">
              <p className="text-lg">
                {searchTerm ? "No matching job posts found." : "You haven't created any job posts yet."}
              </p>
              {!searchTerm && (
                <Button
                  onClick={() => router.push("/agency/dashboard")}
                  className="mt-4 bg-primary hover:bg-primary-hover"
                >
                  Create a New Post
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {jobs.map((job) => (
                <Card key={job.id} className="flex flex-col">
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <CardTitle className="text-lg font-semibold">{job.title}</CardTitle>
                        <CardDescription className="text-sm text-slate-500 dark:text-slate-400">
                          Posted: {new Date(job.created_at).toLocaleDateString()}
                        </CardDescription>
                      </div>
                      <div className="flex gap-2">
                        {job.funding_status === "funded" && (
                          <Button
                            onClick={() => handleJobDone(job.id)}
                            className="bg-green-500 hover:bg-green-600"
                            size="sm"
                          >
                            ✅ Job Done
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1 flex flex-col justify-between">
                    <p className="text-slate-700 dark:text-gray-300 mb-4 line-clamp-3">{job.description}</p>
                    <div className="flex items-center justify-between mb-4">
                      <Badge
                        variant="secondary"
                        className="text-sm bg-orange-100 text-primary dark:bg-orange-900/20 dark:text-orange-300"
                      >
                        Budget: ₦ {job.budget_min?.toLocaleString()} - ₦ {job.budget_max?.toLocaleString()}
                      </Badge>
                      <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200">
                        Proposals: {job.proposals}
                      </Badge>
                    </div>
                    <Button
                      onClick={() => handleViewProposals(job)}
                      className="w-full bg-primary hover:bg-primary-hover"
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      View Proposals ({job.proposals})
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
          {hasMore && !loading && jobs.length > 0 && (
            <div className="flex justify-center mt-8">
              <Button onClick={handleLoadMore} disabled={loading} className="bg-primary hover:bg-primary-hover">
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {loading ? "Loading..." : "Load More"}
              </Button>
            </div>
          )}
        </div>
      </main>

      {selectedJobForPayment && selectedFreelancerForPayment && (
        <PaymentModal
          isOpen={showPaymentModal}
          onClose={() => {
            setShowPaymentModal(false)
            setSelectedJobForPayment(null)
            setSelectedFreelancerForPayment(null)
          }}
          jobData={{
            id: selectedJobForPayment.id,
            title: selectedJobForPayment.title,
            freelancer: {
              id: selectedFreelancerForPayment.freelancer_id,
              name: selectedFreelancerForPayment.profiles?.full_name || "Unknown Freelancer",
              email: selectedFreelancerForPayment.profiles?.email || "No email provided",
            },
            amount: selectedJobForPayment.budget_max,
          }}
          onSuccess={handlePaymentSuccess}
        />
      )}

      {showProposalsModal && selectedJob && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <CardHeader className="flex-shrink-0">
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
              <div className="mt-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    type="text"
                    placeholder="Search freelancers by name, location, or proposal..."
                    value={proposalSearchTerm}
                    onChange={(e) => setProposalSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto p-6">
              {filteredProposals.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-semibold mb-2">
                    {proposalSearchTerm ? "No Matching Proposals" : "No Proposals Yet"}
                  </h3>
                  <p className="text-muted-foreground">
                    {proposalSearchTerm
                      ? "No proposals match your search criteria. Try different keywords."
                      : "Freelancers haven't submitted any proposals for this job yet."}
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {filteredProposals.map((proposal) => (
                    <div key={proposal.id} className="border border-slate-200 dark:border-gray-700 rounded-lg p-6">
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
                            <p className="text-sm font-semibold text-primary">
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
                        {proposal.status === "pending" && (
                          <div className="flex space-x-2 pt-4">
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
                              <div className="flex space-x-2">
                                <Button
                                  className="flex-1 bg-primary hover:bg-primary-hover"
                                  onClick={() => {
                                    setMessageInputOpenForProposalId(proposal.id)
                                    setCurrentMessageText("")
                                  }}
                                >
                                  <Eye className="h-4 w-4 mr-2" />
                                  Message Freelancer
                                </Button>
                                <Button
                                  className="flex-1 bg-primary hover:bg-primary-hover"
                                  onClick={() => handleFundFreelancerClick(selectedJob, proposal)}
                                >
                                  💰 Fund Job
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
                                    className="bg-primary hover:bg-primary-hover"
                                    onClick={() =>
                                      handleSendMessage(proposal.freelancer_id, currentUserId!, currentMessageText)
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
    </div>
  )
}
