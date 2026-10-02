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

describe("useVerificationQuery", () => {
  it("GETs /api/user/verification and returns the record", async () => {
    apiFetchMock.mockResolvedValue({ verification: { nin: "12345678901", status: "pending", created_at: "2026-01-01T00:00:00Z" } })
    const { useVerificationQuery } = await import("./verification")

    const { result } = renderHook(() => useVerificationQuery(), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(apiFetchMock).toHaveBeenCalledWith("/api/user/verification")
    expect(result.current.data?.status).toBe("pending")
  })
})

describe("useSubmitVerificationMutation", () => {
  it("POSTs /api/user/verification and invalidates the verification query on success", async () => {
    apiFetchMock.mockResolvedValue({ success: true })
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const invalidateSpy = vi.spyOn(client, "invalidateQueries")
    const { useSubmitVerificationMutation } = await import("./verification")

    const { result } = renderHook(() => useSubmitVerificationMutation(), {
      wrapper: ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>,
    })
    result.current.mutate({ nin: "12345678901" })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(apiFetchMock).toHaveBeenCalledWith("/api/user/verification", { method: "POST", body: JSON.stringify({ nin: "12345678901" }) })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["user", "verification"] })
  })
})
