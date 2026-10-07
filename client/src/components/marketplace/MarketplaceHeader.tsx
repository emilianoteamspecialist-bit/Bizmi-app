import { useState } from "react"
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom"
import { Bell, Bookmark, ChevronDown, LogOut, Menu, Phone, Play, Plus, Search, Settings, Shield, User, Wallet, LayoutDashboard, Coins } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { useAuth } from "@/contexts/AuthContext"
import { useShellQuery, type PortalRole } from "@/lib/queries/shell"
import { cn } from "@/lib/utils"

// The portal is chosen by the URL section, not the profile: the URL is
// synchronous, so the header never flashes the wrong portal while the
// profile loads.
export function portalRoleFor(pathname: string, accountType?: string | null): PortalRole {
  if (pathname.startsWith("/agency")) return "agency"
  if (pathname.startsWith("/freelancer")) return "freelancer"
  return accountType === "agency" ? "agency" : "freelancer"
}

type NavItem = { label: string; to: string }

// Only links that lead somewhere real for the role.
const NAV: Record<PortalRole, NavItem[]> = {
  freelancer: [
    { label: "Find Work", to: "/freelancer/marketplace" },
    { label: "My Jobs", to: "/freelancer/funded-jobs" },
    { label: "Proposals", to: "/freelancer/proposals" },
    { label: "Messages", to: "/freelancer/messages" },
  ],
  agency: [
    { label: "Find Talent", to: "/agency/find-freelancers" },
    { label: "My Jobs", to: "/agency/posts" },
    { label: "Payments", to: "/agency/wallet" },
    { label: "Messages", to: "/agency/messages" },
  ],
}

const SEARCH: Record<PortalRole, { to: string; placeholder: string; label: string }> = {
  freelancer: { to: "/freelancer/marketplace", placeholder: "Search jobs or skills", label: "Search jobs" },
  agency: { to: "/agency/find-freelancers", placeholder: "Search freelancers or skills", label: "Search freelancers" },
}

function MarketplaceSearch({ role, className, autoFocus }: { role: PortalRole; className?: string; autoFocus?: boolean }) {
  const navigate = useNavigate()
  const [value, setValue] = useState("")
  const search = SEARCH[role]
  return (
    <form
      role="search"
      className={cn("relative", className)}
      onSubmit={(e) => {
        e.preventDefault()
        const q = value.trim()
        navigate(q ? `${search.to}?q=${encodeURIComponent(q)}` : search.to)
      }}
    >
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
      <input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={search.placeholder}
        aria-label={search.label}
        autoFocus={autoFocus}
        className="h-9 w-full rounded-md border border-transparent bg-surface-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground transition-colors focus:border-primary focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/20"
      />
    </form>
  )
}

export function MarketplaceHeader() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { user, profile, signOut } = useAuth()
  const role = portalRoleFor(pathname, profile?.account_type)
  const shell = useShellQuery(role)
  const unread = shell.data?.unreadCount ?? 0
  const recent = shell.data?.recentUnread ?? []
  const credits = shell.data?.credits
  const [menuOpen, setMenuOpen] = useState(false)
  const [mobileSearch, setMobileSearch] = useState(false)

  const firstName = profile?.full_name?.split(" ")[0] || "Account"
  const initial = profile?.full_name?.charAt(0)?.toUpperCase() || "U"
  const dashboard = `/${role}/dashboard`

  const handleSignOut = async () => {
    await signOut()
    navigate("/login")
  }

  const accountLinks: { label: string; to: string; icon: typeof User }[] = [
    { label: "Dashboard", to: dashboard, icon: LayoutDashboard },
    { label: "Profile", to: `/${role}/profile`, icon: User },
    ...(role === "freelancer"
      ? [
          { label: "Saved jobs", to: "/freelancer/saved-jobs", icon: Bookmark },
          { label: "Credits", to: "/freelancer/bizpal", icon: Coins },
          { label: "Identity verification", to: "/freelancer/identity", icon: Shield },
        ]
      : [{ label: "Payments", to: "/agency/wallet", icon: Wallet }]),
    { label: "Settings", to: `/${role}/settings`, icon: Settings },
    { label: "Tutorial", to: `/${role}/tutorial`, icon: Play },
    { label: "Support", to: `/${role}/contact`, icon: Phone },
  ]

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-card">
      <div className="mx-auto flex h-14 max-w-[1280px] items-center gap-4 px-4 sm:px-6 lg:gap-6">
        {/* Mobile menu */}
        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="-ml-2 h-9 w-9 lg:hidden" aria-label="Open menu">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 p-0">
            <SheetTitle className="border-b border-border px-5 py-4 text-base font-semibold">Menu</SheetTitle>
            <nav aria-label="Main" className="flex flex-col p-2">
              {[{ label: "Dashboard", to: dashboard }, ...NAV[role]].map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setMenuOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      "flex h-11 items-center justify-between rounded-md px-3 text-sm font-medium",
                      isActive ? "bg-primary-soft text-primary" : "text-foreground hover:bg-surface-2"
                    )
                  }
                >
                  {item.label}
                  {item.label === "Messages" && unread > 0 && <span className="text-xs font-semibold text-primary">{unread}</span>}
                </NavLink>
              ))}
            </nav>
            <div className="border-t border-border p-4">
              {role === "agency" ? (
                <Button className="w-full" onClick={() => { setMenuOpen(false); navigate("/agency/dashboard?post=true") }}>
                  <Plus /> Post a Job
                </Button>
              ) : (
                <Button variant="outline" className="w-full" onClick={() => { setMenuOpen(false); navigate("/freelancer/bizpal") }}>
                  <Coins /> {credits ?? 0} credits
                </Button>
              )}
            </div>
          </SheetContent>
        </Sheet>

        <Link to={dashboard} className="flex shrink-0 items-center gap-2" aria-label="Bizimi home">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary">
            <img src="/favicon.ico" alt="" className="h-4 w-4" />
          </span>
          <span className="font-heading text-lg font-semibold tracking-tight text-foreground">Bizimi</span>
        </Link>

        <nav aria-label="Main" className="hidden h-full items-stretch gap-5 lg:flex">
          {NAV[role].map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  "relative inline-flex items-center gap-1.5 text-sm font-medium transition-colors",
                  "after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:rounded-full",
                  isActive ? "text-foreground after:bg-primary" : "text-muted-foreground hover:text-foreground after:bg-transparent"
                )
              }
            >
              {item.label}
              {item.label === "Messages" && unread > 0 && (
                <span className="rounded-full bg-primary px-1.5 text-[10px] font-semibold leading-4 text-primary-foreground" aria-label={`${unread} unread`}>
                  {unread}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        <MarketplaceSearch role={role} className="hidden flex-1 md:block md:max-w-md" />
        <div className="flex-1 md:hidden" />

        <div className="flex items-center gap-1 sm:gap-2">
          <Button variant="ghost" size="icon" className="h-9 w-9 md:hidden" aria-label="Search" aria-expanded={mobileSearch} onClick={() => setMobileSearch((v) => !v)}>
            <Search className="h-4 w-4" />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="relative h-9 w-9 text-muted-foreground hover:text-foreground" aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}>
                <Bell className="h-4 w-4" />
                {unread > 0 && <span className="absolute right-2 top-2 h-2 w-2 rounded-full border-2 border-card bg-primary" />}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 p-1">
              <DropdownMenuLabel className="px-3 py-2 text-sm font-semibold">Unread messages</DropdownMenuLabel>
              {recent.length === 0 ? (
                <p className="px-3 py-6 text-center text-sm text-muted-foreground">You're all caught up.</p>
              ) : (
                recent.map((n) => (
                  <DropdownMenuItem key={n.id} onClick={() => navigate(`/${role}/messages?conversationId=${n.conversation_id}`)} className="cursor-pointer gap-3 p-2.5">
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarFallback className="bg-surface-2 text-xs font-semibold text-foreground">{n.sender_name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-foreground">{n.sender_name}</span>
                      <span className="block truncate text-xs text-muted-foreground">{n.message_text}</span>
                    </span>
                  </DropdownMenuItem>
                ))
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate(`/${role}/messages`)} className="justify-center text-sm font-medium text-primary">
                Open messages
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {role === "freelancer" && (
            <Button asChild variant="ghost" size="icon" className="hidden h-9 w-9 text-muted-foreground hover:text-foreground sm:inline-flex">
              <Link to="/freelancer/saved-jobs" aria-label="Saved jobs">
                <Bookmark className="h-4 w-4" />
              </Link>
            </Button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-9 gap-2 px-1.5" aria-label="Account menu">
                <Avatar className="h-7 w-7">
                  <AvatarImage src={shell.data?.avatar ?? undefined} className="object-cover" />
                  <AvatarFallback className="bg-foreground text-[11px] font-semibold text-background">{initial}</AvatarFallback>
                </Avatar>
                <span className="hidden text-sm font-medium xl:inline">{firstName}</span>
                <ChevronDown className="hidden h-3.5 w-3.5 text-muted-foreground xl:block" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60 p-1">
              <div className="px-3 py-2.5">
                <p className="truncate text-sm font-semibold text-foreground">{profile?.full_name || "Your account"}</p>
                <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
              </div>
              <DropdownMenuSeparator />
              {accountLinks.map(({ label, to, icon: Icon }) => (
                <DropdownMenuItem key={to} onClick={() => navigate(to)} className="cursor-pointer gap-2">
                  <Icon className="h-4 w-4 text-muted-foreground" /> {label}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer gap-2 text-destructive focus:text-destructive">
                <LogOut className="h-4 w-4" /> Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {role === "agency" ? (
            <Button size="sm" className="hidden h-9 sm:inline-flex" onClick={() => navigate("/agency/dashboard?post=true")}>
              <Plus /> Post a Job
            </Button>
          ) : (
            <Button asChild variant="outline" size="sm" className="hidden h-9 tabular-nums sm:inline-flex">
              <Link to="/freelancer/bizpal" aria-label={`${credits ?? 0} credits — buy more`}>
                <Coins className="text-primary" /> {credits ?? "–"} credits
              </Link>
            </Button>
          )}
        </div>
      </div>

      {mobileSearch && (
        <div className="border-t border-border px-4 py-2 md:hidden">
          <MarketplaceSearch role={role} autoFocus />
        </div>
      )}
    </header>
  )
}
