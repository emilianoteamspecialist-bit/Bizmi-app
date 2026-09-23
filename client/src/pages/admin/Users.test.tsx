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

  // Note: opening this Radix DropdownMenu goes through userEvent's real pointerdown
  // dispatch (assertPointerEvents + DismissableLayer/RovingFocusGroup setup), which
  // is measured to take ~30-40s per click in this repo's jsdom + Windows environment
  // (confirmed via isolated timing: NOT an infinite hang, not fixed by
  // pointerEventsCheck/delay tuning or silencing console — see task-4-report.md).
  // Each of these tests performs two such clicks, so they need a generous timeout.
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
  }, 120000)

  it("does not call the mutation if the confirmation is declined", async () => {
    vi.stubGlobal("confirm", vi.fn(() => false))
    const user = userEvent.setup()
    renderPage()

    await user.click(within(screen.getByTestId("user-row-f-1")).getByRole("button"))
    await user.click(screen.getByText("Disable user"))

    expect(disableMutate).not.toHaveBeenCalled()
  }, 120000)
})
