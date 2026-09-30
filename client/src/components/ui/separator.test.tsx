import { describe, it, expect } from "vitest"
import { render } from "@testing-library/react"
import { Separator } from "./separator"

describe("Separator", () => {
  it("renders a horizontal separator by default", () => {
    const { container } = render(<Separator />)
    const el = container.firstChild as HTMLElement
    expect(el).toHaveAttribute("data-orientation", "horizontal")
  })

  it("renders a vertical separator when orientation=vertical", () => {
    const { container } = render(<Separator orientation="vertical" />)
    const el = container.firstChild as HTMLElement
    expect(el).toHaveAttribute("data-orientation", "vertical")
  })
})
