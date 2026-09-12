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

describe("useAgencyJobsQuery", () => {
  it("calls GET /api/jobs/agency", async () => {
    apiFetchMock.mockResolvedValue({ jobs: [{ id: "job-1", proposals: 2 }] })
    const { useAgencyJobsQuery } = await import("./jobs")

    const { result } = renderHook(() => useAgencyJobsQuery(), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(apiFetchMock).toHaveBeenCalledWith("/api/jobs/agency")
  })
})

describe("useCreateJobMutation", () => {
  it("POSTs to /api/jobs with the job payload and idempotencyKey", async () => {
    apiFetchMock.mockResolvedValue({ success: true })
    const { useCreateJobMutation } = await import("./jobs")

    const { result } = renderHook(() => useCreateJobMutation(), { wrapper })
    result.current.mutate({ title: "Build a site", idempotencyKey: "key-1" } as any)

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(apiFetchMock).toHaveBeenCalledWith("/api/jobs", {
      method: "POST",
      body: JSON.stringify({ title: "Build a site", idempotencyKey: "key-1" }),
    })
  })
})

describe("useUpdateJobMutation", () => {
  it("PUTs to /api/jobs/:jobId with the job payload", async () => {
    apiFetchMock.mockResolvedValue({ success: true })
    const { useUpdateJobMutation } = await import("./jobs")

    const { result } = renderHook(() => useUpdateJobMutation(), { wrapper })
    result.current.mutate({ jobId: "job-1", title: "Updated title" } as any)

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(apiFetchMock).toHaveBeenCalledWith("/api/jobs/job-1", {
      method: "PUT",
      body: JSON.stringify({ title: "Updated title" }),
    })
  })
})

describe("useUpdateJobStatusMutation", () => {
  it("PATCHes to /api/jobs/:jobId/status with the new status", async () => {
    apiFetchMock.mockResolvedValue({ success: true })
    const { useUpdateJobStatusMutation } = await import("./jobs")

    const { result } = renderHook(() => useUpdateJobStatusMutation(), { wrapper })
    result.current.mutate({ jobId: "job-1", status: "paused" })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(apiFetchMock).toHaveBeenCalledWith("/api/jobs/job-1/status", {
      method: "PATCH",
      body: JSON.stringify({ status: "paused" }),
    })
  })
})

describe("useJobProposalsQuery", () => {
  it("calls GET /api/jobs/:jobId/proposals when enabled", async () => {
    apiFetchMock.mockResolvedValue({ proposals: [] })
    const { useJobProposalsQuery } = await import("./jobs")

    const { result } = renderHook(() => useJobProposalsQuery("job-1", true), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(apiFetchMock).toHaveBeenCalledWith("/api/jobs/job-1/proposals")
  })

  it("does not fetch when disabled", async () => {
    const { useJobProposalsQuery } = await import("./jobs")
    renderHook(() => useJobProposalsQuery(undefined, false), { wrapper })
    expect(apiFetchMock).not.toHaveBeenCalled()
  })
})
