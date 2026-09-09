import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { ReactNode } from "react"

const apiFetchMock = vi.fn()
vi.mock("../api", () => ({ apiFetch: (...args: unknown[]) => apiFetchMock(...args) }))

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

beforeEach(() => {
  apiFetchMock.mockReset()
})

describe("useJobsQuery", () => {
  it("calls GET /api/jobs with the given params as a query string", async () => {
    apiFetchMock.mockResolvedValue({ jobs: [{ id: "job-1" }], totalCount: 1 })
    const { useJobsQuery } = await import("./jobs")

    const { result } = renderHook(() => useJobsQuery({ searchQuery: "react", limit: 6 }), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(apiFetchMock).toHaveBeenCalledWith("/api/jobs?searchQuery=react&limit=6")
    expect(result.current.data).toEqual({ jobs: [{ id: "job-1" }], totalCount: 1 })
  })
})

describe("useSavedJobsQuery", () => {
  it("calls GET /api/jobs/saved", async () => {
    apiFetchMock.mockResolvedValue({ jobs: [] })
    const { useSavedJobsQuery } = await import("./jobs")

    const { result } = renderHook(() => useSavedJobsQuery(), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(apiFetchMock).toHaveBeenCalledWith("/api/jobs/saved")
  })
})

describe("useToggleBookmarkMutation", () => {
  it("POSTs to /api/jobs/:jobId/bookmark with the new isBookmarked value", async () => {
    apiFetchMock.mockResolvedValue({ success: true })
    const { useToggleBookmarkMutation } = await import("./jobs")

    const { result } = renderHook(() => useToggleBookmarkMutation(), { wrapper })
    result.current.mutate({ jobId: "job-1", isBookmarked: false })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(apiFetchMock).toHaveBeenCalledWith("/api/jobs/job-1/bookmark", {
      method: "POST",
      body: JSON.stringify({ isBookmarked: false }),
    })
  })
})
