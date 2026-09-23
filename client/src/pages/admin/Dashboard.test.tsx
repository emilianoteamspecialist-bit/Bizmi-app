import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"

const useAdminUsersQueryMock = vi.fn()
vi.mock("../../lib/queries/admin", () => ({ useAdminUsersQuery: () => useAdminUsersQueryMock() }))

const signOutMock = vi.fn()
vi.mock("../../contexts/AuthContext", () => ({ useAuth: () => ({ signOut: signOutMock }) }))

import AdminDashboard from "./Dashboard"

const agency = { id: "a-1", email: "a@x.com", full_name: "Acme Agency", account_type: "agency", created_at: "2026-01-01T00:00:00Z", wallet_balance: 5000 }
const freelancer = { id: "f-1", email: "f@x.com", full_name: "Jane Freelancer", account_type: "freelancer", created_at: "2026-01-02T00:00:00Z", wallet_balance: null }

function renderPage() {
  return render(<MemoryRouter><AdminDashboard /></MemoryRouter>)
}

beforeEach(() => {
  vi.clearAllMocks()
  useAdminUsersQueryMock.mockReturnValue({ isLoading: false, data: { users: [agency, freelancer] } })
})

describe("AdminDashboard", () => {
  it("shows a loading state while users are pending", () => {
    useAdminUsersQueryMock.mockReturnValue({ isLoading: true, data: undefined })
    renderPage()
    expect(screen.getByText(/loading dashboard/i)).toBeInTheDocument()
  })

  it("shows stat tiles derived from the users list", () => {
    renderPage()
    expect(within(screen.getByTestId("stat-total-users")).getByText("2")).toBeInTheDocument()
    expect(within(screen.getByTestId("stat-agencies")).getByText("1")).toBeInTheDocument()
    expect(within(screen.getByTestId("stat-freelancers")).getByText("1")).toBeInTheDocument()
  })

  it("lists all users in the All tab", () => {
    renderPage()
    expect(screen.getByText("Acme Agency")).toBeInTheDocument()
    expect(screen.getByText("Jane Freelancer")).toBeInTheDocument()
  })

  it("filters the All tab by search term", async () => {
    const user = userEvent.setup()
    renderPage()
    await user.type(screen.getByPlaceholderText(/search all users/i), "Jane")
    expect(screen.queryByText("Acme Agency")).not.toBeInTheDocument()
    expect(screen.getByText("Jane Freelancer")).toBeInTheDocument()
  })
})
