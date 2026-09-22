import { Router } from "express"
import { asyncHandler } from "../lib/http.js"
import { resolveAvatar } from "../lib/avatar.js"

const messagesRouter = Router()

messagesRouter.get(
  "/conversations",
  asyncHandler(async (req, res) => {
    const supabase = req.supabase!
    const userId = req.user!.id

    const { data: convs, error } = await supabase
      .from("conversations")
      .select("id, last_message_at, participant1_id, participant2_id")
      .or(`participant1_id.eq.${userId},participant2_id.eq.${userId}`)
      .order("last_message_at", { ascending: false, nullsFirst: false })

    if (error) {
      console.error("Error fetching conversations:", error)
      res.json({ conversations: [] })
      return
    }
    if (!convs || convs.length === 0) {
      res.json({ conversations: [] })
      return
    }

    const otherIds = convs.map((c: { participant1_id: string; participant2_id: string }) =>
      c.participant1_id === userId ? c.participant2_id : c.participant1_id
    )

    const [profilesResult, logosResult, imagesResult] = await Promise.all([
      supabase.from("profiles").select("id, full_name, account_type, company_name").in("id", otherIds),
      supabase.from("freelancer_logos").select("freelancer_id, logo_path, logo_data").in("freelancer_id", otherIds),
      supabase.from("agency_image").select("agency_id, image_path, image_data").in("agency_id", otherIds),
    ])

    const profileById: Record<string, { full_name: string; account_type: string; company_name: string | null }> = {}
    for (const p of profilesResult.data || []) profileById[p.id] = p

    const avatarById: Record<string, string> = {}
    for (const l of logosResult.data || []) avatarById[l.freelancer_id] = resolveAvatar(l)
    for (const i of imagesResult.data || []) avatarById[i.agency_id] = resolveAvatar(i)

    const conversations = convs.map((c: { id: string; last_message_at: string; participant1_id: string; participant2_id: string }) => {
      const otherId = c.participant1_id === userId ? c.participant2_id : c.participant1_id
      const profile = profileById[otherId]
      const displayName = profile ? profile.company_name || profile.full_name || "Unknown User" : "Unknown User"
      return {
        id: c.id,
        last_message_at: c.last_message_at,
        participant: { id: otherId, full_name: displayName, avatar: avatarById[otherId] || "" },
      }
    })

    res.json({ conversations })
  })
)

export default messagesRouter
