import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { apiFetch } from "../api"

export type DashboardData = {
  profile: any
  credits: number
  balance: number
  isVerified: boolean
}

export function useDashboardQuery(enabled = true) {
  return useQuery({
    queryKey: ["user", "dashboard"],
    queryFn: () => apiFetch<DashboardData>("/api/user/dashboard"),
    enabled,
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

export function useUpdateProfileMutation() {
  return useMutation({
    mutationFn: (input: Record<string, unknown>) =>
      apiFetch<{ success: boolean; error?: string }>("/api/user/profile", {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
  })
}

export function useUploadAvatarMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { data: string; fileName: string; mimeType: string }) =>
      apiFetch<{ success: boolean; avatar?: string; error?: string }>("/api/user/avatar", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agencies"] })
      queryClient.invalidateQueries({ queryKey: ["user", "freelancer-logos"] })
    },
  })
}
