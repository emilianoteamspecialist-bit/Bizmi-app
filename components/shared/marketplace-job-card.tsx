"use client"

import { Card } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Bookmark, BadgeCheck, Briefcase, MapPin, Sparkles, CheckCircle2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatRelative } from "@/lib/date"

interface MarketplaceJobCardProps {
  job: {
    id: string
    title: string
    description: string
    budget: string
    duration: string
    credit_cost: number
    location?: string
    job_type?: string
    skills?: string[]
    isBookmarked?: boolean
    has_applied?: boolean
    proposals?: number
    proposal_count?: number
    created_at: string
    agencyInfo: {
      name: string
      logo?: string
      isVerified?: boolean
    }
  }
  onAction: (job: any, action: "bookmark" | "view" | "apply") => void
  className?: string
}

export function MarketplaceJobCard({ job, onAction, className }: MarketplaceJobCardProps) {
  const isVerified = job.agencyInfo.isVerified !== false
  const proposalCount = job.proposals ?? job.proposal_count ?? 0
  const matchLabel = job.has_applied
    ? "You've applied"
    : proposalCount === 0
      ? "Be the first to apply"
      : `${proposalCount} ${proposalCount === 1 ? "proposal" : "proposals"} so far`

  return (
    <Card
      onClick={() => onAction(job, "view")}
      className={cn(
        "group flex flex-col bg-card border border-border rounded-xl overflow-hidden shadow-none hover:border-rule hover:shadow-[var(--shadow-warm)] transition-all duration-200 cursor-pointer",
        className
      )}
    >
      <div className="p-5 flex-1 space-y-4">
        {/* Header — logo + name + bookmark */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <Avatar className="h-10 w-10 rounded-lg border border-border shrink-0">
              <AvatarImage src={job.agencyInfo.logo} className="object-cover" />
              <AvatarFallback className="bg-paper text-foreground font-display text-base rounded-lg">
                {job.agencyInfo.name.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1">
                <p className="text-sm font-medium text-muted-foreground truncate">
                  {job.agencyInfo.name}
                </p>
                {isVerified && (
                  <BadgeCheck className="h-3.5 w-3.5 text-primary shrink-0" />
                )}
              </div>
              <h3 className="text-base font-semibold text-foreground line-clamp-1 mt-0.5 group-hover:text-primary transition-colors">
                {job.title}
              </h3>
            </div>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onAction(job, "bookmark")
            }}
            className="text-muted-foreground hover:text-foreground transition-colors -mr-1 -mt-1 p-1.5 shrink-0"
            aria-label={job.isBookmarked ? "Remove from saved" : "Save"}
          >
            <Bookmark
              className={cn(
                "h-4 w-4",
                job.isBookmarked && "fill-primary text-primary"
              )}
            />
          </button>
        </div>

        {/* Meta strip */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          {job.job_type && (
            <span className="flex items-center gap-1.5">
              <Briefcase className="h-3.5 w-3.5" />
              <span className="capitalize">{job.job_type.replace(/_/g, "-")}</span>
            </span>
          )}
          {job.location && (
            <span className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" />
              <span className="truncate">{job.location}</span>
            </span>
          )}
          {!job.job_type && !job.location && (
            <span className="flex items-center gap-1.5">
              <Briefcase className="h-3.5 w-3.5" />
              <span>{job.duration}</span>
            </span>
          )}
        </div>

        {/* Description */}
        <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">
          {job.description}
        </p>

        {/* Salary + date */}
        <div className="flex items-baseline justify-between pt-1">
          <p className="text-sm font-semibold text-foreground numeric">{job.budget}</p>
          <p className="caption">{formatRelative(job.created_at)}</p>
        </div>
      </div>

      {/* Bottom strip — soft primary tint */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          if (!job.has_applied) onAction(job, "apply")
        }}
        disabled={job.has_applied}
        className={cn(
          "w-full flex items-center justify-center gap-1.5 py-3 text-xs font-medium transition-colors",
          job.has_applied
            ? "bg-success/10 text-success cursor-default"
            : "bg-primary-soft text-primary hover:bg-primary/15"
        )}
      >
        {job.has_applied ? (
          <CheckCircle2 className="h-3.5 w-3.5" />
        ) : (
          <Sparkles className="h-3.5 w-3.5" />
        )}
        {matchLabel}
      </button>
    </Card>
  )
}
