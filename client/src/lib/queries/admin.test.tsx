import { describe, it, expect, vi } from "vitest"
import { renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { ReactNode } from "react"

const apiFetchMock = vi.fn()
vi.mock("../api", () => ({ apiFetch: (...args: unknown[]) => apiFetchMock(...args) }))

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

describe("useAdminUsersQuery", () => {
  it("GETs /api/admin/users", async () => {
    apiFetchMock.mockResolvedValue({ users: [{ id: "u-1", email: "a@x.com", full_name: "Agency A", account_type: "agency", created_at: "2026-01-01T00:00:00Z", wallet_balance: 5000 }] })
    const { useAdminUsersQuery } = await import("./admin")

    const { result } = renderHook(() => useAdminUsersQuery(), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(apiFetchMock).toHaveBeenCalledWith("/api/admin/users")
    expect(result.current.data?.users[0].full_name).toBe("Agency A")
  })
})
