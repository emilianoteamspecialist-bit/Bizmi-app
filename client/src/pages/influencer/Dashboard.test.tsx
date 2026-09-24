import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Routes, Route } from "react-router-dom"

const useInfluencerMeQueryMock = vi.fn()
vi.mock("../../lib/queries/influencer", () => ({ useInfluencerMeQuery: () => useInfluencerMeQueryMock() }))

let authValue: any = { profile: { account_type: "influencer" }, signOut: vi.fn() }
vi.mock("../../contexts/AuthContext", () => ({ useAuth: () => authValue }))

import InfluencerDashboard from "./Dashboard"

const writeText = vi.fn().mockResolvedValue(undefined)
Object.assign(navigator, { clipboard: { writeText } })

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/influencer/dashboard"]}>
      <Routes>
        <Route path="/influencer/dashboard" element={<InfluencerDashboard />} />
        <Route path="/" element={<div>Landing</div>} />
      </Routes>
    </MemoryRouter>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  writeText.mockClear()
  authValue = { profile: { account_type: "influencer" }, signOut: vi.fn() }
})

describe("InfluencerDashboard", () => {
  it("shows a loading state while the query is pending", () => {
    useInfluencerMeQueryMock.mockReturnValue({ isLoading: true, isError: false, data: undefined })
    renderPage()
    expect(screen.getByText(/loading/i)).toBeInTheDocument()
  })

  it("shows an error state when the query fails", () => {
    useInfluencerMeQueryMock.mockReturnValue({ isLoading: false, isError: true, data: undefined })
    renderPage()
    expect(screen.getByText(/couldn't load your dashboard/i)).toBeInTheDocument()
  })

  it("redirects a non-influencer away", () => {
    authValue = { profile: { account_type: "freelancer" }, signOut: vi.fn() }
    useInfluencerMeQueryMock.mockReturnValue({
      isLoading: false,
      isError: false,
      data: { referralCode: "abc123", displayName: null, socialHandle: null, totals: { referred: 0, qualified: 0, pending: 0, earnedNaira: 0, unpaidNaira: 0 }, referrals: [], payouts: [] },
    })
    renderPage()
    expect(screen.getByText("Landing")).toBeInTheDocument()
  })

  it("shows the referral link and copies it on click", async () => {
    const user = userEvent.setup()
    // userEvent.setup() installs its own navigator.clipboard stub (via
    // attachClipboardStubToView), overriding the module-level Object.assign
    // mock above. Reclaim the property so writeText assertions below hit
    // our spy rather than user-event's internal stub.
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } })
    useInfluencerMeQueryMock.mockReturnValue({
      isLoading: false,
      isError: false,
      data: { referralCode: "abc123", displayName: null, socialHandle: null, totals: { referred: 3, qualified: 1, pending: 2, earnedNaira: 50, unpaidNaira: 20 }, referrals: [], payouts: [] },
    })
    renderPage()

    expect(screen.getByText(/\/signup\?ref=abc123/)).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: /copy link/i }))
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining("/signup?ref=abc123"))
    expect(await screen.findByRole("button", { name: /copied/i })).toBeInTheDocument()
  })

  it("shows the 'being set up' placeholder when there is no referral code yet", () => {
    useInfluencerMeQueryMock.mockReturnValue({
      isLoading: false,
      isError: false,
      data: { referralCode: null, displayName: null, socialHandle: null, totals: { referred: 0, qualified: 0, pending: 0, earnedNaira: 0, unpaidNaira: 0 }, referrals: [], payouts: [] },
    })
    renderPage()
    expect(screen.getByText(/being set up/i)).toBeInTheDocument()
  })

  it("shows recent referrals when present, and an empty state when there are none", () => {
    useInfluencerMeQueryMock.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        referralCode: "abc123",
        displayName: null,
        socialHandle: null,
        totals: { referred: 1, qualified: 0, pending: 1, earnedNaira: 0, unpaidNaira: 0 },
        referrals: [{ id: "r-1", referred_account_type: "freelancer", status: "pending", commission_kobo: null, created_at: "2026-01-01T00:00:00Z", qualified_at: null }],
        payouts: [],
      },
    })
    renderPage()
    expect(screen.getByText("freelancer")).toBeInTheDocument()
    expect(screen.getByText("pending")).toBeInTheDocument()
  })
})
