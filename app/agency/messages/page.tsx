import { redirect } from "next/navigation"
import MessagesClient from "./MessagesClient"
import { getFullUserData } from "@/app/actions/user"
import { createClient } from "@/lib/supabase-server"
import { resolveAvatar } from "@/lib/avatar-url"

// Replicates the client's fetchConversations() for the initial list, kept inline
// here to avoid editing shared action files. Same tables/columns/filters.
async function fetchInitialConversations(userId: string) {
  const supabase = await createClient()

  const { data: convs, error } = await supabase
    .from("conversations")
    .select("id, last_message_at, participant1_id, participant2_id")
    .or(`participant1_id.eq.${userId},participant2_id.eq.${userId}`)
    .order("last_message_at", { ascending: false, nullsFirst: false })

  if (error) {
    console.error("Error fetching conversations (server):", error)
    return []
  }
  if (!convs || convs.length === 0) return []

  const allIds = new Set<string>()
  for (const c of convs) {
    if (c.participant1_id) allIds.add(c.participant1_id)
    if (c.participant2_id) allIds.add(c.participant2_id)
  }
  const idArr = Array.from(allIds)

  const [profilesRes, logoRes, imageRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, account_type, company_name")
      .in("id", idArr),
    supabase
      .from("freelancer_logos")
      .select("freelancer_id, logo_path, logo_data")
      .in("freelancer_id", idArr),
    supabase
      .from("agency_image")
      .select("agency_id, image_path, image_data")
      .in("agency_id", idArr),
  ])

  const profileById: Record<string, any> = {}
  for (const p of (profilesRes.data as any[]) || []) profileById[p.id] = p

  const avatarById: Record<string, string> = {}
  for (const r of (logoRes.data as any[]) || []) avatarById[r.freelancer_id] = resolveAvatar(r)
  for (const r of (imageRes.data as any[]) || []) avatarById[r.agency_id] = resolveAvatar(r)

  return convs.map((c) => ({
    ...c,
    participant1_profile: profileById[c.participant1_id] || null,
    participant2_profile: profileById[c.participant2_id] || null,
    _avatarById: avatarById,
  }))
}

export default async function AgencyMessagesPage() {
  // Authenticate first, mirroring the agency dashboard (source of truth).
  const userData = await getFullUserData()

  if (!userData?.user) {
    redirect("/login")
  }

  const { profile } = userData

  if (profile?.account_type === "freelancer") {
    redirect("/freelancer/dashboard")
  }
  if (profile?.account_type === "admin") {
    redirect("/admin/dashboard")
  }

  const initialConversations = await fetchInitialConversations(userData.user.id)

  return (
    <MessagesClient
      initialConversations={initialConversations}
      initialProfile={profile}
    />
  )
}
