import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Switch } from "./switch"

describe("Switch", () => {
  it("renders unchecked by default and calls onCheckedChange when clicked", async () => {
    const onCheckedChange = vi.fn()
    const user = userEvent.setup()
    render(<Switch checked={false} onCheckedChange={onCheckedChange} />)

    const switchEl = screen.getByRole("switch")
    expect(switchEl).toHaveAttribute("data-state", "unchecked")

    await user.click(switchEl)
    expect(onCheckedChange).toHaveBeenCalledWith(true)
  })

  it("renders checked when checked=true", () => {
    render(<Switch checked={true} onCheckedChange={vi.fn()} />)
    expect(screen.getByRole("switch")).toHaveAttribute("data-state", "checked")
  })
})
