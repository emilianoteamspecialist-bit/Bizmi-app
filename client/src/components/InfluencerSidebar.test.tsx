import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"

const signOutMock = vi.fn()
const navigateMock = vi.fn()
vi.mock("../contexts/AuthContext", () => ({ useAuth: () => ({ signOut: signOutMock }) }))
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom")
  return { ...actual, useNavigate: () => navigateMock }
})

import InfluencerSidebar from "./InfluencerSidebar"

beforeEach(() => {
  vi.clearAllMocks()
})

function renderSidebar() {
  return render(
    <MemoryRouter initialEntries={["/influencer/dashboard"]}>
      <InfluencerSidebar />
    </MemoryRouter>
  )
}

describe("InfluencerSidebar", () => {
  it("renders links to all three influencer pages", () => {
    renderSidebar()
    expect(screen.getByRole("link", { name: /dashboard/i })).toHaveAttribute("href", "/influencer/dashboard")
    expect(screen.getByRole("link", { name: /referrals/i })).toHaveAttribute("href", "/influencer/referrals")
    expect(screen.getByRole("link", { name: /earnings/i })).toHaveAttribute("href", "/influencer/earnings")
  })

  it("signs out and navigates to /login when Logout is clicked", async () => {
    const user = userEvent.setup()
    renderSidebar()
    await user.click(screen.getByRole("button", { name: /logout/i }))
    expect(signOutMock).toHaveBeenCalledOnce()
    expect(navigateMock).toHaveBeenCalledWith("/login")
  })
})
