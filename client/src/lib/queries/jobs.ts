import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { apiFetch } from "../api"

export type JobsQueryParams = {
  searchQuery?: string
  offset?: number
  limit?: number
  fromDate?: string
  toDate?: string
  maxCredits?: number
  jobType?: string
  categorySkills?: string[]
}

function buildJobsQueryString(params: JobsQueryParams): string {
  const search = new URLSearchParams()
  if (params.searchQuery) search.set("searchQuery", params.searchQuery)
  if (params.offset !== undefined) search.set("offset", String(params.offset))
  if (params.limit !== undefined) search.set("limit", String(params.limit))
  if (params.fromDate) search.set("fromDate", params.fromDate)
  if (params.toDate) search.set("toDate", params.toDate)
  if (params.maxCredits !== undefined) search.set("maxCredits", String(params.maxCredits))
  if (params.jobType) search.set("jobType", params.jobType)
  if (params.categorySkills) for (const skill of params.categorySkills) search.append("categorySkills", skill)
  const qs = search.toString()
  return qs ? `?${qs}` : ""
}

export function useJobsQuery(params: JobsQueryParams) {
  return useQuery({
    queryKey: ["jobs", params],
    queryFn: () => apiFetch<{ jobs: any[]; totalCount: number; error?: string }>(`/api/jobs${buildJobsQueryString(params)}`),
  })
}

export function useSavedJobsQuery() {
  return useQuery({
    queryKey: ["jobs", "saved"],
    queryFn: () => apiFetch<{ jobs: any[] }>("/api/jobs/saved"),
  })
}

export function useToggleBookmarkMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ jobId, isBookmarked }: { jobId: string; isBookmarked: boolean }) =>
      apiFetch<{ success: boolean }>(`/api/jobs/${jobId}/bookmark`, {
        method: "POST",
        body: JSON.stringify({ isBookmarked }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jobs"] })
    },
  })
}

export type AgencyJob = {
  id: string
  title: string
  description: string
  budget_min: number | null
  budget_max: number | null
  duration: string
  location: string
  job_type: string
  credit_cost: number
  status: "active" | "paused" | "closed"
  skills: string[]
  created_at: string
  agency_id: string
  proposals: number
}

export function useAgencyJobsQuery() {
  return useQuery({
    queryKey: ["jobs", "agency"],
    queryFn: () => apiFetch<{ jobs: AgencyJob[] }>("/api/jobs/agency"),
  })
}

export type JobInput = {
  title: string
  description: string
  skills: string[]
  budget_min: number | null
  budget_max: number | null
  duration: string
  location: string
  job_type: string
  credit_cost: number
}

export function useCreateJobMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: JobInput & { idempotencyKey: string }) =>
      apiFetch<{ success: boolean; deduped?: boolean; error?: string; code?: string }>("/api/jobs", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jobs", "agency"] })
    },
  })
}

export function useUpdateJobMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ jobId, ...input }: JobInput & { jobId: string }) =>
      apiFetch<{ success: boolean; error?: string; code?: string }>(`/api/jobs/${jobId}`, {
        method: "PUT",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jobs", "agency"] })
    },
  })
}

export function useUpdateJobStatusMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ jobId, status }: { jobId: string; status: string }) =>
      apiFetch<{ success: boolean }>(`/api/jobs/${jobId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jobs", "agency"] })
    },
  })
}

export type JobProposal = {
  id: string
  job_id: string
  freelancer_id: string
  proposal_text: string
  budget: number | string | null
  timeline: string | null
  attachments: string[] | null
  status: "pending" | "accepted" | "rejected"
  created_at: string
  updated_at: string
  profiles: {
    id: string
    full_name: string | null
    bio: string | null
    location: string | null
    phone: string | null
    website: string | null
  } | null
}

export function useJobProposalsQuery(jobId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ["jobs", jobId, "proposals"],
    queryFn: () => apiFetch<{ proposals: JobProposal[] }>(`/api/jobs/${jobId}/proposals`),
    enabled: enabled && !!jobId,
  })
}
