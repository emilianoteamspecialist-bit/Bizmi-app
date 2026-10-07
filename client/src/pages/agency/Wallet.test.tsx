import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, within } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"

const myEscrows = vi.fn()
vi.mock("@/lib/supabase", () => ({ supabase: {} }))
vi.mock("@/lib/queries/escrow", async () => {
  const actual = await vi.importActual<typeof import("@/lib/queries/escrow")>("@/lib/queries/escrow")
  return {
    ...actual,
    useMyEscrowsQuery: () => myEscrows(),
    useOpenDisputeMutation: () => ({ mutate: vi.fn(), isPending: false }),
  }
})

import Wallet from "./Wallet"

const base = {
  job_id: "job-1",
  agency_id: "agency-1",
  freelancer_id: "free-1",
  amount_kobo: 5_000_000,
  created_at: "2026-01-01T00:00:00Z",
  funded_at: "2026-01-02T00:00:00Z",
  released_at: null,
  paid_out_at: null,
  refunded_at: null,
  disputed_at: null,
  role: "agency",
  job_title: "Landing page",
  agency_name: "Acme",
  freelancer_name: "Jane",
  submission_status: null,
  open_dispute_id: null,
  latest_payout: null,
}

const renderPage = () =>
  render(
    <MemoryRouter>
      <Wallet />
    </MemoryRouter>
  )

beforeEach(() => vi.clearAllMocks())

describe("Agency payments (Wallet)", () => {
  it("totals escrows by state and lists only the agency's own, non-pending escrows", () => {
    myEscrows.mockReturnValue({
      isLoading: false,
      data: {
        escrows: [
          { ...base, id: "e1", status_v2: "funded" },
          { ...base, id: "e2", status_v2: "paid_out", amount_kobo: 2_000_000, job_title: "Logo" },
          { ...base, id: "e3", status_v2: "pending", job_title: "Not started" },
          { ...base, id: "e4", status_v2: "funded", role: "freelancer", job_title: "As freelancer" },
        ],
      },
    })
    renderPage()

    expect(screen.getByTestId("wallet-In escrow")).toHaveTextContent("₦50,000")
    expect(screen.getByTestId("wallet-Paid out")).toHaveTextContent("₦20,000")
    expect(screen.getByText("Landing page")).toBeInTheDocument()
    expect(screen.queryByText("Not started")).not.toBeInTheDocument()
    expect(screen.queryByText("As freelancer")).not.toBeInTheDocument()
    expect(within(screen.getByTestId("escrow-e1")).getByRole("link", { name: /workspace/i })).toHaveAttribute("href", "/workspace/job-1")
  })

  it("points an unpaid checkout back to the agency's jobs to complete payment", () => {
    myEscrows.mockReturnValue({ isLoading: false, data: { escrows: [{ ...base, id: "e1", status_v2: "awaiting", funded_at: null }] } })
    renderPage()
    expect(screen.getByRole("link", { name: /complete payment/i })).toHaveAttribute("href", "/agency/posts")
  })

  it("shows an empty state that leads to the agency's jobs", () => {
    myEscrows.mockReturnValue({ isLoading: false, data: { escrows: [] } })
    renderPage()
    expect(screen.getByText("Nothing in escrow yet")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /go to my jobs/i })).toHaveAttribute("href", "/agency/posts")
  })

  it("shows an error state when escrows fail to load", () => {
    myEscrows.mockReturnValue({ isLoading: false, isError: true })
    renderPage()
    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't load your payments")
  })
})
