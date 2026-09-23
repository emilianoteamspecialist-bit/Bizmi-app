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

describe("useDisableUserMutation", () => {
  it("POSTs /api/admin/users/:id/disable and invalidates the admin users list", async () => {
    apiFetchMock.mockResolvedValue({ success: true, disabled: true })
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const invalidateSpy = vi.spyOn(client, "invalidateQueries")
    const { useDisableUserMutation } = await import("./admin")

    const { result } = renderHook(() => useDisableUserMutation(), {
      wrapper: ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>,
    })
    result.current.mutate({ userId: "u-2", disabled: true })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(apiFetchMock).toHaveBeenCalledWith("/api/admin/users/u-2/disable", {
      method: "POST",
      body: JSON.stringify({ disabled: true }),
    })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["admin", "users"] })
  })
})
