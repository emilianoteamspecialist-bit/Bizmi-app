import { cn } from "@/lib/utils"

type PipelineTone = "default" | "primary" | "success" | "warning" | "muted"

const toneDotClasses: Record<PipelineTone, string> = {
  default: "bg-foreground",
  primary: "bg-primary",
  success: "bg-success",
  warning: "bg-warning",
  muted: "bg-muted-foreground/40",
}

interface PipelineColumn {
  id: string
  label: string
  count?: number
  tone?: PipelineTone
  children: React.ReactNode
}

interface PipelineProps {
  columns: PipelineColumn[]
  className?: string
}

export function Pipeline({ columns, className }: PipelineProps) {
  return (
    <div className={cn("grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4", className)}>
      {columns.map((c) => (
        <div key={c.id} className="space-y-3 min-w-0">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2 min-w-0">
              <span
                className={cn("h-1.5 w-1.5 rounded-full shrink-0", toneDotClasses[c.tone || "default"])}
                aria-hidden
              />
              <p className="text-xs font-semibold text-foreground tracking-wide uppercase truncate">
                {c.label}
              </p>
            </div>
            {typeof c.count === "number" && (
              <span className="text-[10px] font-semibold text-muted-foreground bg-surface-2 rounded-full px-1.5 py-0.5 numeric shrink-0">
                {c.count}
              </span>
            )}
          </div>
          <div className="space-y-2.5">{c.children}</div>
        </div>
      ))}
    </div>
  )
}

interface PipelineCardProps {
  title: string
  subtitle?: string
  meta?: React.ReactNode
  onClick?: () => void
  accent?: PipelineTone
  children?: React.ReactNode
  className?: string
}

const accentBorderClasses: Record<PipelineTone, string> = {
  default: "",
  primary: "border-l-2 border-l-primary",
  success: "border-l-2 border-l-success",
  warning: "border-l-2 border-l-warning",
  muted: "",
}

export function PipelineCard({
  title,
  subtitle,
  meta,
  onClick,
  accent = "default",
  children,
  className,
}: PipelineCardProps) {
  return (
    <article
      onClick={onClick}
      className={cn(
        "rounded-xl bg-card p-3.5 shadow-[var(--shadow-soft)] hover:shadow-[var(--shadow-grounded)] transition-shadow space-y-2",
        onClick && "cursor-pointer",
        accentBorderClasses[accent],
        className
      )}
    >
      {subtitle && <p className="text-[11px] text-muted-foreground truncate">{subtitle}</p>}
      <h5 className="text-sm font-semibold text-foreground line-clamp-2 leading-snug">{title}</h5>
      {children}
      {meta && <div className="pt-1.5 border-t border-border/60 mt-1.5">{meta}</div>}
    </article>
  )
}
