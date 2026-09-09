import { useMutation, useQueryClient } from "@tanstack/react-query"
import { apiFetch } from "../api"

export type SubmitProposalInput = {
  jobId: string
  proposal_text: string
  timeline: string
  budget: string
  creditCost: number
  attachments?: string[]
}

export type SubmitProposalResult =
  | { success: true; alreadySubmitted?: boolean }
  | { success: false; error: string; code?: string }

export function useSubmitProposalMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ jobId, ...body }: SubmitProposalInput) =>
      apiFetch<SubmitProposalResult>(`/api/proposals/jobs/${jobId}`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jobs"] })
    },
  })
}
