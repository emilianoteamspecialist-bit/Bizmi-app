import { useNavigate } from "react-router-dom"
import { LayoutDashboard, CreditCard, DollarSign, BarChart3, ShieldAlert, Users, ScrollText, Briefcase, Megaphone } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { ConsoleHeader, type ConsoleNavItem } from "@/components/console/ConsoleHeader"

const navigation: ConsoleNavItem[] = [
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

/** The admin console's top bar (formerly a dark sidebar; the name is kept for its many importers). */
export default function AdminSidebar() {
  const navigate = useNavigate()
  const { signOut } = useAuth()

  const handleLogout = async () => {
    await signOut()
    navigate("/admin/login")
  }

  return <ConsoleHeader area="Admin" home="/admin/dashboard" nav={navigation} onSignOut={handleLogout} />
}
