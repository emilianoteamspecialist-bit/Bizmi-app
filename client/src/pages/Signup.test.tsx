import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"

vi.mock("@/lib/supabase", () => ({
  supabase: { auth: { signUp: vi.fn() } },
}))
vi.mock("@/lib/fbpixel", () => ({ trackSignUp: vi.fn() }))

beforeEach(() => {
  window.sessionStorage.clear()
})

describe("Signup", () => {
  it("starts on the account-type step and advances to details on Next", async () => {
    const { default: Signup } = await import("./Signup")
    render(
      <MemoryRouter>
        <Signup />
      </MemoryRouter>
    )

    expect(screen.getByRole("heading", { name: /Choose account type/i })).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: /Next step/i }))

    expect(screen.getByRole("heading", { name: /Personal details/i })).toBeInTheDocument()
  })

  it("shows the skills step for freelancers after details are valid", async () => {
    const { default: Signup } = await import("./Signup")
    render(
      <MemoryRouter>
        <Signup />
      </MemoryRouter>
    )

    fireEvent.click(screen.getByRole("button", { name: /Next step/i }))
    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: "Jane Doe" } })
    fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: "jane@example.com" } })
    fireEvent.change(screen.getByLabelText(/username/i), { target: { value: "janedoe" } })
    fireEvent.click(screen.getByRole("button", { name: /Next step/i }))

    expect(screen.getByRole("heading", { name: /Your expertise/i })).toBeInTheDocument()
  })
})
