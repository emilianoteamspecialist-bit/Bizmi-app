import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"

const resetPasswordForEmailMock = vi.fn()
vi.mock("@/lib/supabase", () => ({
  supabase: { auth: { resetPasswordForEmail: (...a: unknown[]) => resetPasswordForEmailMock(...a) } },
}))

import ForgotPasswordModal from "./ForgotPasswordModal"

beforeEach(() => {
  resetPasswordForEmailMock.mockReset()
})

function submitEmail(email: string) {
  fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: email } })
  fireEvent.click(screen.getByRole("button", { name: /send reset link/i }))
}

describe("ForgotPasswordModal", () => {
  it("renders nothing when closed", () => {
    render(<ForgotPasswordModal isOpen={false} onClose={vi.fn()} />)
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("disables the submit button until an email is entered", () => {
    render(<ForgotPasswordModal isOpen onClose={vi.fn()} />)
    expect(screen.getByRole("button", { name: /send reset link/i })).toBeDisabled()
  })

  it("requests a reset email that redirects to the SPA's /reset-password page", async () => {
    resetPasswordForEmailMock.mockResolvedValue({ error: null })
    render(<ForgotPasswordModal isOpen onClose={vi.fn()} />)

    submitEmail("jane@x.com")

    await waitFor(() =>
      expect(resetPasswordForEmailMock).toHaveBeenCalledWith("jane@x.com", {
        redirectTo: `${window.location.origin}/reset-password`,
      })
    )
    expect(await screen.findByText(/password reset email sent/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/email address/i)).toHaveValue("")
  })

  it("shows the Supabase error message when the request fails", async () => {
    resetPasswordForEmailMock.mockResolvedValue({ error: { message: "Email rate limit exceeded" } })
    render(<ForgotPasswordModal isOpen onClose={vi.fn()} />)

    submitEmail("jane@x.com")

    expect(await screen.findByText("Email rate limit exceeded")).toBeInTheDocument()
  })

  it("clears state and calls onClose on Cancel", async () => {
    resetPasswordForEmailMock.mockResolvedValue({ error: { message: "Boom" } })
    const onClose = vi.fn()
    const { rerender } = render(<ForgotPasswordModal isOpen onClose={onClose} />)

    submitEmail("jane@x.com")
    await screen.findByText("Boom")

    fireEvent.click(screen.getByRole("button", { name: /cancel/i }))
    expect(onClose).toHaveBeenCalled()

    rerender(<ForgotPasswordModal isOpen onClose={onClose} />)
    expect(screen.queryByText("Boom")).not.toBeInTheDocument()
    expect(screen.getByLabelText(/email address/i)).toHaveValue("")
  })
})
