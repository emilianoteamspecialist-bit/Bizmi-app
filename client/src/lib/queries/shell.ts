import { useQuery } from "@tanstack/react-query"
import { apiFetch } from "../api"

export type PortalRole = "agency" | "freelancer"

export type ShellData = {
  avatar: string | null
  unreadCount: number
  /** Freelancer credit balance; null in the agency portal. */
  credits: number | null
  recentUnread: { id: string; message_text: string | null; created_at: string; conversation_id: string; sender_name: string }[]
}

// Avatar, unread messages and credits for the marketplace header, refreshed
// every minute while a portal page is open.
export function useShellQuery(role: PortalRole) {
  return useQuery({
    queryKey: ["shell", role],
    queryFn: () => apiFetch<ShellData>(`/api/user/shell?role=${role}`),
    refetchInterval: 60_000,
  })
}
