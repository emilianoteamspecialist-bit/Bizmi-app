import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, within } from "@testing-library/react"
import { MemoryRouter, Routes, Route } from "react-router-dom"

const useAuthMock = vi.fn()
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => useAuthMock() }))

const useJobsQueryMock = vi.fn()
const bookmarkMutate = vi.fn()
vi.mock("@/lib/queries/jobs", () => ({
  useJobsQuery: (...args: unknown[]) => useJobsQueryMock(...args),
  useToggleBookmarkMutation: () => ({ mutate: bookmarkMutate }),
}))
const useDashboardQueryMock = vi.fn()
vi.mock("@/lib/queries/user", () => ({ useDashboardQuery: () => useDashboardQueryMock() }))
const proposalsMock = vi.fn()
vi.mock("@/lib/queries/proposals", () => ({
  useSubmitProposalMutation: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useMyProposalsQuery: () => proposalsMock(),
}))
const escrowsMock = vi.fn()
vi.mock("@/lib/supabase", () => ({ supabase: {} }))
vi.mock("@/lib/queries/escrow", async () => {
  const actual = await vi.importActual<typeof import("@/lib/queries/escrow")>("@/lib/queries/escrow")
  return { ...actual, useMyEscrowsQuery: () => escrowsMock() }
})
const shellMock = vi.fn()
vi.mock("@/lib/queries/shell", () => ({ useShellQuery: () => shellMock() }))

import Dashboard from "./Dashboard"

const job = {
  id: "job-1",
  title: "Build a landing page",
  description: "A landing page",
  budget_min: 100000,
  budget_max: 200000,
  skills: ["React"],
  credit_cost: 5,
  created_at: "2026-01-01T00:00:00Z",
  is_bookmarked: true,
  agency_info: { company_name: "Acme Agency" },
}

function renderDashboard() {
  return render(
    <MemoryRouter initialEntries={["/freelancer/dashboard"]}>
      <Routes>
        <Route path="/freelancer/dashboard" element={<Dashboard />} />
        <Route path="/" element={<div>home</div>} />
      </Routes>
    </MemoryRouter>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  useAuthMock.mockReturnValue({ user: { id: "freelancer-1" }, profile: { full_name: "Jane Doe", account_type: "freelancer" } })
  useDashboardQueryMock.mockReturnValue({ isLoading: false, data: { credits: 20, isVerified: true, profile: { full_name: "Jane Doe", skills: ["React"] } } })
  useJobsQueryMock.mockReturnValue({ isLoading: false, data: { jobs: [job] } })
  proposalsMock.mockReturnValue({ data: { pages: [{ proposals: [{ id: "p1", job_title: "Logo refresh", agency_name: "Brandly", status: "pending", created_at: "2026-01-02T00:00:00Z" }] }] } })
  escrowsMock.mockReturnValue({ data: { escrows: [] } })
  shellMock.mockReturnValue({ data: { avatar: null, unreadCount: 0, recentUnread: [], credits: 20 } })
})

describe("Dashboard", () => {
  it("shows a loading state while the dashboard query is pending", () => {
    useDashboardQueryMock.mockReturnValue({ isLoading: true })
    renderDashboard()
    expect(screen.getByTestId("dashboard-skeleton")).toBeInTheDocument()
  })

  it("shows an error state when a query fails", () => {
    useJobsQueryMock.mockReturnValue({ isLoading: false, isError: true })
    renderDashboard()
    expect(screen.getByText("Couldn't load your dashboard")).toBeInTheDocument()
  })

  it("greets the freelancer and recommends jobs matching their skills", () => {
    renderDashboard()
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Jane")
    expect(screen.getByRole("heading", { name: "Jobs matching your skills" })).toBeInTheDocument()
    expect(screen.getByText("Build a landing page")).toBeInTheDocument()
    expect(useJobsQueryMock).toHaveBeenCalledWith(expect.objectContaining({ limit: 5, categorySkills: ["React"] }))
  })

  it("sends the job's actual bookmark state when the save button is clicked", () => {
    renderDashboard()
    fireEvent.click(screen.getByRole("button", { name: "Remove from saved" }))
    expect(bookmarkMutate).toHaveBeenCalledWith({ jobId: "job-1", isBookmarked: true })
  })

  it("lists action items for what to do next", () => {
    useDashboardQueryMock.mockReturnValue({ isLoading: false, data: { credits: 2, isVerified: false, profile: { full_name: "Jane Doe" } } })
    renderDashboard()
    const actions = screen.getByRole("region", { name: "Action items" })
    expect(within(actions).getByRole("link", { name: "Verify identity" })).toHaveAttribute("href", "/freelancer/identity")
    expect(within(actions).getByRole("link", { name: "Buy credits" })).toHaveAttribute("href", "/freelancer/bizpal")
  })

  it("shows current contracts with a workspace link, proposals and earnings", () => {
    escrowsMock.mockReturnValue({
      data: {
        escrows: [
          { id: "e1", job_id: "job-9", role: "freelancer", status_v2: "funded", amount_kobo: 5_000_000, job_title: "Fintech dashboard", agency_name: "PayCo", submission_status: null, latest_payout: null },
          { id: "e2", job_id: "job-8", role: "freelancer", status_v2: "released", amount_kobo: 1_000_000, job_title: "Old job", agency_name: "PayCo", latest_payout: null },
        ],
      },
    })
    renderDashboard()
    expect(screen.getByText("Fintech dashboard")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Workspace" })).toHaveAttribute("href", "/workspace/job-9")
    expect(screen.getByText("Logo refresh")).toBeInTheDocument()
    expect(screen.getByText("₦10,000")).toBeInTheDocument() // approved, ready to withdraw
    expect(within(screen.getByRole("region", { name: "Action items" })).getByRole("link", { name: "Withdraw" })).toBeInTheDocument()
  })

  it("redirects a non-freelancer", () => {
    useAuthMock.mockReturnValue({ user: { id: "a1" }, profile: { account_type: "agency" } })
    renderDashboard()
    expect(screen.getByText("home")).toBeInTheDocument()
  })
})
