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

describe("useSubmitProposalMutation", () => {
  it("POSTs to /api/proposals/jobs/:jobId with the proposal payload", async () => {
    apiFetchMock.mockResolvedValue({ success: true, alreadySubmitted: false })
    const { useSubmitProposalMutation } = await import("./proposals")

    const { result } = renderHook(() => useSubmitProposalMutation(), { wrapper })
    result.current.mutate({
      jobId: "job-1",
      proposal_text: "I can do this",
      timeline: "2 weeks",
      budget: "5000",
      creditCost: 2,
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(apiFetchMock).toHaveBeenCalledWith("/api/proposals/jobs/job-1", {
      method: "POST",
      body: JSON.stringify({ proposal_text: "I can do this", timeline: "2 weeks", budget: "5000", creditCost: 2 }),
    })
  })
})

describe("useMyProposalsQuery", () => {
  it("fetches the first page from GET /api/proposals/mine with offset 0", async () => {
    apiFetchMock.mockResolvedValue({
      proposals: [{ id: "p1", job_title: "Build a site" }],
      hasMore: false,
    })
    const { useMyProposalsQuery } = await import("./proposals")

    const { result } = renderHook(() => useMyProposalsQuery(""), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(apiFetchMock).toHaveBeenCalledWith("/api/proposals/mine?searchTerm=&offset=0&limit=15")
    expect(result.current.data?.pages[0].proposals).toEqual([{ id: "p1", job_title: "Build a site" }])
  })

  it("computes the next page's offset from the cumulative proposal count", async () => {
    apiFetchMock
      .mockResolvedValueOnce({
        proposals: Array.from({ length: 15 }, (_, i) => ({ id: `p${i}` })),
        hasMore: true,
      })
      .mockResolvedValueOnce({ proposals: [{ id: "p15" }], hasMore: false })

    const { useMyProposalsQuery } = await import("./proposals")
    const { result } = renderHook(() => useMyProposalsQuery(""), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.hasNextPage).toBe(true)

    result.current.fetchNextPage()

    await waitFor(() => expect(result.current.data?.pages.length).toBe(2))
    expect(apiFetchMock).toHaveBeenLastCalledWith("/api/proposals/mine?searchTerm=&offset=15&limit=15")
  })

  it("URL-encodes the search term", async () => {
    apiFetchMock.mockResolvedValue({ proposals: [], hasMore: false })
    const { useMyProposalsQuery } = await import("./proposals")

    const { result } = renderHook(() => useMyProposalsQuery("react & node"), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(apiFetchMock).toHaveBeenCalledWith("/api/proposals/mine?searchTerm=react%20%26%20node&offset=0&limit=15")
  })
})

describe("useRespondToProposalMutation", () => {
  it("POSTs to /api/proposals/:proposalId/respond with the action, and invalidates the job's proposals", async () => {
    apiFetchMock.mockResolvedValue({ success: true })
    const { useRespondToProposalMutation } = await import("./proposals")

    const { result } = renderHook(() => useRespondToProposalMutation(), { wrapper })
    result.current.mutate({ proposalId: "prop-1", jobId: "job-1", action: "accept" })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(apiFetchMock).toHaveBeenCalledWith("/api/proposals/prop-1/respond", {
      method: "POST",
      body: JSON.stringify({ action: "accept" }),
    })
  })
})
