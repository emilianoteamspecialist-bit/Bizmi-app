import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"

const useAdminAuditQueryMock = vi.fn()
vi.mock("../../lib/queries/admin", () => ({ useAdminAuditQuery: () => useAdminAuditQueryMock() }))

const signOutMock = vi.fn()
vi.mock("../../contexts/AuthContext", () => ({ useAuth: () => ({ signOut: signOutMock }) }))

import AdminAuditLog from "./AuditLog"

const entry = {
  id: "log-1",
  action: "user.disable",
  target_type: "user",
  target_id: "u-2",
  details: { note: "spam" },
  created_at: "2026-01-01T00:00:00Z",
  admin: { full_name: "Admin One", email: "admin1@bizimi.com" },
}

function renderPage() {
  return render(<MemoryRouter><AdminAuditLog /></MemoryRouter>)
}

beforeEach(() => {
  vi.clearAllMocks()
  useAdminAuditQueryMock.mockReturnValue({ isLoading: false, data: { logs: [entry] } })
})

describe("AdminAuditLog", () => {
  it("shows an empty state when there are no entries", () => {
    useAdminAuditQueryMock.mockReturnValue({ isLoading: false, data: { logs: [] } })
    renderPage()
    expect(screen.getByText(/no audit entries yet/i)).toBeInTheDocument()
  })

  it("lists entries with the acting admin's name", () => {
    renderPage()
    expect(screen.getByText("Admin One")).toBeInTheDocument()
    expect(screen.getByText("user.disable")).toBeInTheDocument()
  })

  it("filters by search term across action, admin, and target", async () => {
    const user = userEvent.setup()
    renderPage()
    await user.type(screen.getByPlaceholderText(/search action, admin, target/i), "nonexistent")
    expect(screen.queryByText("Admin One")).not.toBeInTheDocument()
  })
})
