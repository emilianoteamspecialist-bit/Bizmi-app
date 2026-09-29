import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import Contact from "./Contact"

function renderPage() {
  return render(
    <MemoryRouter>
      <Contact />
    </MemoryRouter>
  )
}

describe("Contact", () => {
  it("renders a mailto link to the support email", () => {
    renderPage()
    const link = screen.getByRole("link", { name: /email us/i })
    expect(link).toHaveAttribute("href", "mailto:bizimi@gmail.com")
  })

  it("renders WhatsApp links for both contacts with the correct numbers", () => {
    renderPage()
    const mubarack = screen.getByRole("link", { name: /chat with mubarack/i })
    expect(mubarack).toHaveAttribute("href", expect.stringContaining("https://wa.me/2347052345295"))

    const emiliano = screen.getByRole("link", { name: /chat with emiliano/i })
    expect(emiliano).toHaveAttribute("href", expect.stringContaining("https://wa.me/2347052345296"))
  })

  it("renders the page heading", () => {
    renderPage()
    expect(screen.getByRole("heading", { name: /contact us/i })).toBeInTheDocument()
  })
})
