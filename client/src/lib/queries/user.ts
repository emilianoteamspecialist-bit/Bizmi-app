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

export function useFreelancerLogosQuery(freelancerIds: string[]) {
  return useQuery({
    queryKey: ["user", "freelancer-logos", freelancerIds],
    queryFn: () =>
      apiFetch<{ logos: Record<string, string> }>("/api/user/freelancer-logos", {
        method: "POST",
        body: JSON.stringify({ freelancerIds }),
      }),
    enabled: freelancerIds.length > 0,
  })
}
