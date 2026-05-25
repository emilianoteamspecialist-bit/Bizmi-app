"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ArrowUpRight, CheckCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { calcMatch, competitionLevel } from "@/lib/freelancer-insights"

interface RowJob {
  id: string
  title: string
  budget: string
  skills?: string[]
  proposals?: number
  proposal_count?: number
  has_applied?: boolean
  agencyInfo?: {
    name?: string
    logo?: string
  }
}

interface JobCardRowProps {
  job: RowJob
  userSkills?: string[] | null
  onApply?: () => void
  onClick?: () => void
  className?: string
}

export function JobCardRow({ job, userSkills, onApply, onClick, className }: JobCardRowProps) {
  const match = calcMatch(job.skills, userSkills)
  const proposalCount = job.proposals ?? job.proposal_count ?? 0
  const comp = competitionLevel(proposalCount)

  return (
    <article
      onClick={onClick}
      className={cn(
        "group flex items-center gap-3.5 rounded-2xl bg-card px-4 py-3.5 shadow-[var(--shadow-soft)] hover:shadow-[var(--shadow-grounded)] transition-shadow",
        onClick && "cursor-pointer",
        className
      )}
    >
      <Avatar className="h-10 w-10 rounded-xl border border-border shrink-0">
        <AvatarImage src={job.agencyInfo?.logo} className="object-cover" />
        <AvatarFallback className="rounded-xl bg-foreground/90 text-white text-sm font-semibold">
          {job.agencyInfo?.name?.[0]?.toUpperCase() ?? "A"}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0 space-y-0.5">
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span className="truncate">{job.agencyInfo?.name}</span>
          <span className="text-border">·</span>
          <span className={comp.tone}>{proposalCount} bids</span>
        </div>
        <h4 className="text-sm font-semibold text-foreground truncate">{job.title}</h4>
      </div>
      <div className="hidden md:flex flex-col items-end gap-0.5 shrink-0">
        <p className="text-sm font-semibold text-foreground numeric whitespace-nowrap">{job.budget}</p>
        <p className="text-[11px]">
          <span className="text-primary font-medium numeric">{match}%</span>
          <span className="text-muted-foreground"> match</span>
        </p>
      </div>
      {onApply && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onApply()
          }}
          disabled={job.has_applied}
          className="h-9 w-9 rounded-full bg-primary-soft text-primary hover:bg-primary hover:text-white transition-colors flex items-center justify-center shrink-0 disabled:opacity-40 disabled:cursor-not-allowed group-hover:scale-105"
          aria-label={job.has_applied ? "Applied" : "Apply"}
        >
          {job.has_applied ? <CheckCircle className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
        </button>
      )}
    </article>
  )
}
