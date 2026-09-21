import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor, fireEvent } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Routes, Route } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

const useAuthMock = vi.fn()
vi.mock("../../contexts/AuthContext", () => ({ useAuth: () => useAuthMock() }))

const useDashboardQueryMock = vi.fn()
vi.mock("../../lib/queries/user", () => ({
  useDashboardQuery: (...args: unknown[]) => useDashboardQueryMock(...args),
}))

const useCreditsHistoryQueryMock = vi.fn()
vi.mock("../../lib/queries/credits", () => ({
  useCreditsHistoryQuery: () => useCreditsHistoryQueryMock(),
  // TopUpCreditsModal is always mounted by Bizpal (Dialog's `isOpen` only toggles
  // visibility, not mounting) and unconditionally calls useVerifyCreditsMutation,
  // so it must be stubbed here too even though these tests never trigger a verify.
  useVerifyCreditsMutation: () => ({ mutate: vi.fn(), isPending: false }),
}))

import Bizpal from "./Bizpal"

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/freelancer/bizpal"]}>
        <Routes>
          <Route path="/" element={<div>home</div>} />
          <Route path="/freelancer/bizpal" element={<Bizpal />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  useAuthMock.mockReturnValue({ profile: { account_type: "freelancer" } })
  useDashboardQueryMock.mockReturnValue({ isLoading: false, data: { credits: 40 } })
  useCreditsHistoryQueryMock.mockReturnValue({ isLoading: false, data: { purchases: [] } })
})

describe("Bizpal", () => {
  it("redirects home when the signed-in user's account_type isn't freelancer", async () => {
    useAuthMock.mockReturnValue({ profile: { account_type: "agency" } })
    renderPage()
    await waitFor(() => expect(screen.getByText("home")).toBeInTheDocument())
  })

  it("shows a loading skeleton while dashboard or history data is pending", () => {
    useDashboardQueryMock.mockReturnValue({ isLoading: true, data: undefined })
    renderPage()
    expect(screen.getByTestId("bizpal-skeleton")).toBeInTheDocument()
  })

  it("shows the current credits balance", () => {
    renderPage()
    expect(screen.getByText("40")).toBeInTheDocument()
  })

  it("shows the empty state when there is no purchase history", () => {
    renderPage()
    expect(screen.getByText("No credits purchased yet")).toBeInTheDocument()
  })

  it("renders purchase history rows", () => {
    useCreditsHistoryQueryMock.mockReturnValue({
      isLoading: false,
      data: {
        purchases: [
          { id: "p-1", amount: 500, credits_amount: 10, status: "completed", created_at: "2026-01-01T00:00:00Z", paystack_reference: "ref-1" },
        ],
      },
    })
    renderPage()
    expect(screen.getByText("Credits purchase")).toBeInTheDocument()
    expect(screen.getByText("10 credits")).toBeInTheDocument()
  })

  it("filters purchase history by date range", async () => {
    useCreditsHistoryQueryMock.mockReturnValue({
      isLoading: false,
      data: {
        purchases: [
          { id: "p-1", amount: 500, credits_amount: 10, status: "completed", created_at: "2026-01-01T00:00:00Z", paystack_reference: "ref-1" },
          { id: "p-2", amount: 1000, credits_amount: 20, status: "completed", created_at: "2026-03-01T00:00:00Z", paystack_reference: "ref-2" },
        ],
      },
    })
    const user = userEvent.setup()
    renderPage()

    expect(screen.getByText("10 credits")).toBeInTheDocument()
    expect(screen.getByText("20 credits")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: /filter/i }))
    fireEvent.change(screen.getByLabelText(/from date/i), { target: { value: "2026-02-01" } })

    await waitFor(() => {
      expect(screen.queryByText("10 credits")).not.toBeInTheDocument()
      expect(screen.getByText("20 credits")).toBeInTheDocument()
    })
  })

  it("opens the top-up modal when 'Top up credits' is clicked", async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(screen.getByRole("button", { name: /top up credits/i }))

    expect(screen.getByRole("heading", { name: /top up credits/i })).toBeInTheDocument()
  })
})
