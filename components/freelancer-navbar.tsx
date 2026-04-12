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
  Bookmark,
  Play,
  Phone,
  CreditCard,
  Shield,
  LayoutDashboard,
  Wallet,
  Sparkles,
  ChevronDown
} from "lucide-react"
import { useRouter, usePathname } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import Link from "next/link"

export default function FreelancerNavbar() {
  const [logoPreview, setLogoPreview] = useState<string>("")
  const [profile, setProfile] = useState<any>(null)
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0)
  const [recentNotifications, setRecentNotifications] = useState<any[]>([])
  const router = useRouter()
  const pathname = usePathname()

  const loadUserData = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profileData } = await supabase.from("profiles").select("*").eq("id", user.id).single()
      if (profileData) setProfile(profileData)

      const { data: logoData } = await supabase.from("freelancer_logos").select("logo_data").eq("freelancer_id", user.id).single()
      if (logoData) setLogoPreview(logoData.logo_data)

      const { count } = await supabase.from("messages").select("*", { count: "exact", head: true }).eq("receiver_id", user.id).eq("is_read", false)
      setUnreadMessagesCount(count || 0)

      const { data: recent } = await supabase.from("messages").select(`id, message_text, created_at, sender_id, conversation_id, sender_profile:profiles!messages_sender_id_fkey (full_name, account_type, company_name)`).eq("receiver_id", user.id).eq("is_read", false).order("created_at", { ascending: false }).limit(7)
      setRecentNotifications(recent || [])
    } catch (error) {
      console.error(error)
    }
  }, [])

  useEffect(() => {
    loadUserData()
  }, [loadUserData])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push("/")
  }

  const navLinks = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { name: "Messages", href: "/freelancer/messages", icon: MessageCircle, badge: unreadMessagesCount },
    { name: "Proposals", href: "/freelancer/proposals", icon: FileText },
    { name: "Funded Jobs", href: "/freelancer/funded-jobs", icon: Wallet },
    { name: "Saved", href: "/freelancer/saved-jobs", icon: Bookmark },
  ]

  return (
    <nav className="sticky top-0 z-50 bg-white border-b border-slate-100 shadow-sm selection:bg-orange-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">
          
          {/* Logo & Desktop Nav */}
          <div className="flex items-center gap-10">
            <Link href="/" className="flex items-center space-x-2 group">
              <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center shadow-lg shadow-orange-500/20">
                <span className="text-white font-bold text-xl">B</span>
              </div>
              <span className="text-2xl font-black tracking-tight text-slate-900 hidden sm:block">Bizimi</span>
            </Link>

            <div className="hidden lg:flex items-center gap-2">
              {navLinks.map((link) => {
                const isActive = pathname === link.href
                return (
                  <Link 
                    key={link.name} 
                    href={link.href}
                    className={`px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all ${
                      isActive 
                        ? "bg-slate-900 text-white" 
                        : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
                    }`}
                  >
                    <link.icon className="w-4 h-4" />
                    {link.name}
                    {link.badge > 0 && (
                      <span className="bg-orange-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">
                        {link.badge}
                      </span>
                    )}
                  </Link>
                )
              })}
            </div>
          </div>

          {/* Right Side Actions */}
          <div className="flex items-center gap-3">
            <Button 
              onClick={() => router.push("/freelancer/bizpal")}
              className="hidden md:flex bg-orange-500 hover:bg-orange-600 rounded-xl font-bold h-11 px-6 shadow-lg shadow-orange-500/20"
            >
              <CreditCard className="w-4 h-4 mr-2" />
              Buy Credits
            </Button>

            <div className="h-8 w-px bg-slate-100 mx-1 hidden sm:block"></div>

            {/* Notifications */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative h-11 w-11 rounded-xl hover:bg-slate-50 text-slate-500">
                  <Bell className="h-5 w-5" />
                  {unreadMessagesCount > 0 && (
                    <span className="absolute top-2 right-2 bg-orange-500 w-2.5 h-2.5 rounded-full border-2 border-white"></span>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80 rounded-2xl p-2 shadow-2xl border-slate-100">
                <div className="px-4 py-3 text-xs font-black uppercase tracking-widest text-slate-400">Recent Messages</div>
                <ScrollArea className="max-h-[400px]">
                  {recentNotifications.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 text-sm font-medium italic">No new alerts</div>
                  ) : (
                    recentNotifications.map((n) => (
                      <DropdownMenuItem key={n.id} onClick={() => router.push(`/freelancer/messages?conversationId=${n.conversation_id}`)} className="rounded-xl p-3 cursor-pointer">
                        <div className="flex gap-3">
                           <Avatar className="h-10 w-10 rounded-lg">
                              <AvatarFallback className="bg-orange-50 text-orange-600 font-bold">{n.sender_profile?.full_name?.charAt(0)}</AvatarFallback>
                           </Avatar>
                           <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold text-slate-900 truncate">{n.sender_profile?.full_name}</p>
                              <p className="text-xs text-slate-500 truncate">{n.message_text}</p>
                           </div>
                        </div>
                      </DropdownMenuItem>
                    ))
                  )}
                </ScrollArea>
                <DropdownMenuSeparator className="my-2" />
                <DropdownMenuItem onClick={() => router.push("/freelancer/messages")} className="justify-center font-bold text-orange-500 text-sm">
                  View All Messages
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* User Profile */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-11 pl-2 pr-1 rounded-xl hover:bg-slate-50 border border-slate-100">
                  <div className="flex items-center gap-2">
                    <Avatar className="h-8 w-8 rounded-lg">
                      <AvatarImage src={logoPreview} />
                      <AvatarFallback className="bg-slate-900 text-white text-xs font-black uppercase">
                        {profile?.full_name?.charAt(0) || "F"}
                      </AvatarFallback>
                    </Avatar>
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 rounded-2xl p-2 shadow-2xl border-slate-100">
                <div className="px-3 py-3 border-b border-slate-50 mb-2">
                   <p className="text-sm font-black text-slate-900 truncate">{profile?.full_name}</p>
                   <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Freelancer Account</p>
                </div>
                <DropdownMenuItem onClick={() => router.push("/freelancer/profile")} className="rounded-xl"><User className="mr-2 h-4 w-4" /> My Profile</DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push("/freelancer/identity")} className="rounded-xl"><Shield className="mr-2 h-4 w-4" /> Identity Verification</DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push("/freelancer/settings")} className="rounded-xl"><Settings className="mr-2 h-4 w-4" /> Settings</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => router.push("/freelancer/tutorial")} className="rounded-xl"><Play className="mr-2 h-4 w-4" /> Video Tutorial</DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push("/freelancer/contact")} className="rounded-xl"><Phone className="mr-2 h-4 w-4" /> Support</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="rounded-xl text-red-500 focus:text-red-500 focus:bg-red-50"><LogOut className="mr-2 h-4 w-4" /> Sign out</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Mobile Menu */}
            <div className="lg:hidden">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-11 w-11 rounded-xl hover:bg-slate-50">
                    <Menu className="h-6 w-6" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64 rounded-2xl p-2 shadow-2xl">
                  {navLinks.map((link) => (
                    <DropdownMenuItem key={link.name} onClick={() => router.push(link.href)} className="rounded-xl p-3 font-bold">
                       <link.icon className="mr-3 h-5 w-5 text-slate-400" /> {link.name}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <div className="p-2">
                    <Button onClick={() => router.push("/freelancer/bizpal")} className="w-full bg-orange-500 hover:bg-orange-600 rounded-xl font-bold h-12">Buy Credits</Button>
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </div>
    </nav>
  )
}
