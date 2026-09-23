import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"

const navigateMock = vi.fn()
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom")
  return { ...actual, useNavigate: () => navigateMock }
})

const signInWithPasswordMock = vi.fn()
const signOutMock = vi.fn()
const singleMock = vi.fn()
vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: { signInWithPassword: (...args: unknown[]) => signInWithPasswordMock(...args), signOut: (...args: unknown[]) => signOutMock(...args) },
    from: vi.fn(() => ({ select: vi.fn(() => ({ eq: vi.fn(() => ({ single: singleMock })) })) })),
  },
}))

import AdminLogin from "./Login"

beforeEach(() => vi.clearAllMocks())

function renderPage() {
  return render(<MemoryRouter><AdminLogin /></MemoryRouter>)
}

async function submit(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/email/i), "admin@bizimi.com")
  await user.type(screen.getByLabelText(/password/i), "hunter2")
  await user.click(screen.getByRole("button", { name: /sign in/i }))
}

describe("AdminLogin", () => {
  it("signs in and navigates to /admin/dashboard when the profile is an admin", async () => {
    const user = userEvent.setup()
    signInWithPasswordMock.mockResolvedValue({ data: { user: { id: "admin-1" } }, error: null })
    singleMock.mockResolvedValue({ data: { role: "admin" }, error: null })
    renderPage()

    await submit(user)

    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith("/admin/dashboard"))
    expect(signOutMock).not.toHaveBeenCalled()
  })

  it("signs the user back out and shows an error when the profile is not an admin", async () => {
    const user = userEvent.setup()
    signInWithPasswordMock.mockResolvedValue({ data: { user: { id: "u-2" } }, error: null })
    singleMock.mockResolvedValue({ data: { role: "freelancer" }, error: null })
    renderPage()

    await submit(user)

    await waitFor(() => expect(signOutMock).toHaveBeenCalled())
    expect(screen.getByText(/access denied/i)).toBeInTheDocument()
    expect(navigateMock).not.toHaveBeenCalled()
  })

  it("shows the auth error message when sign-in fails", async () => {
    const user = userEvent.setup()
    // Real Supabase AuthError instances extend Error — mock as a real Error, not a
    // plain {message} object, so it actually exercises the `err instanceof Error`
    // branch in the component (a plain object would silently fall through to the
    // generic fallback message and this test would be asserting dead code).
    signInWithPasswordMock.mockResolvedValue({ data: { user: null }, error: new Error("Invalid login credentials") })
    renderPage()

    await submit(user)

    await waitFor(() => expect(screen.getByText("Invalid login credentials")).toBeInTheDocument())
    expect(navigateMock).not.toHaveBeenCalled()
  })
})
