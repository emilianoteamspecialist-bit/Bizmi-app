import { useEffect, useMemo, useRef, useState } from "react"
import { Navigate, useSearchParams } from "react-router-dom"
import { Search, Bookmark, BookmarkCheck, Briefcase, ChevronDown, Loader2, MapPin, Sparkles, X } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { useDashboardQuery } from "@/lib/queries/user"
import { useMarketplaceQuery } from "@/lib/queries/marketplace"
import { useToggleBookmarkMutation } from "@/lib/queries/jobs"
import { useSubmitProposalMutation } from "@/lib/queries/proposals"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Modal } from "@/components/shared/modal"

type Job = any

function money(value: number | null) { return value == null ? "Negotiable" : `₦${value.toLocaleString()}` }
function relativeDate(value: string) {
  const days = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 86400000))
  return days === 0 ? "today" : `${days}d ago`
}

export default function Marketplace() {
  const { profile } = useAuth()
  const isFreelancer = !profile || profile.account_type === "freelancer"
  const dashboard = useDashboardQuery(isFreelancer)
  // ?q= comes from the marketplace header search.
  const [searchParams] = useSearchParams()
  const urlQuery = searchParams.get("q") ?? ""
  const [params, setParams] = useState({ searchQuery: urlQuery, jobType: "", maxCredits: undefined as number | undefined, categorySkills: undefined as string[] | undefined, fromDate: undefined as string | undefined })
  const [draftSearch, setDraftSearch] = useState(urlQuery)
  useEffect(() => {
    setDraftSearch(urlQuery)
    setParams((current) => (current.searchQuery === urlQuery ? current : { ...current, searchQuery: urlQuery }))
  }, [urlQuery])
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [bookmarkOverrides, setBookmarkOverrides] = useState<Record<string, boolean>>({})
  const [proposal, setProposal] = useState({ proposal_text: "", timeline: "", budget: "" })
  const [showFilters, setShowFilters] = useState(false)
  const submittingRef = useRef(false)
  const [applied, setApplied] = useState<Set<string>>(new Set())
  const query = useMarketplaceQuery(params, isFreelancer)
  const bookmark = useToggleBookmarkMutation()
  const submit = useSubmitProposalMutation()

  if (profile && profile.account_type !== "freelancer") return <Navigate to="/" replace />
  if (query.isError && !query.data) return <MarketplaceShell><div className="py-20 text-center"><p className="font-semibold">Couldn't load projects</p><p className="text-sm text-muted-foreground">Please try refreshing the page.</p></div></MarketplaceShell>

  const jobs = query.data?.pages.flatMap((page) => page.jobs) ?? []
  const total = query.data?.pages[0]?.totalCount ?? jobs.length
  const credits = dashboard.data?.credits ?? 0
  const verified = !!dashboard.data?.isVerified
  const apply = (job: Job) => {
    if (!verified || credits < job.credit_cost) return
    setSelectedJob(job); setProposal({ proposal_text: "", timeline: "", budget: "" })
  }
  const submitProposal = () => {
    if (!selectedJob || submittingRef.current || !proposal.proposal_text || !proposal.timeline || !proposal.budget) return
    submittingRef.current = true
    const submittedJobId = selectedJob.id
    setJobsApplied(submittedJobId)
    submit.mutateAsync({ jobId: selectedJob.id, ...proposal, creditCost: selectedJob.credit_cost }).then((result) => {
      submittingRef.current = false
      if (result.success) setSelectedJob(null)
      else setApplied((current) => { const next = new Set(current); next.delete(submittedJobId); return next })
    }).catch(() => { submittingRef.current = false; setApplied((current) => { const next = new Set(current); next.delete(submittedJobId); return next }) })
  }
  const setJobsApplied = (id: string) => setApplied((current) => new Set(current).add(id))

  return <MarketplaceShell>
    <header className="space-y-1"><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Marketplace</p><h1 className="text-2xl font-semibold">Find projects</h1><p className="text-sm text-muted-foreground">Browse open briefs from agencies and file your proposal.</p></header>
    <form className="rounded-xl border border-border bg-card p-4 flex flex-col sm:flex-row gap-2" onSubmit={(event) => { event.preventDefault(); setParams((current) => ({ ...current, searchQuery: draftSearch })) }}>
      <div className="relative flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input aria-label="Search projects" role="searchbox" value={draftSearch} onChange={(e) => setDraftSearch(e.target.value)} placeholder="Search projects, skills, agencies…" className="pl-9" /></div>
      <Button type="submit">Search</Button><Button type="button" variant="outline" onClick={() => setShowFilters((value) => !value)}><ChevronDown className="mr-2 h-4 w-4" />Filters</Button>
    </form>
    {showFilters && <div className="rounded-xl border border-border bg-card p-4 flex flex-wrap gap-3"><Select value={params.jobType || "all"} onValueChange={(value) => setParams((current) => ({ ...current, jobType: value === "all" ? "" : value }))}><SelectTrigger className="w-44"><SelectValue placeholder="Job type" /></SelectTrigger><SelectContent><SelectItem value="all">All job types</SelectItem><SelectItem value="Remote">Remote</SelectItem><SelectItem value="Hybrid">Hybrid</SelectItem><SelectItem value="On-site">On-site</SelectItem></SelectContent></Select><Select value={params.maxCredits ? String(params.maxCredits) : "all"} onValueChange={(value) => setParams((current) => ({ ...current, maxCredits: value === "all" ? undefined : Number(value) }))}><SelectTrigger className="w-44"><SelectValue placeholder="Bid cost" /></SelectTrigger><SelectContent><SelectItem value="all">Any bid cost</SelectItem><SelectItem value="5">Up to 5 credits</SelectItem><SelectItem value="10">Up to 10 credits</SelectItem></SelectContent></Select><Button type="button" variant="ghost" onClick={() => setParams({ searchQuery: "", jobType: "", maxCredits: undefined, categorySkills: undefined, fromDate: undefined })}>Clear filters</Button></div>}
    <div className="flex items-center justify-between"><p className="text-sm">{total === 1 ? "1 project found" : `${total} projects found`}</p><p className="text-xs text-muted-foreground">{query.isFetching ? "Updating…" : "Fresh briefs"}</p></div>
    {query.isFetchNextPageError && <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm flex justify-between items-center"><span>Couldn't load more projects.</span><Button variant="outline" size="sm" onClick={() => query.fetchNextPage()}>Retry load more</Button></div>}
    {query.isLoading && !query.data ? <div className="py-16 text-center text-muted-foreground">Loading projects…</div> : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{jobs.map((job) => { const isApplied = job.has_applied || applied.has(job.id); const isBookmarked = bookmarkOverrides[job.id] ?? !!job.is_bookmarked; const canApply = verified && credits >= job.credit_cost && !isApplied; return <article key={job.id} className="rounded-xl border border-border bg-card overflow-hidden flex flex-col"><div className="p-5 space-y-4 flex-1"><div className="flex justify-between gap-3"><div><p className="text-xs text-muted-foreground">{job.agency_info?.company_name || job.agency_info?.full_name || "Agency"}</p><h2 className="mt-1 text-lg font-semibold">{job.title}</h2></div><button aria-label={isBookmarked ? "Remove from saved" : "Save"} className="text-muted-foreground hover:text-primary" onClick={() => { setBookmarkOverrides((current) => ({ ...current, [job.id]: !isBookmarked })); bookmark.mutate({ jobId: job.id, isBookmarked }) }}>{isBookmarked ? <BookmarkCheck className="h-5 w-5" /> : <Bookmark className="h-5 w-5" />}</button></div><p className="text-sm text-muted-foreground line-clamp-3">{job.description}</p><div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground"><span>{money(job.budget_min)} – {money(job.budget_max)}</span><span><MapPin className="inline h-3 w-3" /> {job.location || "Remote"}</span><span>{relativeDate(job.created_at)}</span></div><div className="flex flex-wrap gap-1.5">{(job.skills || []).slice(0, 5).map((skill: string) => <span key={skill} className="rounded bg-surface px-2 py-1 text-[11px]">{skill}</span>)}</div></div><div className="border-t border-border p-4 flex items-center justify-between gap-3"><span className="text-xs text-muted-foreground">{job.credit_cost} credits · {job.proposal_count ?? 0} bids</span><Button disabled={!canApply} variant={isApplied ? "outline" : "default"} aria-label={isApplied ? "Applied" : !verified ? "Verify identity to apply" : credits < job.credit_cost ? "Insufficient credits" : "Apply"} onClick={() => apply(job)}>{isApplied ? "Applied" : "Apply"}</Button></div></article> })}</div>}
    {jobs.length === 0 && <div className="rounded-xl border border-border bg-card py-16 text-center"><Briefcase className="mx-auto h-8 w-8 text-muted-foreground" /><p className="mt-3 font-semibold">No projects match</p><p className="text-sm text-muted-foreground">Try a different search or clear your filters.</p></div>}
    {query.hasNextPage && <div className="flex justify-center"><Button variant="outline" disabled={query.isFetchingNextPage} onClick={() => query.fetchNextPage()}>{query.isFetchingNextPage && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Load more</Button></div>}
    <Modal isOpen={!!selectedJob} onClose={() => setSelectedJob(null)} title="Send a proposal" description={selectedJob ? `${selectedJob.title} · ${selectedJob.credit_cost} credits` : undefined}><form onSubmit={(event) => { event.preventDefault(); submitProposal() }} className="space-y-4"><Textarea aria-label="Your proposal" value={proposal.proposal_text} onChange={(e) => setProposal((current) => ({ ...current, proposal_text: e.target.value }))} placeholder="Tell the agency how you will deliver this brief" /><Input aria-label="Timeline" value={proposal.timeline} onChange={(e) => setProposal((current) => ({ ...current, timeline: e.target.value }))} placeholder="Timeline" /><Input aria-label="Your budget (₦)" value={proposal.budget} onChange={(e) => setProposal((current) => ({ ...current, budget: e.target.value }))} placeholder="Your budget (₦)" /><Button type="submit" disabled={submit.isPending || !proposal.proposal_text || !proposal.timeline || !proposal.budget} className="w-full">{submit.isPending ? "Sending…" : "Send proposal"}</Button></form></Modal>
  </MarketplaceShell>
}

function MarketplaceShell({ children }: { children: React.ReactNode }) { return <div className="min-h-screen bg-surface pb-20"><div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">{children}</div></div> }
