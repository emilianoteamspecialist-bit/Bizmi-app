import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { MemoryRouter, Routes, Route } from "react-router-dom"

const useInfluencerMeQueryMock = vi.fn()
vi.mock("../../lib/queries/influencer", () => ({ useInfluencerMeQuery: () => useInfluencerMeQueryMock() }))

let authValue: any = { profile: { account_type: "influencer" }, signOut: vi.fn() }
vi.mock("../../contexts/AuthContext", () => ({ useAuth: () => authValue }))

import InfluencerEarnings from "./Earnings"

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/influencer/earnings"]}>
      <Routes>
        <Route path="/influencer/earnings" element={<InfluencerEarnings />} />
        <Route path="/" element={<div>Landing</div>} />
      </Routes>
    </MemoryRouter>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  authValue = { profile: { account_type: "influencer" }, signOut: vi.fn() }
})

describe("InfluencerEarnings", () => {
  it("redirects a non-influencer away", () => {
    authValue = { profile: { account_type: "freelancer" }, signOut: vi.fn() }
    useInfluencerMeQueryMock.mockReturnValue({ isLoading: false, isError: false, data: { totals: { earnedNaira: 0, unpaidNaira: 0 }, payouts: [] } })
    renderPage()
    expect(screen.getByText("Landing")).toBeInTheDocument()
  })

  it("shows total earned, unpaid balance, and paid-out totals", () => {
    useInfluencerMeQueryMock.mockReturnValue({
      isLoading: false,
      isError: false,
      data: { totals: { earnedNaira: 500, unpaidNaira: 200, referred: 0, qualified: 0, pending: 0 }, payouts: [] },
    })
    renderPage()
    expect(screen.getByText("₦500")).toBeInTheDocument()
    expect(screen.getByText("₦200")).toBeInTheDocument()
    expect(screen.getByText("₦300")).toBeInTheDocument()
  })

  it("shows an empty state with no payouts, and lists payouts when present", () => {
    useInfluencerMeQueryMock.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        totals: { earnedNaira: 500, unpaidNaira: 0, referred: 0, qualified: 0, pending: 0 },
        payouts: [{ id: "p-1", amount_kobo: 50000, status: "paid", processed_at: "2026-01-10T00:00:00Z", note: "Manual payout" }],
      },
    })
    renderPage()
    // With earnedNaira 500 and unpaidNaira 0, "Paid out" is also 500, and the
    // payout row itself (50000 kobo) renders as ₦500 too — three legitimate,
    // distinct "₦500" nodes from this fixture. getByText requires a single
    // match, so assert the text is present at least once instead.
    expect(screen.getAllByText("₦500").length).toBeGreaterThan(0)
    expect(screen.getByText("Manual payout")).toBeInTheDocument()
  })
})
