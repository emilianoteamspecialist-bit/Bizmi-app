import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { apiFetch } from "../api"

export type Verification = {
  nin: string
  status: string
  created_at: string
}

export function useVerificationQuery() {
  return useQuery({
    queryKey: ["user", "verification"],
    queryFn: async () => {
      const { verification } = await apiFetch<{ verification: Verification | null }>("/api/user/verification")
      return verification
    },
  })
}

export function useSubmitVerificationMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { nin: string }) =>
      apiFetch<{ success: boolean; error?: string }>("/api/user/verification", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user", "verification"] })
    },
  })
}
