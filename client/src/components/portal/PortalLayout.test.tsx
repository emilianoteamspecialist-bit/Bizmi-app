import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, within, fireEvent } from "@testing-library/react"
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom"

let authValue: any
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => authValue }))
vi.mock("../../contexts/AuthContext", () => ({ useAuth: () => authValue }))
vi.mock("../ReferralSync", () => ({ default: () => null }))
const shell = vi.fn()
vi.mock("@/lib/queries/shell", () => ({ useShellQuery: (role: string) => shell(role) }))

import PortalLayout from "./PortalLayout"

function Where() {
  const { pathname, search } = useLocation()
  return <div data-testid="where">{pathname + search}</div>
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<PortalLayout />}>
          <Route path="/agency/*" element={<Where />} />
          <Route path="/freelancer/*" element={<Where />} />
        </Route>
        <Route path="/login" element={<div>Login page</div>} />
      </Routes>
    </MemoryRouter>
  )
}

const mainNav = () => screen.getAllByRole("navigation", { name: "Main" })[0]

beforeEach(() => {
  vi.clearAllMocks()
  authValue = { user: { id: "u1", email: "tee@x.com" }, profile: { full_name: "Tee Dev", account_type: "agency" }, loading: false, signOut: vi.fn() }
  shell.mockReturnValue({ data: { avatar: null, unreadCount: 3, recentUnread: [], credits: null } })
})

describe("PortalLayout / MarketplaceHeader", () => {
  it("gives agencies their marketplace nav, freelancer search and a Post a Job action", () => {
    renderAt("/agency/dashboard")
    const nav = mainNav()
    expect(within(nav).getByRole("link", { name: "Find Talent" })).toHaveAttribute("href", "/agency/find-freelancers")
    expect(within(nav).getByRole("link", { name: "My Jobs" })).toHaveAttribute("href", "/agency/posts")
    expect(within(nav).getByRole("link", { name: "Payments" })).toHaveAttribute("href", "/agency/wallet")
    expect(within(nav).getByRole("link", { name: /Messages/ })).toHaveAttribute("href", "/agency/messages")
    expect(screen.getByRole("searchbox", { name: "Search freelancers" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /post a job/i })).toBeInTheDocument()
    expect(screen.queryByRole("link", { name: "Saved jobs" })).not.toBeInTheDocument()
    expect(shell).toHaveBeenCalledWith("agency")
  })

  it("gives freelancers job-focused nav, saved jobs and their credit balance", () => {
    shell.mockReturnValue({ data: { avatar: null, unreadCount: 0, recentUnread: [], credits: 12 } })
    renderAt("/freelancer/dashboard")
    const nav = mainNav()
    expect(within(nav).getByRole("link", { name: "Find Work" })).toHaveAttribute("href", "/freelancer/marketplace")
    expect(within(nav).getByRole("link", { name: "My Jobs" })).toHaveAttribute("href", "/freelancer/funded-jobs")
    expect(within(nav).getByRole("link", { name: "Proposals" })).toHaveAttribute("href", "/freelancer/proposals")
    expect(screen.getByRole("link", { name: "Saved jobs" })).toHaveAttribute("href", "/freelancer/saved-jobs")
    expect(screen.getByRole("link", { name: /12 credits/ })).toHaveAttribute("href", "/freelancer/bizpal")
    expect(screen.queryByRole("button", { name: /post a job/i })).not.toBeInTheDocument()
  })

  it("marks the current section active and shows the unread count on Messages", () => {
    renderAt("/agency/posts")
    const nav = mainNav()
    expect(within(nav).getByRole("link", { name: "My Jobs" })).toHaveAttribute("aria-current", "page")
    expect(within(nav).getByLabelText("3 unread")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Notifications, 3 unread" })).toBeInTheDocument()
  })

  it("sends a header search to the role's search page with ?q=", () => {
    renderAt("/freelancer/dashboard")
    const box = screen.getByRole("searchbox", { name: "Search jobs" })
    fireEvent.change(box, { target: { value: "flutter dev" } })
    fireEvent.submit(box.closest("form")!)
    expect(screen.getByTestId("where")).toHaveTextContent("/freelancer/marketplace?q=flutter%20dev")
  })

  it("redirects to login when signed out", () => {
    authValue = { user: null, profile: null, loading: false, signOut: vi.fn() }
    renderAt("/agency/dashboard")
    expect(screen.getByText("Login page")).toBeInTheDocument()
  })
})
