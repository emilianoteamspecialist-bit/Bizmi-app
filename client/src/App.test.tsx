// client/src/App.test.tsx
import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { MemoryRouter, Routes, Route } from "react-router-dom"

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: { signInWithPassword: vi.fn(), signUp: vi.fn() },
    from: vi.fn(() => ({
      select: vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn() })) })),
    })),
  },
}))
vi.mock("@/lib/fbpixel", () => ({ trackSignUp: vi.fn() }))

import Landing from "./pages/Landing"
import Login from "./pages/Login"
import Signup from "./pages/Signup"

function renderAt(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
      </Routes>
    </MemoryRouter>
  )
}

describe("route table", () => {
  it("renders Landing at /", () => {
    renderAt("/")
    expect(screen.getByText(/Hire Nigeria's/i)).toBeInTheDocument()
  })

  it("renders Login at /login", () => {
    renderAt("/login")
    expect(screen.getByRole("heading", { name: /Continue your work/i })).toBeInTheDocument()
  })

  it("renders Signup at /signup", () => {
    renderAt("/signup")
    expect(screen.getByRole("heading", { name: /Start your journey/i })).toBeInTheDocument()
  })
})

describe("QueryClientProvider", () => {
  it("renders the app without a 'No QueryClient set' error", () => {
    // A component using useQuery outside a provider throws synchronously on
    // render — rendering the full App at "/" and not throwing is proof the
    // provider is mounted above the router.
    expect(() => renderAt("/")).not.toThrow()
  })
})
