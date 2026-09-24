import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { MemoryRouter, Routes, Route } from "react-router-dom"

const useInfluencerMeQueryMock = vi.fn()
vi.mock("../../lib/queries/influencer", () => ({ useInfluencerMeQuery: () => useInfluencerMeQueryMock() }))

let authValue: any = { profile: { account_type: "influencer" }, signOut: vi.fn() }
vi.mock("../../contexts/AuthContext", () => ({ useAuth: () => authValue }))

import InfluencerReferrals from "./Referrals"

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/influencer/referrals"]}>
      <Routes>
        <Route path="/influencer/referrals" element={<InfluencerReferrals />} />
        <Route path="/" element={<div>Landing</div>} />
      </Routes>
    </MemoryRouter>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  authValue = { profile: { account_type: "influencer" }, signOut: vi.fn() }
})

describe("InfluencerReferrals", () => {
  it("redirects a non-influencer away", () => {
    authValue = { profile: { account_type: "agency" }, signOut: vi.fn() }
    useInfluencerMeQueryMock.mockReturnValue({ isLoading: false, isError: false, data: { referrals: [] } })
    renderPage()
    expect(screen.getByText("Landing")).toBeInTheDocument()
  })

  it("shows an empty state when there are no referrals", () => {
    useInfluencerMeQueryMock.mockReturnValue({ isLoading: false, isError: false, data: { referrals: [] } })
    renderPage()
    expect(screen.getByText(/no referrals yet/i)).toBeInTheDocument()
  })

  it("lists every referral with its status, commission, and dates", () => {
    useInfluencerMeQueryMock.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        referrals: [
          { id: "r-1", referred_account_type: "agency", status: "paid", commission_kobo: 3000, created_at: "2026-01-01T00:00:00Z", qualified_at: "2026-01-05T00:00:00Z" },
          { id: "r-2", referred_account_type: null, status: "pending", commission_kobo: null, created_at: "2026-01-02T00:00:00Z", qualified_at: null },
        ],
      },
    })
    renderPage()
    expect(screen.getByText("All referrals (2)")).toBeInTheDocument()
    expect(screen.getByText("agency")).toBeInTheDocument()
    expect(screen.getByText("New user")).toBeInTheDocument()
    expect(screen.getByText("₦30")).toBeInTheDocument()
  })
})
