import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { MemoryRouter, Routes, Route } from "react-router-dom"

const workspace = vi.fn()
const submitWork = vi.fn()
const approve = vi.fn()
const postComment = vi.fn()
// The real escrow module is partially kept (formatKobo, labels); stub the
// Supabase client it imports so no env/network is needed.
vi.mock("@/lib/supabase", () => ({ supabase: {} }))
vi.mock("@/lib/queries/escrow", async () => {
  const actual = await vi.importActual<typeof import("@/lib/queries/escrow")>("@/lib/queries/escrow")
  return {
    ...actual,
    useWorkspaceQuery: () => workspace(),
    useSubmitWorkMutation: () => ({ mutate: submitWork, isPending: false }),
    useApproveSubmissionMutation: () => ({ mutate: approve, isPending: false }),
    useSubmissionCommentsQuery: () => ({ data: { comments: [] } }),
    usePostCommentMutation: () => ({ mutate: postComment, isPending: false }),
  }
})
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "agency-1" } }) }))

import Workspace from "./Workspace"

const submitted = {
  id: "sub-1",
  job_id: "job-1",
  freelancer_id: "free-1",
  agency_id: "agency-1",
  submission_type: "tech",
  content: { github_url: "https://github.com/x/y", notes: "Done!" },
  status: "submitted",
  submitted_at: "2026-01-03T00:00:00Z",
  updated_at: "2026-01-03T00:00:00Z",
}

const data = (role: "agency" | "freelancer", status: string, submission: unknown) => ({
  isLoading: false,
  data: { role, job: { id: "job-1", title: "Landing page", description: null }, escrow: { id: "esc-1", status, amount_kobo: 5_000_000 }, submission },
})

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/workspace/job-1"]}>
      <Routes>
        <Route path="/workspace/:jobId" element={<Workspace />} />
      </Routes>
    </MemoryRouter>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal("confirm", vi.fn(() => true))
})

describe("Workspace", () => {
  it("shows the contract parties and the payment timeline", () => {
    workspace.mockReturnValue({
      isLoading: false,
      data: {
        role: "freelancer",
        job: { id: "job-1", title: "Landing page", description: null, duration: "2 weeks" },
        escrow: { id: "esc-1", status: "released", amount_kobo: 5_000_000, funded_at: "2026-01-02T00:00:00Z", released_at: "2026-01-09T00:00:00Z" },
        parties: { agency_name: "Acme", freelancer_name: "Jane" },
        open_dispute_id: null,
        submission: { ...submitted, status: "approved" },
      },
    })
    renderPage()
    const details = screen.getByRole("complementary", { name: "Contract details" })
    expect(details).toHaveTextContent("Acme")
    expect(details).toHaveTextContent("2 weeks")
    const timeline = screen.getByRole("list", { name: "Payment progress" })
    expect(timeline).toHaveTextContent("Approved and released (done)")
    expect(timeline).toHaveTextContent("Paid out to freelancer (not yet)")
    expect(screen.getByRole("link", { name: /message client/i })).toHaveAttribute("href", "/freelancer/messages")
  })

  it("explains access when the workspace can't be loaded", () => {
    workspace.mockReturnValue({ isLoading: false, isError: true })
    renderPage()
    expect(screen.getByText(/workspace not available/i)).toBeInTheDocument()
  })

  it("lets the freelancer submit links and notes for a funded job", () => {
    workspace.mockReturnValue(data("freelancer", "funded", null))
    renderPage()
    fireEvent.change(screen.getByLabelText(/type of work/i), { target: { value: "tech" } })
    fireEvent.change(screen.getByLabelText(/repository/i), { target: { value: "https://github.com/x/y" } })
    fireEvent.change(screen.getByLabelText(/notes for the agency/i), { target: { value: "All done" } })
    fireEvent.click(screen.getByRole("button", { name: /submit work/i }))
    expect(submitWork).toHaveBeenCalledWith(
      { submission_type: "tech", content: { github_url: "https://github.com/x/y", notes: "All done" } },
      expect.anything()
    )
  })

  it("shows the agency the submission and approves it after confirmation", () => {
    workspace.mockReturnValue(data("agency", "funded", submitted))
    renderPage()
    expect(screen.getByRole("link", { name: /github\.com\/x\/y/ })).toHaveAttribute("href", "https://github.com/x/y")
    fireEvent.click(screen.getByRole("button", { name: /approve & release payment/i }))
    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining("₦50,000"))
    expect(approve).toHaveBeenCalledWith("sub-1", expect.anything())
  })

  it("does not approve if the agency cancels the confirmation", () => {
    vi.stubGlobal("confirm", vi.fn(() => false))
    workspace.mockReturnValue(data("agency", "funded", submitted))
    renderPage()
    fireEvent.click(screen.getByRole("button", { name: /approve & release payment/i }))
    expect(approve).not.toHaveBeenCalled()
  })

  it("lets the agency request changes through the feedback thread", () => {
    workspace.mockReturnValue(data("agency", "funded", submitted))
    renderPage()
    fireEvent.change(screen.getByLabelText(/message/i), { target: { value: "Please fix the footer" } })
    fireEvent.click(screen.getByRole("button", { name: /request changes/i }))
    expect(postComment).toHaveBeenCalledWith({ message: "Please fix the footer", is_revision_request: true }, expect.anything())
  })

  it("pauses delivery while the escrow is disputed", () => {
    workspace.mockReturnValue(data("agency", "disputed", submitted))
    renderPage()
    expect(screen.getByText(/in dispute/i)).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /approve/i })).not.toBeInTheDocument()
  })
})
