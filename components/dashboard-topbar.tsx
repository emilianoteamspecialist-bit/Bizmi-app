"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import {
  Bell,
  Search,
  ChevronDown,
  MessageCircle,
  User,
  Settings,
  LogOut,
  Shield,
  Play,
  Phone,
  FileText,
  Bookmark,
} from "lucide-react"
import { Input } from "@/components/ui/input"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { useAuth } from "@/contexts/AuthContext"
import { supabase } from "@/lib/supabase"
import { resolveAvatar } from "@/lib/avatar-url"
import { getCachedAvatar, setCachedAvatar } from "@/lib/avatar-cache"
import { ScrollArea } from "@/components/ui/scroll-area"

export function DashboardTopBar() {
  const router = useRouter()
  const { user, profile, signOut } = useAuth()
  const [imagePreview, setImagePreview] = useState("")
  const [unread, setUnread] = useState(0)
  const [recent, setRecent] = useState<any[]>([])
  const [searchValue, setSearchValue] = useState("")
  const [searchScope, setSearchScope] = useState("jobs")
  const role = profile?.account_type || "freelancer"

  const load = useCallback(async (userId: string, r: string) => {
    try {
      const logoQuery = r === "agency"
        ? supabase.from("agency_image").select("image_path, image_data").eq("agency_id", userId).maybeSingle()
        : supabase.from("freelancer_logos").select("logo_path, logo_data").eq("freelancer_id", userId).maybeSingle()

      const [logoRes, countRes, recentRes] = await Promise.all([
        logoQuery,
        supabase.from("messages").select("*", { count: "exact", head: true }).eq("receiver_id", userId).eq("is_read", false),
        supabase
          .from("messages")
          .select("id, message_text, created_at, sender_id, conversation_id")
          .eq("receiver_id", userId)
          .eq("is_read", false)
          .order("created_at", { ascending: false })
          .limit(6),
      ])

      if (logoRes.data) {
        const url = resolveAvatar(logoRes.data)
        setImagePreview(url)
        setCachedAvatar(userId, url)
      }
      setUnread(countRes.count || 0)

      // Resolve sender names in a separate batch (avoids the brittle named-FK embed)
      const senderIds = Array.from(new Set((recentRes.data || []).map((m: any) => m.sender_id).filter(Boolean)))
      let senderById: Record<string, any> = {}
      if (senderIds.length) {
        const { data: senders } = await supabase
          .from("profiles")
          .select("id, full_name, account_type, company_name")
          .in("id", senderIds)
        for (const s of senders || []) senderById[(s as any).id] = s
      }
      setRecent(
        (recentRes.data || []).map((m: any) => ({
          ...m,
          sender_profile: senderById[m.sender_id] || null,
        }))
      )
    } catch (err) {
      console.error("Topbar load error:", err)
    }
  }, [])

  useEffect(() => {
    // Wait for profile to be resolved so we don't query the wrong avatar table on first paint
    if (user?.id && profile?.account_type) {
      const cached = getCachedAvatar(user.id)
      if (cached) setImagePreview(cached)
      load(user.id, role)
    }
  }, [user?.id, profile?.account_type, role, load])

  const triggerSearch = () => {
    if (!searchValue.trim()) return
    const base =
      searchScope === "agencies"
        ? "/freelancer/marketplace"
        : searchScope === "messages"
          ? "/freelancer/messages"
          : "/freelancer/marketplace"
    router.push(`${base}?q=${encodeURIComponent(searchValue)}`)
  }

  const handleSignOut = async () => {
    await signOut()
    router.push("/login")
  }

  return (
    <header className="sticky top-0 z-30 h-16 bg-card border-b border-border flex items-center gap-3 px-4 sm:px-6">
      <SidebarTrigger className="-ml-1 text-muted-foreground hover:text-foreground" />

      {/* Search */}
      <div className="flex items-center gap-1 max-w-md w-full bg-surface-2 rounded-full pl-4 pr-1.5 h-10 ml-2">
        <Search className="h-4 w-4 text-muted-foreground shrink-0" />
        <Input
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && triggerSearch()}
          placeholder="Search for a project, agency, or skill"
          className="border-0 shadow-none bg-transparent h-8 px-2 text-sm focus-visible:ring-0 placeholder:text-muted-foreground"
        />
        <Select value={searchScope} onValueChange={setSearchScope}>
          <SelectTrigger className="h-7 w-auto gap-1 border-0 bg-card rounded-full px-3 text-xs font-medium shadow-none focus:ring-0 focus:ring-offset-0 [&_svg]:size-3">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="jobs">Jobs</SelectItem>
            <SelectItem value="agencies">Agencies</SelectItem>
            <SelectItem value="messages">Messages</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex-1" />

      {/* Right side actions */}
      <div className="flex items-center gap-1">
        {/* Messages */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push(`/${role}/messages`)}
          className="relative h-10 w-10 rounded-full text-muted-foreground hover:text-foreground hover:bg-surface-2"
          aria-label="Messages"
        >
          <MessageCircle className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-primary border-2 border-card" />
          )}
        </Button>

        {/* Notifications */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="relative h-10 w-10 rounded-full text-muted-foreground hover:text-foreground hover:bg-surface-2"
              aria-label="Notifications"
            >
              <Bell className="h-4 w-4" />
              {unread > 0 && (
                <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-primary border-2 border-card" />
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80 rounded-2xl p-2 shadow-[var(--shadow-grounded)] border-border">
            <DropdownMenuLabel className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Recent activity
            </DropdownMenuLabel>
            <ScrollArea className="max-h-[360px]">
              {recent.length === 0 ? (
                <div className="px-3 py-8 text-center text-xs text-muted-foreground italic">
                  No new alerts
                </div>
              ) : (
                recent.map((n) => (
                  <DropdownMenuItem
                    key={n.id}
                    onClick={() => router.push(`/${role}/messages?conversationId=${n.conversation_id}`)}
                    className="rounded-lg p-2.5 cursor-pointer focus:bg-surface-2"
                  >
                    <div className="flex gap-2.5 w-full min-w-0">
                      <Avatar className="h-8 w-8 rounded-full shrink-0">
                        <AvatarFallback className="bg-primary-soft text-primary font-semibold text-xs">
                          {n.sender_profile?.full_name?.charAt(0) || "?"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-foreground truncate">
                          {n.sender_profile?.full_name}
                        </p>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {n.message_text}
                        </p>
                      </div>
                    </div>
                  </DropdownMenuItem>
                ))
              )}
            </ScrollArea>
            <DropdownMenuSeparator className="my-1" />
            <DropdownMenuItem
              onClick={() => router.push(`/${role}/messages`)}
              className="justify-center font-medium text-primary text-xs rounded-lg"
            >
              View all messages
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* User dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="h-10 pl-1.5 pr-3 gap-2 rounded-full hover:bg-surface-2"
            >
              <Avatar className="h-7 w-7 rounded-full">
                <AvatarImage src={imagePreview} className="object-cover" />
                <AvatarFallback className="bg-foreground text-white text-[11px] font-semibold rounded-full">
                  {profile?.full_name?.charAt(0)?.toUpperCase() || "U"}
                </AvatarFallback>
              </Avatar>
              <span className="hidden sm:inline text-sm font-medium text-foreground">
                {profile?.full_name?.split(" ")[0] || "Account"}
              </span>
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 rounded-2xl p-2 shadow-[var(--shadow-grounded)] border-border">
            <div className="px-3 py-3">
              <p className="text-sm font-semibold text-foreground truncate">{profile?.full_name}</p>
              <p className="text-[11px] text-muted-foreground truncate capitalize">
                {role} account
              </p>
            </div>
            <DropdownMenuSeparator className="my-1" />
            <DropdownMenuItem onClick={() => router.push(`/${role}/profile`)} className="rounded-lg">
              <User className="mr-2 h-4 w-4" /> Profile
            </DropdownMenuItem>
            {role === "freelancer" && (
              <>
                <DropdownMenuItem onClick={() => router.push("/freelancer/proposals")} className="rounded-lg">
                  <FileText className="mr-2 h-4 w-4" /> Proposals
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push("/freelancer/saved-jobs")} className="rounded-lg">
                  <Bookmark className="mr-2 h-4 w-4" /> Saved jobs
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push("/freelancer/identity")} className="rounded-lg">
                  <Shield className="mr-2 h-4 w-4" /> Identity verification
                </DropdownMenuItem>
              </>
            )}
            <DropdownMenuItem onClick={() => router.push(`/${role}/settings`)} className="rounded-lg">
              <Settings className="mr-2 h-4 w-4" /> Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator className="my-1" />
            <DropdownMenuItem onClick={() => router.push(`/${role}/tutorial`)} className="rounded-lg">
              <Play className="mr-2 h-4 w-4" /> Tutorial
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push(`/${role}/contact`)} className="rounded-lg">
              <Phone className="mr-2 h-4 w-4" /> Support
            </DropdownMenuItem>
            <DropdownMenuSeparator className="my-1" />
            <DropdownMenuItem onClick={handleSignOut} className="rounded-lg text-destructive focus:text-destructive focus:bg-destructive/10">
              <LogOut className="mr-2 h-4 w-4" /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
