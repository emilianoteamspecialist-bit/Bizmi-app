import type { ReactNode } from "react"
import { Link } from "react-router-dom"
import { Check } from "lucide-react"
import { cn } from "@/lib/utils"

export type CompletenessItem = { label: string; done: boolean; action?: { label: string; to?: string; onClick?: () => void } }

/** Freelancer profile items agencies look at, in the order they matter. */
export function freelancerCompleteness(input: {
  hasPhoto: boolean
  bio?: string | null
  skills?: string[] | null
  hourlyRate?: number | string | null
  location?: string | null
  identityVerified: boolean
}): CompletenessItem[] {
  return [
    { label: "Verify your identity", done: input.identityVerified, action: { label: "Verify", to: "/freelancer/identity" } },
    { label: "Add a profile photo", done: input.hasPhoto, action: { label: "Add photo", to: "/freelancer/profile" } },
    { label: "Write a bio", done: !!input.bio?.trim(), action: { label: "Write bio", to: "/freelancer/profile" } },
    { label: "List your skills", done: (input.skills?.length ?? 0) > 0, action: { label: "Add skills", to: "/freelancer/profile" } },
    { label: "Set your hourly rate", done: !!Number(input.hourlyRate), action: { label: "Set rate", to: "/freelancer/profile" } },
    { label: "Add your location", done: !!input.location?.trim(), action: { label: "Add location", to: "/freelancer/profile" } },
  ]
}

/** A short "profile strength" checklist: progress, then what's left to do. */
export function ProfileCompleteness({ items, title = "Profile strength", footer }: { items: CompletenessItem[]; title?: string; footer?: ReactNode }) {
  const done = items.filter((i) => i.done).length
  const pct = items.length ? Math.round((done / items.length) * 100) : 0
  return (
    <section className="rounded-lg border border-border bg-card p-4" aria-labelledby="profile-strength">
      <div className="flex items-baseline justify-between">
        <h2 id="profile-strength" className="text-sm font-semibold text-foreground">
          {title}
        </h2>
        <span className="text-sm font-semibold tabular-nums text-foreground">{pct}%</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${title}: ${pct}% complete`}>
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
      </div>
      <ul className="mt-3 space-y-1.5">
        {items.map((item) => (
          <li key={item.label} className="flex items-center justify-between gap-3 text-sm">
            <span className={cn("flex items-center gap-2", item.done ? "text-muted-foreground" : "text-foreground")}>
              <span
                className={cn(
                  "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
                  item.done ? "border-success bg-success text-white" : "border-border"
                )}
                aria-hidden
              >
                {item.done && <Check className="h-3 w-3" />}
              </span>
              <span className={item.done ? "line-through decoration-muted-foreground/40" : undefined}>{item.label}</span>
              <span className="sr-only">{item.done ? "(done)" : "(to do)"}</span>
            </span>
            {!item.done && item.action && (
              item.action.to ? (
                <Link to={item.action.to} onClick={item.action.onClick} className="shrink-0 text-xs font-medium text-primary hover:underline">
                  {item.action.label}
                </Link>
              ) : (
                <button onClick={item.action.onClick} className="shrink-0 text-xs font-medium text-primary hover:underline">
                  {item.action.label}
                </button>
              )
            )}
          </li>
        ))}
      </ul>
      {footer}
    </section>
  )
}
