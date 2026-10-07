import { Link, NavLink } from "react-router-dom"
import { LogOut } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export type ConsoleNavItem = { name: string; href: string; icon: LucideIcon }

/**
 * Top bar for the non-marketplace areas (admin console, influencer program):
 * the same logo and neutral bar as the marketplace header, an area label so
 * it's obvious which tool you're in, and the area's sections as a tab row
 * that scrolls sideways on small screens instead of hiding in a drawer.
 */
export function ConsoleHeader({
  area,
  home,
  nav,
  onSignOut,
}: {
  area: string
  home: string
  nav: ConsoleNavItem[]
  onSignOut: () => void
}) {
  return (
    <header className="shrink-0 border-b border-border bg-card">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Link to={home} className="flex shrink-0 items-center gap-2" aria-label={`Bizimi ${area} home`}>
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary">
              <img src="/favicon.ico" alt="" className="h-4 w-4" />
            </span>
            <span className="font-heading text-lg font-semibold tracking-tight text-foreground">Bizimi</span>
          </Link>
          <span className="truncate rounded-md border border-border px-2 py-0.5 text-xs font-medium text-muted-foreground">{area}</span>
        </div>
        <Button variant="ghost" size="sm" onClick={onSignOut}>
          <LogOut /> Log out
        </Button>
      </div>
      <nav aria-label={`${area} sections`} className="mx-auto max-w-7xl overflow-x-auto px-4 sm:px-6">
        <ul className="flex min-w-max gap-5">
          {nav.map((item) => (
            <li key={item.href}>
              <NavLink
                to={item.href}
                end
                className={({ isActive }) =>
                  cn(
                    "flex h-10 items-center gap-1.5 border-b-2 text-sm font-medium transition-colors",
                    isActive ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
                  )
                }
              >
                <item.icon className="h-4 w-4" aria-hidden />
                {item.name}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  )
}
