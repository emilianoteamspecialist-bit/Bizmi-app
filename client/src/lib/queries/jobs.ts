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
