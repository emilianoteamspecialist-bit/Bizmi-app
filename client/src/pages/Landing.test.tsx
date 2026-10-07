import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import Landing from "./Landing"

describe("Landing", () => {
  it("renders the hero headline and primary CTAs", () => {
    render(
      <MemoryRouter>
        <Landing />
      </MemoryRouter>
    )
    expect(screen.getByText(/Hire Nigeria's/i)).toBeInTheDocument()
    expect(screen.getAllByRole("link", { name: /Get started/i }).length).toBeGreaterThan(0)
    expect(screen.getByRole("link", { name: /Sign in/i })).toHaveAttribute("href", "/login")
  })

  it("renders every landing section between the hero and the footer, as the Next.js page does", () => {
    render(
      <MemoryRouter>
        <Landing />
      </MemoryRouter>
    )
    // Categories, How it works, Featured talent, Testimonials, For freelancers, FAQ, plus FinalCTA.
    expect(screen.getAllByRole("heading", { level: 2 }).length).toBeGreaterThanOrEqual(7)
    // The FAQ accordion is interactive (Radix triggers render as buttons).
    expect(screen.getAllByRole("button", { expanded: false }).length).toBeGreaterThan(0)
  })
})
