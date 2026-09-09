import { useQuery } from "@tanstack/react-query"
import { apiFetch } from "../api"

export type DashboardData = {
  profile: any
  credits: number
  balance: number
  isVerified: boolean
}

export function useDashboardQuery() {
  return useQuery({
    queryKey: ["user", "dashboard"],
    queryFn: () => apiFetch<DashboardData>("/api/user/dashboard"),
  })
}
