import { useInfiniteQuery, keepPreviousData } from "@tanstack/react-query"
import { apiFetch } from "../api"

export type FreelancerSearchResult = {
  id: string
  full_name: string
  bio: string | null
  location: string | null
  skills: string[]
  created_at: string
  logo: string | null
  verification_status: string | null
  /** From freelancer_verification (the external KYC service's record). */
  identity_verified?: boolean
  /** Escrows released or paid out to this freelancer. */
  jobs_completed: number
}

type FreelancersPage = {
  freelancers: FreelancerSearchResult[]
  hasMore: boolean
}

const FREELANCERS_PAGE_SIZE = 20

export function useFindFreelancersQuery(searchTerm: string, enabled: boolean) {
  return useInfiniteQuery({
    queryKey: ["freelancers", searchTerm],
    queryFn: ({ pageParam }) =>
      apiFetch<FreelancersPage>(
        `/api/freelancers?search=${encodeURIComponent(searchTerm)}&offset=${pageParam}&limit=${FREELANCERS_PAGE_SIZE}`
      ),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage.hasMore) return undefined
      return allPages.reduce((sum, page) => sum + page.freelancers.length, 0)
    },
    placeholderData: keepPreviousData,
    enabled,
  })
}
