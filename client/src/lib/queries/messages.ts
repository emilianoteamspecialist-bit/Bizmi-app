import { useEffect } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { apiFetch } from "../api"
import { supabase } from "../supabase"

export type ConversationSummary = {
  id: string
  last_message_at: string
  participant: { id: string; full_name: string; avatar: string }
}

export type Message = {
  id: string
  conversation_id: string
  sender_id: string
  receiver_id: string
  message_text: string | null
  file_url: string | null
  file_name: string | null
  file_type: string | null
  file_size: number | null
  is_read: boolean
  created_at: string
}

export function useConversationsQuery() {
  return useQuery({
    queryKey: ["messages", "conversations"],
    queryFn: () => apiFetch<{ conversations: ConversationSummary[] }>("/api/messages/conversations"),
  })
}

export function useConversationMessagesQuery(conversationId: string | null) {
  return useQuery({
    queryKey: ["messages", conversationId],
    queryFn: () => apiFetch<{ messages: Message[] }>(`/api/messages/${conversationId}`),
    enabled: !!conversationId,
  })
}

export function useSendMessageMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ conversationId, message_text }: { conversationId: string; message_text: string }) =>
      apiFetch<{ success: boolean; message?: Message; error?: string }>(`/api/messages/${conversationId}`, {
        method: "POST",
        body: JSON.stringify({ message_text }),
      }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["messages", "conversations"] })
      queryClient.invalidateQueries({ queryKey: ["messages", variables.conversationId] })
    },
  })
}

export function useSendFileMessageMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ conversationId, ...input }: { conversationId: string; data: string; fileName: string; mimeType: string }) =>
      apiFetch<{ success: boolean; message?: Message; error?: string }>(`/api/messages/${conversationId}/file`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["messages", "conversations"] })
      queryClient.invalidateQueries({ queryKey: ["messages", variables.conversationId] })
    },
  })
}

export function useMarkReadMutation() {
  return useMutation({
    mutationFn: (conversationId: string) =>
      apiFetch<{ success: boolean }>(`/api/messages/${conversationId}/read`, { method: "PATCH" }),
  })
}

export function useRealtimeMessages(conversationId: string | null) {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!conversationId) return

    const channel = supabase
      .channel(`messages_channel_${conversationId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
        (payload: { new: Message }) => {
          queryClient.setQueryData<{ messages: Message[] } | undefined>(["messages", conversationId], (old) => {
            if (!old) return old
            if (old.messages.some((m) => m.id === payload.new.id)) return old
            return { messages: [...old.messages, payload.new] }
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [conversationId, queryClient])
}
