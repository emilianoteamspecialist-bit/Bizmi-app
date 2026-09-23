import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"

const useAdminInfluencersQueryMock = vi.fn()
const recordPayoutMutate = vi.fn()
const updateSettingsMutate = vi.fn()
vi.mock("../../lib/queries/admin", () => ({
  useAdminInfluencersQuery: () => useAdminInfluencersQueryMock(),
  useRecordInfluencerPayoutMutation: () => ({ mutate: recordPayoutMutate, isPending: false }),
  useUpdateInfluencerSettingsMutation: () => ({ mutate: updateSettingsMutate, isPending: false }),
}))

vi.mock("../../contexts/AuthContext", () => ({ useAuth: () => ({ signOut: vi.fn() }) }))

import AdminInfluencers from "./Influencers"

const influencer = { id: "inf-1", name: "Influencer One", email: "one@x.com", referralCode: "ABC123", socialHandle: null, referred: 5, qualified: 2, earnedNaira: 2000, unpaidNaira: 500 }

function renderPage() {
  return render(<MemoryRouter><AdminInfluencers /></MemoryRouter>)
}

beforeEach(() => {
  vi.clearAllMocks()
  useAdminInfluencersQueryMock.mockReturnValue({
    isLoading: false,
    data: { influencers: [influencer], summary: { totalUsers: 100, referred: 30, organic: 70 }, commissionPct: 10, platformFeePct: 15 },
  })
  vi.stubGlobal("confirm", vi.fn(() => true))
})

describe("AdminInfluencers", () => {
  it("shows acquisition stat tiles", () => {
    renderPage()
    expect(screen.getByText("100")).toBeInTheDocument()
    expect(screen.getByText("30")).toBeInTheDocument()
  })

  it("lists influencers with their unpaid balance", () => {
    renderPage()
    expect(screen.getByText("Influencer One")).toBeInTheDocument()
    expect(screen.getByText("ABC123")).toBeInTheDocument()
  })

  it("records a payout after confirmation", async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByRole("button", { name: /record payout/i }))
    expect(window.confirm).toHaveBeenCalled()
    expect(recordPayoutMutate).toHaveBeenCalledWith({ influencerId: "inf-1" }, expect.anything())
  })

  it("disables the payout button when unpaid balance is zero", () => {
    useAdminInfluencersQueryMock.mockReturnValue({
      isLoading: false,
      data: { influencers: [{ ...influencer, unpaidNaira: 0 }], summary: { totalUsers: 100, referred: 30, organic: 70 }, commissionPct: 10, platformFeePct: 15 },
    })
    renderPage()
    expect(screen.getByRole("button", { name: /record payout/i })).toBeDisabled()
  })

  it("saves program settings", async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByRole("button", { name: /save settings/i }))
    expect(updateSettingsMutate).toHaveBeenCalledWith({ influencer_commission_pct: 10, platform_fee_pct: 15 })
  })
})
