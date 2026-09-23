import { useQuery } from "@tanstack/react-query"
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
