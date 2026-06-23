import { redirect } from "next/navigation"
import AdminDashboardClient from "./AdminDashboardClient"
import { getFullUserData } from "@/app/actions/user"
import { createClient } from "@/lib/supabase-server"

export default async function AdminDashboardPage() {
  // Admin auth guard: must be signed in AND have an admin profile.
  const userData = await getFullUserData()

  if (!userData?.user) {
    redirect("/admin/login")
  }
  if (userData.profile?.account_type !== "admin") {
    redirect("/admin/login")
  }

  // Initial dashboard data, fetched server-side. Replicates the same `profiles`
  // query the client previously ran on mount (the source-of-truth pattern).
  const supabase = await createClient()
  const { data: allUsers } = await supabase
    .from("profiles")
    .select("id, email, full_name, account_type, created_at, wallet_balance")

  const users = allUsers || []

  const initialAgencies = users.filter((user) => user.account_type === "agency")
  const initialFreelancers = users.filter((user) => user.account_type === "freelancer")

  const todayString = new Date().toISOString().split("T")[0]
  const newUsersToday = users.filter((user) => {
    if (!user.created_at) return false
    const userDate = new Date(user.created_at).toISOString().split("T")[0]
    return userDate === todayString
  }).length

  const initialStats = {
    totalUsers: users.length,
    newUsersToday,
    totalAgencies: initialAgencies.length,
    totalFreelancers: initialFreelancers.length,
  }

  return (
    <AdminDashboardClient
      initialStats={initialStats}
      initialAgencies={initialAgencies}
      initialFreelancers={initialFreelancers}
    />
  )
}
