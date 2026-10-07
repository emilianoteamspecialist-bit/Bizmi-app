import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query"
import { apiFetch } from "../api"

export type MarketplaceParams = {
  searchQuery?: string
  maxCredits?: number
  jobType?: string
  categorySkills?: string[]
  fromDate?: string
  toDate?: string
}

export type MarketplacePage = { jobs: any[]; totalCount: number }
const PAGE_SIZE = 20

function queryString(params: MarketplaceParams, offset: number) {
  const search = new URLSearchParams()
  if (params.searchQuery) search.set("searchQuery", params.searchQuery)
  if (params.maxCredits !== undefined) search.set("maxCredits", String(params.maxCredits))
  if (params.jobType) search.set("jobType", params.jobType)
  if (params.categorySkills) params.categorySkills.forEach((skill) => search.append("categorySkills", skill))
  if (params.fromDate) search.set("fromDate", params.fromDate)
  if (params.toDate) search.set("toDate", params.toDate)
  search.set("offset", String(offset))
  search.set("limit", String(PAGE_SIZE))
  return `?${search.toString()}`
}

export function useMarketplaceQuery(params: MarketplaceParams, enabled = true) {
  return useInfiniteQuery({
    queryKey: ["marketplace", params],
    queryFn: async ({ pageParam }) => {
      const result = await apiFetch<MarketplacePage & { error?: string }>(`/api/jobs${queryString(params, pageParam)}`)
      if (result.error) throw new Error(result.error)
      return result
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, pages) => {
      const loaded = pages.reduce((total, page) => total + page.jobs.length, 0)
      // A full page means there may be more, even if total_count is stale
      // (the RPC reported 1 for every query before its window-count fix).
      return loaded < lastPage.totalCount || lastPage.jobs.length === PAGE_SIZE ? loaded : undefined
    },
    placeholderData: keepPreviousData,
    enabled,
  })
}
