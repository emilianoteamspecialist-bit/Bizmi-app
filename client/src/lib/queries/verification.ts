import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { apiFetch } from "../api"

export type Verification = {
  nin: string
  status: string
  created_at: string
}

// NIN verification is decided by an external KYC service, which updates the
// status out of band. While a submission is pending, poll so the result shows
// up without a manual refresh; stop once it's settled (or there's no record).
export const PENDING_VERIFICATION_POLL_MS = 30_000

export function verificationRefetchInterval(verification: Verification | null | undefined): number | false {
  return verification?.status === "pending" ? PENDING_VERIFICATION_POLL_MS : false
}

export function useVerificationQuery() {
  return useQuery({
    queryKey: ["user", "verification"],
    queryFn: async () => {
      const { verification } = await apiFetch<{ verification: Verification | null }>("/api/user/verification")
      return verification
    },
    refetchInterval: (query) => verificationRefetchInterval(query.state.data),
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
