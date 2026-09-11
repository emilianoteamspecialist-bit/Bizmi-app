import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { Badge } from "./badge"

describe("Badge", () => {
  it("renders its children and applies the outline variant class", () => {
    render(<Badge variant="outline">📎 file.pdf</Badge>)
    const badge = screen.getByText("📎 file.pdf")
    expect(badge).toBeInTheDocument()
    expect(badge.className).toContain("border-border")
  })
})
