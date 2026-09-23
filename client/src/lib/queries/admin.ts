import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { apiFetch } from "../api"

export type AdminUser = {
  id: string
  email: string
  full_name: string
  account_type: string
  created_at: string
  wallet_balance: number | null
}

export function useAdminUsersQuery() {
  return useQuery({
    queryKey: ["admin", "users"],
    queryFn: () => apiFetch<{ users: AdminUser[] }>("/api/admin/users"),
  })
}

export function useDisableUserMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ userId, disabled }: { userId: string; disabled: boolean }) =>
      apiFetch<{ success: boolean; disabled: boolean }>(`/api/admin/users/${userId}/disable`, {
        method: "POST",
        body: JSON.stringify({ disabled }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] })
    },
  })
}

export type AdminJobRow = {
  id: string
  title: string
  status: string
  moderation_status: string
  moderation_reason: string | null
  agency_name: string
  created_at: string
  budget_min: number | null
  budget_max: number | null
}

export function useAdminJobsQuery() {
  return useQuery({
    queryKey: ["admin", "jobs"],
    queryFn: () => apiFetch<{ jobs: AdminJobRow[] }>("/api/admin/jobs"),
  })
}

export function useModerateJobMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ jobId, action, reason }: { jobId: string; action: "remove" | "restore"; reason?: string | null }) =>
      apiFetch<{ success: boolean; moderation_status: string }>(`/api/admin/jobs/${jobId}/moderate`, {
        method: "POST",
        body: JSON.stringify({ action, reason }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "jobs"] })
    },
  })
}

export type AdminAuditEntry = {
  id: string
  action: string
  target_type: string | null
  target_id: string | null
  details: Record<string, unknown> | null
  created_at: string
  admin: { full_name: string | null; email: string | null } | null
}

export function useAdminAuditQuery() {
  return useQuery({
    queryKey: ["admin", "audit"],
    queryFn: () => apiFetch<{ logs: AdminAuditEntry[] }>("/api/admin/audit"),
  })
}
