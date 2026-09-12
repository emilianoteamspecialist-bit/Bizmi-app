import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor, fireEvent } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

const useJobProposalsQueryMock = vi.fn()
vi.mock("../../lib/queries/jobs", () => ({
  useJobProposalsQuery: (...args: unknown[]) => useJobProposalsQueryMock(...args),
}))

const useRespondToProposalMutationMock = vi.fn()
vi.mock("../../lib/queries/proposals", () => ({
  useRespondToProposalMutation: () => useRespondToProposalMutationMock(),
}))

const useFreelancerLogosQueryMock = vi.fn()
vi.mock("../../lib/queries/user", () => ({
  useFreelancerLogosQuery: (...args: unknown[]) => useFreelancerLogosQueryMock(...args),
}))

import ProposalsModal from "./ProposalsModal"

const job = {
  id: "job-1",
  title: "Build a landing page",
  description: "",
  budget_min: null,
  budget_max: null,
  duration: "",
  location: "",
  job_type: "",
  credit_cost: 5,
  status: "active" as const,
  skills: [],
  created_at: "2026-01-01T00:00:00Z",
  agency_id: "agency-1",
  proposals: 1,
}

function renderModal(props: Partial<React.ComponentProps<typeof ProposalsModal>> = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <ProposalsModal job={job} isOpen onClose={vi.fn()} {...props} />
    </QueryClientProvider>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  useRespondToProposalMutationMock.mockReturnValue({ mutate: vi.fn(), isPending: false })
  useFreelancerLogosQueryMock.mockReturnValue({ data: { logos: {} } })
})

describe("ProposalsModal", () => {
  it("shows an empty state when there are no proposals", async () => {
    useJobProposalsQueryMock.mockReturnValue({ isLoading: false, isError: false, data: { proposals: [] } })
    renderModal()
    await waitFor(() => expect(screen.getByText("No Proposals Yet")).toBeInTheDocument())
  })

  it("renders a pending proposal with Accept/Reject buttons", async () => {
    useJobProposalsQueryMock.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        proposals: [
          {
            id: "prop-1",
            job_id: "job-1",
            freelancer_id: "freelancer-1",
            proposal_text: "I can build this",
            budget: 5000,
            timeline: "2 weeks",
            attachments: null,
            status: "pending",
            created_at: "2026-01-01T00:00:00Z",
            updated_at: "2026-01-01T00:00:00Z",
            profiles: { id: "freelancer-1", full_name: "Jane Doe", bio: null, location: "Lagos", phone: null, website: null },
          },
        ],
      },
    })

    renderModal()

    await waitFor(() => expect(screen.getByText("Jane Doe")).toBeInTheDocument())
    expect(screen.getByRole("button", { name: /accept/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /reject/i })).toBeInTheDocument()
  })

  it("calls the respond mutation with accept when Accept is clicked", async () => {
    const mutate = vi.fn()
    useRespondToProposalMutationMock.mockReturnValue({ mutate, isPending: false })
    useJobProposalsQueryMock.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        proposals: [
          {
            id: "prop-1",
            job_id: "job-1",
            freelancer_id: "freelancer-1",
            proposal_text: "I can build this",
            budget: 5000,
            timeline: "2 weeks",
            attachments: null,
            status: "pending",
            created_at: "2026-01-01T00:00:00Z",
            updated_at: "2026-01-01T00:00:00Z",
            profiles: { id: "freelancer-1", full_name: "Jane Doe", bio: null, location: "Lagos", phone: null, website: null },
          },
        ],
      },
    })

    renderModal()
    const acceptButton = await screen.findByRole("button", { name: /accept/i })
    acceptButton.click()

    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({ proposalId: "prop-1", jobId: "job-1", action: "accept" }),
      expect.anything()
    )
  })

  it("filters proposals by the search term (freelancer name)", async () => {
    useJobProposalsQueryMock.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        proposals: [
          {
            id: "prop-1",
            job_id: "job-1",
            freelancer_id: "freelancer-1",
            proposal_text: "text",
            budget: null,
            timeline: null,
            attachments: null,
            status: "pending",
            created_at: "2026-01-01T00:00:00Z",
            updated_at: "2026-01-01T00:00:00Z",
            profiles: { id: "freelancer-1", full_name: "Jane Doe", bio: null, location: null, phone: null, website: null },
          },
          {
            id: "prop-2",
            job_id: "job-1",
            freelancer_id: "freelancer-2",
            proposal_text: "text",
            budget: null,
            timeline: null,
            attachments: null,
            status: "pending",
            created_at: "2026-01-01T00:00:00Z",
            updated_at: "2026-01-01T00:00:00Z",
            profiles: { id: "freelancer-2", full_name: "John Smith", bio: null, location: null, phone: null, website: null },
          },
        ],
      },
    })

    renderModal()
    await waitFor(() => expect(screen.getByText("Jane Doe")).toBeInTheDocument())

    const searchInput = screen.getByPlaceholderText(/search freelancers/i)
    fireEvent.focus(searchInput)
    fireEvent.change(searchInput, { target: { value: "Jane" } })

    await waitFor(() => {
      expect(screen.getByText("Jane Doe")).toBeInTheDocument()
      expect(screen.queryByText("John Smith")).not.toBeInTheDocument()
    })
  })
})
