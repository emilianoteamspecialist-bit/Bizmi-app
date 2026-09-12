import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

const useAuthMock = vi.fn()
vi.mock("../../contexts/AuthContext", () => ({ useAuth: () => useAuthMock() }))

const useAgencyJobsQueryMock = vi.fn()
const useUpdateJobStatusMutationMock = vi.fn()
vi.mock("../../lib/queries/jobs", () => ({
  useAgencyJobsQuery: () => useAgencyJobsQueryMock(),
  useUpdateJobStatusMutation: () => useUpdateJobStatusMutationMock(),
}))

vi.mock("./PostJobModal", () => ({ default: () => null }))
vi.mock("./ProposalsModal", () => ({ default: () => null }))

import AgencyDashboard from "./Dashboard"

function renderDashboard() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <AgencyDashboard />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  useAuthMock.mockReturnValue({ user: { id: "agency-1" }, profile: { company_name: "Acme Co", account_type: "agency" } })
  useUpdateJobStatusMutationMock.mockReturnValue({ mutate: vi.fn(), isPending: false })
})

describe("AgencyDashboard", () => {
  it("shows a loading state while the agency jobs query is pending", () => {
    useAgencyJobsQueryMock.mockReturnValue({ isLoading: true, data: undefined })
    renderDashboard()
    expect(screen.getByTestId("agency-dashboard-skeleton")).toBeInTheDocument()
  })

  it("renders stat tiles and the jobs list once data loads", async () => {
    useAgencyJobsQueryMock.mockReturnValue({
      isLoading: false,
      data: {
        jobs: [
          {
            id: "job-1",
            title: "Build a landing page",
            description: "A landing page",
            budget_min: 100000,
            budget_max: 200000,
            duration: "2 weeks",
            location: "Lagos",
            job_type: "Remote",
            credit_cost: 5,
            status: "active",
            skills: ["React"],
            created_at: "2026-01-01T00:00:00Z",
            agency_id: "agency-1",
            proposals: 3,
          },
        ],
      },
    })

    renderDashboard()

    await waitFor(() => expect(screen.getByText("Build a landing page")).toBeInTheDocument())
    expect(screen.getByText("Acme Co")).toBeInTheDocument()
  })

  it("shows the empty state and a Post a job button when there are no jobs", async () => {
    useAgencyJobsQueryMock.mockReturnValue({ isLoading: false, isError: false, data: { jobs: [] } })
    renderDashboard()
    await waitFor(() => expect(screen.getByText("No jobs yet")).toBeInTheDocument())
  })

  it("shows an error state instead of the empty state when the jobs query fails", async () => {
    useAgencyJobsQueryMock.mockReturnValue({ isLoading: false, isError: true, data: undefined })
    renderDashboard()
    await waitFor(() => expect(screen.getByText("Couldn't load your hiring desk")).toBeInTheDocument())
    expect(screen.queryByText("No jobs yet")).not.toBeInTheDocument()
  })
})
