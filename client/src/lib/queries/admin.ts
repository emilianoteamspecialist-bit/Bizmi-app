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
