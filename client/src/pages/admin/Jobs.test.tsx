import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"

const useAdminJobsQueryMock = vi.fn()
const moderateMutate = vi.fn()
vi.mock("../../lib/queries/admin", () => ({
  useAdminJobsQuery: () => useAdminJobsQueryMock(),
  useModerateJobMutation: () => ({ mutate: moderateMutate, isPending: false }),
}))

const signOutMock = vi.fn()
vi.mock("../../contexts/AuthContext", () => ({ useAuth: () => ({ signOut: signOutMock }) }))

import AdminJobs from "./Jobs"

const activeJob = { id: "j-1", title: "Logo design", status: "open", moderation_status: "visible", moderation_reason: null, agency_name: "Acme", created_at: "2026-01-01T00:00:00Z", budget_min: 5000, budget_max: 10000 }
const removedJob = { id: "j-2", title: "Spam job", status: "open", moderation_status: "removed", moderation_reason: "fraud", agency_name: "Shell Co", created_at: "2026-01-02T00:00:00Z", budget_min: null, budget_max: null }

function renderPage() {
  return render(<MemoryRouter><AdminJobs /></MemoryRouter>)
}

beforeEach(() => {
  vi.clearAllMocks()
  useAdminJobsQueryMock.mockReturnValue({ isLoading: false, data: { jobs: [activeJob, removedJob] } })
  vi.stubGlobal("prompt", vi.fn(() => "fraud"))
  vi.stubGlobal("confirm", vi.fn(() => true))
})

describe("AdminJobs", () => {
  it("splits jobs into Active and Removed tabs", () => {
    renderPage()
    expect(screen.getByRole("tab", { name: /active \(1\)/i })).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: /removed \(1\)/i })).toBeInTheDocument()
    expect(screen.getByText("Logo design")).toBeInTheDocument()
  })

  it("filters by search term across title and agency name", async () => {
    const user = userEvent.setup()
    renderPage()
    await user.type(screen.getByPlaceholderText(/search title or agency/i), "Acme")
    expect(screen.getByText("Logo design")).toBeInTheDocument()
  })

  it("removes a job with a prompted reason", async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByRole("button", { name: /remove/i }))
    expect(window.prompt).toHaveBeenCalled()
    expect(moderateMutate).toHaveBeenCalledWith({ jobId: "j-1", action: "remove", reason: "fraud" }, expect.anything())
  })
})
