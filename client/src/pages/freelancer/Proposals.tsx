import { useState } from "react"
import { Link } from "react-router-dom"
import { FileText, Loader2, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet"
import { useMyProposalsQuery, type Proposal } from "@/lib/queries/proposals"
import { formatBudgetRange, formatNaira, formatTimeAgo } from "@/lib/format"
import { cn } from "@/lib/utils"
import { EmptyState, ErrorState, FactList, PageContainer, PageHeader, Panel, SkeletonBlock } from "@/components/marketplace/primitives"

type Tab = "all" | "active" | "accepted" | "archived"
const TABS: { id: Tab; label: string; match: (p: Proposal) => boolean }[] = [
  { id: "all", label: "All", match: () => true },
  { id: "active", label: "Active", match: (p) => p.status === "pending" },
  { id: "accepted", label: "Accepted", match: (p) => p.status === "accepted" },
  { id: "archived", label: "Archived", match: (p) => p.status === "rejected" },
]

const STATUS: Record<string, { label: string; className: string }> = {
  pending: { label: "Pending", className: "bg-warning/10 text-warning" },
  accepted: { label: "Accepted", className: "bg-success/10 text-success" },
  rejected: { label: "Not selected", className: "bg-surface-2 text-muted-foreground" },
}

function StatusPill({ status }: { status: string }) {
  const s = STATUS[status] ?? { label: status, className: "bg-surface-2 text-muted-foreground" }
  return <span className={cn("inline-flex rounded px-1.5 py-0.5 text-[11px] font-medium", s.className)}>{s.label}</span>
}

const bid = (p: Proposal) => formatNaira(p.budget) ?? "—"

export default function Proposals() {
  const [searchTerm, setSearchTerm] = useState("")
  const [tab, setTab] = useState<Tab>("all")
  const [viewingProposal, setViewingProposal] = useState<Proposal | null>(null)
  const query = useMyProposalsQuery(searchTerm)

  if (query.isError && !query.data) {
    return (
      <PageContainer width="narrow">
        <ErrorState title="Couldn't load your proposals" description="Please try refreshing the page." />
      </PageContainer>
    )
  }

  const proposals: Proposal[] = query.data?.pages.flatMap((page) => page.proposals) ?? []
  const shown = proposals.filter(TABS.find((t) => t.id === tab)!.match)
  const counts = Object.fromEntries(TABS.map((t) => [t.id, proposals.filter(t.match).length])) as Record<Tab, number>
  const firstLoad = query.isLoading && !searchTerm

  return (
    <PageContainer width="narrow">
      <PageHeader title="Proposals" description="Every proposal you've sent and where it stands." />

      <div className="mt-6 space-y-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            type="search"
            aria-label="Search proposals"
            placeholder="Search proposals by job title or description"
            className="pl-9"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div role="tablist" aria-label="Proposal status" className="flex gap-1 overflow-x-auto border-b border-border">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                tab === t.id ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {t.label}
              <span className="ml-1.5 text-xs tabular-nums text-muted-foreground">{counts[t.id]}</span>
            </button>
          ))}
        </div>

        {firstLoad ? (
          <div className="space-y-2" aria-label="Loading proposals">
            {[1, 2, 3].map((i) => (
              <SkeletonBlock key={i} className="h-16" />
            ))}
          </div>
        ) : shown.length === 0 ? (
          <EmptyState
            icon={<FileText className="h-5 w-5" />}
            title={searchTerm ? "No matching proposals" : proposals.length === 0 ? "No proposals yet" : "Nothing here"}
            description={
              searchTerm
                ? "Try a different search term or clear the search."
                : proposals.length === 0
                  ? "Find a job that fits your skills and send your first proposal."
                  : "No proposals with this status."
            }
            action={
              !searchTerm && proposals.length === 0 ? (
                <Button asChild size="sm">
                  <Link to="/freelancer/marketplace">Browse jobs</Link>
                </Button>
              ) : undefined
            }
          />
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border bg-card" role="tabpanel">
            {shown.map((p) => {
              const funded = p.status === "accepted" && p.funding_status === "funded"
              return (
                <li key={p.id} className="grid gap-2 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate text-sm font-semibold text-foreground">{p.job_title ?? "Job"}</h2>
                      <StatusPill status={p.status} />
                      {funded && <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[11px] font-medium text-primary">Funded</span>}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">{p.agency_name ?? "Agency"}</span> · Your bid <span className="tabular-nums">{bid(p)}</span> · Sent{" "}
                      {formatTimeAgo(p.created_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {funded && (
                      <Button asChild size="sm">
                        <Link to={`/workspace/${p.job_id}`}>Workspace</Link>
                      </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={() => setViewingProposal(p)} aria-label={`View proposal for ${p.job_title ?? "job"}`}>
                      View
                    </Button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}

        {query.hasNextPage && (
          <div className="flex justify-center pt-2">
            <Button onClick={() => query.fetchNextPage()} disabled={query.isFetchingNextPage} variant="outline">
              {query.isFetchingNextPage && <Loader2 className="animate-spin" />}
              {query.isFetchingNextPage ? "Loading…" : "Load more"}
            </Button>
          </div>
        )}
      </div>

      <Sheet open={!!viewingProposal} onOpenChange={(open) => !open && setViewingProposal(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto bg-surface p-0 sm:max-w-xl">
          {viewingProposal && (
            <>
              <div className="border-b border-border bg-card px-5 py-5 pr-12 sm:px-6">
                <SheetTitle className="font-heading text-lg font-semibold text-foreground">{viewingProposal.job_title ?? "Job"}</SheetTitle>
                <SheetDescription className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  {viewingProposal.agency_name ?? "Agency"} · sent {formatTimeAgo(viewingProposal.created_at)} <StatusPill status={viewingProposal.status} />
                </SheetDescription>
              </div>
              <div className="space-y-5 px-5 py-5 sm:px-6">
                <Panel title="Your terms">
                  <FactList
                    items={[
                      { label: "Your bid", value: bid(viewingProposal) },
                      { label: "Your timeline", value: viewingProposal.timeline || "Not specified" },
                      { label: "Client budget", value: formatBudgetRange(viewingProposal.job_budget_min, viewingProposal.job_budget_max) },
                      { label: "Job duration", value: viewingProposal.job_duration || "Not specified" },
                    ]}
                  />
                </Panel>
                <Panel title="Cover letter">
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{viewingProposal.proposal_text}</p>
                </Panel>
                {viewingProposal.job_description && (
                  <Panel title="The job">
                    <p className="line-clamp-[12] whitespace-pre-wrap text-sm text-muted-foreground">{viewingProposal.job_description}</p>
                  </Panel>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </PageContainer>
  )
}
