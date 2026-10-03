import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"

const useAdminUsersQueryMock = vi.fn()
const disableMutate = vi.fn()
vi.mock("../../lib/queries/admin", () => ({
  useAdminUsersQuery: () => useAdminUsersQueryMock(),
  useDisableUserMutation: () => ({ mutate: disableMutate, isPending: false }),
}))

const signOutMock = vi.fn()
vi.mock("../../contexts/AuthContext", () => ({ useAuth: () => ({ signOut: signOutMock }) }))

import AdminUsers from "./Users"

const agency = { id: "a-1", email: "a@x.com", full_name: "Acme Agency", account_type: "agency", created_at: "2026-01-01T00:00:00Z", wallet_balance: 5000 }
const freelancer = { id: "f-1", email: "f@x.com", full_name: "Jane Freelancer", account_type: "freelancer", created_at: "2026-01-02T00:00:00Z", wallet_balance: null }

function renderPage() {
  return render(<MemoryRouter><AdminUsers /></MemoryRouter>)
}

beforeEach(() => {
  vi.clearAllMocks()
  useAdminUsersQueryMock.mockReturnValue({ isLoading: false, data: { users: [agency, freelancer] } })
  vi.stubGlobal("confirm", vi.fn(() => true))
  vi.stubGlobal("alert", vi.fn())
})

describe("AdminUsers", () => {
  it("shows a loading state while users are pending", () => {
    useAdminUsersQueryMock.mockReturnValue({ isLoading: true, data: undefined })
    renderPage()
    expect(screen.getByText(/loading users/i)).toBeInTheDocument()
  })

  it("lists users grouped into tabs by account type", () => {
    renderPage()
    expect(screen.getByRole("tab", { name: /all \(2\)/i })).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: /agencies \(1\)/i })).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: /freelancers \(1\)/i })).toBeInTheDocument()
  })

  it("disables a user after confirmation, via the real mutation", async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(within(screen.getByTestId("user-row-f-1")).getByRole("button"))
    await user.click(screen.getByText("Disable user"))

    expect(window.confirm).toHaveBeenCalled()
    expect(disableMutate).toHaveBeenCalledWith(
      { userId: "f-1", disabled: true },
      expect.objectContaining({ onSuccess: expect.any(Function), onError: expect.any(Function) })
    )
  })

  it("does not call the mutation if the confirmation is declined", async () => {
    vi.stubGlobal("confirm", vi.fn(() => false))
    const user = userEvent.setup()
    renderPage()

    await user.click(within(screen.getByTestId("user-row-f-1")).getByRole("button"))
    await user.click(screen.getByText("Disable user"))

    expect(disableMutate).not.toHaveBeenCalled()
  })
})
