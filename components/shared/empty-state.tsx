import Link from "next/link"
import { ArrowUpRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface ActionConfig {
  label: string
  href?: string
  onClick?: () => void
}

interface EmptyStateProps {
  icon?: React.ReactNode
  eyebrow?: string
  title: string
  description?: string
  action?: ActionConfig
  secondaryAction?: ActionConfig
  className?: string
  variant?: "muted" | "paper" | "dark"
  compact?: boolean
}

export function EmptyState({
  icon,
  eyebrow,
  title,
  description,
  action,
  secondaryAction,
  className,
  variant = "muted",
  compact,
}: EmptyStateProps) {
  const surface =
    variant === "paper"
      ? "surface-paper grain"
      : variant === "dark"
      ? "bg-foreground text-white"
      : "bg-card"

  const renderAction = (a?: ActionConfig, primary = false) => {
    if (!a) return null
    const btn = (
      <Button variant={primary ? "default" : "outline"} size="sm" onClick={a.onClick}>
        {a.label} <ArrowUpRight className="h-3.5 w-3.5 ml-1" />
      </Button>
    )
    return a.href ? <Link href={a.href}>{btn}</Link> : btn
  }

  return (
    <div
      className={cn(
        "relative rounded-2xl shadow-[var(--shadow-soft)] overflow-hidden text-center",
        compact ? "px-5 py-8" : "px-6 py-14",
        surface,
        className
      )}
    >
      {icon && (
        <div className="h-12 w-12 mx-auto rounded-2xl bg-primary-soft flex items-center justify-center text-primary mb-4">
          {icon}
        </div>
      )}
      {eyebrow && <p className="eyebrow text-primary mb-2">{eyebrow}</p>}
      <h3
        className={cn(
          "text-base font-semibold leading-tight",
          variant === "dark" ? "text-white" : "text-foreground"
        )}
      >
        {title}
      </h3>
      {description && (
        <p
          className={cn(
            "text-sm max-w-md mx-auto mt-2 leading-relaxed",
            variant === "dark" ? "text-white/70" : "text-muted-foreground"
          )}
        >
          {description}
        </p>
      )}
      {(action || secondaryAction) && (
        <div className="flex items-center justify-center gap-2 mt-5">
          {renderAction(action, true)}
          {renderAction(secondaryAction)}
        </div>
      )}
    </div>
  )
}
