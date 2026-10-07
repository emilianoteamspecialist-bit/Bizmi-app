import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { MemoryRouter, Routes, Route } from "react-router-dom"

const useAuthMock = vi.fn()
vi.mock("../../contexts/AuthContext", () => ({ useAuth: () => useAuthMock() }))

const useAgencyJobsQueryMock = vi.fn()
vi.mock("../../lib/queries/jobs", () => ({
  useAgencyJobsQuery: () => useAgencyJobsQueryMock(),
}))

vi.mock("./ProposalsModal", () => ({
  default: ({ job, isOpen }: { job: { title: string } | null; isOpen: boolean }) =>
    isOpen && job ? <div>Proposals for {job.title}</div> : null,
}))

import AgencyPosts from "./Posts"

function makeJob(overrides: Record<string, unknown>) {
  return {
    id: "job-1",
    title: "Build a landing page",
    description: "A marketing site",
    budget_min: 100000,
    budget_max: 200000,
    duration: "2 weeks",
    location: "Lagos",
    job_type: "Remote",
    credit_cost: 5,
    status: "active",
    skills: [],
    created_at: "2026-01-01T00:00:00Z",
    agency_id: "agency-1",
    proposals: 3,
    ...overrides,
  }
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/agency/posts"]}>
      <Routes>
        <Route path="/agency/posts" element={<AgencyPosts />} />
        <Route path="/agency/dashboard" element={<div>Agency dashboard</div>} />
        <Route path="/freelancer/dashboard" element={<div>Freelancer dashboard</div>} />
        <Route path="/admin/dashboard" element={<div>Admin dashboard</div>} />
      </Routes>
    </MemoryRouter>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  useAuthMock.mockReturnValue({ user: { id: "agency-1" }, profile: { account_type: "agency" } })
})

describe("AgencyPosts", () => {
  it("shows a loading skeleton while the jobs query is pending", () => {
    useAgencyJobsQueryMock.mockReturnValue({ isLoading: true, data: undefined })
    renderPage()
    expect(screen.getByTestId("agency-posts-skeleton")).toBeInTheDocument()
  })

  it("shows an error state when the jobs query fails with no data", () => {
    useAgencyJobsQueryMock.mockReturnValue({ isLoading: false, isError: true, data: undefined })
    renderPage()
    expect(screen.getByText("Couldn't load your job posts")).toBeInTheDocument()
  })

  it("renders a card per job with its proposal count", () => {
    useAgencyJobsQueryMock.mockReturnValue({
      isLoading: false,
      data: { jobs: [makeJob({}), makeJob({ id: "job-2", title: "Logo design", proposals: 1 })] },
    })
    renderPage()
    expect(screen.getByText("Build a landing page")).toBeInTheDocument()
    expect(screen.getByText("Logo design")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /review bids \(3\)/i })).toBeInTheDocument()
    expect(screen.getByText("1 proposal")).toBeInTheDocument()
  })

  it("filters jobs by title or description, case-insensitively", () => {
    useAgencyJobsQueryMock.mockReturnValue({
      isLoading: false,
      data: {
        jobs: [
          makeJob({}),
          makeJob({ id: "job-2", title: "Logo design", description: "Brand identity work" }),
        ],
      },
    })
    renderPage()
    const search = screen.getByPlaceholderText(/search job posts/i)

    fireEvent.change(search, { target: { value: "LOGO" } })
    expect(screen.getByText("Logo design")).toBeInTheDocument()
    expect(screen.queryByText("Build a landing page")).not.toBeInTheDocument()

    fireEvent.change(search, { target: { value: "marketing" } })
    expect(screen.getByText("Build a landing page")).toBeInTheDocument()
    expect(screen.queryByText("Logo design")).not.toBeInTheDocument()

    fireEvent.change(search, { target: { value: "nothing matches" } })
    expect(screen.getByText("No matching job posts")).toBeInTheDocument()
  })

  it("shows the empty state with a Post a job link that opens the dashboard composer", () => {
    useAgencyJobsQueryMock.mockReturnValue({ isLoading: false, data: { jobs: [] } })
    renderPage()
    expect(screen.getByText("No job posts yet")).toBeInTheDocument()
    const links = screen.getAllByRole("link", { name: /post a job/i })
    expect(links[0]).toHaveAttribute("href", "/agency/dashboard?post=true")
    fireEvent.click(links[0])
    expect(screen.getByText("Agency dashboard")).toBeInTheDocument()
  })

  it("filters jobs by status with per-status counts", () => {
    useAgencyJobsQueryMock.mockReturnValue({
      isLoading: false,
      data: { jobs: [makeJob({}), makeJob({ id: "job-2", title: "Logo design", status: "closed" })] },
    })
    renderPage()
    fireEvent.click(screen.getByRole("tab", { name: /closed 1/i }))
    expect(screen.getByText("Logo design")).toBeInTheDocument()
    expect(screen.queryByText("Build a landing page")).not.toBeInTheDocument()
  })

  it("opens the proposals modal for the clicked job", () => {
    useAgencyJobsQueryMock.mockReturnValue({ isLoading: false, data: { jobs: [makeJob({})] } })
    renderPage()
    fireEvent.click(screen.getByRole("button", { name: /review bids/i }))
    expect(screen.getByText("Proposals for Build a landing page")).toBeInTheDocument()
  })

  it("does not offer escrow actions (Fund job / Mark done are Phase 4)", () => {
    useAgencyJobsQueryMock.mockReturnValue({ isLoading: false, data: { jobs: [makeJob({})] } })
    renderPage()
    expect(screen.queryByRole("button", { name: /mark done/i })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /fund job/i })).not.toBeInTheDocument()
  })

  it("redirects freelancers to their dashboard", () => {
    useAuthMock.mockReturnValue({ user: { id: "f1" }, profile: { account_type: "freelancer" } })
    useAgencyJobsQueryMock.mockReturnValue({ isLoading: false, data: { jobs: [] } })
    renderPage()
    expect(screen.getByText("Freelancer dashboard")).toBeInTheDocument()
  })

  it("redirects admins to the admin dashboard", () => {
    useAuthMock.mockReturnValue({ user: { id: "a1" }, profile: { account_type: "admin" } })
    useAgencyJobsQueryMock.mockReturnValue({ isLoading: false, data: { jobs: [] } })
    renderPage()
    expect(screen.getByText("Admin dashboard")).toBeInTheDocument()
  })
})
