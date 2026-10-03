import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import Policy from "./Policy"

describe("Policy", () => {
  it("renders the policy title and all six sections", () => {
    render(<Policy />)
    expect(screen.getByRole("heading", { level: 1, name: /duplicates & verification policy/i })).toBeInTheDocument()
    for (const section of [
      /single account rule/i,
      /authenticity requirement/i,
      /profile image policy/i,
      /nin verification requirement/i,
      /consequences of violation/i,
      /right to review/i,
    ]) {
      expect(screen.getByRole("heading", { level: 2, name: section })).toBeInTheDocument()
    }
  })
})
