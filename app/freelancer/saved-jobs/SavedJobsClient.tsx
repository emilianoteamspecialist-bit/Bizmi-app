"use client"
import { useState } from "react"
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
import { getSavedJobs } from "@/app/actions/jobs"
import { submitProposal } from "@/app/actions/proposals"

export default function SavedJobsClient({ initialSavedJobs }: { initialSavedJobs: any[] }) {
  const { user: currentUser } = useAuth()
  const [savedJobs, setSavedJobs] = useState<any[]>(initialSavedJobs || [])
  const [loading, setLoading] = useState(false)
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

  // Reads now run server-side via getSavedJobs — used to refresh after a bid.
  const loadSavedJobs = async () => {
    try {
      setLoading(true)
      const data = await getSavedJobs()
      setSavedJobs(data)
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
        if (!currentUser) return
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

      // Proposal + credit charge happen atomically server-side (place_bid).
      // The browser no longer reads or writes credit balances directly.
      const result = await submitProposal(
        selectedJob.id,
        {
          proposal_text: bidData.proposal,
          timeline: bidData.timeline,
          budget: bidData.budget,
          attachments: selectedFiles.map((file) => file.name),
        },
        selectedJob.credit_cost,
      )

      if (!result.success) {
        alert(result.error === "Unauthorized" ? "You must be signed in to bid." : result.error)
        return
      }

      alert(
        result.alreadySubmitted
          ? "You've already applied to this job."
          : "Proposal submitted successfully! Credits deducted.",
      )

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
      <div className="min-h-screen bg-surface">
        <div className="max-w-6xl mx-auto py-8 px-4">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-foreground/5 rounded w-1/4 mb-6"></div>
            <div className="h-32 bg-foreground/5 rounded"></div>
            <div className="h-20 bg-foreground/5 rounded"></div>
            <div className="h-20 bg-foreground/5 rounded"></div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface pb-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Header */}
        <header className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Saved</p>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Saved jobs</h1>
          <p className="text-sm text-muted-foreground">Jobs you&apos;ve bookmarked for later.</p>
        </header>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground">
            Your saved jobs <span className="font-normal text-muted-foreground">· {savedJobs.length}</span>
          </h2>

          {savedJobs.length === 0 ? (
            <div className="rounded-xl border border-border bg-card py-16 px-6 text-center">
              <div className="mx-auto h-11 w-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <Bookmark className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-sm font-semibold text-foreground">No saved jobs yet</h3>
              <p className="mt-1 text-sm text-muted-foreground max-w-sm mx-auto">
                Bookmark jobs from the marketplace to find them here later.
              </p>
              <Button className="mt-5" onClick={() => router.push("/freelancer/dashboard")}>Browse jobs</Button>
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-card divide-y divide-border overflow-hidden">
              {savedJobs.map((job) => (
                <div key={job.id} className="p-4 sm:p-5">
                  <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="text-sm font-semibold text-foreground line-clamp-1">{job.title}</h3>
                          <p className="text-xs text-muted-foreground mt-0.5">{job.agencyInfo.name}</p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={() => handleJobAction(job, "unsave")}
                            aria-label="Remove from saved"
                          >
                            <BookmarkX className="h-4 w-4" />
                          </Button>
                          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => handleJobAction(job, "view")}>
                            <Eye className="h-4 w-4" /> View
                          </Button>
                        </div>
                      </div>

                      {job.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2">{job.description}</p>
                      )}

                      {!!job.skills?.length && (
                        <div className="flex flex-wrap gap-1.5">
                          {job.skills.slice(0, 4).map((skill: string, i: number) => (
                            <span key={i} className="px-2 py-0.5 rounded-md bg-surface-2 text-muted-foreground text-[11px]">
                              {skill}
                            </span>
                          ))}
                          {job.skills.length > 4 && (
                            <span className="px-2 py-0.5 text-[11px] text-muted-foreground">+{job.skills.length - 4}</span>
                          )}
                        </div>
                      )}

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span className="font-medium text-foreground tabular-nums">{job.budget}</span>
                        <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{job.duration || "Flexible"}</span>
                        <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{job.location || "Remote"}</span>
                        <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" />{job.proposals} proposals</span>
                        <span className="inline-flex items-center gap-1"><CreditCard className="h-3 w-3 text-primary" />{job.credit_cost} credits</span>
                        <span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" />Saved {job.savedAt}</span>
                      </div>
                    </div>

                    <div className="shrink-0">
                      <Button className="w-full lg:w-auto gap-2" onClick={() => handleJobAction(job, "placeBid")}>
                        <Send className="h-4 w-4" /> Place bid
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
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
                    <AvatarFallback className="text-lg font-semibold bg-surface-2 text-foreground">
                      {selectedAgency.name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <CardTitle className="text-xl">{selectedAgency.name}</CardTitle>
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
          <div className="bg-card w-full max-w-md h-full overflow-y-auto animate-in slide-in-from-right">
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
                      <CreditCard className="h-4 w-4 mr-1 text-primary" />
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
                  <div className="border-2 border-dashed border-border rounded-lg p-4">
                    <input type="file" multiple onChange={handleFileSelect} className="hidden" id="file-upload" />
                    <label htmlFor="file-upload" className="cursor-pointer">
                      <div className="text-center">
                        <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                        <p className="text-sm text-muted-foreground">Click to upload files</p>
                      </div>
                    </label>
                  </div>

                  {selectedFiles.length > 0 && (
                    <div className="mt-2 space-y-2">
                      {selectedFiles.map((file, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between bg-surface-2 p-2 rounded"
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

                <div className="bg-primary-soft p-4 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Credits required</span>
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
