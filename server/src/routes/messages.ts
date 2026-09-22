import { Router } from "express"
import type { SupabaseClient } from "@supabase/supabase-js"
import { asyncHandler } from "../lib/http.js"
import { resolveAvatar } from "../lib/avatar.js"

const messagesRouter = Router()

// Confirms userId is a participant of conversationId and returns the OTHER participant's id, or null
// if the conversation doesn't exist or userId isn't a member of it. Used both as a membership guard
// (Task 3's GET route) and to server-derive receiver_id (Task 4's send-message routes) -- never trust
// a client-supplied receiver_id or conversationId membership.
async function otherParticipantId(supabase: SupabaseClient, conversationId: string, userId: string): Promise<string | null> {
  const { data } = await supabase
    .from("conversations")
    .select("participant1_id, participant2_id")
    .eq("id", conversationId)
    .single()

  if (!data) return null
  if (data.participant1_id !== userId && data.participant2_id !== userId) return null
  return data.participant1_id === userId ? data.participant2_id : data.participant1_id
}

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

messagesRouter.get(
  "/:conversationId",
  asyncHandler(async (req, res) => {
    const { conversationId } = req.params
    const supabase = req.supabase!

    const member = await otherParticipantId(supabase, conversationId, req.user!.id)
    if (!member) {
      res.status(404).json({ messages: [] })
      return
    }

    const { data, error } = await supabase
      .from("messages")
      .select("id, conversation_id, sender_id, receiver_id, message_text, file_url, file_name, file_type, file_size, is_read, created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })

    if (error) {
      console.error("Error fetching messages:", error)
      res.json({ messages: [] })
      return
    }

    res.json({ messages: data || [] })
  })
)

messagesRouter.patch(
  "/:conversationId/read",
  asyncHandler(async (req, res) => {
    const { conversationId } = req.params

    const { error } = await req.supabase!
      .from("messages")
      .update({ is_read: true })
      .eq("conversation_id", conversationId)
      .eq("receiver_id", req.user!.id)
      .eq("is_read", false)

    if (error) {
      console.error("Error marking messages read:", error)
      res.status(500).json({ success: false, error: error.message })
      return
    }

    res.json({ success: true })
  })
)

const ALLOWED_MESSAGE_FILE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "application/pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
}

function messageFileUrl(path: string): string {
  const base = process.env.SUPABASE_URL || ""
  if (!base) return ""
  return `${base}/storage/v1/object/public/message-files/${path}`
}

messagesRouter.post(
  "/:conversationId",
  asyncHandler(async (req, res) => {
    const { conversationId } = req.params
    const { message_text } = req.body ?? {}
    if (typeof message_text !== "string" || !message_text.trim()) {
      res.status(400).json({ success: false, error: "message_text is required" })
      return
    }

    const supabase = req.supabase!
    const userId = req.user!.id
    const receiverId = await otherParticipantId(supabase, conversationId, userId)
    if (!receiverId) {
      res.status(404).json({ success: false, error: "Conversation not found" })
      return
    }

    const { data, error } = await supabase
      .from("messages")
      .insert({ conversation_id: conversationId, sender_id: userId, receiver_id: receiverId, message_text, is_read: false })
      .select()
      .single()

    if (error) {
      console.error("Error sending message:", error)
      res.status(500).json({ success: false, error: error.message })
      return
    }

    await supabase.from("conversations").update({ last_message_at: new Date().toISOString() }).eq("id", conversationId)

    res.json({ success: true, message: data })
  })
)

messagesRouter.post(
  "/:conversationId/file",
  asyncHandler(async (req, res) => {
    const { conversationId } = req.params
    const { data, fileName, mimeType } = req.body ?? {}
    if (typeof data !== "string" || typeof fileName !== "string" || typeof mimeType !== "string") {
      res.status(400).json({ error: "data, fileName, and mimeType are required" })
      return
    }

    const ext = ALLOWED_MESSAGE_FILE_TYPES[mimeType]
    if (!ext) {
      res.status(400).json({ error: "unsupported file type" })
      return
    }

    const supabase = req.supabase!
    const userId = req.user!.id
    const receiverId = await otherParticipantId(supabase, conversationId, userId)
    if (!receiverId) {
      res.status(404).json({ success: false, error: "Conversation not found" })
      return
    }

    const buffer = Buffer.from(data, "base64")
    const path = `messages/${crypto.randomUUID()}.${ext}`

    const { error: uploadError } = await supabase.storage.from("message-files").upload(path, buffer, { contentType: mimeType })
    if (uploadError) {
      console.error("Error uploading message file:", uploadError)
      res.status(500).json({ success: false, error: uploadError.message })
      return
    }

    const fileUrl = messageFileUrl(path)

    const { data: message, error } = await supabase
      .from("messages")
      .insert({
        conversation_id: conversationId,
        sender_id: userId,
        receiver_id: receiverId,
        message_text: `File: ${fileName}`,
        file_url: fileUrl,
        file_name: fileName,
        file_type: mimeType,
        file_size: buffer.length,
        is_read: false,
      })
      .select()
      .single()

    if (error) {
      console.error("Error saving file message:", error)
      res.status(500).json({ success: false, error: error.message })
      return
    }

    await supabase.from("conversations").update({ last_message_at: new Date().toISOString() }).eq("id", conversationId)

    res.json({ success: true, message })
  })
)

export default messagesRouter
