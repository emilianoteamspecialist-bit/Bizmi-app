import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, within } from "@testing-library/react"
import { MemoryRouter, Routes, Route } from "react-router-dom"

let authValue: any
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => authValue }))
vi.mock("../../contexts/AuthContext", () => ({ useAuth: () => authValue }))
vi.mock("../ReferralSync", () => ({ default: () => null }))
const shell = vi.fn()
vi.mock("@/lib/queries/shell", () => ({ useShellQuery: (role: string) => shell(role) }))

import PortalLayout from "./PortalLayout"

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<PortalLayout />}>
          <Route path="/agency/dashboard" element={<div>Agency page</div>} />
          <Route path="/freelancer/dashboard" element={<div>Freelancer page</div>} />
        </Route>
        <Route path="/login" element={<div>Login page</div>} />
      </Routes>
    </MemoryRouter>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  authValue = { user: { id: "u1", email: "tee@x.com" }, profile: { full_name: "Tee Dev", account_type: "agency" }, loading: false, signOut: vi.fn() }
  shell.mockReturnValue({ data: { avatar: null, unreadCount: 3, recentUnread: [] } })
})

describe("PortalLayout", () => {
  it("wraps agency pages in the agency sidebar and top bar", () => {
    renderAt("/agency/dashboard")
    expect(screen.getByText("Agency page")).toBeInTheDocument()
    const nav = screen.getByRole("list", { name: /agency navigation/i })
    for (const name of ["Dashboard", "Marketplace", "Messages", "My Posts", "Wallet"]) {
      expect(within(nav).getByRole("link", { name: new RegExp(name) })).toBeInTheDocument()
    }
    expect(within(nav).getByRole("link", { name: /wallet/i })).toHaveAttribute("href", "/agency/wallet")
    expect(screen.getByRole("button", { name: /post a job/i })).toBeInTheDocument()
    expect(screen.getByRole("textbox", { name: "Search" })).toHaveAttribute("placeholder", "Search freelancers, skills, talent")
    expect(shell).toHaveBeenCalledWith("agency")
  })

  it("marks the current page active and shows the unread-message badge", () => {
    renderAt("/agency/dashboard")
    const nav = screen.getByRole("list", { name: /agency navigation/i })
    expect(within(nav).getByRole("link", { name: /dashboard/i })).toHaveAttribute("data-active", "true")
    expect(within(nav).getByRole("link", { name: /messages/i })).toHaveTextContent("3")
  })

  it("picks the portal from the URL, not the profile (freelancer nav on /freelancer)", () => {
    renderAt("/freelancer/dashboard")
    const nav = screen.getByRole("list", { name: /freelancer navigation/i })
    expect(within(nav).getByRole("link", { name: /funded jobs/i })).toHaveAttribute("href", "/freelancer/funded-jobs")
    expect(screen.getByRole("button", { name: /top up credits/i })).toBeInTheDocument()
    expect(shell).toHaveBeenCalledWith("freelancer")
  })

  it("redirects to login when signed out", () => {
    authValue = { user: null, profile: null, loading: false, signOut: vi.fn() }
    renderAt("/agency/dashboard")
    expect(screen.getByText("Login page")).toBeInTheDocument()
  })
})
