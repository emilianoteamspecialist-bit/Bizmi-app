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

describe("useAgencyImageQuery", () => {
  it("calls GET /api/agencies/:agencyId/image when enabled", async () => {
    apiFetchMock.mockResolvedValue({ image: "https://example.com/logo.png" })
    const { useAgencyImageQuery } = await import("./agencies")

    const { result } = renderHook(() => useAgencyImageQuery("agency-1", true), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(apiFetchMock).toHaveBeenCalledWith("/api/agencies/agency-1/image")
  })

  it("does not fetch when disabled", async () => {
    const { useAgencyImageQuery } = await import("./agencies")
    renderHook(() => useAgencyImageQuery(undefined, false), { wrapper })
    expect(apiFetchMock).not.toHaveBeenCalled()
  })
})
