import { useState } from "react"
import { Navigate, useNavigate } from "react-router-dom"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Eye, FileText, Plus, Search } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { useAgencyJobsQuery, type AgencyJob } from "@/lib/queries/jobs"
import ProposalsModal from "./ProposalsModal"

// Slim port of the legacy /agency/posts page. The legacy page's "Fund job" and
// "Mark done" actions are escrow-gated (Phase 4) and intentionally omitted.
// Search filters the already-loaded job list client-side (the agency jobs
// query returns every job), which replaces the legacy server-side search +
// "Load more" pagination.
export default function AgencyPosts() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [searchTerm, setSearchTerm] = useState("")
  const [viewingProposalsJob, setViewingProposalsJob] = useState<AgencyJob | null>(null)

  const agencyJobsQuery = useAgencyJobsQuery()

  if (profile?.account_type === "freelancer") {
    return <Navigate to="/freelancer/dashboard" replace />
  }
  if (profile?.account_type === "admin") {
    return <Navigate to="/admin/dashboard" replace />
  }

  if (agencyJobsQuery.isError && !agencyJobsQuery.data) {
    return (
      <div className="min-h-screen bg-surface pb-20 flex items-center justify-center">
        <div className="text-center space-y-2">
          <p className="text-sm font-semibold text-foreground">Couldn't load your job posts</p>
          <p className="text-sm text-muted-foreground">Please try refreshing the page.</p>
        </div>
      </div>
    )
  }

  const jobs: AgencyJob[] = agencyJobsQuery.data?.jobs ?? []
  const term = searchTerm.trim().toLowerCase()
  const filteredJobs = term
    ? jobs.filter(
        (job) =>
          (job.title?.toLowerCase() || "").includes(term) || (job.description?.toLowerCase() || "").includes(term)
      )
    : jobs

  return (
    <div className="flex flex-col min-h-screen bg-surface">
      <main className="flex-1 p-4 sm:p-6 lg:p-8 pb-20">
        <div className="mx-auto max-w-6xl space-y-8">
          <header className="space-y-1">
            <h1 className="font-heading text-xl font-semibold tracking-tight text-foreground sm:text-2xl">Job posts</h1>
            <p className="text-sm text-muted-foreground">Track your listings and review incoming proposals.</p>
          </header>

          <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search job posts by title or description..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {agencyJobsQuery.isLoading ? (
            <div data-testid="agency-posts-skeleton" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <Card key={i} className="rounded-xl border border-border bg-card shadow-none animate-pulse">
                  <CardHeader>
                    <div className="h-6 bg-foreground/5 rounded w-3/4 mb-2"></div>
                    <div className="h-4 bg-foreground/5 rounded w-1/2"></div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="h-4 bg-foreground/5 rounded"></div>
                    <div className="h-4 bg-foreground/5 rounded w-5/6"></div>
                    <div className="h-4 bg-foreground/5 rounded w-2/3"></div>
                    <div className="h-8 bg-foreground/5 rounded w-full mt-4"></div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : filteredJobs.length === 0 ? (
            <div className="rounded-xl border border-border bg-card py-16 px-6 text-center">
              <div className="mx-auto h-11 w-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <FileText className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-sm font-semibold text-foreground">
                {searchTerm ? "No matching job posts" : "No job posts yet"}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground max-w-sm mx-auto">
                {searchTerm
                  ? "Try a different title or keyword."
                  : "Post your first opportunity from the dashboard and proposals will land here."}
              </p>
              {!searchTerm && (
                <Button className="mt-5 gap-2" onClick={() => navigate("/agency/dashboard")}>
                  <Plus className="h-4 w-4" /> Post a job
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredJobs.map((job) => (
                <Card
                  key={job.id}
                  className="flex flex-col rounded-xl border border-border bg-card shadow-none hover:border-foreground/20 transition-colors"
                >
                  <CardHeader>
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-base font-semibold text-foreground truncate">{job.title}</CardTitle>
                      <CardDescription className="text-xs text-muted-foreground mt-1">
                        Posted{" "}
                        {new Date(job.created_at).toLocaleDateString("en-NG", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </CardDescription>
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1 flex flex-col justify-between">
                    <p className="text-sm text-muted-foreground mb-4 line-clamp-3">{job.description}</p>
                    <div className="flex flex-wrap items-center gap-2 mb-4">
                      <span className="px-2 py-0.5 rounded-md bg-surface-2 text-foreground text-[11px] font-medium tabular-nums">
                        ₦{job.budget_min?.toLocaleString()} – ₦{job.budget_max?.toLocaleString()}
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-primary-soft text-primary text-[11px] font-medium">
                        {job.proposals} {job.proposals === 1 ? "proposal" : "proposals"}
                      </span>
                    </div>
                    <Button variant="outline" onClick={() => setViewingProposalsJob(job)} className="w-full gap-2">
                      <Eye className="h-4 w-4" />
                      Review bids ({job.proposals})
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>

      <ProposalsModal job={viewingProposalsJob} isOpen={!!viewingProposalsJob} onClose={() => setViewingProposalsJob(null)} />
    </div>
  )
}
