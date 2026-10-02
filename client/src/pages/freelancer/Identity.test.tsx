import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"

const useVerificationQueryMock = vi.fn()
const submitMutate = vi.fn()
vi.mock("../../lib/queries/verification", () => ({
  useVerificationQuery: () => useVerificationQueryMock(),
  useSubmitVerificationMutation: () => ({ mutate: submitMutate, isPending: false }),
}))

import Identity from "./Identity"

function renderPage() {
  return render(
    <MemoryRouter>
      <Identity />
    </MemoryRouter>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("Identity", () => {
  it("shows the verified state when the record's status is verified", () => {
    useVerificationQueryMock.mockReturnValue({
      isLoading: false,
      data: { nin: "12345678901", status: "verified", created_at: "2026-01-01T00:00:00Z" },
    })
    renderPage()
    expect(screen.getByText(/identity verified/i)).toBeInTheDocument()
    expect(screen.getByText(/12345678901/)).toBeInTheDocument()
  })

  it("shows the pending state when the record's status is pending", () => {
    useVerificationQueryMock.mockReturnValue({
      isLoading: false,
      data: { nin: "12345678901", status: "pending", created_at: new Date().toISOString() },
    })
    renderPage()
    expect(screen.getByText(/verification in progress/i)).toBeInTheDocument()
  })

  it("shows the submission form when there is no record, and disables submit until 11 digits are entered", async () => {
    useVerificationQueryMock.mockReturnValue({ isLoading: false, data: null })
    const user = userEvent.setup()
    renderPage()

    const submitButton = screen.getByRole("button", { name: /submit for verification/i })
    expect(submitButton).toBeDisabled()

    await user.type(screen.getByLabelText(/national identity number/i), "1234567890")
    expect(submitButton).toBeDisabled()

    await user.type(screen.getByLabelText(/national identity number/i), "1")
    expect(submitButton).toBeEnabled()

    await user.click(submitButton)
    expect(submitMutate).toHaveBeenCalledWith({ nin: "12345678901" }, expect.anything())
  })

  it("strips non-digit characters from the NIN input", async () => {
    useVerificationQueryMock.mockReturnValue({ isLoading: false, data: null })
    const user = userEvent.setup()
    renderPage()

    await user.type(screen.getByLabelText(/national identity number/i), "123-456-78901")
    expect(screen.getByLabelText(/national identity number/i)).toHaveValue("12345678901")
  })
})
