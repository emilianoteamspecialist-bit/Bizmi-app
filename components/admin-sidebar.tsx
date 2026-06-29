"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { LayoutDashboard, CreditCard, DollarSign, BarChart3, LogOut, Menu, X, ShieldAlert, Users, ScrollText, Briefcase, Megaphone } from "lucide-react"
import { supabase } from "@/lib/supabase"

const navigation = [
  { name: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
  { name: "Transactions", href: "/admin/transactions", icon: CreditCard },
  { name: "Credits", href: "/admin/credits", icon: DollarSign },
  { name: "Analytics", href: "/admin/analytics", icon: BarChart3 },
  { name: "Disputes", href: "/admin/disputes", icon: ShieldAlert },
  { name: "Jobs", href: "/admin/jobs", icon: Briefcase },
  { name: "Influencers", href: "/admin/influencers", icon: Megaphone },
  { name: "Users", href: "/admin/users", icon: Users },
  { name: "Audit Log", href: "/admin/audit", icon: ScrollText },
]

export default function AdminSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push("/admin/login")
  }

  return (
    <>
      {/* Mobile menu button */}
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="bg-white p-2 rounded-xl shadow-md">
          {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Sidebar */}
      <div
        className={`
        fixed inset-y-0 left-0 z-40 w-64 bg-gradient-to-b from-aubergine to-ink text-white shadow-xl transform transition-transform duration-300 ease-in-out
        lg:translate-x-0 lg:static lg:inset-0
        ${isMobileMenuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
      `}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center gap-2.5 h-16 px-5 border-b border-white/10">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
              <ShieldAlert className="h-4 w-4 text-white" />
            </div>
            <div className="leading-tight">
              <p className="text-sm font-semibold">Admin</p>
              <p className="text-[10px] text-white/50">Bizimi console</p>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto">
            {navigation.map((item) => {
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`
                    flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors
                    ${
                      isActive
                        ? "bg-primary text-white shadow-sm shadow-primary/30"
                        : "text-white/70 hover:bg-white/10 hover:text-white"
                    }
                  `}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <item.icon className="h-5 w-5 shrink-0" />
                  {item.name}
                </Link>
              )
            })}
          </nav>

          {/* Logout */}
          <div className="p-3 border-t border-white/10">
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 w-full px-3 py-2.5 text-sm font-medium text-white/70 rounded-lg hover:bg-white/10 hover:text-white transition-colors"
            >
              <LogOut className="h-5 w-5 shrink-0" />
              Logout
            </button>
          </div>
        </div>
      </div>

      {/* Mobile overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 z-30 bg-black bg-opacity-50 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}
    </>
  )
}

export { AdminSidebar }
