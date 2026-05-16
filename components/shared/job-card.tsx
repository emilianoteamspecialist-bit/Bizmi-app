"use client"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Bookmark, CheckCircle2, ArrowUpRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatDate } from "@/lib/date"

interface JobCardProps {
  job: {
    id: string
    title: string
    description: string
    budget: string
    duration: string
    credit_cost: number
    skills?: string[]
    rating?: number
    isBookmarked?: boolean
    has_applied?: boolean
    match_score?: number
    created_at: string
    agencyInfo: {
      name: string
      logo?: string
      isVerified?: boolean
    }
  }
  onAction: (job: any, action: "bookmark" | "view" | "apply") => void
  creditBalance: number
  className?: string
}

export function JobCard({ job, onAction, creditBalance, className }: JobCardProps) {
  const canApply = !job.has_applied && creditBalance >= job.credit_cost
  const isVerified = job.agencyInfo.isVerified !== false

  return (
    <Card
      className={cn(
        "group flex flex-col bg-card border border-border rounded-lg overflow-hidden shadow-none hover:shadow-[var(--shadow-warm)] transition-shadow duration-300",
        className
      )}
    >
      <div className="p-6 flex-1 space-y-5">
        {/* Byline */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Avatar className="h-9 w-9 rounded-md border border-border shrink-0">
              <AvatarImage src={job.agencyInfo.logo} className="object-cover" />
              <AvatarFallback className="bg-paper text-foreground font-display text-base rounded-md">
                {job.agencyInfo.name.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                {job.agencyInfo.name}
              </p>
              <p className="caption flex items-center gap-1.5">
                {formatDate(job.created_at)}
                {isVerified && (
                  <>
                    <span className="text-border">·</span>
                    <span className="text-success">verified</span>
                  </>
                )}
              </p>
            </div>
          </div>
          <button
            onClick={() => onAction(job, "bookmark")}
            className="text-muted-foreground hover:text-foreground transition-colors -mr-1 -mt-1 p-1.5"
            aria-label={job.isBookmarked ? "Remove from saved" : "Save"}
          >
            <Bookmark
              className={cn(
                "h-4 w-4",
                job.isBookmarked && "fill-foreground text-foreground"
              )}
            />
          </button>
        </div>

        {/* Title — editorial display */}
        <h3
          onClick={() => onAction(job, "view")}
          className="font-display text-2xl md:text-[1.625rem] leading-[1.15] tracking-tight text-foreground line-clamp-2 cursor-pointer group-hover:text-primary transition-colors"
        >
          {job.title}
        </h3>

        {/* Description */}
        <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">
          {job.description}
        </p>

        {/* Meta — hairline rows */}
        <dl className="hairline pt-3 space-y-0">
          <div className="flex justify-between items-baseline py-2 hairline-b">
            <dt className="caption">Budget</dt>
            <dd className="numeric text-sm font-medium text-foreground">{job.budget}</dd>
          </div>
          <div className="flex justify-between items-baseline py-2 hairline-b">
            <dt className="caption">Duration</dt>
            <dd className="text-sm font-medium text-foreground">{job.duration}</dd>
          </div>
          <div className="flex justify-between items-baseline py-2 hairline-b">
            <dt className="caption">Bid cost</dt>
            <dd className="numeric text-sm font-medium text-foreground">
              {job.credit_cost} <span className="caption">credits</span>
            </dd>
          </div>
        </dl>

        {/* Skills */}
        {job.skills && job.skills.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {job.skills.slice(0, 4).map((s) => (
              <span
                key={s}
                className="px-2 py-1 bg-paper text-foreground text-[11px] font-medium rounded border border-border"
              >
                {s}
              </span>
            ))}
            {job.skills.length > 4 && (
              <span className="caption italic px-2 py-1">
                +{job.skills.length - 4}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-6 py-4 hairline flex items-center justify-end gap-2 bg-surface/40">
        <Button
          variant="ghost"
          size="sm"
          className="h-9 text-xs"
          onClick={() => onAction(job, "view")}
        >
          Details
        </Button>
        <Button
          size="sm"
          className="h-9 text-xs"
          onClick={() => onAction(job, "apply")}
          disabled={!canApply && !job.has_applied}
          variant={job.has_applied ? "outline" : "default"}
        >
          {job.has_applied ? (
            <>
              <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Applied
            </>
          ) : creditBalance < job.credit_cost ? (
            "Low credits"
          ) : (
            <>
              Apply <ArrowUpRight className="ml-1 h-3.5 w-3.5" />
            </>
          )}
        </Button>
      </div>
    </Card>
  )
}
