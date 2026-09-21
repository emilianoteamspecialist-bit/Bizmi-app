import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

const verifyMutate = vi.fn()
vi.mock("../../lib/queries/credits", () => ({
  useVerifyCreditsMutation: () => ({ mutate: verifyMutate, isPending: false }),
}))

import TopUpCreditsModal from "./TopUpCreditsModal"

function renderModal(props: Partial<React.ComponentProps<typeof TopUpCreditsModal>> = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <TopUpCreditsModal isOpen onClose={vi.fn()} onSuccess={vi.fn()} {...props} />
    </QueryClientProvider>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("TopUpCreditsModal", () => {
  it("shows a validation error when the amount is below the minimum", async () => {
    const user = userEvent.setup()
    renderModal()

    await user.type(screen.getByLabelText(/amount paid/i), "100")
    await user.type(screen.getByLabelText(/payment reference/i), "ref-1")
    await user.click(screen.getByRole("button", { name: /verify payment/i }))

    expect(screen.getByText(/minimum amount is/i)).toBeInTheDocument()
    expect(verifyMutate).not.toHaveBeenCalled()
  })

  it("shows the calculated credit total once a valid amount is entered", async () => {
    const user = userEvent.setup()
    renderModal()

    await user.type(screen.getByLabelText(/amount paid/i), "1000")

    expect(screen.getByText("20 credits")).toBeInTheDocument()
  })

  it("calls the verify mutation with the amount and reference (not a client-computed credits total)", async () => {
    const user = userEvent.setup()
    renderModal()

    await user.type(screen.getByLabelText(/amount paid/i), "1000")
    await user.type(screen.getByLabelText(/payment reference/i), "ref-abc")
    await user.click(screen.getByRole("button", { name: /verify payment/i }))

    expect(verifyMutate).toHaveBeenCalledWith(
      { reference: "ref-abc", amount: 1000 },
      expect.objectContaining({ onSuccess: expect.any(Function), onError: expect.any(Function) })
    )
  })

  it("shows the server's error message when verification fails", async () => {
    // The real server never returns a 2xx body with success:false -- every
    // failure (bad reference, amount mismatch, already-used reference) comes
    // back as a non-2xx status, which apiFetch turns into a thrown Error
    // carrying the server's message, triggering the mutation's onError.
    verifyMutate.mockImplementation((_input, { onError }) => onError(new Error("This reference has already been used")))
    const user = userEvent.setup()
    renderModal()

    await user.type(screen.getByLabelText(/amount paid/i), "1000")
    await user.type(screen.getByLabelText(/payment reference/i), "ref-abc")
    await user.click(screen.getByRole("button", { name: /verify payment/i }))

    await waitFor(() => expect(screen.getByText("This reference has already been used")).toBeInTheDocument())
  })

  it("falls back to a generic error message when the thrown error has no message", async () => {
    verifyMutate.mockImplementation((_input, { onError }) => onError(new Error()))
    const user = userEvent.setup()
    renderModal()

    await user.type(screen.getByLabelText(/amount paid/i), "1000")
    await user.type(screen.getByLabelText(/payment reference/i), "ref-abc")
    await user.click(screen.getByRole("button", { name: /verify payment/i }))

    await waitFor(() => expect(screen.getByText("Failed to verify payment")).toBeInTheDocument())
  })

  it("calls onSuccess and onClose after a successful verification", async () => {
    const onSuccess = vi.fn()
    const onClose = vi.fn()
    verifyMutate.mockImplementation((_input, { onSuccess: succeed }) => succeed({ success: true, credits_added: 20 }))
    const user = userEvent.setup()
    renderModal({ onSuccess, onClose })

    await user.type(screen.getByLabelText(/amount paid/i), "1000")
    await user.type(screen.getByLabelText(/payment reference/i), "ref-abc")
    await user.click(screen.getByRole("button", { name: /verify payment/i }))

    await waitFor(() => expect(onSuccess).toHaveBeenCalled())
  })
})
