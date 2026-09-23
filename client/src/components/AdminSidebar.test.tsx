import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"

const signOutMock = vi.fn()
vi.mock("../contexts/AuthContext", () => ({ useAuth: () => ({ signOut: signOutMock }) }))

const navigateMock = vi.fn()
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom")
  return { ...actual, useNavigate: () => navigateMock }
})

beforeEach(() => vi.clearAllMocks())

describe("AdminSidebar", () => {
  it("renders every nav link", async () => {
    const { default: AdminSidebar } = await import("./AdminSidebar")
    render(<MemoryRouter><AdminSidebar /></MemoryRouter>)

    for (const name of ["Dashboard", "Transactions", "Credits", "Analytics", "Disputes", "Jobs", "Influencers", "Users", "Audit Log"]) {
      expect(screen.getByRole("link", { name })).toBeInTheDocument()
    }
  })

  it("highlights the active route", async () => {
    const { default: AdminSidebar } = await import("./AdminSidebar")
    render(<MemoryRouter initialEntries={["/admin/users"]}><AdminSidebar /></MemoryRouter>)

    expect(screen.getByRole("link", { name: "Users" })).toHaveClass("bg-primary")
    expect(screen.getByRole("link", { name: "Dashboard" })).not.toHaveClass("bg-primary")
  })

  it("signs out and navigates to /admin/login on logout", async () => {
    const { default: userEvent } = await import("@testing-library/user-event")
    const user = userEvent.setup()
    const { default: AdminSidebar } = await import("./AdminSidebar")
    render(<MemoryRouter><AdminSidebar /></MemoryRouter>)

    await user.click(screen.getByRole("button", { name: /logout/i }))

    expect(signOutMock).toHaveBeenCalled()
    expect(navigateMock).toHaveBeenCalledWith("/admin/login")
  })
})
