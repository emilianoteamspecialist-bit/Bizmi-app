import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { MemoryRouter, Routes, Route } from "react-router-dom"
import RequireAuth from "./RequireAuth"

const useAuthMock = vi.fn()
vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => useAuthMock(),
}))

function renderAt(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/login" element={<div>login page</div>} />
        <Route
          path="/protected"
          element={
            <RequireAuth>
              <div>secret content</div>
            </RequireAuth>
          }
        />
      </Routes>
    </MemoryRouter>
  )
}

describe("RequireAuth", () => {
  it("shows nothing (no redirect) while auth is still loading", () => {
    useAuthMock.mockReturnValue({ user: null, loading: true })
    renderAt("/protected")
    expect(screen.queryByText("secret content")).not.toBeInTheDocument()
    expect(screen.queryByText("login page")).not.toBeInTheDocument()
  })

  it("redirects to /login when there is no user", () => {
    useAuthMock.mockReturnValue({ user: null, loading: false })
    renderAt("/protected")
    expect(screen.getByText("login page")).toBeInTheDocument()
  })

  it("renders children when a user is present", () => {
    useAuthMock.mockReturnValue({ user: { id: "user-1" }, loading: false })
    renderAt("/protected")
    expect(screen.getByText("secret content")).toBeInTheDocument()
  })
})
