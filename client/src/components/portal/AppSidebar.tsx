import * as React from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import { ChevronsUpDown, CreditCard, LogOut, Play, Plus, Settings, Shield, User } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/contexts/AuthContext"
import { cn } from "@/lib/utils"
import { useShellQuery, type PortalRole } from "@/lib/queries/shell"

// The portal is chosen by the URL section, not the profile: the URL is
// synchronous, so the nav never flashes the wrong portal while the profile
// loads (same rule as the Next.js app's components/app-sidebar.tsx).
export function portalRoleFor(pathname: string, accountType?: string | null): PortalRole {
  if (pathname.startsWith("/agency")) return "agency"
  if (pathname.startsWith("/freelancer")) return "freelancer"
  return accountType === "agency" ? "agency" : "freelancer"
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { user, profile, signOut } = useAuth()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const role = portalRoleFor(pathname, profile?.account_type)
  const shell = useShellQuery(role)
  const imagePreview = shell.data?.avatar ?? ""
  const unreadMessagesCount = shell.data?.unreadCount ?? 0

  const navLinks =
    role === "agency"
      ? [
          { name: "Dashboard", href: "/agency/dashboard", icon: "fi-rr-apps" },
          { name: "Marketplace", href: "/agency/find-freelancers", icon: "fi-rr-users-alt" },
          { name: "Messages", href: "/agency/messages", icon: "fi-rr-comment-alt", badge: unreadMessagesCount },
          { name: "My Posts", href: "/agency/posts", icon: "fi-rr-document" },
          { name: "Wallet", href: "/agency/wallet", icon: "fi-rr-wallet" },
        ]
      : [
          { name: "Dashboard", href: "/freelancer/dashboard", icon: "fi-rr-apps" },
          { name: "Marketplace", href: "/freelancer/marketplace", icon: "fi-rr-search" },
          { name: "Messages", href: "/freelancer/messages", icon: "fi-rr-comment-alt", badge: unreadMessagesCount },
          { name: "Proposals", href: "/freelancer/proposals", icon: "fi-rr-document" },
          { name: "Funded Jobs", href: "/freelancer/funded-jobs", icon: "fi-rr-wallet" },
          { name: "Saved", href: "/freelancer/saved-jobs", icon: "fi-rr-bookmark" },
        ]

  const handleSignOut = async () => {
    await signOut()
    navigate("/login")
  }

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader className="border-b border-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild className="hover:bg-transparent">
              <Link to="/" className="py-3">
                <div className="flex aspect-square size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
                  <img src="/favicon.ico" alt="Bizimi" className="size-4" />
                </div>
                <div className="grid flex-1 text-left leading-tight">
                  <span className="truncate text-sm font-semibold text-foreground">Bizimi</span>
                  <span className="truncate text-[11px] text-muted-foreground">{role === "agency" ? "Agency workspace" : "Freelance marketplace"}</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu className="px-3 py-4 gap-1" aria-label={`${role === "agency" ? "Agency" : "Freelancer"} navigation`}>
          {navLinks.map((item) => {
            const isActive = pathname === item.href
            return (
              <SidebarMenuItem key={item.name}>
                <SidebarMenuButton
                  asChild
                  isActive={isActive}
                  tooltip={item.name}
                  className={cn(
                    "rounded-lg h-10 px-3 text-sm transition-colors group",
                    "hover:bg-surface-2",
                    "data-[active=true]:bg-primary-soft data-[active=true]:text-primary data-[active=true]:font-semibold",
                    !isActive && "text-muted-foreground font-medium"
                  )}
                >
                  <Link to={item.href} className="flex items-center gap-3">
                    <i
                      className={cn(
                        "fi inline-flex items-center justify-center text-base leading-none transition-colors w-4 h-4",
                        item.icon,
                        isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                      )}
                      aria-hidden
                    />
                    <span>{item.name}</span>
                    {item.badge !== undefined && item.badge > 0 && (
                      <span className="ml-auto flex h-5 min-w-5 px-1.5 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-white">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )
          })}
        </SidebarMenu>

        <div className="mt-auto px-3 pb-3 group-data-[collapsible=icon]:hidden hairline pt-4 mx-3">
          {role === "agency" ? (
            <Button variant="outline" className="w-full h-10 justify-between font-medium group" onClick={() => navigate("/agency/dashboard?post=true")}>
              <span className="flex items-center">
                <Plus className="mr-2 h-4 w-4 text-primary" /> Post a job
              </span>
              <span className="text-muted-foreground group-hover:text-primary transition-colors">→</span>
            </Button>
          ) : (
            <Button variant="outline" className="w-full h-10 justify-between font-medium group" onClick={() => navigate("/freelancer/bizpal")}>
              <span className="flex items-center">
                <CreditCard className="mr-2 h-4 w-4 text-primary" /> Top up credits
              </span>
              <span className="text-muted-foreground group-hover:text-primary transition-colors">→</span>
            </Button>
          )}
        </div>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground rounded-xl">
                  <Avatar className="h-8 w-8 rounded-lg">
                    <AvatarImage src={imagePreview} alt={profile?.full_name ?? undefined} />
                    <AvatarFallback className="rounded-lg bg-slate-900 text-white">{profile?.full_name?.charAt(0) || "U"}</AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
                    <span className="truncate font-semibold">{profile?.full_name}</span>
                    <span className="truncate text-xs opacity-60 capitalize">{role} Account</span>
                  </div>
                  <ChevronsUpDown className="ml-auto size-4 group-data-[collapsible=icon]:hidden" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-2xl" side="bottom" align="end" sideOffset={4}>
                <DropdownMenuLabel className="p-0 font-normal">
                  <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                    <Avatar className="h-8 w-8 rounded-lg">
                      <AvatarImage src={imagePreview} alt={profile?.full_name ?? undefined} />
                      <AvatarFallback className="rounded-lg bg-slate-900 text-white">{profile?.full_name?.charAt(0) || "U"}</AvatarFallback>
                    </Avatar>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-semibold">{profile?.full_name}</span>
                      <span className="truncate text-xs opacity-60">{user?.email}</span>
                    </div>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem onClick={() => navigate(`/${role}/profile`)}>
                    <User className="mr-2 h-4 w-4" />
                    Profile
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate(`/${role}/settings`)}>
                    <Settings className="mr-2 h-4 w-4" />
                    Settings
                  </DropdownMenuItem>
                  {role === "freelancer" && (
                    <DropdownMenuItem onClick={() => navigate("/freelancer/identity")}>
                      <Shield className="mr-2 h-4 w-4" />
                      Identity
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={() => navigate(`/${role}/tutorial`)}>
                    <Play className="mr-2 h-4 w-4" />
                    Tutorial
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="text-red-500 focus:text-red-500 focus:bg-red-50">
                  <LogOut className="mr-2 h-4 w-4" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
