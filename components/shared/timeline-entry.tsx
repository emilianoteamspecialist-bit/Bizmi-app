import { cn } from "@/lib/utils"

interface TimelineEntryProps {
  state?: "complete" | "current" | "upcoming" | "warning"
  title: string
  description?: string
  meta?: string
  isLast?: boolean
  icon?: React.ReactNode
  children?: React.ReactNode
  className?: string
}

export function TimelineEntry({
  state = "upcoming",
  title,
  description,
  meta,
  isLast,
  icon,
  children,
  className,
}: TimelineEntryProps) {
  const dotClass =
    state === "complete"
      ? "bg-success text-white"
      : state === "current"
      ? "bg-primary text-white ring-4 ring-primary/15"
      : state === "warning"
      ? "bg-warning text-white"
      : "bg-surface-2 text-muted-foreground border border-border"

  const titleClass =
    state === "upcoming" ? "text-muted-foreground" : "text-foreground"

  return (
    <div className={cn("relative flex gap-4 pb-6", className)}>
      {!isLast && (
        <div
          className={cn(
            "absolute left-[15px] top-8 bottom-0 w-px",
            state === "complete" ? "bg-success/30" : "bg-border"
          )}
          aria-hidden
        />
      )}
      <div
        className={cn(
          "h-8 w-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 z-10",
          dotClass
        )}
      >
        {icon || (state === "complete" ? "✓" : null)}
      </div>
      <div className="flex-1 min-w-0 -mt-0.5">
        <div className="flex items-baseline justify-between gap-3">
          <h4 className={cn("text-sm font-semibold leading-tight", titleClass)}>{title}</h4>
          {meta && <p className="caption shrink-0 numeric">{meta}</p>}
        </div>
        {description && (
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{description}</p>
        )}
        {children && <div className="mt-3">{children}</div>}
      </div>
    </div>
  )
}
