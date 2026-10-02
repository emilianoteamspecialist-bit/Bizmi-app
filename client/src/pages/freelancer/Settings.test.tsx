import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Routes, Route } from "react-router-dom"

const updateUserMock = vi.fn()
const signOutMock = vi.fn()
vi.mock("../../lib/supabase", () => ({
  supabase: { auth: { updateUser: (...a: unknown[]) => updateUserMock(...a), signOut: (...a: unknown[]) => signOutMock(...a) } },
}))

const apiFetchMock = vi.fn()
vi.mock("../../lib/api", () => ({ apiFetch: (...args: unknown[]) => apiFetchMock(...args) }))

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

async function openDialogAndConfirmDelete() {
  const user = userEvent.setup()
  renderPage()
  await screen.findByDisplayValue("jane@x.com")

  await user.click(screen.getByRole("button", { name: /delete account/i }))
  const dialog = await screen.findByRole("dialog")
  await user.type(within(dialog).getByLabelText(/type delete to confirm/i), "DELETE")
  await user.click(within(dialog).getByRole("button", { name: /delete account/i }))
  return user
}

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

  it(
    "deletes the account via apiFetch, then signs out and navigates to / on success",
    async () => {
      apiFetchMock.mockResolvedValue({ ok: true })

      await openDialogAndConfirmDelete()

      expect(apiFetchMock).toHaveBeenCalledWith("/api/user/account", { method: "POST" })
      expect(await screen.findByText("Landing")).toBeInTheDocument()
      expect(signOutMock).toHaveBeenCalled()
    },
    120000
  )

  it(
    "does not sign out or navigate when the deletion request fails",
    async () => {
      apiFetchMock.mockRejectedValue(new Error("Your account has financial or administrative history"))

      await openDialogAndConfirmDelete()

      expect(apiFetchMock).toHaveBeenCalledWith("/api/user/account", { method: "POST" })
      expect(signOutMock).not.toHaveBeenCalled()
      expect(screen.queryByText("Landing")).not.toBeInTheDocument()
    },
    120000
  )
})
