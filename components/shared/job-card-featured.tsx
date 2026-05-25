"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Bookmark, Sparkles, ArrowUpRight, MapPin } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatDate } from "@/lib/date"
import { calcMatch, competitionLevel, isFresh } from "@/lib/freelancer-insights"

interface FeaturedJob {
  id: string
  title: string
  budget: string
  location?: string
  created_at: string
  skills?: string[]
  proposals?: number
  proposal_count?: number
  isBookmarked?: boolean
  has_applied?: boolean
  agencyInfo?: {
    name?: string
    logo?: string
    rating?: number | string
  }
}

interface JobCardFeaturedProps {
  job: FeaturedJob
  userSkills?: string[] | null
  onView?: () => void
  onApply?: () => void
  onBookmark?: () => void
  className?: string
}

export function JobCardFeatured({
  job,
  userSkills,
  onView,
  onApply,
  onBookmark,
  className,
}: JobCardFeaturedProps) {
  const match = calcMatch(job.skills, userSkills)
  const fresh = isFresh(job.created_at)
  const proposalCount = job.proposals ?? job.proposal_count ?? 0
  const comp = competitionLevel(proposalCount)
  const userLower = (userSkills || []).map((s) => s.toLowerCase())

  return (
    <article
      className={cn(
        "group relative rounded-2xl bg-card shadow-[var(--shadow-grounded)] overflow-hidden hover:-translate-y-0.5 transition-transform",
        className
      )}
    >
      <div
        className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-primary via-primary/80 to-transparent"
        aria-hidden
      />
      <div className="p-6 lg:p-7 space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3.5 min-w-0">
            <Avatar className="h-12 w-12 rounded-xl border border-border shrink-0">
              <AvatarImage src={job.agencyInfo?.logo} className="object-cover" />
              <AvatarFallback className="rounded-xl bg-foreground text-white font-semibold">
                {job.agencyInfo?.name?.[0]?.toUpperCase() ?? "A"}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="truncate">{job.agencyInfo?.name}</span>
                {job.agencyInfo?.rating && (
                  <>
                    <span className="text-border">·</span>
                    <span className="numeric">★ {job.agencyInfo.rating}</span>
                  </>
                )}
              </div>
              <h3 className="text-lg font-semibold text-foreground leading-tight mt-0.5">
                {job.title}
              </h3>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {fresh && (
              <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.18em] font-semibold text-primary bg-primary-soft px-2.5 py-1 rounded-full">
                <Sparkles className="h-3 w-3" /> Fresh
              </span>
            )}
            {onBookmark && (
              <button
                onClick={onBookmark}
                className="h-9 w-9 rounded-full bg-surface-2 hover:bg-primary-soft text-muted-foreground hover:text-primary transition-colors flex items-center justify-center"
                aria-label={job.isBookmarked ? "Unsave" : "Save"}
              >
                <Bookmark
                  className={cn("h-4 w-4", job.isBookmarked && "fill-primary text-primary")}
                />
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 py-3.5 border-y border-border">
          <div>
            <p className="eyebrow mb-1.5">Budget</p>
            <p className="text-sm font-semibold text-foreground numeric truncate">{job.budget}</p>
          </div>
          <div>
            <p className="eyebrow mb-1.5">Match</p>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-foreground numeric">{match}%</span>
              <div className="flex-1 h-1 bg-surface-2 rounded-full overflow-hidden max-w-[64px]">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-700"
                  style={{ width: `${match}%` }}
                />
              </div>
            </div>
          </div>
          <div>
            <p className="eyebrow mb-1.5">Competition</p>
            <p className={cn("text-sm font-semibold", comp.tone)}>
              <span className="numeric">{proposalCount}</span>
              <span className="text-muted-foreground font-normal text-xs"> · {comp.label.toLowerCase()}</span>
            </p>
          </div>
        </div>

        {!!job.skills?.length && (
          <div className="flex flex-wrap gap-1.5">
            {job.skills.slice(0, 6).map((s) => {
              const matching = userLower.includes(s.toLowerCase())
              return (
                <span
                  key={s}
                  className={cn(
                    "px-2.5 py-1 text-[11px] font-medium rounded-md",
                    matching ? "bg-primary-soft text-primary" : "bg-surface-2 text-muted-foreground"
                  )}
                >
                  {matching && "✓ "}
                  {s}
                </span>
              )
            })}
            {job.skills.length > 6 && (
              <span className="px-2.5 py-1 text-[11px] text-muted-foreground italic">
                +{job.skills.length - 6}
              </span>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="flex items-center gap-2.5 text-xs text-muted-foreground min-w-0">
            <span className="inline-flex items-center gap-1 truncate">
              <MapPin className="h-3 w-3 shrink-0" />
              {job.location || "Remote"}
            </span>
            <span className="text-border">·</span>
            <span className="truncate">Posted {formatDate(job.created_at)}</span>
          </div>
          <div className="flex items-center gap-2">
            {onView && (
              <Button variant="outline" size="sm" onClick={onView}>
                Details
              </Button>
            )}
            {onApply && (
              <Button
                size="sm"
                onClick={onApply}
                disabled={job.has_applied}
                className="shadow-md hover:shadow-lg transition-shadow"
              >
                {job.has_applied ? (
                  "Applied ✓"
                ) : (
                  <>
                    Quick apply <ArrowUpRight className="h-3.5 w-3.5 ml-1" />
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </article>
  )
}
