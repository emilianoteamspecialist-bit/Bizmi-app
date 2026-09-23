import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
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
    expect(screen.getByText("20")).toBeInTheDocument()
    expect(screen.getByText("Jane F")).toBeInTheDocument()
    expect(screen.getByText("ref-1")).toBeInTheDocument()
  })

  it("filters transactions by search term", async () => {
    const user = userEvent.setup()
    renderPage()
    await user.type(screen.getByPlaceholderText(/search transactions/i), "nonexistent")
    expect(screen.queryByText("Jane F")).not.toBeInTheDocument()
  })

  it("lists registered freelancers", () => {
    renderPage()
    expect(screen.getAllByText("Jane F").length).toBeGreaterThan(0)
  })
})
