import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"

const useAdminCreditsQueryMock = vi.fn()
vi.mock("../../lib/queries/admin", () => ({ useAdminCreditsQuery: () => useAdminCreditsQueryMock() }))

vi.mock("../../contexts/AuthContext", () => ({ useAuth: () => ({ signOut: vi.fn() }) }))

import AdminCredits from "./Credits"

const purchase = { id: "p-1", credits_amount: 20, paystack_reference: "ref-1", status: "completed", created_at: "2026-01-01T00:00:00Z", freelancer_name: "Jane F" }
const freelancer = { id: "f-1", full_name: "Jane F", created_at: "2026-01-01T00:00:00Z", account_type: "freelancer" }

function renderPage() {
  return render(<MemoryRouter><AdminCredits /></MemoryRouter>)
}

beforeEach(() => {
  vi.clearAllMocks()
  useAdminCreditsQueryMock.mockReturnValue({ isLoading: false, data: { purchases: [purchase], freelancers: [freelancer], totalCredits: 20 } })
})

describe("AdminCredits", () => {
  it("shows a loading state while data is pending", () => {
    useAdminCreditsQueryMock.mockReturnValue({ isLoading: true, data: undefined })
    renderPage()
    expect(screen.getByText(/loading/i)).toBeInTheDocument()
  })

  it("shows the total credits purchased and lists transactions", () => {
    renderPage()
    // "20" and "Jane F" each legitimately appear twice on the page (the
    // total-credits stat tile vs. the transaction row's amount, and the
    // transaction row's freelancer name vs. the unfiltered freelancers
    // table below). Scope each assertion to the element it's actually
    // about instead of asserting page-wide.
    expect(within(screen.getByTestId("total-credits-value")).getByText("20")).toBeInTheDocument()
    const transactions = screen.getByTestId("transactions-table")
    expect(within(transactions).getByText("Jane F")).toBeInTheDocument()
    expect(within(transactions).getByText("ref-1")).toBeInTheDocument()
  })

  it("filters transactions by search term", async () => {
    const user = userEvent.setup()
    renderPage()
    const transactions = screen.getByTestId("transactions-table")
    await user.type(screen.getByPlaceholderText(/search transactions/i), "nonexistent")
    // Scoped to the transactions table: the freelancers table below is
    // intentionally unfiltered by this search box and still shows "Jane F".
    expect(within(transactions).queryByText("Jane F")).not.toBeInTheDocument()
  })

  it("lists registered freelancers", () => {
    renderPage()
    expect(screen.getAllByText("Jane F").length).toBeGreaterThan(0)
  })
})
