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

describe("useDashboardQuery", () => {
  it("calls GET /api/user/dashboard", async () => {
    apiFetchMock.mockResolvedValue({ profile: { id: "user-1" }, credits: 10, balance: 0, isVerified: true })
    const { useDashboardQuery } = await import("./user")

    const { result } = renderHook(() => useDashboardQuery(), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(apiFetchMock).toHaveBeenCalledWith("/api/user/dashboard")
    expect(result.current.data?.credits).toBe(10)
  })
})

describe("useFreelancerLogosQuery", () => {
  it("POSTs to /api/user/freelancer-logos with the given ids when there are any", async () => {
    apiFetchMock.mockResolvedValue({ logos: { "freelancer-1": "https://example.com/a.png" } })
    const { useFreelancerLogosQuery } = await import("./user")

    const { result } = renderHook(() => useFreelancerLogosQuery(["freelancer-1"]), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(apiFetchMock).toHaveBeenCalledWith("/api/user/freelancer-logos", {
      method: "POST",
      body: JSON.stringify({ freelancerIds: ["freelancer-1"] }),
    })
    expect(result.current.data?.logos).toEqual({ "freelancer-1": "https://example.com/a.png" })
  })

  it("does not fetch when the id list is empty", async () => {
    const { useFreelancerLogosQuery } = await import("./user")
    renderHook(() => useFreelancerLogosQuery([]), { wrapper })
    expect(apiFetchMock).not.toHaveBeenCalled()
  })
})
