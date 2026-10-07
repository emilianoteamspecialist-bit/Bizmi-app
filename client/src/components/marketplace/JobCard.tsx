import type { ReactNode } from "react"
import { Bookmark, BookmarkCheck, MapPin } from "lucide-react"
import { formatBudgetRange, formatTimeAgo } from "@/lib/format"
import { cn } from "@/lib/utils"
import { SkillList } from "./primitives"

// Shape of a job from GET /api/jobs (get_jobs_with_details) -- fields can be
// missing, so everything here degrades gracefully.
export type MarketplaceJob = {
  id: string
  title: string
  description?: string | null
  budget_min?: number | null
  budget_max?: number | null
  duration?: string | null
  location?: string | null
  job_type?: string | null
  skills?: string[] | null
  credit_cost?: number | null
  created_at?: string | null
  proposal_count?: number | null
  is_bookmarked?: boolean | null
  has_applied?: boolean | null
  agency_info?: {
    full_name?: string | null
    company_name?: string | null
    location?: string | null
    created_at?: string | null
    total_jobs?: number | null
    bio?: string | null
  } | null
}

export const clientName = (job: MarketplaceJob) => job.agency_info?.company_name || job.agency_info?.full_name || "Agency"

export function proposalsLabel(count: number | null | undefined): string {
  const n = Number(count) || 0
  if (n === 0) return "Be the first to apply"
  if (n < 5) return "Less than 5 proposals"
  if (n < 10) return "5 to 10 proposals"
  if (n < 20) return "10 to 20 proposals"
  return "20+ proposals"
}

type Props = {
  job: MarketplaceJob
  onOpen: (job: MarketplaceJob) => void
  saved?: boolean
  onToggleSave?: (job: MarketplaceJob) => void
  /** Primary action shown bottom-right (e.g. Apply / Applied). */
  action?: ReactNode
  className?: string
}

/**
 * Marketplace job row. The whole card opens the job (via a stretched title
 * button, so it stays keyboard- and screen-reader-friendly); Save and the
 * action stay independent controls above it.
 */
export function JobCard({ job, onOpen, saved, onToggleSave, action, className }: Props) {
  const posted = formatTimeAgo(job.created_at)
  const meta = [job.job_type, job.duration ? `Est. ${job.duration}` : null].filter(Boolean)

  return (
    <article className={cn("group relative rounded-lg border border-border bg-card p-4 transition-colors hover:border-foreground/25 sm:p-5", className)}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          {posted && <p className="text-xs text-muted-foreground">Posted {posted}</p>}
          <h2 className="mt-0.5 font-heading text-base font-semibold leading-snug text-foreground">
            <button
              type="button"
              onClick={() => onOpen(job)}
              className="text-left after:absolute after:inset-0 after:rounded-lg after:content-[''] group-hover:text-primary focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring"
            >
              {job.title}
            </button>
          </h2>
        </div>
        {onToggleSave && (
          <button
            type="button"
            onClick={() => onToggleSave(job)}
            aria-label={saved ? "Remove from saved" : "Save"}
            aria-pressed={!!saved}
            className={cn(
              "relative z-10 -mr-1 -mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-md transition-colors hover:bg-surface-2",
              saved ? "text-primary" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {saved ? <BookmarkCheck className="h-5 w-5" /> : <Bookmark className="h-5 w-5" />}
          </button>
        )}
      </div>

      <p className="mt-2 text-sm text-foreground">
        <span className="font-semibold tabular-nums">{formatBudgetRange(job.budget_min, job.budget_max)}</span>
        {meta.length > 0 && <span className="text-muted-foreground"> · {meta.join(" · ")}</span>}
      </p>

      {job.description && <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{job.description}</p>}

      <div className="mt-3">
        <SkillList skills={job.skills} max={5} />
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{clientName(job)}</span>
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-3 w-3" aria-hidden />
            {job.location || "Remote"}
          </span>
          <span>{proposalsLabel(job.proposal_count)}</span>
          {job.credit_cost != null && <span>{job.credit_cost} credits to apply</span>}
        </div>
        {action && <div className="relative z-10">{action}</div>}
      </div>
    </article>
  )
}

export function JobCardSkeleton() {
  return (
    <div className="rounded-lg border border-border bg-card p-5" aria-hidden>
      <div className="h-3 w-24 animate-pulse rounded bg-surface-2" />
      <div className="mt-2 h-5 w-2/3 animate-pulse rounded bg-surface-2" />
      <div className="mt-3 h-4 w-1/3 animate-pulse rounded bg-surface-2" />
      <div className="mt-3 h-4 w-full animate-pulse rounded bg-surface-2" />
      <div className="mt-1.5 h-4 w-4/5 animate-pulse rounded bg-surface-2" />
      <div className="mt-4 flex gap-1.5">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-5 w-16 animate-pulse rounded bg-surface-2" />
        ))}
      </div>
    </div>
  )
}
