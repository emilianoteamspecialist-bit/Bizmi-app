import type { ReactNode } from "react"
import { BadgeCheck, ShieldCheck } from "lucide-react"
import { cn } from "@/lib/utils"

// Small shared building blocks of the marketplace design system
// (docs/design/marketplace-design-system.md).

/** Page title row: a plain heading, an optional one-line description, and actions. */
export function PageHeader({ title, description, actions, className }: { title: string; description?: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="min-w-0">
        <h1 className="font-heading text-xl font-semibold tracking-tight text-foreground sm:text-2xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

/** Standard page container below the marketplace header. */
export function PageContainer({ children, className, width = "default" }: { children: ReactNode; className?: string; width?: "default" | "narrow" }) {
  return (
    <div className={cn("mx-auto px-4 py-6 sm:px-6 lg:py-8", width === "narrow" ? "max-w-4xl" : "max-w-[1280px]", className)}>{children}</div>
  )
}

export function SkillTag({ children }: { children: ReactNode }) {
  return <span className="inline-flex items-center rounded-md bg-surface-2 px-2 py-0.5 text-xs font-medium text-foreground/80">{children}</span>
}

export function SkillList({ skills, max = 6 }: { skills: string[] | null | undefined; max?: number }) {
  const list = (skills ?? []).filter(Boolean)
  if (list.length === 0) return null
  const shown = list.slice(0, max)
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label="Skills">
      {shown.map((s) => (
        <li key={s}>
          <SkillTag>{s}</SkillTag>
        </li>
      ))}
      {list.length > max && (
        <li>
          <span className="inline-flex items-center px-1 py-0.5 text-xs text-muted-foreground">+{list.length - max} more</span>
        </li>
      )}
    </ul>
  )
}

/**
 * Trust signals, strongest first: identity verified (NIN via the external KYC
 * service) and payment secured (job funded into escrow). Only shown when the
 * data says so -- never as a placeholder.
 */
export function TrustBadge({ kind, className }: { kind: "identity" | "payment"; className?: string }) {
  const Icon = kind === "identity" ? BadgeCheck : ShieldCheck
  const label = kind === "identity" ? "Identity verified" : "Payment secured"
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-medium text-success", className)}>
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {label}
    </span>
  )
}

/** An empty state that says what to do next. */
export function EmptyState({ icon, title, description, action, className }: { icon?: ReactNode; title: string; description?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-lg border border-dashed border-border bg-card px-6 py-12 text-center", className)}>
      {icon && <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-md bg-surface-2 text-muted-foreground">{icon}</div>}
      <p className="text-sm font-semibold text-foreground">{title}</p>
      {description && <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  )
}

/** An error panel that says what failed and offers a retry. */
export function ErrorState({ title, description = "Check your connection and try again.", onRetry }: { title: string; description?: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-6 py-10 text-center">
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      {onRetry && (
        <button onClick={onRetry} className="mt-4 text-sm font-medium text-primary hover:underline">
          Try again
        </button>
      )}
    </div>
  )
}

/** A bordered white panel with an optional titled header. */
export function Panel({ title, action, children, className, bodyClassName }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string; bodyClassName?: string }) {
  return (
    <section className={cn("rounded-lg border border-border bg-card", className)}>
      {(title || action) && (
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          {title && <h2 className="text-sm font-semibold text-foreground">{title}</h2>}
          {action}
        </div>
      )}
      <div className={cn("p-4", bodyClassName)}>{children}</div>
    </section>
  )
}

/** A list of label/value facts, e.g. in a job sidebar. */
export function FactList({ items }: { items: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="divide-y divide-border">
      {items.map((it) => (
        <div key={it.label} className="flex items-baseline justify-between gap-4 py-2 text-sm first:pt-0 last:pb-0">
          <dt className="text-muted-foreground">{it.label}</dt>
          <dd className="text-right font-medium text-foreground tabular-nums">{it.value}</dd>
        </div>
      ))}
    </dl>
  )
}

/** A skeleton block for loading states shaped like the content. */
export function SkeletonBlock({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-surface-2", className)} aria-hidden />
}
