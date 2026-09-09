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
