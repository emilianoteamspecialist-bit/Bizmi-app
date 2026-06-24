import { redirect } from "next/navigation"
import AdminDisputesClient from "./AdminDisputesClient"
import { getFullUserData } from "@/app/actions/user"
import { createClient } from "@/lib/supabase-server"
import { createServiceRoleClient } from "@/lib/supabase-service"

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

  // Pull the dispute-room conversation for the listed disputes so the admin can
  // review the evidence before resolving. Read with the service role (the admin
  // is already authorised above) since dispute_messages RLS is scoped to the
  // participants. Grouped by dispute_id for the client.
  const disputeIds = (disputes || []).map((d: any) => d.id)
  const messagesByDispute: Record<string, any[]> = {}
  if (disputeIds.length) {
    const service = createServiceRoleClient()
    const { data: messages } = await service
      .from("dispute_messages")
      .select(`
        id, dispute_id, sender_id, message, created_at,
        sender:profiles!dispute_messages_sender_id_fkey(full_name)
      `)
      .in("dispute_id", disputeIds)
      .order("created_at", { ascending: true })

    for (const m of messages || []) {
      ;(messagesByDispute[m.dispute_id] ||= []).push(m)
    }
  }

  return <AdminDisputesClient initialDisputes={disputes || []} initialMessagesByDispute={messagesByDispute} />
}
