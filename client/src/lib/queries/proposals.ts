import { useMutation, useQueryClient, useInfiniteQuery, keepPreviousData } from "@tanstack/react-query"
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
      queryClient.invalidateQueries({ queryKey: ["user", "dashboard"] })
      queryClient.invalidateQueries({ queryKey: ["proposals"] })
    },
  })
}

export type Proposal = {
  id: string
  job_id: string
  freelancer_id: string
  proposal_text: string
  timeline: string | null
  budget: number | null
  attachments: string[] | null
  status: "pending" | "accepted" | "rejected"
  created_at: string
  updated_at: string
  job_title?: string
  job_description?: string
  job_budget_min?: number
  job_budget_max?: number
  job_type?: string
  job_duration?: string
  job_location?: string
  skills?: string[]
  agency_name?: string
  funding_status?: string
  job_status?: string
  freelancer_status?: string
}

type ProposalsPage = { proposals: Proposal[]; hasMore: boolean }

const PROPOSALS_PAGE_SIZE = 15

export function useMyProposalsQuery(searchTerm: string) {
  return useInfiniteQuery({
    queryKey: ["proposals", "mine", searchTerm],
    queryFn: ({ pageParam }) =>
      apiFetch<ProposalsPage>(
        `/api/proposals/mine?searchTerm=${encodeURIComponent(searchTerm)}&offset=${pageParam}&limit=${PROPOSALS_PAGE_SIZE}`
      ),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage.hasMore) return undefined
      return allPages.reduce((sum, page) => sum + page.proposals.length, 0)
    },
    placeholderData: keepPreviousData,
  })
}
