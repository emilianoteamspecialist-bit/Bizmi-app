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
  vi.clearAllMocks()
})

describe("useInfluencerMeQuery", () => {
  it("GETs /api/influencer/me and returns the influencer's data", async () => {
    apiFetchMock.mockResolvedValue({
      referralCode: "abc123",
      displayName: "Jane",
      socialHandle: null,
      totals: { referred: 2, qualified: 1, pending: 1, earnedNaira: 50, unpaidNaira: 20 },
      referrals: [],
      payouts: [],
    })
    const { useInfluencerMeQuery } = await import("./influencer")

    const { result } = renderHook(() => useInfluencerMeQuery(), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(apiFetchMock).toHaveBeenCalledWith("/api/influencer/me")
    expect(result.current.data?.referralCode).toBe("abc123")
    expect(result.current.data?.totals.unpaidNaira).toBe(20)
  })
})
