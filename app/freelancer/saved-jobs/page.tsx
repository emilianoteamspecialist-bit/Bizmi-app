"use client"
import { useState, useEffect } from "react"
import type React from "react"
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
  CreditCard,
  Upload,
  Send,
  BookmarkX,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { resolveAvatar } from "@/lib/avatar-url"
import { useAuth } from "@/contexts/AuthContext"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

export default function SavedJobsPage() {
  const { user: currentUser, loading: authLoading } = useAuth()
  const [savedJobs, setSavedJobs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showPlaceBidModal, setShowPlaceBidModal] = useState(false)
  const [showAgencyModal, setShowAgencyModal] = useState(false)
  const [selectedJob, setSelectedJob] = useState<any>(null)
  const [selectedAgency, setSelectedAgency] = useState<any>(null)
  const [agencyImage, setAgencyImage] = useState<string>("")
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [bidData, setBidData] = useState({
    proposal: "",
    timeline: "",
    budget: "",
  })
  const router = useRouter()

  useEffect(() => {
    if (authLoading) return
    if (!currentUser?.id) {
      setLoading(false)
      return
    }
    loadSavedJobs()
  }, [currentUser?.id, authLoading])

  const loadSavedJobs = async () => {
    try {
      if (currentUser) {
        const user = currentUser

        // Load saved jobs
        const { data: savedJobsData, error } = await supabase
          .from("saved_jobs")
          .select(`
            *,
            jobs!saved_jobs_job_id_fkey (
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
                created_at
              ),
              proposals(count)
            )
          `)
          .eq("freelancer_id", user.id)
          .order("created_at", { ascending: false })

        if (error) {
          console.error("Error loading saved jobs:", error)
        } else {
          // Get job counts for each agency
          const agencyIds = [...new Set(savedJobsData?.map((item) => item.jobs?.profiles?.id).filter(Boolean))]
          const agencyJobCounts: { [key: string]: number } = {}

          for (const agencyId of agencyIds) {
            const { count } = await supabase
              .from("jobs")
              .select("*", { count: "exact", head: true })
              .eq("agency_id", agencyId)
            agencyJobCounts[agencyId] = count || 0
          }

          // Transform the data
          const transformedJobs =
            savedJobsData?.map((item: any) => {
              const job = item.jobs
              return {
                ...job,
                savedAt: new Date(item.created_at).toLocaleDateString(),
                budget: `₦ ${job.budget_min?.toLocaleString()} - ₦ ${job.budget_max?.toLocaleString()}`,
                postedDate: new Date(job.created_at).toLocaleDateString(),
                proposals: job.proposals?.[0]?.count || 0,
                rating: 4.8,
                isBookmarked: true,
                agencyInfo: {
                  id: job.profiles?.id,
                  name: job.profiles?.company_name || job.profiles?.full_name || "Unknown Agency",
                  rating: 4.8,
                  reviews: 156,
                  location: job.profiles?.location || "Nigeria",
                  employees: job.profiles?.company_size || "10-50",
                  description: job.profiles?.bio || "Professional agency providing quality services.",
                  memberSince: new Date(job.profiles?.created_at).getFullYear().toString() || "2020",
                  phone: job.profiles?.phone,
                  website: job.profiles?.website,
                  email: job.profiles?.email,
                  fullName: job.profiles?.full_name,
                  companyName: job.profiles?.company_name,
                  totalJobs: agencyJobCounts[job.profiles?.id] || 0,
                },
              }
            }) || []

          setSavedJobs(transformedJobs)
        }
      }
    } catch (error) {
      console.error("Error loading saved jobs:", error)
    } finally {
      setLoading(false)
    }
  }

  const loadAgencyImage = async (agencyId: string) => {
    try {
      const { data: imageData } = await supabase
        .from("agency_image")
        .select("image_path, image_data")
        .eq("agency_id", agencyId)
        .single()

      setAgencyImage(imageData ? resolveAvatar(imageData) : "")
    } catch (error) {
      console.error("Error loading agency image:", error)
      setAgencyImage("")
    }
  }

  const handleJobAction = async (job: any, action: "unsave" | "view" | "placeBid") => {
    if (action === "view") {
      setSelectedAgency(job.agencyInfo)
      setAgencyImage("")
      if (job.agencyInfo.id) {
        await loadAgencyImage(job.agencyInfo.id)
      }
      setShowAgencyModal(true)
    } else if (action === "placeBid") {
      setSelectedJob(job)
      setShowPlaceBidModal(true)
    } else if (action === "unsave") {
      try {
        const { error } = await supabase
          .from("saved_jobs")
          .delete()
          .eq("freelancer_id", currentUser.id)
          .eq("job_id", job.id)

        if (error) {
          console.error("Error unsaving job:", error)
        } else {
          setSavedJobs(savedJobs.filter((j) => j.id !== job.id))
        }
      } catch (error) {
        console.error("Error unsaving job:", error)
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

  const submitBid = async () => {
    try {
      if (!currentUser || !selectedJob) return

      // Check if user has enough credits
      const { data: profileData } = await supabase.from("profiles").select("credits").eq("id", currentUser.id).single()

      if (!profileData || profileData.credits < selectedJob.credit_cost) {
        alert("Insufficient credits to place this bid!")
        return
      }

      // Create proposal
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
        return
      }

      // Deduct credits
      const { error: creditError } = await supabase
        .from("profiles")
        .update({ credits: profileData.credits - selectedJob.credit_cost })
        .eq("id", currentUser.id)

      if (creditError) {
        console.error("Error deducting credits:", creditError)
        alert("Proposal submitted but error deducting credits")
      } else {
        alert("Proposal submitted successfully! Credits deducted.")
      }

      setShowPlaceBidModal(false)
      setBidData({ proposal: "", timeline: "", budget: "" })
      setSelectedFiles([])
      loadSavedJobs()
    } catch (error) {
      console.error("Error submitting bid:", error)
      alert("Error submitting proposal. Please try again.")
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">

      <div className="max-w-7xl mx-auto py-4 sm:py-6 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl sm:text-primaryxl font-bold text-slate-900 dark:text-white mb-2">Saved Jobs</h1>
          <p className="text-muted-foreground">Jobs you've bookmarked for later</p>
        </div>

        {/* Saved Jobs */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg sm:text-xl">Your Saved Jobs ({savedJobs.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {savedJobs.length === 0 ? (
              <div className="p-8 text-center">
                <Bookmark className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">No Saved Jobs</h3>
                <p className="text-muted-foreground mb-4">You haven't saved any jobs yet</p>
                <Button onClick={() => router.push("/freelancer/dashboard")} className="bg-primary hover:bg-primary-hover">
                  Browse Jobs
                </Button>
              </div>
            ) : (
              <div className="space-y-0">
                {savedJobs.map((job, index) => (
                  <div
                    key={job.id}
                    className={`p-4 sm:p-6 ${index !== savedJobs.length - 1 ? "border-b border-slate-200 dark:border-gray-700" : ""}`}
                  >
                    <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 mb-3">
                          <div className="flex-1 min-w-0">
                            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-1 line-clamp-1">
                              {job.title}
                            </h3>
                            <p className="text-sm text-muted-foreground mb-2">{job.agencyInfo.name}</p>
                            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground mb-2">
                              <span className="flex items-center">
                                <Calendar className="h-4 w-4 mr-1" />
                                Saved {job.savedAt}
                              </span>
                              <span className="flex items-center">
                                <Users className="h-4 w-4 mr-1" />
                                {job.proposals} proposals
                              </span>
                              <span className="flex items-center">
                                <Star className="h-4 w-4 mr-1 text-yellow-500" />
                                {job.rating}
                              </span>
                              <span className="flex items-center">
                                <CreditCard className="h-4 w-4 mr-1 text-primary" />
                                {job.credit_cost} credits
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleJobAction(job, "unsave")}
                              className="h-8 w-8 text-primary hover:text-red-600"
                            >
                              <BookmarkX className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleJobAction(job, "view")}
                              className="bg-transparent"
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              View
                            </Button>
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
                            <span className="font-semibold text-primary truncate">{job.budget}</span>
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

                      <div className="flex-shrink-0">
                        <Button
                          className="w-full sm:w-auto bg-primary hover:bg-primary-hover"
                          onClick={() => handleJobAction(job, "placeBid")}
                        >
                          <Send className="h-4 w-4 mr-2" />
                          Place Bid
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

      {/* Agency Profile Modal */}
      {showAgencyModal && selectedAgency && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <Avatar className="h-16 w-16">
                    <AvatarImage
                      src={agencyImage || "/placeholder.svg"}
                      alt={selectedAgency.name}
                      className="object-cover"
                    />
                    <AvatarFallback className="text-lg font-semibold bg-orange-100 text-primary">
                      {selectedAgency.name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <CardTitle className="text-xl">{selectedAgency.name}</CardTitle>
                    <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                      <Star className="h-4 w-4 text-yellow-500" />
                      <span>
                        {selectedAgency.rating} ({selectedAgency.reviews} reviews)
                      </span>
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
          <div className="bg-white dark:bg-slate-800 w-full max-w-md h-full overflow-y-auto animate-in slide-in-from-right">
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
                      <span className="text-primary mr-1">₦</span>
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
                    placeholder="₦ 0"
                    value={bidData.budget}
                    onChange={(e) => setBidData({ ...bidData, budget: e.target.value })}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Attachments</label>
                  <div className="border-2 border-dashed border-slate-300 dark:border-gray-600 rounded-lg p-4">
                    <input type="file" multiple onChange={handleFileSelect} className="hidden" id="file-upload" />
                    <label htmlFor="file-upload" className="cursor-pointer">
                      <div className="text-center">
                        <Upload className="h-8 w-8 mx-auto text-slate-400 mb-2" />
                        <p className="text-sm text-muted-foreground">Click to upload files</p>
                      </div>
                    </label>
                  </div>

                  {selectedFiles.length > 0 && (
                    <div className="mt-2 space-y-2">
                      {selectedFiles.map((file, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between bg-slate-100 dark:bg-gray-700 p-2 rounded"
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

                <div className="bg-primary/10 dark:bg-orange-900/20 p-4 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Credits Required:</span>
                    <span className="text-lg font-bold text-primary">{selectedJob.credit_cost}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">This will be deducted from your credit balance</p>
                </div>

                <Button
                  className="w-full bg-primary hover:bg-primary-hover"
                  onClick={submitBid}
                  disabled={!bidData.proposal || !bidData.timeline || !bidData.budget}
                >
                  <Send className="h-4 w-4 mr-2" />
                  Submit Proposal
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
