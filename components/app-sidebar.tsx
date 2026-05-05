"use client"

import * as React from "react"
import {
  Bell,
  Check,
  ChevronRight,
  ChevronsUpDown,
  FileText,
  LayoutDashboard,
  LogOut,
  MessageCircle,
  Plus,
  Search,
  Settings,
  Sparkles,
  User,
  Users,
  Wallet,
  Bookmark,
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
        const { data: imageData } = await supabase.from("agency_image").select("image_data").eq("agency_id", userId).single()
        if (imageData) setImagePreview(imageData.image_data)
      } else {
        const { data: logoData } = await supabase.from("freelancer_logos").select("logo_data").eq("freelancer_id", userId).single()
        if (logoData) setImagePreview(logoData.logo_data)
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

  const role = profile?.account_type || "freelancer"

  const navLinks = role === "agency" 
    ? [
        { name: "Dashboard", href: "/agency/dashboard", icon: LayoutDashboard },
        { name: "Marketplace", href: "/agency/find-freelancers", icon: Users },
        { name: "Messages", href: "/agency/messages", icon: MessageCircle, badge: unreadMessagesCount },
        { name: "My Posts", href: "/agency/posts", icon: FileText },
        { name: "Wallet", href: "/agency/wallet", icon: Wallet },
      ]
    : [
        { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
        { name: "Marketplace", href: "/freelancer/marketplace", icon: Search },
        { name: "Messages", href: "/freelancer/messages", icon: MessageCircle, badge: unreadMessagesCount },
        { name: "Proposals", href: "/freelancer/proposals", icon: FileText },
        { name: "Funded Jobs", href: "/freelancer/funded-jobs", icon: Wallet },
        { name: "Saved", href: "/freelancer/saved-jobs", icon: Bookmark },
      ]

  const handleSignOut = async () => {
    await signOut()
    router.push("/")
  }

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <img src="/favicon.ico" alt="Bizimi" className="size-5" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">Bizimi</span>
                  <span className="truncate text-xs">Freelance Marketplace</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu className="p-2 gap-1">
          {navLinks.map((item) => (
            <SidebarMenuItem key={item.name}>
              <SidebarMenuButton
                asChild
                isActive={pathname === item.href}
                tooltip={item.name}
                className="rounded-xl h-11 px-4"
              >
                <Link href={item.href} className="flex items-center gap-3">
                  <item.icon className="size-5" />
                  <span className="font-bold">{item.name}</span>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className="ml-auto flex size-5 items-center justify-center rounded-full bg-primary text-[10px] text-white">
                      {item.badge}
                    </span>
                  )}
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>

        {role === "agency" ? (
          <div className="mt-auto p-4 group-data-[collapsible=icon]:hidden">
            <Button 
              className="w-full bg-primary hover:bg-primary-hover rounded-xl font-bold h-11 shadow-lg shadow-primary/20"
              onClick={() => router.push("/agency/dashboard?post=true")}
            >
              <Plus className="mr-2 h-4 w-4" /> Post a Job
            </Button>
          </div>
        ) : (
          <div className="mt-auto p-4 group-data-[collapsible=icon]:hidden">
            <Button 
              className="w-full bg-primary hover:bg-primary-hover rounded-xl font-bold h-11 shadow-lg shadow-primary/20"
              onClick={() => router.push("/freelancer/bizpal")}
            >
              <CreditCard className="mr-2 h-4 w-4" /> Buy Credits
            </Button>
          </div>
        )}
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
