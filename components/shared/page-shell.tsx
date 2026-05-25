import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { cn } from "@/lib/utils"

interface Breadcrumb {
  label: string
  href?: string
}

interface PageShellProps {
  eyebrow?: string
  title: string
  description?: string
  breadcrumbs?: Breadcrumb[]
  backHref?: string
  actions?: React.ReactNode
  hero?: React.ReactNode
  children: React.ReactNode
  className?: string
  fluid?: boolean
}

export function PageShell({
  eyebrow,
  title,
  description,
  breadcrumbs,
  backHref,
  actions,
  hero,
  children,
  className,
  fluid,
}: PageShellProps) {
  return (
    <div className={cn("min-h-screen bg-surface pb-20", className)}>
      <main
        className={cn(
          fluid ? "px-4 sm:px-6 lg:px-8 max-w-[1400px] mx-auto" : "editorial-shell",
          "py-8 space-y-7"
        )}
      >
        {(backHref || breadcrumbs?.length) && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {backHref && (
              <Link href={backHref} className="link-quiet">
                <ArrowLeft className="h-3.5 w-3.5" /> Back
              </Link>
            )}
            {breadcrumbs?.map((c, i) => (
              <span key={i} className="flex items-center gap-2">
                {(backHref || i > 0) && <span className="text-border">/</span>}
                {c.href ? (
                  <Link href={c.href} className="hover:text-foreground transition-colors">
                    {c.label}
                  </Link>
                ) : (
                  <span>{c.label}</span>
                )}
              </span>
            ))}
          </div>
        )}

        {hero ?? (
          <header className="flex flex-wrap items-end justify-between gap-4 animate-fade-up">
            <div className="space-y-2 min-w-0">
              {eyebrow && <p className="eyebrow">{eyebrow}</p>}
              <h1 className="text-2xl sm:text-3xl font-semibold text-foreground tracking-tight leading-tight">
                {title}
              </h1>
              {description && (
                <p className="text-sm text-muted-foreground max-w-2xl leading-relaxed">{description}</p>
              )}
            </div>
            {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
          </header>
        )}

        {children}
      </main>
    </div>
  )
}
