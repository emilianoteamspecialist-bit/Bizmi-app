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

describe("useCreditsHistoryQuery", () => {
  it("GETs /api/user/credits/history and returns the purchase list", async () => {
    apiFetchMock.mockResolvedValue({
      purchases: [{ id: "p-1", amount: 500, credits_amount: 10, status: "completed", created_at: "2026-01-01T00:00:00Z", paystack_reference: "ref-1" }],
    })
    const { useCreditsHistoryQuery } = await import("./credits")

    const { result } = renderHook(() => useCreditsHistoryQuery(), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(apiFetchMock).toHaveBeenCalledWith("/api/user/credits/history")
    expect(result.current.data?.purchases[0].paystack_reference).toBe("ref-1")
  })
})

describe("useVerifyCreditsMutation", () => {
  it("POSTs /api/user/credits/verify with the given payload and invalidates the dashboard and history queries on success", async () => {
    apiFetchMock.mockResolvedValue({ success: true, credits_added: 10, purchase: { id: "p-1" } })
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const invalidateSpy = vi.spyOn(client, "invalidateQueries")
    const { useVerifyCreditsMutation } = await import("./credits")

    const { result } = renderHook(() => useVerifyCreditsMutation(), {
      wrapper: ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>,
    })
    result.current.mutate({ reference: "ref-1", amount: 500 })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(apiFetchMock).toHaveBeenCalledWith("/api/user/credits/verify", {
      method: "POST",
      body: JSON.stringify({ reference: "ref-1", amount: 500 }),
    })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["user", "dashboard"] })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["user", "credits", "history"] })
  })
})
