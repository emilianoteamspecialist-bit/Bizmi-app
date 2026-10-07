import { useQuery } from "@tanstack/react-query"
import { apiFetch } from "../api"

export type PortalRole = "agency" | "freelancer"

export type ShellData = {
  avatar: string | null
  unreadCount: number
  recentUnread: { id: string; message_text: string | null; created_at: string; conversation_id: string; sender_name: string }[]
}

// Avatar + unread messages for the portal sidebar and top bar. Shared by both
// (same query key), refreshed every minute while a portal page is open.
export function useShellQuery(role: PortalRole) {
  return useQuery({
    queryKey: ["shell", role],
    queryFn: () => apiFetch<ShellData>(`/api/user/shell?role=${role}`),
    refetchInterval: 60_000,
  })
}
