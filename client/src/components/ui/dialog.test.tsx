import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { Dialog, DialogContent, DialogTitle } from "./dialog"

describe("Dialog", () => {
  it("renders its content when open", () => {
    render(
      <Dialog open>
        <DialogContent>
          <DialogTitle>Test dialog</DialogTitle>
          <p>Body content</p>
        </DialogContent>
      </Dialog>
    )
    expect(screen.getByText("Test dialog")).toBeInTheDocument()
    expect(screen.getByText("Body content")).toBeInTheDocument()
  })
})
