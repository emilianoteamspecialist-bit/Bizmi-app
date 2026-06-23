import { redirect } from "next/navigation"
import AdminDisputesClient from "./AdminDisputesClient"
import { getFullUserData } from "@/app/actions/user"
import { createClient } from "@/lib/supabase-server"

export default async function AdminDisputesPage() {
  // Admin guard — authenticate before fetching any dispute data.
  const userData = await getFullUserData()

  if (!userData?.user) {
    redirect("/admin/login")
  }
  if (userData.profile?.account_type !== "admin") {
    redirect("/admin/login")
  }

  // Initial disputes fetched server-side. Same tables/columns/filters as the
  // client refetch (loadDisputes), replicated inline per the source-of-truth pattern.
  const supabase = await createClient()
  const { data: disputes } = await supabase
    .from("disputes")
    .select(`
      *,
      job:jobs(title),
      initiator:profiles!disputes_initiator_id_fkey(full_name),
      respondent:profiles!disputes_respondent_id_fkey(full_name)
    `)
    .order("created_at", { ascending: false })

  return <AdminDisputesClient initialDisputes={disputes || []} />
}
