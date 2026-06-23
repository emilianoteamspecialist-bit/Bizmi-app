import { redirect } from "next/navigation"
import DisputeRoomClient from "./DisputeRoomClient"
import { getFullUserData } from "@/app/actions/user"
import { createClient } from "@/lib/supabase-server"

export default async function DisputePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  // Auth only — both dispute participants (and admins) reach this room; RLS on
  // the tables enforces who can actually read the rows.
  const userData = await getFullUserData()
  if (!userData?.user) {
    redirect("/login")
  }

  const supabase = await createClient()

  // Same dispute + messages queries the client previously ran on mount.
  const { data: dispute } = await supabase
    .from("disputes")
    .select(`
      *,
      job:jobs(title),
      initiator:profiles!disputes_initiator_id_fkey(full_name),
      respondent:profiles!disputes_respondent_id_fkey(full_name)
    `)
    .eq("id", id)
    .maybeSingle()

  const { data: messages } = await supabase
    .from("dispute_messages")
    .select(`
      id, sender_id, message, created_at,
      sender:profiles!dispute_messages_sender_id_fkey(full_name)
    `)
    .eq("dispute_id", id)
    .order("created_at", { ascending: true })

  return (
    <DisputeRoomClient
      disputeId={id}
      currentUserId={userData.user.id}
      initialDispute={dispute ?? null}
      initialMessages={messages || []}
    />
  )
}
