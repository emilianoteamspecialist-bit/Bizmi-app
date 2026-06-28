"use client"

import * as React from "react"
import {
  Bell,
  Check,
  ChevronRight,
  ChevronsUpDown,
  LogOut,
  Plus,
  Settings,
  Sparkles,
  User,
  CreditCard,
  Shield,
  Play,
  Phone,
  Menu,
} from "lucide-react"

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
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
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { useRouter, usePathname } from "next/navigation"
import { useAuth } from "@/contexts/AuthContext"
import { supabase } from "@/lib/supabase"
import { resolveAvatar } from "@/lib/avatar-url"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { Button } from "@/components/ui/button"

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { user, profile, signOut } = useAuth()
  const [imagePreview, setImagePreview] = React.useState<string>("")
  const [unreadMessagesCount, setUnreadMessagesCount] = React.useState(0)
  const router = useRouter()
  const pathname = usePathname()

  const loadExtraData = React.useCallback(async (userId: string, role: string) => {
    try {
      if (role === "agency") {
        const { data: imageData } = await supabase.from("agency_image").select("image_path, image_data").eq("agency_id", userId).maybeSingle()
        if (imageData) setImagePreview(resolveAvatar(imageData))
      } else {
        const { data: logoData } = await supabase.from("freelancer_logos").select("logo_path, logo_data").eq("freelancer_id", userId).maybeSingle()
        if (logoData) setImagePreview(resolveAvatar(logoData))
      }

      const { count } = await supabase.from("messages").select("*", { count: "exact", head: true }).eq("receiver_id", userId).eq("is_read", false)
      setUnreadMessagesCount(count || 0)
    } catch (error) {
      console.error("Error loading extra data:", error)
    }
  }, [])

  React.useEffect(() => {
    if (user?.id && profile?.account_type) {
      loadExtraData(user.id, profile.account_type)
    }
  }, [user?.id, profile?.account_type, loadExtraData])

  // Drive the nav off the section we're rendered in, not just the profile.
  // AppSidebar lives inside the /agency and /freelancer layouts, so the URL is
  // the authoritative (and synchronous) signal for which nav to show — relying
  // on profile.account_type alone made the agency dashboard flash/stick on the
  // freelancer nav whenever the profile was slow to load or missing account_type.
  const role = pathname.startsWith("/agency")
    ? "agency"
    : pathname.startsWith("/freelancer")
      ? "freelancer"
      : profile?.account_type || "freelancer"

  const navLinks = role === "agency"
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
    router.push("/login")
  }

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader className="border-b border-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild className="hover:bg-transparent">
              <Link href="/" className="py-3">
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
        <SidebarMenu className="px-3 py-4 gap-1">
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
                  <Link href={item.href} className="flex items-center gap-3">
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
            <Button
              variant="outline"
              className="w-full h-10 justify-between font-medium group"
              onClick={() => router.push("/agency/dashboard?post=true")}
            >
              <span className="flex items-center">
                <Plus className="mr-2 h-4 w-4 text-primary" /> Post a job
              </span>
              <span className="text-muted-foreground group-hover:text-primary transition-colors">→</span>
            </Button>
          ) : (
            <Button
              variant="outline"
              className="w-full h-10 justify-between font-medium group"
              onClick={() => router.push("/freelancer/bizpal")}
            >
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
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground rounded-xl"
                >
                  <Avatar className="h-8 w-8 rounded-lg">
                    <AvatarImage src={imagePreview} alt={profile?.full_name} />
                    <AvatarFallback className="rounded-lg bg-slate-900 text-white">
                      {profile?.full_name?.charAt(0) || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
                    <span className="truncate font-semibold">{profile?.full_name}</span>
                    <span className="truncate text-xs opacity-60 capitalize">{role} Account</span>
                  </div>
                  <ChevronsUpDown className="ml-auto size-4 group-data-[collapsible=icon]:hidden" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-2xl"
                side="bottom"
                align="end"
                sideOffset={4}
              >
                <DropdownMenuLabel className="p-0 font-normal">
                  <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                    <Avatar className="h-8 w-8 rounded-lg">
                      <AvatarImage src={imagePreview} alt={profile?.full_name} />
                      <AvatarFallback className="rounded-lg bg-slate-900 text-white">
                        {profile?.full_name?.charAt(0) || "U"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-semibold">{profile?.full_name}</span>
                      <span className="truncate text-xs opacity-60">{user?.email}</span>
                    </div>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem onClick={() => router.push(`/${role}/profile`)}>
                    <User className="mr-2 h-4 w-4" />
                    Profile
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => router.push(`/${role}/settings`)}>
                    <Settings className="mr-2 h-4 w-4" />
                    Settings
                  </DropdownMenuItem>
                  {role === "freelancer" && (
                    <DropdownMenuItem onClick={() => router.push("/freelancer/identity")}>
                      <Shield className="mr-2 h-4 w-4" />
                      Identity
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={() => router.push(`/${role}/tutorial`)}>
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
