import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { DeleteAccountDialog } from "./DeleteAccountDialog"

describe("DeleteAccountDialog", () => {
  it("keeps the destructive button disabled until DELETE is typed", async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn().mockResolvedValue(undefined)
    render(<DeleteAccountDialog onConfirm={onConfirm} />)

    await user.click(screen.getByRole("button", { name: /delete account/i }))
    const confirmButton = screen.getByRole("button", { name: /^delete account$/i })
    expect(confirmButton).toBeDisabled()

    await user.type(screen.getByLabelText(/type delete to confirm/i), "wrong")
    expect(confirmButton).toBeDisabled()

    await user.clear(screen.getByLabelText(/type delete to confirm/i))
    await user.type(screen.getByLabelText(/type delete to confirm/i), "delete")
    expect(confirmButton).toBeEnabled()
  })

  it("calls onConfirm only after DELETE is typed and the confirm button is clicked", async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn().mockResolvedValue(undefined)
    render(<DeleteAccountDialog onConfirm={onConfirm} />)

    await user.click(screen.getByRole("button", { name: /delete account/i }))
    await user.type(screen.getByLabelText(/type delete to confirm/i), "DELETE")
    await user.click(screen.getByRole("button", { name: /^delete account$/i }))

    expect(onConfirm).toHaveBeenCalledOnce()
  })
})
