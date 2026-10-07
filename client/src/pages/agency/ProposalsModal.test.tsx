import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor, fireEvent, within } from "@testing-library/react"
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

const useJobEscrowQueryMock = vi.fn()
const initEscrowMutate = vi.fn()
vi.mock("@/lib/queries/escrow", () => ({
  useJobEscrowQuery: (...args: unknown[]) => useJobEscrowQueryMock(...args),
  useInitializeEscrowMutation: () => ({ mutate: initEscrowMutate, isPending: false }),
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
  useJobEscrowQueryMock.mockReturnValue({ isLoading: false, data: { escrow: null } })
})

const acceptedProposal = {
  id: "prop-1",
  job_id: "job-1",
  freelancer_id: "freelancer-1",
  proposal_text: "I can build this",
  budget: 5000,
  timeline: "2 weeks",
  attachments: null,
  status: "accepted",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  profiles: { id: "freelancer-1", full_name: "Jane Doe", bio: null, location: "Lagos", phone: null, website: null },
}

describe("ProposalsModal", () => {
  it("shows each bidder's real trust signals", async () => {
    useJobProposalsQueryMock.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        proposals: [
          { ...acceptedProposal, status: "pending", identity_verified: true, jobs_completed: 3 },
          { ...acceptedProposal, id: "prop-2", freelancer_id: "freelancer-2", status: "pending", identity_verified: false, jobs_completed: 0, profiles: { ...acceptedProposal.profiles, id: "freelancer-2", full_name: "John Smith" } },
        ],
      },
    })
    renderModal()

    const [jane, john] = await screen.findAllByRole("listitem")
    expect(within(jane).getByText("Identity verified")).toBeInTheDocument()
    expect(within(jane).getByText("3 jobs completed")).toBeInTheDocument()
    expect(within(jane).getByText("₦5,000")).toBeInTheDocument()
    expect(within(john).getByText("Identity not yet verified")).toBeInTheDocument()
    expect(within(john).getByText("No completed jobs yet")).toBeInTheDocument()
  })

  it("confirms a hire inline instead of a browser alert", async () => {
    const mutate = vi.fn((_vars: unknown, opts: any) => opts.onSuccess({ success: true }))
    useRespondToProposalMutationMock.mockReturnValue({ mutate, isPending: false })
    useJobProposalsQueryMock.mockReturnValue({ isLoading: false, isError: false, data: { proposals: [{ ...acceptedProposal, status: "pending" }] } })
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {})

    renderModal()
    fireEvent.click(await screen.findByRole("button", { name: /hire jane/i }))

    expect(await screen.findByRole("status")).toHaveTextContent(/freelancer hired/i)
    expect(alertSpy).not.toHaveBeenCalled()
    alertSpy.mockRestore()
  })

  it("funds an accepted proposal by sending the agency to Paystack checkout", async () => {
    useJobProposalsQueryMock.mockReturnValue({ isLoading: false, isError: false, data: { proposals: [acceptedProposal] } })
    const assign = vi.fn()
    vi.stubGlobal("location", { ...window.location, assign })
    initEscrowMutate.mockImplementation((_id: string, opts: any) => opts.onSuccess({ authorization_url: "https://checkout.paystack.com/x" }))

    renderModal()
    fireEvent.click(await screen.findByRole("button", { name: /fund job/i }))

    expect(initEscrowMutate).toHaveBeenCalledWith("prop-1", expect.anything())
    expect(assign).toHaveBeenCalledWith("https://checkout.paystack.com/x")
    vi.unstubAllGlobals()
  })

  it("shows Funded instead of the button once the job's escrow is funded", async () => {
    useJobProposalsQueryMock.mockReturnValue({ isLoading: false, isError: false, data: { proposals: [acceptedProposal] } })
    useJobEscrowQueryMock.mockReturnValue({ isLoading: false, data: { escrow: { id: "esc-1", status_v2: "funded", amount_kobo: 500000 } } })

    renderModal()

    expect(await screen.findByText(/funded — money is held in escrow/i)).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /fund job/i })).not.toBeInTheDocument()
  })

  it("shows an empty state when there are no proposals", async () => {
    useJobProposalsQueryMock.mockReturnValue({ isLoading: false, isError: false, data: { proposals: [] } })
    renderModal()
    await waitFor(() => expect(screen.getByText("No bids yet")).toBeInTheDocument())
  })

  it("renders a pending bid with Hire/Decline buttons", async () => {
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
    expect(screen.getByRole("button", { name: /hire jane/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /decline/i })).toBeInTheDocument()
  })

  it("calls the respond mutation with accept when Hire is clicked", async () => {
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
    const acceptButton = await screen.findByRole("button", { name: /hire jane/i })
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
