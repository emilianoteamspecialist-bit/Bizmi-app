import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor, fireEvent } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

// jsdom doesn't implement IntersectionObserver, which the Reveal component
// (framer-motion's `whileInView`) needs during mount.
class MockIntersectionObserver {
  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = vi.fn()
  takeRecords = vi.fn(() => [])
}
;(globalThis as any).IntersectionObserver = MockIntersectionObserver as unknown as typeof IntersectionObserver

const useAuthMock = vi.fn()
vi.mock("../../contexts/AuthContext", () => ({ useAuth: () => useAuthMock() }))

const useJobsQueryMock = vi.fn()
const useToggleBookmarkMutationMock = vi.fn()
vi.mock("../../lib/queries/jobs", () => ({
  useJobsQuery: (...args: unknown[]) => useJobsQueryMock(...args),
  useToggleBookmarkMutation: () => useToggleBookmarkMutationMock(),
}))

const useDashboardQueryMock = vi.fn()
vi.mock("../../lib/queries/user", () => ({
  useDashboardQuery: () => useDashboardQueryMock(),
}))

const useSubmitProposalMutationMock = vi.fn()
vi.mock("../../lib/queries/proposals", () => ({
  useSubmitProposalMutation: () => useSubmitProposalMutationMock(),
}))

function renderDashboard() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

import Dashboard from "./Dashboard"

beforeEach(() => {
  vi.clearAllMocks()
  useAuthMock.mockReturnValue({ user: { id: "freelancer-1" }, profile: { full_name: "Jane Doe", account_type: "freelancer" } })
  useToggleBookmarkMutationMock.mockReturnValue({ mutate: vi.fn() })
  useSubmitProposalMutationMock.mockReturnValue({ mutate: vi.fn(), isPending: false })
})

describe("Dashboard", () => {
  it("shows a loading state while the dashboard query is pending", () => {
    useDashboardQueryMock.mockReturnValue({ isLoading: true, data: undefined })
    useJobsQueryMock.mockReturnValue({ isLoading: true, data: undefined })

    renderDashboard()

    expect(screen.getByTestId("dashboard-skeleton")).toBeInTheDocument()
  })

  it("renders the stat tiles and matched jobs once data loads", async () => {
    useDashboardQueryMock.mockReturnValue({
      isLoading: false,
      data: { profile: { full_name: "Jane Doe", skills: ["React"] }, credits: 42, balance: 5000, isVerified: true },
    })
    useJobsQueryMock.mockReturnValue({
      isLoading: false,
      data: {
        jobs: [
          {
            id: "job-1",
            title: "Build a landing page",
            budget_min: 1000,
            budget_max: 2000,
            created_at: new Date().toISOString(),
            has_applied: false,
            proposals: 1,
            skills: ["React"],
            agency_info: { company_name: "Acme", logo_path: null },
          },
        ],
        totalCount: 1,
      },
    })

    renderDashboard()

    await waitFor(() => expect(screen.getByText("Build a landing page")).toBeInTheDocument())
    expect(screen.getByText("42")).toBeInTheDocument()
  })

  it("sends the job's actual bookmark state when the bookmark button is clicked", async () => {
    const mutate = vi.fn()
    useToggleBookmarkMutationMock.mockReturnValue({ mutate })
    useDashboardQueryMock.mockReturnValue({
      isLoading: false,
      data: { profile: { full_name: "Jane Doe", skills: ["React"] }, credits: 42, balance: 5000, isVerified: true },
    })
    useJobsQueryMock.mockReturnValue({
      isLoading: false,
      data: {
        jobs: [
          {
            id: "job-1",
            title: "Build a landing page",
            budget_min: 1000,
            budget_max: 2000,
            created_at: new Date().toISOString(),
            has_applied: false,
            is_bookmarked: true,
            proposals: 1,
            skills: ["React"],
            agency_info: { company_name: "Acme", logo_path: null },
          },
        ],
        totalCount: 1,
      },
    })

    renderDashboard()

    const bookmarkButton = await screen.findByRole("button", { name: "Saved" })
    fireEvent.click(bookmarkButton)

    expect(mutate).toHaveBeenCalledWith(
      { jobId: "job-1", isBookmarked: true },
      expect.objectContaining({ onError: expect.any(Function) })
    )
  })

  it("shows an error state when a query fails", async () => {
    useDashboardQueryMock.mockReturnValue({ isLoading: false, isError: true, data: undefined })
    useJobsQueryMock.mockReturnValue({ isLoading: false, isError: false, data: undefined })

    renderDashboard()

    await waitFor(() => expect(screen.getByText("Couldn't load your dashboard")).toBeInTheDocument())
  })
})
