import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import Tutorial from "./Tutorial"

function renderPage() {
  return render(
    <MemoryRouter>
      <Tutorial />
    </MemoryRouter>
  )
}

describe("Tutorial", () => {
  it("renders all 8 section headings", () => {
    renderPage()
    expect(screen.getByRole("heading", { name: /getting started/i })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: /get verified/i })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: /find work/i })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: /submit a proposal/i })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: /win & start work/i })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: /get paid/i })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: /credits & bizpal/i })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: /raise a dispute/i })).toBeInTheDocument()
  })

  it("renders a table of contents linking to each section by id", () => {
    renderPage()
    const links = screen.getAllByRole("link")
    expect(links.some((l) => l.getAttribute("href") === "#getting-started")).toBe(true)
  })
})
