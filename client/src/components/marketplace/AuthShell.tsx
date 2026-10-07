import type { ReactNode } from "react"
import { Link } from "react-router-dom"
import { ShieldCheck } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * Frame for the signed-out pages (sign in, sign up, password reset): the same
 * logo and neutral surface as the portal header, a single centred column,
 * and one plain trust line at the foot. No marketing panel competes with the form.
 */
export function AuthShell({
  title,
  description,
  topRight,
  footer,
  width = "narrow",
  children,
}: {
  title: string
  description?: ReactNode
  topRight?: ReactNode
  footer?: ReactNode
  width?: "narrow" | "wide"
  children: ReactNode
}) {
  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <AuthLogo />
          {topRight && <div className="text-sm text-muted-foreground">{topRight}</div>}
        </div>
      </header>

      <main className="flex flex-1 justify-center px-4 py-10 sm:py-16">
        <div className={cn("w-full", width === "wide" ? "max-w-2xl" : "max-w-md")}>
          <div className="mb-6">
            <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
            {description && <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>}
          </div>
          <div className="rounded-lg border border-border bg-card p-5 sm:p-6">{children}</div>
          {footer && <div className="mt-5 text-sm text-muted-foreground">{footer}</div>}
        </div>
      </main>

      <p className="flex items-center justify-center gap-1.5 px-4 pb-8 text-center text-xs text-muted-foreground">
        <ShieldCheck className="h-3.5 w-3.5 text-success" aria-hidden />
        Payments on Bizimi are held in escrow until the client approves the work.
      </p>
    </div>
  )
}

export function AuthLogo() {
  return (
    <Link to="/" className="flex shrink-0 items-center gap-2" aria-label="Bizimi home">
      <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary">
        <img src="/favicon.ico" alt="" className="h-4 w-4" />
      </span>
      <span className="font-heading text-lg font-semibold tracking-tight text-foreground">Bizimi</span>
    </Link>
  )
}

/** An inline form message: errors are announced, successes are polite. */
export function FormMessage({ tone, children }: { tone: "error" | "success" | "info"; children: ReactNode }) {
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "rounded-md border px-3 py-2 text-sm",
        tone === "error" && "border-destructive/30 bg-destructive/5 text-destructive",
        tone === "success" && "border-success/30 bg-success/5 text-success",
        tone === "info" && "border-border bg-surface text-foreground"
      )}
    >
      {children}
    </p>
  )
}
