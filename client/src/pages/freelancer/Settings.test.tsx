import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Routes, Route } from "react-router-dom"

const updateUserMock = vi.fn()
vi.mock("../../lib/supabase", () => ({ supabase: { auth: { updateUser: (...a: unknown[]) => updateUserMock(...a) } } }))

let authValue: any = { user: { id: "u1", email: "jane@x.com" }, loading: false, signOut: vi.fn() }
vi.mock("../../contexts/AuthContext", () => ({ useAuth: () => authValue }))

vi.stubGlobal("fetch", vi.fn())
vi.stubGlobal("alert", vi.fn())

import Settings from "./Settings"

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/freelancer/settings"]}>
      <Routes>
        <Route path="/freelancer/settings" element={<Settings />} />
        <Route path="/login" element={<div>Login page</div>} />
        <Route path="/" element={<div>Landing</div>} />
      </Routes>
    </MemoryRouter>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  authValue = { user: { id: "u1", email: "jane@x.com" }, loading: false, signOut: vi.fn() }
})

describe("Settings", () => {
  it("redirects to /login when there is no authenticated user", async () => {
    authValue = { user: null, loading: false, signOut: vi.fn() }
    renderPage()
    expect(await screen.findByText("Login page")).toBeInTheDocument()
  })

  it("pre-fills the email field from the authenticated user", async () => {
    renderPage()
    expect(await screen.findByDisplayValue("jane@x.com")).toBeInTheDocument()
  })

  it("updates the email via supabase.auth.updateUser on Update Account", async () => {
    updateUserMock.mockResolvedValue({ error: null })
    const user = userEvent.setup()
    renderPage()
    await screen.findByDisplayValue("jane@x.com")

    await user.click(screen.getByRole("button", { name: /update account/i }))
    expect(updateUserMock).toHaveBeenCalledWith({ email: "jane@x.com" })
  })

  it("shows the Delete Account control in the Danger Zone", async () => {
    renderPage()
    expect(await screen.findByRole("button", { name: /delete account/i })).toBeInTheDocument()
  })
})
