"use client"
import { useState, useEffect, useCallback } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Bell,
  Menu,
  User,
  Settings,
  LogOut,
  Sun,
  Moon,
  FileText,
  MessageCircle,
  Briefcase,
  Play,
  Phone,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area" // Import ScrollArea

interface AgencyNavbarProps {
  onPostJobClick?: () => void
}

export default function AgencyNavbar({ onPostJobClick }: AgencyNavbarProps) {
  const [isDarkMode, setIsDarkMode] = useState(false)
  const [imagePreview, setImagePreview] = useState<string>("")
  const [profile, setProfile] = useState<any>(null)
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0)
  const [recentNotifications, setRecentNotifications] = useState<any[]>([]) // New state for notifications
  const router = useRouter()

  // Helper function to format numbers for display (e.g., 1000 -> 1k)
  const formatNumber = (num: number): string => {
    if (num >= 1_000_000_000_000) {
      return (num / 1_000_000_000_000).toFixed(1).replace(/\.0$/, "") + "T"
    }
    if (num >= 1_000_000_000) {
      return (num / 1_000_000_000).toFixed(1).replace(/\.0$/, "") + "B"
    }
    if (num >= 1_000_000) {
      return (num / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M"
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1).replace(/\.0$/, "") + "k"
    }
    return num.toString()
  }

  const getParticipantProfileForNotification = useCallback((message: any) => {
    const senderProfile = message.sender_profile
    if (!senderProfile) {
      return { full_name: "Unknown Sender", avatar_url: "/placeholder.svg?height=40&width=40" }
    }
    let avatarUrl = "/placeholder.svg?height=40&width=40"
    let displayName = senderProfile.full_name || "Unknown Sender"
    if (senderProfile.account_type === "freelancer") {
      avatarUrl = senderProfile.freelancer_logos?.[0]?.file_name || avatarUrl
      displayName = senderProfile.full_name || "Freelancer"
    } else if (senderProfile.account_type === "agency") {
      avatarUrl = senderProfile.agency_logo?.[0]?.file_name || avatarUrl
      displayName = senderProfile.company_name || senderProfile.full_name || "Agency"
    }
    return { full_name: displayName, avatar_url: avatarUrl }
  }, [])

  const loadProfileAndImage = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        console.log("AgencyNavbar: No user logged in, skipping data fetch.")
        setProfile(null)
        setImagePreview("")
        setUnreadMessagesCount(0)
        setRecentNotifications([])
        return
      }
      console.log("AgencyNavbar: Current User ID:", user.id)
      // Load profile data
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single()
      if (profileError) {
        console.error("AgencyNavbar: Error fetching profile data:", profileError)
      } else if (profileData) {
        setProfile(profileData)
      }
      // Load profile image from agency_image table
      const { data: imageData, error: imageError } = await supabase
        .from("agency_image")
        .select("image_data")
        .eq("agency_id", user.id)
        .single()
      if (imageError) {
        console.error("AgencyNavbar: Error fetching agency image:", imageError)
      } else if (imageData) {
        setImagePreview(imageData.image_data)
      }

      // Fetch total unread messages count
      const { count: totalUnreadCount, error: countError } = await supabase
        .from("messages")
        .select("*", { count: "exact", head: true }) // Use head: true for count only
        .eq("receiver_id", user.id)
        .eq("is_read", false)

      if (countError) {
        console.error("AgencyNavbar: Error fetching total unread messages count:", countError)
      } else {
        setUnreadMessagesCount(totalUnreadCount || 0)
      }

      // Fetch recent unread messages for notification dropdown (still limited to 7)
      const { data: recentUnreadMessages, error: recentMessagesError } = await supabase
        .from("messages")
        .select(`
          id,
          message_text,
          created_at,
          sender_id,
          conversation_id,
          sender_profile:profiles!messages_sender_id_fkey (
            full_name,
            account_type,
            company_name,
            freelancer_logos(file_name),
            agency_logo(*)
          )
        `)
        .eq("receiver_id", user.id)
        .eq("is_read", false)
        .order("created_at", { ascending: false })
        .limit(7) // Keep this limit for the dropdown display

      if (recentMessagesError) {
        console.error("AgencyNavbar: Error fetching unread messages for notifications:", recentMessagesError)
      } else {
        setRecentNotifications(recentUnreadMessages || [])
      }
    } catch (error) {
      console.error("AgencyNavbar: Error loading profile and image:", error)
    }
  }, [getParticipantProfileForNotification])

  useEffect(() => {
    loadProfileAndImage()
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "agency_profile_updated") {
        console.log("AgencyNavbar: Storage event detected, reloading user data.")
        loadProfileAndImage()
      }
    }
    window.addEventListener("storage", handleStorageChange)
    const handleCustomEvent = () => {
      console.log("AgencyNavbar: Custom event detected, reloading user data.")
      loadProfileAndImage()
    }
    window.addEventListener("agency_profile_updated", handleCustomEvent)
    // Listen for real-time messages
    const messagesChannel = supabase
      .channel("public:messages")
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, (payload) => {
        // Only update if the message is for the current user or its read status changes
        if (payload.new.receiver_id === profile?.id || payload.old?.is_read !== payload.new?.is_read) {
          console.log("AgencyNavbar: Real-time message update detected, reloading data.")
          loadProfileAndImage() // Reload data to update message count and notifications
        }
      })
      .subscribe()
    return () => {
      supabase.removeChannel(messagesChannel)
      window.removeEventListener("storage", handleStorageChange)
      window.removeEventListener("agency_profile_updated", handleCustomEvent)
    }
  }, [loadProfileAndImage, profile?.id])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push("/")
  }

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode)
    document.documentElement.classList.toggle("dark")
  }

  return (
    <nav className="sticky top-0 z-50 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8">
        <div className="flex justify-between items-center h-14 sm:h-16">
          <div className="flex items-center space-x-2 sm:space-x-4">
            <h1 className="text-xl sm:text-2xl font-bold text-orange-500">Bizimi</h1>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="hover:bg-orange-50 dark:hover:bg-orange-900/20 h-8 w-8 sm:h-10 sm:w-10"
                >
                  <Menu className="h-4 w-4 sm:h-5 sm:w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48">
                <DropdownMenuItem onClick={() => router.push("/agency/dashboard")}>
                  <Briefcase className="mr-2 h-4 w-4" />
                  Dashboard
                </DropdownMenuItem>

                <DropdownMenuItem onClick={() => router.push("/agency/messages")}>
                  <MessageCircle className="mr-2 h-4 w-4" />
                  Messages
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push("/agency/posts")}>
                  <FileText className="mr-2 h-4 w-4" />
                  Manage Posts
                </DropdownMenuItem>

                <DropdownMenuItem onClick={() => router.push("/agency/wallet")}>
                  <Briefcase className="mr-2 h-4 w-4" />
                  Wallet
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push("/agency/tutorial")}>
                  <Play className="mr-2 h-4 w-4" />
                  Watch Video
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push("/agency/contact")}>
                  <Phone className="mr-2 h-4 w-4" />
                  Contact Us
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push("/agency/profile")}>
                  <User className="mr-2 h-4 w-4" />
                  Profile
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div className="flex-1"></div>
          <div className="flex items-center space-x-2 sm:space-x-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleDarkMode}
              className="hidden sm:flex hover:bg-orange-50 dark:hover:bg-orange-900/20 h-8 w-8 sm:h-10 sm:w-10"
            >
              {isDarkMode ? <Sun className="h-4 w-4 sm:h-5 sm:w-5" /> : <Moon className="h-4 w-4 sm:h-5 sm:w-5" />}
            </Button>
            {/* Notifications Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="relative hover:bg-orange-50 dark:hover:bg-orange-900/20 h-8 w-8 sm:h-10 sm:w-10"
                >
                  <Bell className="h-4 w-4 sm:h-5 sm:w-5" />
                  {unreadMessagesCount > 0 && (
                    <Badge className="absolute -top-1 -right-1 bg-orange-500 text-white text-xs rounded-full h-4 w-4 sm:h-5 sm:w-5 flex items-center justify-center p-0 text-[10px] sm:text-xs">
                      {formatNumber(unreadMessagesCount)}
                    </Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72 sm:w-80">
                <div className="px-4 py-2 text-sm font-semibold border-b">Notifications</div>
                <ScrollArea className="max-h-[300px] sm:max-h-[400px] pr-2" type="always">
                  {recentNotifications.length === 0 ? (
                    <div className="p-4 text-center text-muted-foreground text-sm">No new notifications.</div>
                  ) : (
                    recentNotifications.map((notification) => {
                      const sender = getParticipantProfileForNotification(notification)
                      const timeAgo = new Date(notification.created_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                      return (
                        <DropdownMenuItem
                          key={notification.id}
                          onClick={() => router.push(`/agency/messages?conversationId=${notification.conversation_id}`)}
                          className="flex items-center gap-2 p-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                        >
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={sender.avatar_url || "/placeholder.svg"} alt={sender.full_name} />
                            <AvatarFallback>{sender.full_name.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{sender.full_name}</p>
                            <p className="text-xs text-muted-foreground truncate">{notification.message_text}</p>
                            <span className="block text-xs text-muted-foreground mt-0.5">{timeAgo}</span>
                          </div>
                        </DropdownMenuItem>
                      )
                    })
                  )}
                </ScrollArea>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => router.push("/agency/messages")} className="justify-center">
                  View All Messages
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            {/* User Profile Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-8 w-8 sm:h-10 sm:w-10 rounded-full">
                  <Avatar className="h-8 w-8 sm:h-10 sm:w-10">
                    <AvatarImage src={imagePreview || "/placeholder.svg?height=32&width=32"} alt="Profile" />
                    <AvatarFallback className="text-xs sm:text-sm">
                      {profile?.company_name?.charAt(0) || "AG"}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => router.push("/agency/profile")}>
                  <User className="mr-2 h-4 w-4" />
                  Profile
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push("/agency/settings")}>
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuItem onClick={toggleDarkMode} className="sm:hidden">
                  {isDarkMode ? <Sun className="mr-2 h-4 w-4" /> : <Moon className="mr-2 h-4 w-4" />}
                  {isDarkMode ? "Light Mode" : "Dark Mode"}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </nav>
  )
}
