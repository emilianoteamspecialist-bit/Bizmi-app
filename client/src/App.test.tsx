// client/src/App.test.tsx
import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { MemoryRouter, Routes, Route } from "react-router-dom"
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
