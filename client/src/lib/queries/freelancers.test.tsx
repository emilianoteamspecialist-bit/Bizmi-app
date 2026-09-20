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

describe("useFindFreelancersQuery", () => {
  it("GETs /api/freelancers with search/offset/limit and returns the first page", async () => {
    apiFetchMock.mockResolvedValue({
      freelancers: [{ id: "f-1", full_name: "Jane Doe", bio: null, location: null, skills: [], created_at: "2026-01-01T00:00:00Z", logo: null, verification_status: null, jobs_completed: 0 }],
      hasMore: false,
    })
    const { useFindFreelancersQuery } = await import("./freelancers")

    const { result } = renderHook(() => useFindFreelancersQuery("react dev", true), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(apiFetchMock).toHaveBeenCalledWith("/api/freelancers?search=react%20dev&offset=0&limit=20")
    expect(result.current.data?.pages[0].freelancers[0].full_name).toBe("Jane Doe")
  })

  it("does not fetch when disabled", async () => {
    const { useFindFreelancersQuery } = await import("./freelancers")
    renderHook(() => useFindFreelancersQuery("", false), { wrapper })
    expect(apiFetchMock).not.toHaveBeenCalled()
  })

  it("computes the next page's offset from the total freelancers already loaded", async () => {
    apiFetchMock
      .mockResolvedValueOnce({
        freelancers: Array.from({ length: 20 }, (_, i) => ({ id: `f-${i}`, full_name: `F${i}`, bio: null, location: null, skills: [], created_at: "2026-01-01T00:00:00Z", logo: null, verification_status: null, jobs_completed: 0 })),
        hasMore: true,
      })
      .mockResolvedValueOnce({
        freelancers: [{ id: "f-20", full_name: "F20", bio: null, location: null, skills: [], created_at: "2026-01-01T00:00:00Z", logo: null, verification_status: null, jobs_completed: 0 }],
        hasMore: false,
      })
    const { useFindFreelancersQuery } = await import("./freelancers")

    const { result } = renderHook(() => useFindFreelancersQuery("", true), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    await result.current.fetchNextPage()
    await waitFor(() => expect(result.current.data?.pages).toHaveLength(2))

    expect(apiFetchMock).toHaveBeenLastCalledWith("/api/freelancers?search=&offset=20&limit=20")
  })
})
