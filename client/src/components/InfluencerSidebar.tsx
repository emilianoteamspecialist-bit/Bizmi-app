import { useNavigate } from "react-router-dom"
import { LayoutDashboard, Users, Wallet } from "lucide-react"
import { useAuth } from "../contexts/AuthContext"
import { ConsoleHeader, type ConsoleNavItem } from "@/components/console/ConsoleHeader"

const navigation: ConsoleNavItem[] = [
  { name: "Dashboard", href: "/influencer/dashboard", icon: LayoutDashboard },
  { name: "Referrals", href: "/influencer/referrals", icon: Users },
  { name: "Earnings", href: "/influencer/earnings", icon: Wallet },
]

/** The influencer program's top bar (formerly a dark sidebar; the name is kept for its importers). */
export default function InfluencerSidebar() {
  const navigate = useNavigate()
  const { signOut } = useAuth()

  const handleLogout = async () => {
    await signOut()
    navigate("/login")
  }

  return <ConsoleHeader area="Influencer program" home="/influencer/dashboard" nav={navigation} onSignOut={handleLogout} />
}
