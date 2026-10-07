import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, within } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"

const useSavedJobsQueryMock = vi.fn()
const bookmarkMutate = vi.fn()
vi.mock("@/lib/queries/jobs", () => ({
  useSavedJobsQuery: () => useSavedJobsQueryMock(),
  useToggleBookmarkMutation: () => ({ mutate: bookmarkMutate, isPending: false }),
}))
const dashboard = vi.fn()
vi.mock("@/lib/queries/user", () => ({ useDashboardQuery: () => dashboard() }))
const submitMock = vi.fn()
vi.mock("@/lib/queries/proposals", () => ({ useSubmitProposalMutation: () => ({ mutateAsync: submitMock, isPending: false }) }))

import SavedJobs from "./SavedJobs"

const savedJob = {
  id: "job-1",
  title: "Build a mobile app",
  description: "Cross-platform app for a logistics startup",
  budget_min: 100000,
  budget_max: 200000,
  skills: ["Flutter"],
  credit_cost: 5,
  created_at: "2026-01-01T00:00:00Z",
  proposals: 3,
  has_applied: false,
  agencyInfo: { id: "agency-1", name: "Acme Co" },
}

const renderPage = () => render(<SavedJobs />, { wrapper: ({ children }) => <MemoryRouter>{children}</MemoryRouter> })

beforeEach(() => {
  vi.clearAllMocks()
  dashboard.mockReturnValue({ data: { credits: 20, isVerified: true } })
})

describe("SavedJobs", () => {
  it("shows an empty state that points to Find Work", () => {
    useSavedJobsQueryMock.mockReturnValue({ isLoading: false, data: { jobs: [] } })
    renderPage()
    expect(screen.getByText("No saved jobs yet")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Browse jobs" })).toHaveAttribute("href", "/freelancer/marketplace")
  })

  it("shows an error state when saved jobs fail to load", () => {
    useSavedJobsQueryMock.mockReturnValue({ isLoading: false, isError: true })
    renderPage()
    expect(screen.getByText("Couldn't load your saved jobs")).toBeInTheDocument()
  })

  it("renders each saved job with its agency name and budget", () => {
    useSavedJobsQueryMock.mockReturnValue({ isLoading: false, data: { jobs: [savedJob] } })
    renderPage()
    expect(screen.getByText("Build a mobile app")).toBeInTheDocument()
    expect(screen.getByText("Acme Co")).toBeInTheDocument()
    expect(screen.getByText("₦100,000 – ₦200,000")).toBeInTheDocument()
  })

  it("removes a job from the list when it is unsaved", () => {
    useSavedJobsQueryMock.mockReturnValue({ isLoading: false, data: { jobs: [savedJob] } })
    renderPage()
    fireEvent.click(screen.getByRole("button", { name: "Remove from saved" }))
    expect(bookmarkMutate).toHaveBeenCalledWith({ jobId: "job-1", isBookmarked: true })
    expect(screen.queryByText("Build a mobile app")).not.toBeInTheDocument()
  })

  it("applies through the shared proposal flow", () => {
    useSavedJobsQueryMock.mockReturnValue({ isLoading: false, data: { jobs: [savedJob] } })
    renderPage()
    fireEvent.click(screen.getByRole("button", { name: "Apply" }))
    expect(within(screen.getByRole("dialog")).getByLabelText("Your proposal")).toBeInTheDocument()
  })
})
