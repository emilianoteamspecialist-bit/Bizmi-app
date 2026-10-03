import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, within } from "@testing-library/react"
import { MemoryRouter, Routes, Route } from "react-router-dom"

const myEscrows = vi.fn()
const bankDetails = vi.fn()
const saveBank = vi.fn()
const requestPayout = vi.fn()
const openDispute = vi.fn()
// The real escrow module is partially kept (formatKobo, labels); stub the
// Supabase client it imports so no env/network is needed.
vi.mock("@/lib/supabase", () => ({ supabase: {} }))
vi.mock("@/lib/queries/escrow", async () => {
  const actual = await vi.importActual<typeof import("@/lib/queries/escrow")>("@/lib/queries/escrow")
  return {
    ...actual,
    useMyEscrowsQuery: () => myEscrows(),
    useBankDetailsQuery: () => bankDetails(),
    useBanksQuery: () => ({ isLoading: false, data: { banks: [{ name: "GTBank", code: "058" }] } }),
    useSaveBankDetailsMutation: () => ({ mutate: saveBank, isPending: false }),
    useRequestPayoutMutation: () => ({ mutate: requestPayout, isPending: false }),
    useOpenDisputeMutation: () => ({ mutate: openDispute, isPending: false }),
  }
})

import FundedJobs from "./FundedJobs"

const base = {
  job_id: "job-1",
  agency_id: "agency-1",
  freelancer_id: "free-1",
  amount_kobo: 5_000_000,
  created_at: "2026-01-01T00:00:00Z",
  funded_at: "2026-01-02T00:00:00Z",
  released_at: null,
  paid_out_at: null,
  refunded_at: null,
  disputed_at: null,
  role: "freelancer",
  job_title: "Landing page",
  agency_name: "Acme",
  freelancer_name: "Jane",
  submission_status: null,
  open_dispute_id: null,
  latest_payout: null,
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/freelancer/funded-jobs"]}>
      <Routes>
        <Route path="/freelancer/funded-jobs" element={<FundedJobs />} />
        <Route path="/disputes/:id" element={<div>Dispute room</div>} />
      </Routes>
    </MemoryRouter>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  bankDetails.mockReturnValue({ isLoading: false, data: { bankDetails: { account_number: "0123456789", bank_code: "058", account_name: "JANE DOE", bank_name: "GTBank" } } })
})

describe("FundedJobs", () => {
  it("lists only escrows where the caller is the freelancer and the job is funded or later", () => {
    myEscrows.mockReturnValue({
      isLoading: false,
      data: {
        escrows: [
          { ...base, id: "e1", status_v2: "funded" },
          { ...base, id: "e2", status_v2: "awaiting", job_title: "Unpaid" },
          { ...base, id: "e3", status_v2: "funded", role: "agency", job_title: "As agency" },
        ],
      },
    })
    renderPage()
    expect(screen.getByText("Landing page")).toBeInTheDocument()
    expect(screen.queryByText("Unpaid")).not.toBeInTheDocument()
    expect(screen.queryByText("As agency")).not.toBeInTheDocument()
    expect(screen.getByText("₦50,000")).toBeInTheDocument()
  })

  it("offers a workspace link and dispute for a funded job, and opens a dispute into the dispute room", () => {
    myEscrows.mockReturnValue({ isLoading: false, data: { escrows: [{ ...base, id: "e1", status_v2: "funded" }] } })
    openDispute.mockImplementation((_input: unknown, opts: any) => opts.onSuccess({ dispute: { id: "d-1" } }))
    renderPage()

    expect(screen.getByRole("link", { name: /workspace/i })).toHaveAttribute("href", "/workspace/job-1")
    fireEvent.click(screen.getByRole("button", { name: /^dispute$/i }))
    fireEvent.change(screen.getByLabelText(/what happened/i), { target: { value: "Client went silent" } })
    fireEvent.click(screen.getByRole("button", { name: /open dispute/i }))

    expect(openDispute).toHaveBeenCalledWith(
      { job_id: "job-1", dispute_type: "client_abandonment", description: "Client went silent" },
      expect.anything()
    )
    expect(screen.getByText("Dispute room")).toBeInTheDocument()
  })

  it("lets the freelancer withdraw a released escrow, showing the net after the 15% fee", () => {
    myEscrows.mockReturnValue({ isLoading: false, data: { escrows: [{ ...base, id: "e1", status_v2: "released" }] } })
    renderPage()
    fireEvent.click(screen.getByRole("button", { name: /withdraw ₦42,500/i }))
    expect(requestPayout).toHaveBeenCalledWith("e1", expect.anything())
  })

  it("shows a failed payout's reason and still allows a retry", () => {
    myEscrows.mockReturnValue({
      isLoading: false,
      data: { escrows: [{ ...base, id: "e1", status_v2: "released", latest_payout: { status: "failed", net_amount_kobo: 4_250_000, failure_reason: "Account closed" } }] },
    })
    renderPage()
    expect(screen.getByText(/account closed/i)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /withdraw/i })).toBeInTheDocument()
  })

  it("shows an in-flight payout instead of the withdraw button", () => {
    myEscrows.mockReturnValue({
      isLoading: false,
      data: { escrows: [{ ...base, id: "e1", status_v2: "released", latest_payout: { status: "processing", net_amount_kobo: 4_250_000 } }] },
    })
    renderPage()
    expect(screen.getByText(/payout of ₦42,500 is on its way/i)).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /withdraw/i })).not.toBeInTheDocument()
  })

  it("asks for bank details when none are saved, and submits bank + account number", () => {
    bankDetails.mockReturnValue({ isLoading: false, data: { bankDetails: null } })
    myEscrows.mockReturnValue({ isLoading: false, data: { escrows: [] } })
    renderPage()

    const section = screen.getByRole("region", { name: /payout account/i })
    fireEvent.change(within(section).getByLabelText(/bank/i), { target: { value: "058" } })
    fireEvent.change(within(section).getByLabelText(/account number/i), { target: { value: "01234-56789" } })
    fireEvent.click(within(section).getByRole("button", { name: /verify & save/i }))

    expect(saveBank).toHaveBeenCalledWith({ account_number: "0123456789", bank_code: "058" }, expect.anything())
  })
})
