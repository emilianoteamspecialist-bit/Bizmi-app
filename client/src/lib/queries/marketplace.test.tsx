import { describe, it, expect, vi, beforeEach } from "vitest"
import { act, renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { ReactNode } from "react"
import { useMarketplaceQuery } from "./marketplace"

const apiFetch = vi.hoisted(() => vi.fn())
vi.mock("../api", () => ({ apiFetch }))

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return { client, wrapper: ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider> }
}
beforeEach(() => apiFetch.mockReset())

describe("useMarketplaceQuery", () => {
  it("retains every filter when fetching another page", async () => {
    apiFetch.mockResolvedValueOnce({ jobs: [{ id: "one" }], totalCount: 2 }).mockResolvedValueOnce({ jobs: [{ id: "two" }], totalCount: 2 })
    const { result } = renderHook(() => useMarketplaceQuery({ searchQuery: "React", jobType: "Remote", maxCredits: 10, fromDate: "2026-09-01", categorySkills: ["Web Development"] }), setup())
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    await act(async () => { await result.current.fetchNextPage() })
    const url = new URL(apiFetch.mock.calls[1][0], "http://test")
    expect(Object.fromEntries(url.searchParams)).toEqual({ searchQuery: "React", jobType: "Remote", maxCredits: "10", fromDate: "2026-09-01", categorySkills: "Web Development", offset: "1", limit: "20" })
    expect(apiFetch).toHaveBeenCalledTimes(2)
  })

  it("starts at zero when the search changes", async () => {
    apiFetch.mockResolvedValue({ jobs: [{ id: "one" }], totalCount: 2 })
    const { result, rerender } = renderHook(({ search }) => useMarketplaceQuery({ searchQuery: search }), { ...setup(), initialProps: { search: "React" } })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    await act(async () => { await result.current.fetchNextPage() })
    rerender({ search: "Design" })
    await waitFor(() => expect(apiFetch).toHaveBeenLastCalledWith("/api/jobs?searchQuery=Design&offset=0&limit=20"))
    await waitFor(() => expect(result.current.data?.pages[0].jobs[0].id).toBe("one"))
  })

  it("treats an API error payload as an error instead of an empty result", async () => {
    apiFetch.mockResolvedValue({ jobs: [], totalCount: 0, error: "Database unavailable" })
    const { result } = renderHook(() => useMarketplaceQuery({}), setup())
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error?.message).toBe("Database unavailable")
  })

  it("keeps loaded jobs after a failed load-more request and permits retry", async () => {
    apiFetch.mockResolvedValueOnce({ jobs: [{ id: "one" }], totalCount: 2 }).mockRejectedValueOnce(new Error("Offline")).mockResolvedValueOnce({ jobs: [{ id: "two" }], totalCount: 2 })
    const { result } = renderHook(() => useMarketplaceQuery({}), setup())
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    await act(async () => { await result.current.fetchNextPage() })
    await waitFor(() => expect(result.current.isFetchNextPageError).toBe(true))
    expect(result.current.data?.pages[0].jobs[0].id).toBe("one")
    await act(async () => { await result.current.fetchNextPage() })
    await waitFor(() => expect(result.current.data?.pages).toHaveLength(2))
    expect(result.current.data?.pages).toHaveLength(2)
  })
})
