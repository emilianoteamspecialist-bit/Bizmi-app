import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { Popover, PopoverContent, PopoverTrigger } from "./popover"

describe("Popover", () => {
  it("renders its content when open", () => {
    render(
      <Popover open>
        <PopoverTrigger>Open</PopoverTrigger>
        <PopoverContent>Popover body text</PopoverContent>
      </Popover>
    )

    expect(screen.getByText("Popover body text")).toBeInTheDocument()
  })
})
