import { useEffect, useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { Bell, Bookmark, ChevronDown, FileText, LogOut, MessageCircle, Phone, Play, Search, Settings, Shield, User } from "lucide-react"
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useAuth } from "@/contexts/AuthContext"
import { useShellQuery } from "@/lib/queries/shell"
import { portalRoleFor } from "./AppSidebar"

// Ported from the Next.js app's components/dashboard-topbar.tsx.
export function DashboardTopBar() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { profile, signOut } = useAuth()
  const role = portalRoleFor(pathname, profile?.account_type)
  const isAgency = role === "agency"
  const shell = useShellQuery(role)
  const imagePreview = shell.data?.avatar ?? ""
  const unread = shell.data?.unreadCount ?? 0
  const recent = shell.data?.recentUnread ?? []

  const [searchValue, setSearchValue] = useState("")
  const [searchScope, setSearchScope] = useState(isAgency ? "freelancers" : "jobs")

  // Keep the search scope valid for the current section.
  useEffect(() => {
    setSearchScope(isAgency ? "freelancers" : "jobs")
  }, [isAgency])

  const triggerSearch = () => {
    if (!searchValue.trim()) return
    const base = isAgency
      ? searchScope === "messages"
        ? "/agency/messages"
        : "/agency/find-freelancers"
      : searchScope === "messages"
        ? "/freelancer/messages"
        : "/freelancer/marketplace"
    navigate(`${base}?q=${encodeURIComponent(searchValue)}`)
  }

  const handleSignOut = async () => {
    await signOut()
    navigate("/login")
  }

  return (
    <header className="sticky top-0 z-30 h-16 bg-card border-b border-border flex items-center gap-3 px-4 sm:px-6">
      <SidebarTrigger className="-ml-1 text-muted-foreground hover:text-foreground" />

      <div className="flex items-center gap-1 w-full max-w-md min-w-0 bg-surface-2 rounded-full pl-3 sm:pl-4 pr-1.5 h-10 ml-1 sm:ml-2">
        <Search className="h-4 w-4 text-muted-foreground shrink-0" />
        <Input
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && triggerSearch()}
          placeholder={isAgency ? "Search freelancers, skills, talent" : "Search for a project, agency, or skill"}
          aria-label="Search"
          className="border-0 shadow-none bg-transparent h-8 px-2 text-sm focus-visible:ring-0 placeholder:text-muted-foreground min-w-0"
        />
        <Select value={searchScope} onValueChange={setSearchScope}>
          <SelectTrigger className="h-7 w-auto shrink-0 gap-1 border-0 bg-card rounded-full px-2.5 sm:px-3 text-xs font-medium shadow-none focus:ring-0 focus:ring-offset-0 [&_svg]:size-3">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(isAgency
              ? [
                  { value: "freelancers", label: "Freelancers" },
                  { value: "messages", label: "Messages" },
                ]
              : [
                  { value: "jobs", label: "Jobs" },
                  { value: "agencies", label: "Agencies" },
                  { value: "messages", label: "Messages" },
                ]
            ).map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex-1" />

      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(`/${role}/messages`)}
          className="relative h-10 w-10 rounded-full text-muted-foreground hover:text-foreground hover:bg-surface-2"
          aria-label="Messages"
        >
          <MessageCircle className="h-4 w-4" />
          {unread > 0 && <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-primary border-2 border-card" />}
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative h-10 w-10 rounded-full text-muted-foreground hover:text-foreground hover:bg-surface-2" aria-label="Notifications">
              <Bell className="h-4 w-4" />
              {unread > 0 && <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-primary border-2 border-card" />}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80 rounded-2xl p-2 shadow-[var(--shadow-grounded)] border-border">
            <DropdownMenuLabel className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Recent activity</DropdownMenuLabel>
            <ScrollArea className="max-h-[360px]">
              {recent.length === 0 ? (
                <div className="px-3 py-8 text-center text-xs text-muted-foreground italic">No new alerts</div>
              ) : (
                recent.map((n) => (
                  <DropdownMenuItem
                    key={n.id}
                    onClick={() => navigate(`/${role}/messages?conversationId=${n.conversation_id}`)}
                    className="rounded-lg p-2.5 cursor-pointer focus:bg-surface-2"
                  >
                    <div className="flex gap-2.5 w-full min-w-0">
                      <Avatar className="h-8 w-8 rounded-full shrink-0">
                        <AvatarFallback className="bg-primary-soft text-primary font-semibold text-xs">{n.sender_name?.charAt(0) || "?"}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-foreground truncate">{n.sender_name}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{n.message_text}</p>
                      </div>
                    </div>
                  </DropdownMenuItem>
                ))
              )}
            </ScrollArea>
            <DropdownMenuSeparator className="my-1" />
            <DropdownMenuItem onClick={() => navigate(`/${role}/messages`)} className="justify-center font-medium text-primary text-xs rounded-lg">
              View all messages
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-10 pl-1.5 pr-3 gap-2 rounded-full hover:bg-surface-2" aria-label="Account menu">
              <Avatar className="h-7 w-7 rounded-full">
                <AvatarImage src={imagePreview} className="object-cover" />
                <AvatarFallback className="bg-foreground text-white text-[11px] font-semibold rounded-full">
                  {profile?.full_name?.charAt(0)?.toUpperCase() || "U"}
                </AvatarFallback>
              </Avatar>
              <span className="hidden sm:inline text-sm font-medium text-foreground">{profile?.full_name?.split(" ")[0] || "Account"}</span>
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 rounded-2xl p-2 shadow-[var(--shadow-grounded)] border-border">
            <div className="px-3 py-3">
              <p className="text-sm font-semibold text-foreground truncate">{profile?.full_name}</p>
              <p className="text-[11px] text-muted-foreground truncate capitalize">{role} account</p>
            </div>
            <DropdownMenuSeparator className="my-1" />
            <DropdownMenuItem onClick={() => navigate(`/${role}/profile`)} className="rounded-lg">
              <User className="mr-2 h-4 w-4" /> Profile
            </DropdownMenuItem>
            {role === "freelancer" && (
              <>
                <DropdownMenuItem onClick={() => navigate("/freelancer/proposals")} className="rounded-lg">
                  <FileText className="mr-2 h-4 w-4" /> Proposals
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/freelancer/saved-jobs")} className="rounded-lg">
                  <Bookmark className="mr-2 h-4 w-4" /> Saved jobs
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/freelancer/identity")} className="rounded-lg">
                  <Shield className="mr-2 h-4 w-4" /> Identity verification
                </DropdownMenuItem>
              </>
            )}
            <DropdownMenuItem onClick={() => navigate(`/${role}/settings`)} className="rounded-lg">
              <Settings className="mr-2 h-4 w-4" /> Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator className="my-1" />
            <DropdownMenuItem onClick={() => navigate(`/${role}/tutorial`)} className="rounded-lg">
              <Play className="mr-2 h-4 w-4" /> Tutorial
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate(`/${role}/contact`)} className="rounded-lg">
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
