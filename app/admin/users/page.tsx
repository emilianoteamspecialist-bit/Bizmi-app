import { redirect } from "next/navigation"
import UsersClient from "./UsersClient"
import { getFullUserData } from "@/app/actions/user"
import { createClient } from "@/lib/supabase-server"

export default async function AdminUsersPage() {
  // Admin guard — authenticate before fetching any user data.
  const userData = await getFullUserData()

  if (!userData?.user) {
    redirect("/admin/login")
  }
  if (userData.profile?.account_type !== "admin") {
    redirect("/admin/login")
  }

  // Fetch all profiles server-side — same query the client ran on mount — then
  // split into agencies/freelancers exactly as loadUsers did.
  const supabase = await createClient()
  const { data: allUsers } = await supabase
    .from("profiles")
    .select("id, email, full_name, account_type, created_at, wallet_balance")
    .order("created_at", { ascending: false })

  const users = allUsers || []
  const initialAgencies = users.filter((u) => u.account_type === "agency")
  const initialFreelancers = users.filter((u) => u.account_type === "freelancer")

  return <UsersClient initialAgencies={initialAgencies} initialFreelancers={initialFreelancers} />
}
