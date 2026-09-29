import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Routes, Route } from "react-router-dom"

const getSessionMock = vi.fn()
const updateUserMock = vi.fn()
vi.mock("../lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: (...args: unknown[]) => getSessionMock(...args),
      updateUser: (...args: unknown[]) => updateUserMock(...args),
    },
  },
}))

import ResetPassword from "./ResetPassword"

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/reset-password"]}>
      <Routes>
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/login" element={<div>Login page</div>} />
      </Routes>
    </MemoryRouter>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("ResetPassword", () => {
  it("shows the invalid-link message and a working Back to Login button when there is no active session", async () => {
    getSessionMock.mockResolvedValue({ data: { session: null } })
    const user = userEvent.setup()
    renderPage()

    expect(await screen.findByText(/invalid or expired reset link/i)).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: /back to login/i }))
    expect(screen.getByText("Login page")).toBeInTheDocument()
  })

  it("rejects a password shorter than 8 characters before calling updateUser", async () => {
    getSessionMock.mockResolvedValue({ data: { session: { user: { id: "u1" } } } })
    const user = userEvent.setup()
    renderPage()
    await screen.findByLabelText(/^new password$/i)

    await user.type(screen.getByLabelText(/^new password$/i), "Ab1")
    await user.type(screen.getByLabelText(/^confirm new password$/i), "Ab1")
    await user.click(screen.getByRole("button", { name: /update password/i }))

    expect(await screen.findByText(/password must be at least 8 characters/i)).toBeInTheDocument()
    expect(updateUserMock).not.toHaveBeenCalled()
  })

  it("rejects mismatched passwords before calling updateUser", async () => {
    getSessionMock.mockResolvedValue({ data: { session: { user: { id: "u1" } } } })
    const user = userEvent.setup()
    renderPage()
    await screen.findByLabelText(/^new password$/i)

    await user.type(screen.getByLabelText(/^new password$/i), "GoodPass1")
    await user.type(screen.getByLabelText(/^confirm new password$/i), "GoodPass2")
    await user.click(screen.getByRole("button", { name: /update password/i }))

    expect(await screen.findByText(/passwords do not match/i)).toBeInTheDocument()
    expect(updateUserMock).not.toHaveBeenCalled()
  })

  it("updates the password, shows success, and navigates to /login after the delay", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    getSessionMock.mockResolvedValue({ data: { session: { user: { id: "u1" } } } })
    updateUserMock.mockResolvedValue({ error: null })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderPage()
    await screen.findByLabelText(/^new password$/i)

    await user.type(screen.getByLabelText(/^new password$/i), "GoodPass1")
    await user.type(screen.getByLabelText(/^confirm new password$/i), "GoodPass1")
    await user.click(screen.getByRole("button", { name: /update password/i }))

    expect(await screen.findByText(/password updated successfully/i)).toBeInTheDocument()
    expect(updateUserMock).toHaveBeenCalledWith({ password: "GoodPass1" })

    vi.advanceTimersByTime(2000)
    expect(await screen.findByText("Login page")).toBeInTheDocument()
    vi.useRealTimers()
  })

  it("shows the Supabase error message when updateUser fails", async () => {
    getSessionMock.mockResolvedValue({ data: { session: { user: { id: "u1" } } } })
    updateUserMock.mockResolvedValue({ error: { message: "Session expired" } })
    const user = userEvent.setup()
    renderPage()
    await screen.findByLabelText(/^new password$/i)

    await user.type(screen.getByLabelText(/^new password$/i), "GoodPass1")
    await user.type(screen.getByLabelText(/^confirm new password$/i), "GoodPass1")
    await user.click(screen.getByRole("button", { name: /update password/i }))

    expect(await screen.findByText("Session expired")).toBeInTheDocument()
  })
})
