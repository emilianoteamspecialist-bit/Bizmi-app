import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { MemoryRouter, Routes, Route } from "react-router-dom"

const disputeQuery = vi.fn()
const postMessage = vi.fn()
const verifyMutate = vi.fn()
let verifyState: Record<string, unknown> = {}
const myEscrows = vi.fn()
// The real escrow module is partially kept (formatKobo, labels); stub the
// Supabase client it imports so no env/network is needed.
vi.mock("@/lib/supabase", () => ({ supabase: {} }))
vi.mock("@/lib/queries/escrow", async () => {
  const actual = await vi.importActual<typeof import("@/lib/queries/escrow")>("@/lib/queries/escrow")
  return {
    ...actual,
    useDisputeQuery: () => disputeQuery(),
    usePostDisputeMessageMutation: () => ({ mutate: postMessage, isPending: false }),
    useRealtimeDisputeMessages: () => {},
    useVerifyEscrowMutation: () => ({ mutate: verifyMutate, isPending: false, isIdle: false, ...verifyState }),
    useMyEscrowsQuery: () => myEscrows(),
    useOpenDisputeMutation: () => ({ mutate: vi.fn(), isPending: false }),
  }
})
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "free-1" } }) }))

import DisputeRoom from "./DisputeRoom"
import EscrowReturn from "../agency/EscrowReturn"
import Wallet from "../agency/Wallet"

beforeEach(() => {
  vi.clearAllMocks()
  verifyState = {}
})

describe("DisputeRoom", () => {
  const dispute = {
    id: "d-1",
    job_id: "job-1",
    initiator_id: "free-1",
    respondent_id: "agency-1",
    dispute_type: "client_abandonment",
    status: "in_platform_review",
    resolution_outcome: null,
    amount_disputed: 50000,
    description: "No response for two weeks",
    created_at: "2026-01-05T00:00:00Z",
    job: { title: "Landing page" },
    initiator: { full_name: "Jane" },
    respondent: { full_name: "Acme" },
  }
  const renderRoom = () =>
    render(
      <MemoryRouter initialEntries={["/disputes/d-1"]}>
        <Routes>
          <Route path="/disputes/:id" element={<DisputeRoom />} />
        </Routes>
      </MemoryRouter>
    )

  it("shows the dispute, the other party and the conversation, and sends a message", () => {
    disputeQuery.mockReturnValue({
      isLoading: false,
      data: { dispute, messages: [{ id: "m1", dispute_id: "d-1", sender_id: "agency-1", message: "We were travelling", created_at: "2026-01-06T10:00:00Z", sender: { full_name: "Acme" } }] },
    })
    renderRoom()
    expect(screen.getByRole("heading", { name: "Landing page" })).toBeInTheDocument()
    expect(screen.getByText(/client abandoned the job/i)).toBeInTheDocument()
    expect(screen.getByText("We were travelling")).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText("Message"), { target: { value: "Please respond" } })
    fireEvent.click(screen.getByRole("button", { name: "Send" }))
    expect(postMessage).toHaveBeenCalledWith("Please respond", expect.anything())
  })

  it("shows the outcome and hides the composer once resolved", () => {
    disputeQuery.mockReturnValue({ isLoading: false, data: { dispute: { ...dispute, status: "resolved", resolution_outcome: "refund" }, messages: [] } })
    renderRoom()
    expect(screen.getByText(/payment refunded to the agency/i)).toBeInTheDocument()
    expect(screen.queryByLabelText("Message")).not.toBeInTheDocument()
  })
})

describe("EscrowReturn", () => {
  const renderReturn = (query: string) =>
    render(
      <MemoryRouter initialEntries={[`/agency/escrow/return${query}`]}>
        <Routes>
          <Route path="/agency/escrow/return" element={<EscrowReturn />} />
        </Routes>
      </MemoryRouter>
    )

  it("verifies the Paystack reference it was sent back with", () => {
    verifyState = { isPending: true }
    renderReturn("?trxref=escrow_esc-1_a&reference=escrow_esc-1_a")
    expect(verifyMutate).toHaveBeenCalledWith("escrow_esc-1_a")
    expect(screen.getByText(/confirming your payment/i)).toBeInTheDocument()
  })

  it("confirms a funded job", () => {
    verifyState = { data: { success: true, status: "funded" } }
    renderReturn("?reference=escrow_esc-1_a")
    expect(screen.getByText("Job funded")).toBeInTheDocument()
  })

  it("does nothing for a non-escrow reference", () => {
    renderReturn("?reference=credits_1")
    expect(verifyMutate).not.toHaveBeenCalled()
    expect(screen.getByText(/no payment to confirm/i)).toBeInTheDocument()
  })
})

describe("Wallet", () => {
  const e = (id: string, status_v2: string, amount_kobo: number, extra: Record<string, unknown> = {}) => ({
    id,
    job_id: `job-${id}`,
    agency_id: "agency-1",
    freelancer_id: "free-1",
    amount_kobo,
    status_v2,
    created_at: "2026-01-01T00:00:00Z",
    funded_at: "2026-01-02T00:00:00Z",
    role: "agency",
    job_title: `Job ${id}`,
    freelancer_name: "Jane",
    agency_name: "Acme",
    submission_status: null,
    open_dispute_id: null,
    latest_payout: null,
    ...extra,
  })
  const renderWallet = () => render(<MemoryRouter><Wallet /></MemoryRouter>)

  it("totals the agency's escrows by state", () => {
    myEscrows.mockReturnValue({
      isLoading: false,
      data: { escrows: [e("a", "funded", 1_000_00), e("b", "disputed", 2_000_00), e("c", "paid_out", 5_000_00), e("d", "refunded", 7_000_00), e("x", "funded", 9_999_00, { role: "freelancer" })] },
    })
    renderWallet()
    expect(screen.getByTestId("wallet-In escrow")).toHaveTextContent("₦3,000")
    expect(screen.getByTestId("wallet-Paid out")).toHaveTextContent("₦5,000")
    expect(screen.getByTestId("wallet-Refunded")).toHaveTextContent("₦7,000")
    expect(screen.queryByText("Job x")).not.toBeInTheDocument()
  })

  it("flags submitted work and links to the workspace", () => {
    myEscrows.mockReturnValue({ isLoading: false, data: { escrows: [e("a", "funded", 1_000_00, { submission_status: "submitted" })] } })
    renderWallet()
    expect(screen.getByText(/work submitted/i)).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /workspace/i })).toHaveAttribute("href", "/workspace/job-a")
  })
})
