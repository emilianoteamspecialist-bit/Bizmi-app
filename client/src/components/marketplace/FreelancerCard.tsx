import { MapPin } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { formatMemberSince } from "@/lib/format"
import type { FreelancerSearchResult } from "@/lib/queries/freelancers"
import { SkillList, TrustBadge } from "./primitives"

export const isIdentityVerified = (f: Pick<FreelancerSearchResult, "verification_status"> & { identity_verified?: boolean }) =>
  f.identity_verified ?? f.verification_status === "verified"

export function jobsCompletedLabel(n: number | null | undefined) {
  const count = Number(n) || 0
  return count === 0 ? "No completed jobs yet" : `${count} job${count === 1 ? "" : "s"} completed`
}

export function FreelancerAvatar({ freelancer, size = "md" }: { freelancer: Pick<FreelancerSearchResult, "full_name" | "logo">; size?: "md" | "lg" }) {
  return (
    <Avatar className={size === "lg" ? "h-16 w-16" : "h-12 w-12"}>
      <AvatarImage src={freelancer.logo ?? undefined} alt="" className="object-cover" />
      <AvatarFallback className="bg-surface-2 font-semibold text-foreground">{freelancer.full_name?.charAt(0)?.toUpperCase() || "F"}</AvatarFallback>
    </Avatar>
  )
}

/** Compact freelancer card for talent search: identity, trust, skills, then the action. */
export function FreelancerCard({ freelancer, onView }: { freelancer: FreelancerSearchResult; onView: (f: FreelancerSearchResult) => void }) {
  const verified = isIdentityVerified(freelancer)
  const memberSince = formatMemberSince(freelancer.created_at)
  return (
    <article className="flex flex-col rounded-lg border border-border bg-card p-4 transition-colors hover:border-foreground/25 sm:p-5">
      <div className="flex items-start gap-3">
        <FreelancerAvatar freelancer={freelancer} />
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-heading text-base font-semibold text-foreground">{freelancer.full_name || "Freelancer"}</h2>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
            {freelancer.location && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3 w-3" aria-hidden />
                {freelancer.location}
              </span>
            )}
            {memberSince && <span>{memberSince}</span>}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5">
            {verified && <TrustBadge kind="identity" />}
            <span className="text-xs text-muted-foreground">{jobsCompletedLabel(freelancer.jobs_completed)}</span>
          </div>
        </div>
      </div>

      {freelancer.bio && <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">{freelancer.bio}</p>}

      <div className="mt-3 flex-1">
        <SkillList skills={freelancer.skills} max={4} />
      </div>

      <div className="mt-4 border-t border-border pt-3">
        <Button variant="outline" size="sm" className="w-full" onClick={() => onView(freelancer)}>
          View profile
        </Button>
      </div>
    </article>
  )
}

export function FreelancerCardSkeleton() {
  return (
    <div className="rounded-lg border border-border bg-card p-5" aria-hidden>
      <div className="flex gap-3">
        <div className="h-12 w-12 animate-pulse rounded-full bg-surface-2" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-1/2 animate-pulse rounded bg-surface-2" />
          <div className="h-3 w-1/3 animate-pulse rounded bg-surface-2" />
        </div>
      </div>
      <div className="mt-4 h-3 w-full animate-pulse rounded bg-surface-2" />
      <div className="mt-1.5 h-3 w-3/4 animate-pulse rounded bg-surface-2" />
      <div className="mt-4 h-8 w-full animate-pulse rounded bg-surface-2" />
    </div>
  )
}
