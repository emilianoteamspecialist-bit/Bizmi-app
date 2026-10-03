import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"

const navigateMock = vi.fn()
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom")
  return { ...actual, useNavigate: () => navigateMock }
})

const signInMock = vi.fn()
const singleMock = vi.fn()
vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: { signInWithPassword: signInMock },
    from: vi.fn(() => ({
      select: vi.fn(() => ({ eq: vi.fn(() => ({ single: singleMock })) })),
    })),
  },
}))

beforeEach(() => {
  navigateMock.mockClear()
  signInMock.mockReset()
  singleMock.mockReset()
})

describe("Login", () => {
  it("navigates to the agency dashboard after a successful agency sign-in", async () => {
    signInMock.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null })
    singleMock.mockResolvedValue({ data: { account_type: "agency" }, error: null })

    const { default: Login } = await import("./Login")
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    )

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "a@b.com" } })
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "secret123" } })
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }))

    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith("/agency/dashboard"))
  })

  it("opens the forgot-password modal from the Forgot? link", async () => {
    const { default: Login } = await import("./Login")
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    )

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: /forgot\?/i }))
    expect(screen.getByRole("dialog", { name: /reset password/i })).toBeInTheDocument()
  })
})
