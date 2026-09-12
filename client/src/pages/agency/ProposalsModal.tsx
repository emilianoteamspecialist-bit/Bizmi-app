import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { CheckCircle, FileText, Search, X, XCircle } from "lucide-react"
import { useJobProposalsQuery, type AgencyJob, type JobProposal } from "@/lib/queries/jobs"
import { useRespondToProposalMutation } from "@/lib/queries/proposals"
import { useFreelancerLogosQuery } from "@/lib/queries/user"

function statusBadgeClass(status: string) {
  switch (status) {
    case "accepted":
      return "bg-success/10 text-success"
    case "rejected":
      return "bg-destructive/10 text-destructive"
    default:
      return "bg-warning/10 text-warning"
  }
}

export default function ProposalsModal({ job, isOpen, onClose }: { job: AgencyJob | null; isOpen: boolean; onClose: () => void }) {
  const [searchTerm, setSearchTerm] = useState("")
  const proposalsQuery = useJobProposalsQuery(job?.id, isOpen)
  const respond = useRespondToProposalMutation()

  const proposals: JobProposal[] = proposalsQuery.data?.proposals ?? []
  const freelancerIds = proposals.map((p) => p.freelancer_id)
  const logosQuery = useFreelancerLogosQuery(freelancerIds)
  const logos = logosQuery.data?.logos ?? {}

  if (!isOpen || !job) return null

  const filteredProposals = proposals.filter((proposal) => {
    if (!searchTerm) return true
    const term = searchTerm.toLowerCase()
    return (
      (proposal.profiles?.full_name?.toLowerCase() || "").includes(term) ||
      (proposal.profiles?.location?.toLowerCase() || "").includes(term) ||
      (proposal.profiles?.bio?.toLowerCase() || "").includes(term) ||
      (proposal.proposal_text?.toLowerCase() || "").includes(term)
    )
  })

  const handleClose = () => {
    setSearchTerm("")
    onClose()
  }

  const handleRespond = (proposalId: string, action: "accept" | "reject") => {
    respond.mutate(
      { proposalId, jobId: job.id, action },
      {
        onSuccess: (result) => {
          if (!result.success) {
            alert(result.error === "Forbidden" ? "You can only act on proposals for your own jobs." : `Error updating proposal: ${result.error}`)
            return
          }
          alert(`Proposal ${action}ed successfully!`)
        },
        onError: () => alert("Error updating proposal. Please try again."),
      }
    )
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-full sm:max-w-lg md:max-w-2xl lg:max-w-4xl max-h-[90vh] overflow-y-auto rounded-lg">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl">Proposals for "{job.title}"</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {proposals.length} proposal{proposals.length !== 1 ? "s" : ""} received
                {searchTerm && <span> • {filteredProposals.length} matching</span>}
              </p>
            </div>
            <Button variant="ghost" size="icon" onClick={handleClose} aria-label="Close">
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="mt-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search freelancers by name, location, bio, or proposal..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {proposalsQuery.isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin inline-block w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
              <p className="text-muted-foreground mt-4">Loading proposals...</p>
            </div>
          ) : proposalsQuery.isError ? (
            <div className="text-center py-8">
              <p className="text-sm font-semibold text-foreground">Couldn't load proposals</p>
              <p className="text-sm text-muted-foreground">Please try again.</p>
            </div>
          ) : proposals.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">No Proposals Yet</h3>
              <p className="text-muted-foreground">Freelancers haven't submitted any proposals for this job yet.</p>
            </div>
          ) : filteredProposals.length === 0 ? (
            <div className="text-center py-8">
              <Search className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">No Matching Proposals</h3>
              <p className="text-muted-foreground">No proposals match your search criteria. Try different keywords.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {filteredProposals.map((proposal) => (
                <div key={proposal.id} className="border border-border rounded-lg p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={logos[proposal.freelancer_id]} alt="Freelancer" />
                        <AvatarFallback>{proposal.profiles?.full_name?.charAt(0) || "F"}</AvatarFallback>
                      </Avatar>
                      <div>
                        <h4 className="font-semibold">{proposal.profiles?.full_name || "Unknown Freelancer"}</h4>
                        <p className="text-sm text-muted-foreground">{proposal.profiles?.location || "Location not specified"}</p>
                        <p className="text-xs text-muted-foreground">Submitted {new Date(proposal.created_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <Badge className={statusBadgeClass(proposal.status)}>{proposal.status.charAt(0).toUpperCase() + proposal.status.slice(1)}</Badge>
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
                        <p className="text-sm font-semibold text-primary">{proposal.budget || "Not specified"}</p>
                      </div>
                    </div>
                    {proposal.profiles?.bio && (
                      <div>
                        <h5 className="font-medium mb-1">About Freelancer</h5>
                        <p className="text-sm text-muted-foreground">{proposal.profiles.bio}</p>
                      </div>
                    )}
                    {proposal.status === "pending" && (
                      <div className="flex flex-col sm:flex-row gap-2 pt-4">
                        <Button
                          variant="outline"
                          className="flex-1 border-destructive text-destructive hover:bg-destructive/5"
                          onClick={() => handleRespond(proposal.id, "reject")}
                          disabled={respond.isPending}
                        >
                          <XCircle className="h-4 w-4 mr-2" />
                          Reject
                        </Button>
                        <Button className="flex-1" onClick={() => handleRespond(proposal.id, "accept")} disabled={respond.isPending}>
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Accept
                        </Button>
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
  )
}
