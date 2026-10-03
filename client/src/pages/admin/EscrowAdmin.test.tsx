import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, within } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"

const transactions = vi.fn()
const analytics = vi.fn()
const disputes = vi.fn()
const resolve = vi.fn()
// The real escrow module is partially kept (formatKobo, labels); stub the
// Supabase client it imports so no env/network is needed.
vi.mock("@/lib/supabase", () => ({ supabase: {} }))
vi.mock("@/lib/queries/escrow", async () => {
  const actual = await vi.importActual<typeof import("@/lib/queries/escrow")>("@/lib/queries/escrow")
  return {
    ...actual,
    useAdminTransactionsQuery: () => transactions(),
    useAdminEscrowEventsQuery: (id: string | null) =>
      id ? { isLoading: false, data: { events: [{ id: "ev1", type: "funded", from_status: "awaiting", to_status: "funded", amount_kobo: 100, actor_type: "system", created_at: "2026-01-02T00:00:00Z" }] } } : { isLoading: false },
    useAdminAnalyticsQuery: () => analytics(),
    useAdminDisputesQuery: () => disputes(),
    useResolveDisputeMutation: () => ({ mutate: resolve, isPending: false }),
  }
})
vi.mock("@/components/AdminSidebar", () => ({ default: () => null }))

import AdminTransactions from "./Transactions"
import AdminAnalytics from "./Analytics"
import AdminDisputes from "./Disputes"

const wrap = (ui: React.ReactNode) => render(<MemoryRouter>{ui}</MemoryRouter>)

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal("confirm", vi.fn(() => true))
})

describe("AdminTransactions", () => {
  it("shows ledger totals, rows and an escrow's event history", () => {
    transactions.mockReturnValue({
      isLoading: false,
      data: {
        totals: { funded_kobo: 5_000_000, released_kobo: 0, paid_out_kobo: 0, refunded_kobo: 0, in_escrow_kobo: 5_000_000, fees_kobo: 0 },
        transactions: [
          { id: "esc-1", job_id: "job-1", agency_id: "a", freelancer_id: "f", amount_kobo: 5_000_000, status_v2: "funded", paystack_reference: "escrow_esc-1_a", created_at: "2026-01-01T00:00:00Z", job_title: "Landing page", agency_name: "Acme", freelancer_name: "Jane", payouts: [] },
        ],
      },
    })
    wrap(<AdminTransactions />)
    expect(screen.getAllByText("₦50,000").length).toBeGreaterThan(0)
    expect(screen.getByText("Landing page")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: /history for landing page/i }))
    expect(within(screen.getByTestId("events-esc-1")).getByText("funded")).toBeInTheDocument()
  })

  it("has no money-moving actions", () => {
    transactions.mockReturnValue({ isLoading: false, data: { totals: {}, transactions: [] } })
    wrap(<AdminTransactions />)
    expect(screen.queryByRole("button", { name: /payout|mark done|release/i })).not.toBeInTheDocument()
  })
})

describe("AdminAnalytics", () => {
  it("renders top freelancers and agencies in naira", () => {
    analytics.mockReturnValue({
      isLoading: false,
      data: {
        topFreelancers: [{ id: "f", name: "Jane", email: null, earned_kobo: 4_250_000, paid_jobs: 1 }],
        topAgencies: [{ id: "a", name: "Acme", email: null, funded_kobo: 5_000_000, funded_jobs: 1 }],
      },
    })
    wrap(<AdminAnalytics />)
    expect(within(screen.getByTestId("top-freelancers")).getByText("₦42,500")).toBeInTheDocument()
    expect(within(screen.getByTestId("top-agencies")).getByText("₦50,000")).toBeInTheDocument()
  })
})

describe("AdminDisputes", () => {
  const dispute = {
    id: "d-1",
    job_id: "job-1",
    initiator_id: "f",
    respondent_id: "a",
    dispute_type: "non_delivery",
    status: "admin_intervention",
    resolution_outcome: null,
    amount_disputed: 50000,
    description: "Nothing delivered",
    created_at: "2026-01-05T00:00:00Z",
    job: { title: "Landing page" },
    initiator: { full_name: "Acme" },
    respondent: { full_name: "Jane" },
  }

  it("resolves an open dispute as a refund after confirmation", () => {
    disputes.mockReturnValue({ isLoading: false, data: { disputes: [dispute], messagesByDispute: {} } })
    wrap(<AdminDisputes />)
    fireEvent.click(screen.getByRole("button", { name: /refund agency/i }))
    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining("refund ₦50,000"))
    expect(resolve).toHaveBeenCalledWith({ disputeId: "d-1", outcome: "refund" }, expect.anything())
  })

  it("shows the conversation on demand and no actions for a resolved dispute", () => {
    disputes.mockReturnValue({
      isLoading: false,
      data: {
        disputes: [{ ...dispute, status: "resolved", resolution_outcome: "full_release" }],
        messagesByDispute: { "d-1": [{ id: "m1", dispute_id: "d-1", sender_id: "f", message: "Here is proof", created_at: "2026-01-06T00:00:00Z", sender: { full_name: "Acme" } }] },
      },
    })
    wrap(<AdminDisputes />)
    expect(screen.getByText(/released to freelancer/i)).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /refund agency/i })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: /conversation \(1\)/i }))
    expect(screen.getByText("Here is proof")).toBeInTheDocument()
  })
})
