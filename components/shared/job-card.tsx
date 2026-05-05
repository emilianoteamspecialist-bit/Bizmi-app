"use client"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { StatBadge } from "@/components/shared/stat-badge"
import { Bookmark, ShieldCheck, Clock, Briefcase, CheckCircle2, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"

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
  const matchScore = job.match_score || 94

  return (
    <Card className={cn(
      "flex flex-col group overflow-hidden border border-border shadow-sm hover:shadow-md transition-all duration-300 rounded-lg bg-card", 
      className
    )}>
      <div className="p-6 flex-1 space-y-6">
        {/* Header: Agency & Trust Signals */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Avatar className="h-11 w-11 rounded-md border border-border shadow-sm">
              <AvatarImage src={job.agencyInfo.logo} />
              <AvatarFallback className="bg-surface text-muted-foreground font-bold">
                {job.agencyInfo.name.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-bold text-foreground truncate max-w-[140px]">
                  {job.agencyInfo.name}
                </p>
                {isVerified && (
                  <ShieldCheck className="h-3.5 w-3.5 text-success fill-success/10" />
                )}
              </div>
              <p className="text-[11px] text-muted-foreground font-medium flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {new Date(job.created_at).toLocaleDateString()}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <StatBadge variant="default" icon={<Sparkles className="h-3 w-3" />}>
              {matchScore}%
            </StatBadge>
            <button 
              onClick={() => onAction(job, "bookmark")}
              className="text-muted-foreground hover:text-foreground transition-colors p-1"
            >
              <Bookmark className={cn("h-5 w-5", job.isBookmarked && "fill-foreground text-foreground")} />
            </button>
          </div>
        </div>

        {/* Core Content */}
        <div className="space-y-2">
          <h4 className="text-base font-bold font-heading text-foreground leading-snug line-clamp-2 group-hover:text-primary transition-colors">
            {job.title}
          </h4>
          <p className="text-muted-foreground text-xs leading-relaxed line-clamp-2 font-medium">
            {job.description}
          </p>
        </div>

        {/* Budget & Meta */}
        <div className="flex items-center justify-between p-3 bg-surface rounded-md border border-border/50">
          <div className="space-y-0.5">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Secured Budget</p>
            <p className="text-sm font-black text-foreground">{job.budget}</p>
          </div>
          <div className="text-right space-y-0.5">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Duration</p>
            <p className="text-sm font-black text-foreground">{job.duration}</p>
          </div>
        </div>

        {/* Skills */}
        <div className="flex flex-wrap gap-1.5">
          {job.skills?.slice(0, 3).map((s) => (
            <StatBadge key={s} variant="muted">
              {s}
            </StatBadge>
          ))}
          {job.skills && job.skills.length > 3 && (
            <span className="px-2 py-0.5 text-muted-foreground text-[10px] font-bold italic">
              +{job.skills.length - 3} more
            </span>
          )}
        </div>
      </div>

      {/* Action Footer */}
      <div className="px-6 py-4 border-t border-border bg-card flex items-center justify-between gap-4">
        <div className="flex items-center text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
          <Briefcase className="h-3.5 w-3.5 mr-1.5 text-primary" />
          {job.credit_cost} Credits
        </div>
        <div className="flex gap-2">
          <Button 
            variant="ghost" 
            size="sm"
            className="h-8 text-[11px] font-bold"
            onClick={() => onAction(job, "view")}
          >
            Details
          </Button>
          <Button 
            size="sm"
            className={cn(
              "h-9 px-5 rounded-md font-black text-xs transition-all active:scale-[0.95]",
              job.has_applied 
                ? "bg-success/10 text-success hover:bg-success/20 border border-success/20" 
                : "bg-primary hover:bg-primary-hover text-white shadow-md shadow-primary/10"
            )}
            onClick={() => onAction(job, "apply")}
            disabled={!canApply && !job.has_applied}
          >
            {job.has_applied ? (
              <span className="flex items-center"><CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> Applied</span>
            ) : creditBalance < job.credit_cost ? (
              "Low Credits"
            ) : (
              "Apply Now"
            )}
          </Button>
        </div>
      </div>
    </Card>
  )
}
