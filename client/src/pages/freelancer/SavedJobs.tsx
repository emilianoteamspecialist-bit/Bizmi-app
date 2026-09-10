import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Modal } from "@/components/shared/modal"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Bookmark, Calendar, CreditCard, Eye, Send, Users, X } from "lucide-react"
import { useSavedJobsQuery } from "@/lib/queries/jobs"
import { useSubmitProposalMutation } from "@/lib/queries/proposals"
import { useAgencyImageQuery } from "@/lib/queries/agencies"

export default function SavedJobs() {
  const navigate = useNavigate()
  const savedJobsQuery = useSavedJobsQuery()
  const submitProposal = useSubmitProposalMutation()

  const [showPlaceBidModal, setShowPlaceBidModal] = useState(false)
  const [showAgencyModal, setShowAgencyModal] = useState(false)
  const [selectedJob, setSelectedJob] = useState<any>(null)
  const [selectedAgency, setSelectedAgency] = useState<any>(null)
  const [bidData, setBidData] = useState({ proposal: "", timeline: "", budget: "" })

  const agencyImageQuery = useAgencyImageQuery(selectedAgency?.id, showAgencyModal)

  if (savedJobsQuery.isLoading) {
    return (
      <div className="min-h-screen bg-surface">
        <div className="max-w-6xl mx-auto py-8 px-4">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-foreground/5 rounded w-1/4 mb-6"></div>
            <div className="h-32 bg-foreground/5 rounded"></div>
          </div>
        </div>
      </div>
    )
  }

  if (savedJobsQuery.isError) {
    return (
      <div className="min-h-screen bg-surface pb-20 flex items-center justify-center">
        <div className="text-center space-y-2">
          <p className="text-sm font-semibold text-foreground">Couldn't load your saved jobs</p>
          <p className="text-sm text-muted-foreground">Please try refreshing the page.</p>
        </div>
      </div>
    )
  }

  const savedJobs = savedJobsQuery.data?.jobs ?? []

  const handleJobAction = (job: any, action: "view" | "placeBid") => {
    if (action === "view") {
      setSelectedAgency(job.agencyInfo)
      setShowAgencyModal(true)
    } else if (action === "placeBid") {
      setSelectedJob(job)
      setShowPlaceBidModal(true)
    }
  }

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
            alert(result.error === "Unauthorized" ? "You must be signed in to bid." : result.error)
            return
          }
          alert(result.alreadySubmitted ? "You've already applied to this job." : "Proposal submitted successfully! Credits deducted.")
          setShowPlaceBidModal(false)
          setBidData({ proposal: "", timeline: "", budget: "" })
        },
        onError: () => alert("Error submitting proposal. Please try again."),
      }
    )
  }

  return (
    <div className="min-h-screen bg-surface pb-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
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
              <p className="mt-1 text-sm text-muted-foreground max-w-sm mx-auto">Bookmark jobs from the marketplace to find them here later.</p>
              <Button className="mt-5" onClick={() => navigate("/freelancer/dashboard")}>Browse jobs</Button>
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-card divide-y divide-border overflow-hidden">
              {savedJobs.map((job: any) => (
                <div key={job.id} className="p-4 sm:p-5">
                  <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="text-sm font-semibold text-foreground line-clamp-1">{job.title}</h3>
                          <p className="text-xs text-muted-foreground mt-0.5">{job.agencyInfo.name}</p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => handleJobAction(job, "view")}>
                            <Eye className="h-4 w-4" /> View
                          </Button>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span className="font-medium text-foreground tabular-nums">{job.budget}</span>
                        <span className="inline-flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {job.proposals} proposals
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <CreditCard className="h-3 w-3 text-primary" />
                          {job.credit_cost} credits
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Saved {job.savedAt}
                        </span>
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

      <Modal isOpen={showAgencyModal} onClose={() => setShowAgencyModal(false)} srLabel="Agency details" maxWidth="2xl">
        {selectedAgency && (
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarImage src={agencyImageQuery.data?.image ?? undefined} alt={selectedAgency.name} className="object-cover" />
                <AvatarFallback className="text-lg font-semibold bg-surface-2 text-foreground">{selectedAgency.name.charAt(0).toUpperCase()}</AvatarFallback>
              </Avatar>
              <h3 className="text-xl font-bold">{selectedAgency.name}</h3>
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
            </div>
            <div className="flex justify-center pt-4">
              <Button variant="outline" onClick={() => setShowAgencyModal(false)}>Close</Button>
            </div>
          </div>
        )}
      </Modal>

      {showPlaceBidModal && selectedJob && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end justify-end z-50">
          <div className="bg-card w-full max-w-md h-full overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold">Place Your Bid</h3>
                <Button variant="ghost" size="icon" onClick={() => setShowPlaceBidModal(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Your Proposal</label>
                  <Textarea value={bidData.proposal} onChange={(e) => setBidData({ ...bidData, proposal: e.target.value })} rows={4} />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Timeline</label>
                  <Input value={bidData.timeline} onChange={(e) => setBidData({ ...bidData, timeline: e.target.value })} />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Your Budget</label>
                  <Input value={bidData.budget} onChange={(e) => setBidData({ ...bidData, budget: e.target.value })} />
                </div>
                <Button
                  className="w-full"
                  onClick={submitBid}
                  disabled={submitProposal.isPending || !bidData.proposal || !bidData.timeline || !bidData.budget}
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
