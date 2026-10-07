import type { ReactNode } from "react"
import { Bookmark, BookmarkCheck, MapPin } from "lucide-react"
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { formatBudgetRange, formatMemberSince, formatTimeAgo } from "@/lib/format"
import { FactList, Panel, SkillList } from "./primitives"
import { clientName, proposalsLabel, type MarketplaceJob } from "./JobCard"

type Props = {
  job: MarketplaceJob | null
  open: boolean
  onOpenChange: (open: boolean) => void
  saved?: boolean
  onToggleSave?: (job: MarketplaceJob) => void
  /** The apply area: the Submit a proposal button, or why it's unavailable. */
  cta: ReactNode
  /** Shown in place of the job body while the freelancer writes a proposal. */
  children?: ReactNode
}

/**
 * Job details as a slide-over from the job list (a familiar marketplace
 * pattern: browse and read without losing your place). Two columns on wide
 * screens: the brief on the left, budget/apply/client on the right.
 */
export function JobDetailsSheet({ job, open, onOpenChange, saved, onToggleSave, cta, children }: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto bg-surface p-0 sm:max-w-4xl">
        {job && (
          <div className="min-h-full">
            <div className="border-b border-border bg-card px-5 py-5 pr-12 sm:px-8">
              <p className="text-xs text-muted-foreground">Posted {formatTimeAgo(job.created_at) || "recently"}</p>
              <SheetTitle className="mt-1 font-heading text-xl font-semibold leading-snug text-foreground">{job.title}</SheetTitle>
              <SheetDescription className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" aria-hidden />
                  {job.location || "Remote"}
                </span>
                {job.job_type && <span>{job.job_type}</span>}
              </SheetDescription>
            </div>

            <div className="grid gap-5 px-5 py-5 sm:px-8 lg:grid-cols-[minmax(0,1fr)_280px]">
              <div className="min-w-0 space-y-5">
                {children ?? (
                  <>
                    <Panel title="About the job">
                      {job.description ? (
                        <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{job.description}</p>
                      ) : (
                        <p className="text-sm text-muted-foreground">The client hasn't added a description.</p>
                      )}
                    </Panel>
                    {!!job.skills?.length && (
                      <Panel title="Skills and expertise">
                        <SkillList skills={job.skills} max={20} />
                      </Panel>
                    )}
                    <Panel title="Activity on this job">
                      <FactList
                        items={[
                          { label: "Proposals", value: proposalsLabel(job.proposal_count) },
                          { label: "Credits to apply", value: job.credit_cost ?? "—" },
                        ]}
                      />
                    </Panel>
                  </>
                )}
              </div>

              <aside className="space-y-5" aria-label="Job summary">
                <Panel>
                  <p className="font-heading text-lg font-semibold tabular-nums text-foreground">{formatBudgetRange(job.budget_min, job.budget_max)}</p>
                  <p className="text-xs text-muted-foreground">Budget</p>
                  <div className="mt-4">
                    <FactList
                      items={[
                        { label: "Work type", value: job.job_type || "Not specified" },
                        { label: "Duration", value: job.duration || "Not specified" },
                      ]}
                    />
                  </div>
                  <div className="mt-4 space-y-2">{cta}</div>
                  {onToggleSave && (
                    <Button variant="outline" className="mt-2 w-full" onClick={() => onToggleSave(job)} aria-pressed={!!saved}>
                      {saved ? <BookmarkCheck className="text-primary" /> : <Bookmark />}
                      {saved ? "Saved" : "Save job"}
                    </Button>
                  )}
                </Panel>

                <Panel title="About the client">
                  <p className="text-sm font-semibold text-foreground">{clientName(job)}</p>
                  <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                    {job.agency_info?.location && <li>{job.agency_info.location}</li>}
                    {job.agency_info?.total_jobs != null && (
                      <li>
                        {job.agency_info.total_jobs} job{Number(job.agency_info.total_jobs) === 1 ? "" : "s"} posted
                      </li>
                    )}
                    {formatMemberSince(job.agency_info?.created_at) && <li>{formatMemberSince(job.agency_info?.created_at)}</li>}
                  </ul>
                  {job.agency_info?.bio && <p className="mt-3 line-clamp-4 text-sm text-foreground">{job.agency_info.bio}</p>}
                  <p className="mt-3 text-xs text-muted-foreground">Payment is held in escrow once the client funds the job, and released when they approve your work.</p>
                </Panel>
              </aside>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
