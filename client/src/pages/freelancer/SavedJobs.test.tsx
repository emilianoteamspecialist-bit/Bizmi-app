import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

const useSavedJobsQueryMock = vi.fn()
vi.mock("../../lib/queries/jobs", () => ({
  useSavedJobsQuery: () => useSavedJobsQueryMock(),
}))

const useSubmitProposalMutationMock = vi.fn()
vi.mock("../../lib/queries/proposals", () => ({
  useSubmitProposalMutation: () => useSubmitProposalMutationMock(),
}))

const useAgencyImageQueryMock = vi.fn()
vi.mock("../../lib/queries/agencies", () => ({
  useAgencyImageQuery: (...args: unknown[]) => useAgencyImageQueryMock(...args),
}))

function renderSavedJobs() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <SavedJobs />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

import SavedJobs from "./SavedJobs"

beforeEach(() => {
  vi.clearAllMocks()
  useSubmitProposalMutationMock.mockReturnValue({ mutate: vi.fn(), isPending: false })
  useAgencyImageQueryMock.mockReturnValue({ data: undefined })
})

describe("SavedJobs", () => {
  it("shows an empty state when there are no saved jobs", async () => {
    useSavedJobsQueryMock.mockReturnValue({ isLoading: false, data: { jobs: [] } })

    renderSavedJobs()

    await waitFor(() => expect(screen.getByText("No saved jobs yet")).toBeInTheDocument())
  })

  it("renders each saved job with its agency name and budget", async () => {
    useSavedJobsQueryMock.mockReturnValue({
      isLoading: false,
      data: {
        jobs: [
          {
            id: "job-1",
            title: "Build a mobile app",
            budget: "₦ 100,000 - ₦ 200,000",
            proposals: 3,
            credit_cost: 5,
            savedAt: "1/1/2026",
            agencyInfo: { id: "agency-1", name: "Acme Co" },
          },
        ],
      },
    })

    renderSavedJobs()

    await waitFor(() => expect(screen.getByText("Build a mobile app")).toBeInTheDocument())
    expect(screen.getByText("Acme Co")).toBeInTheDocument()
  })
})
