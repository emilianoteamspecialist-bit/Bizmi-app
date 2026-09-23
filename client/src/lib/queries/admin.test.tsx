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

describe("useAdminJobsQuery", () => {
  it("GETs /api/admin/jobs", async () => {
    apiFetchMock.mockResolvedValue({ jobs: [{ id: "j-1", title: "Logo design", status: "open", moderation_status: "visible", moderation_reason: null, agency_name: "Acme", created_at: "2026-01-01T00:00:00Z", budget_min: 5000, budget_max: 10000 }] })
    const { useAdminJobsQuery } = await import("./admin")

    const { result } = renderHook(() => useAdminJobsQuery(), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(apiFetchMock).toHaveBeenCalledWith("/api/admin/jobs")
    expect(result.current.data?.jobs[0].title).toBe("Logo design")
  })
})

describe("useModerateJobMutation", () => {
  it("POSTs /api/admin/jobs/:id/moderate and invalidates the jobs list", async () => {
    apiFetchMock.mockResolvedValue({ success: true, moderation_status: "removed" })
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const invalidateSpy = vi.spyOn(client, "invalidateQueries")
    const { useModerateJobMutation } = await import("./admin")

    const { result } = renderHook(() => useModerateJobMutation(), {
      wrapper: ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>,
    })
    result.current.mutate({ jobId: "j-1", action: "remove", reason: "fraud" })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(apiFetchMock).toHaveBeenCalledWith("/api/admin/jobs/j-1/moderate", {
      method: "POST",
      body: JSON.stringify({ action: "remove", reason: "fraud" }),
    })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["admin", "jobs"] })
  })
})

describe("useAdminAuditQuery", () => {
  it("GETs /api/admin/audit", async () => {
    apiFetchMock.mockResolvedValue({ logs: [{ id: "log-1", action: "user.disable", target_type: "user", target_id: "u-2", details: null, created_at: "2026-01-01T00:00:00Z", admin: { full_name: "Admin One", email: "a@x.com" } }] })
    const { useAdminAuditQuery } = await import("./admin")

    const { result } = renderHook(() => useAdminAuditQuery(), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(apiFetchMock).toHaveBeenCalledWith("/api/admin/audit")
    expect(result.current.data?.logs[0].action).toBe("user.disable")
  })
})
