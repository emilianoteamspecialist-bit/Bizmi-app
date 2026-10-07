import { MapPin } from "lucide-react"
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet"
import { getCategoriesForSkills } from "@/lib/categories"
import { formatMemberSince } from "@/lib/format"
import type { FreelancerSearchResult } from "@/lib/queries/freelancers"
import { FreelancerAvatar, isIdentityVerified, jobsCompletedLabel } from "@/components/marketplace/FreelancerCard"
import { FactList, Panel, SkillList, TrustBadge } from "@/components/marketplace/primitives"

/**
 * A freelancer's profile as a storefront panel opened from talent search:
 * who they are and why to trust them up top, then overview and skills. Only
 * data Bizimi actually has is shown (no ratings or reviews exist yet).
 */
export default function FreelancerProfileModal({
  freelancer,
  isOpen,
  onClose,
}: {
  freelancer: FreelancerSearchResult | null
  isOpen: boolean
  onClose: () => void
}) {
  if (!isOpen || !freelancer) return null
  const verified = isIdentityVerified(freelancer)
  const categories = getCategoriesForSkills(freelancer.skills ?? [])
  const memberSince = formatMemberSince(freelancer.created_at)

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto bg-surface p-0 sm:max-w-2xl">
        <div className="border-b border-border bg-card px-5 py-6 pr-12 sm:px-8">
          <div className="flex items-start gap-4">
            <FreelancerAvatar freelancer={freelancer} size="lg" />
            <div className="min-w-0">
              <SheetTitle className="font-heading text-xl font-semibold text-foreground">{freelancer.full_name || "Freelancer"}</SheetTitle>
              <SheetDescription className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                {freelancer.location && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" aria-hidden />
                    {freelancer.location}
                  </span>
                )}
                {memberSince && <span>{memberSince}</span>}
              </SheetDescription>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
                {verified ? <TrustBadge kind="identity" /> : <span className="text-xs text-muted-foreground">Identity not yet verified</span>}
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-5 px-5 py-5 sm:px-8">
          <Panel title="Track record">
            <FactList
              items={[
                { label: "Jobs completed on Bizimi", value: Number(freelancer.jobs_completed) || 0 },
                { label: "Identity", value: verified ? "Verified" : "Not verified" },
              ]}
            />
            <p className="mt-3 text-xs text-muted-foreground">{jobsCompletedLabel(freelancer.jobs_completed)} through Bizimi escrow.</p>
          </Panel>

          <Panel title="About">
            {freelancer.bio ? (
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{freelancer.bio}</p>
            ) : (
              <p className="text-sm text-muted-foreground">This freelancer hasn't written a bio yet.</p>
            )}
          </Panel>

          <Panel title="Skills">
            {freelancer.skills?.length ? <SkillList skills={freelancer.skills} max={30} /> : <p className="text-sm text-muted-foreground">No skills listed.</p>}
            {categories.length > 0 && (
              <p className="mt-3 text-sm text-muted-foreground">
                Works in <span className="font-medium text-foreground">{categories.join(", ")}</span>
              </p>
            )}
          </Panel>
        </div>
      </SheetContent>
    </Sheet>
  )
}
