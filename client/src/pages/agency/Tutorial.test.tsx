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
    expect(screen.getByRole("heading", { name: /post a job/i })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: /review proposals/i })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: /fund the job/i })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: /message & collaborate/i })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: /complete & release payment/i })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: /wallet & deposits/i })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: /raise a dispute/i })).toBeInTheDocument()
  })

  it("renders a table of contents linking to each section by id", () => {
    renderPage()
    const links = screen.getAllByRole("link")
    expect(links.some((l) => l.getAttribute("href") === "#post-a-job")).toBe(true)
  })
})
