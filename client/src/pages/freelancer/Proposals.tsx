import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { CalendarDays, DollarSign, Clock, CheckCircle, XCircle, AlertCircle, FileText, Search, MapPin, Loader2, X } from "lucide-react"
import { useMyProposalsQuery, type Proposal } from "@/lib/queries/proposals"

function getStatusIcon(status: string) {
  switch (status) {
    case "accepted":
      return <CheckCircle className="h-3.5 w-3.5 text-success" />
    case "rejected":
      return <XCircle className="h-3.5 w-3.5 text-destructive" />
    default:
      return <AlertCircle className="h-3.5 w-3.5 text-primary" />
  }
}

function getStatusColor(status: string) {
  switch (status) {
    case "accepted":
      return "bg-success/10 text-success"
    case "rejected":
      return "bg-destructive/10 text-destructive"
    default:
      return "bg-primary-soft text-primary"
  }
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
}

export default function Proposals() {
  const [searchTerm, setSearchTerm] = useState("")
  const [viewingProposal, setViewingProposal] = useState<Proposal | null>(null)

  const query = useMyProposalsQuery(searchTerm)

  if (query.isLoading) {
    return (
      <div className="min-h-screen bg-surface pb-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
          <div className="space-y-2 animate-pulse">
            <div className="h-3 w-24 bg-foreground/5 rounded" />
            <div className="h-7 w-56 bg-foreground/5 rounded" />
          </div>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-40 bg-card border border-border rounded-xl animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (query.isError) {
    return (
      <div className="min-h-screen bg-surface pb-20 flex items-center justify-center">
        <div className="text-center space-y-2">
          <p className="text-sm font-semibold text-foreground">Couldn't load your proposals</p>
          <p className="text-sm text-muted-foreground">Please try refreshing the page.</p>
        </div>
      </div>
    )
  }

  const proposals: Proposal[] = query.data?.pages.flatMap((page) => page.proposals) ?? []

  return (
    <div className="min-h-screen bg-surface pb-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <header className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Proposals</p>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">My proposals</h1>
          <p className="text-sm text-muted-foreground">Track the status of your job applications.</p>
        </header>

        <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search proposals by job title or description..."
              className="pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {proposals.length === 0 ? (
          <div className="rounded-xl border border-border bg-card py-16 px-6 text-center">
            <div className="mx-auto h-11 w-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <FileText className="h-5 w-5" />
            </div>
            <h3 className="mt-4 text-sm font-semibold text-foreground">
              {searchTerm ? "No matching proposals" : "No proposals yet"}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground max-w-sm mx-auto">
              {searchTerm ? "Try a different search term or clear the search." : "Start applying to jobs to see your proposals here."}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {proposals.map((proposal) => (
              <div key={proposal.id} className="rounded-xl border border-border bg-card p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <h3 className="text-base font-semibold text-foreground line-clamp-2">{proposal.job_title}</h3>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5">
                        <Avatar className="h-5 w-5">
                          <AvatarFallback className="text-[10px] bg-surface-2 text-foreground">
                            {proposal.agency_name?.charAt(0) || "A"}
                          </AvatarFallback>
                        </Avatar>
                        <span className="truncate">{proposal.agency_name}</span>
                      </span>
                      <span className="text-border">·</span>
                      <span className="inline-flex items-center gap-1">
                        <CalendarDays className="h-3.5 w-3.5" /> Applied {formatDate(proposal.created_at)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(proposal.status)}`}>
                      {getStatusIcon(proposal.status)}
                      {proposal.status.charAt(0).toUpperCase() + proposal.status.slice(1)}
                    </span>
                    {proposal.status === "accepted" && proposal.funding_status === "funded" && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-success/10 text-success">
                        <CheckCircle className="h-3 w-3" /> Funded
                      </span>
                    )}
                  </div>
                </div>

                {proposal.job_description && (
                  <p className="mt-3 text-sm text-muted-foreground line-clamp-3">{proposal.job_description}</p>
                )}

                <div className="mt-4 grid grid-cols-2 lg:grid-cols-4 gap-4 border-y border-border py-4">
                  {[
                    { icon: DollarSign, label: "Your budget", val: proposal.budget || "Not specified" },
                    {
                      icon: DollarSign,
                      label: "Client budget",
                      val: `₦${(proposal.job_budget_min ?? 0).toLocaleString()} – ₦${(proposal.job_budget_max ?? 0).toLocaleString()}`,
                    },
                    { icon: Clock, label: "Your timeline", val: proposal.timeline || "Not specified" },
                    { icon: Clock, label: "Job duration", val: proposal.job_duration || "Not specified" },
                  ].map((m, i) => (
                    <div key={i} className="flex items-start gap-2 min-w-0">
                      <m.icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">{m.label}</p>
                        <p className="text-sm font-medium text-foreground truncate tabular-nums">{m.val}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {proposal.job_location && (
                  <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="h-4 w-4 shrink-0" />
                    <span>
                      Location: <span className="font-medium text-foreground">{proposal.job_location}</span>
                    </span>
                  </div>
                )}

                {!!proposal.skills?.length && (
                  <div className="mt-4">
                    <p className="text-xs font-medium text-muted-foreground mb-2">Skills</p>
                    <div className="flex flex-wrap gap-1.5">
                      {proposal.skills.map((skill, index) => (
                        <span key={index} className="px-2 py-0.5 rounded-md bg-surface-2 text-muted-foreground text-[11px]">
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-4 rounded-lg border border-border bg-surface-2 p-4">
                  <p className="text-xs font-medium text-muted-foreground mb-1.5">Your proposal</p>
                  <p className="text-sm text-foreground whitespace-pre-wrap line-clamp-4">{proposal.proposal_text}</p>
                  {(proposal.proposal_text?.length ?? 0) > 240 && (
                    <button onClick={() => setViewingProposal(proposal)} className="mt-2 text-xs font-medium text-primary hover:underline">
                      View all
                    </button>
                  )}
                </div>

                {proposal.attachments && proposal.attachments.length > 0 && (
                  <div className="mt-4">
                    <p className="text-xs font-medium text-muted-foreground mb-2">Attachments</p>
                    <div className="flex flex-wrap gap-2">
                      {proposal.attachments.map((attachment, index) => (
                        <Badge key={index} variant="outline" className="text-xs">
                          📎 {attachment}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}

            {query.hasNextPage && (
              <div className="flex justify-center pt-2">
                <Button onClick={() => query.fetchNextPage()} disabled={query.isFetchingNextPage} variant="outline">
                  {query.isFetchingNextPage ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Loading...
                    </>
                  ) : (
                    "Load more"
                  )}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {viewingProposal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setViewingProposal(null)}>
          <div
            className="w-full max-w-2xl max-h-[85vh] flex flex-col rounded-2xl border border-border bg-card shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 p-5 border-b border-border">
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Your proposal</p>
                <h3 className="text-base font-semibold text-foreground truncate">{viewingProposal.job_title}</h3>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => setViewingProposal(null)} aria-label="Close">
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{viewingProposal.proposal_text}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
