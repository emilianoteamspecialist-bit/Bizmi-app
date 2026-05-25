import Link from "next/link"
import { ArrowUpRight } from "lucide-react"
import { cn } from "@/lib/utils"

interface SectionHeadProps {
  eyebrow?: string
  title: string
  description?: string
  action?: { label: string; href?: string; onClick?: () => void }
  className?: string
}

export function SectionHead({ eyebrow, title, description, action, className }: SectionHeadProps) {
  const linkClass =
    "text-sm font-medium text-primary hover:text-primary-hover transition-colors inline-flex items-center gap-1 shrink-0"

  return (
    <div className={cn("flex items-end justify-between gap-4", className)}>
      <div className="space-y-0.5 min-w-0">
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h2 className="text-lg font-semibold text-foreground leading-tight">{title}</h2>
        {description && <p className="caption">{description}</p>}
      </div>
      {action &&
        (action.href ? (
          <Link href={action.href} className={linkClass}>
            {action.label} <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        ) : (
          <button onClick={action.onClick} className={linkClass}>
            {action.label} <ArrowUpRight className="h-3.5 w-3.5" />
          </button>
        ))}
    </div>
  )
}
