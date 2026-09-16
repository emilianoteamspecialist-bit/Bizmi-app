import { beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import Marketplace from "./Marketplace"

const mocks = vi.hoisted(() => ({ auth: vi.fn(), jobs: vi.fn(), dashboard: vi.fn(), bookmark: vi.fn(), submit: vi.fn() }))
vi.mock("@/contexts/AuthContext", () => ({ useAuth: mocks.auth }))
vi.mock("@/lib/queries/marketplace", () => ({ useMarketplaceQuery: mocks.jobs }))
vi.mock("@/lib/queries/user", () => ({ useDashboardQuery: mocks.dashboard }))
vi.mock("@/lib/queries/jobs", () => ({ useToggleBookmarkMutation: () => ({ mutate: mocks.bookmark, isPending: false }) }))
vi.mock("@/lib/queries/proposals", () => ({ useSubmitProposalMutation: () => ({ mutateAsync: mocks.submit, isPending: false }) }))
vi.mock("@/lib/avatar", () => ({ getAvatarUrl: () => undefined }))

const job = { id: "j1", title: "Build a storefront", description: "A detailed brief", budget_min: 100000, budget_max: 200000, duration: "2 weeks", location: "Lagos", job_type: "Remote", credit_cost: 5, skills: ["React"], created_at: "2026-09-14", proposal_count: 3, is_bookmarked: true, has_applied: false, agency_info: { company_name: "Acme", bio: "Digital studio" } }
let query: any
const wrap = ({ children }: { children: React.ReactNode }) => <MemoryRouter>{children}</MemoryRouter>
beforeEach(() => {
  vi.clearAllMocks()
  query = { data: { pages: [{ jobs: [job], totalCount: 1 }] }, isLoading: false, isError: false, isFetching: false, hasNextPage: false, refetch: vi.fn(), fetchNextPage: vi.fn() }
  mocks.jobs.mockImplementation(() => query)
  mocks.auth.mockReturnValue({ profile: { account_type: "freelancer", skills: ["React"] } })
  mocks.dashboard.mockReturnValue({ data: { credits: 20, isVerified: true }, isLoading: false, isError: false })
  mocks.submit.mockResolvedValue({ success: true })
})

describe("Marketplace", () => {
  it("renders jobs, current result count and the server bookmark state", () => {
    render(<Marketplace />, { wrapper: wrap })
    expect(screen.getByText("Build a storefront")).toBeInTheDocument()
    expect(screen.getByText(/1 project found/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: /remove from saved/i }))
    expect(mocks.bookmark).toHaveBeenCalledWith({ jobId: "j1", isBookmarked: true })
  })

  it("keeps the search input mounted and focused while a new query loads", () => {
    const { rerender } = render(<Marketplace />, { wrapper: wrap })
    const input = screen.getByRole("searchbox")
    input.focus()
    fireEvent.change(input, { target: { value: "Design" } })
    fireEvent.submit(input.closest("form")!)
    expect(mocks.jobs).toHaveBeenLastCalledWith(expect.objectContaining({ searchQuery: "Design" }), true)
    query = { ...query, data: undefined, isLoading: true }
    rerender(<Marketplace />)
    expect(screen.getByRole("searchbox")).toBe(input)
    expect(input).toHaveFocus()
    expect(input).toHaveValue("Design")
  })

  it("shows initial errors and preserves loaded results on load-more errors", () => {
    query = { ...query, isError: true, data: undefined }
    const { rerender } = render(<Marketplace />, { wrapper: wrap })
    expect(screen.getByText(/couldn't load projects/i)).toBeInTheDocument()
    query = { ...query, data: { pages: [{ jobs: [job], totalCount: 2 }] }, isFetchNextPageError: true, hasNextPage: true }
    rerender(<Marketplace />)
    expect(screen.getByText("Build a storefront")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: /retry load more/i }))
    expect(query.fetchNextPage).toHaveBeenCalledOnce()
  })

  it("blocks bidding without verified identity or sufficient credits", () => {
    mocks.dashboard.mockReturnValue({ data: { credits: 20, isVerified: false } })
    render(<Marketplace />, { wrapper: wrap })
    expect(screen.getByRole("button", { name: /verify identity to apply/i })).toBeDisabled()
    expect(screen.queryByLabelText("Your proposal")).not.toBeInTheDocument()
  })

  it("keeps an in-progress proposal through a background error and prevents double submission", async () => {
    mocks.submit.mockImplementation(() => new Promise(() => {}))
    const { rerender } = render(<Marketplace />, { wrapper: wrap })
    fireEvent.click(screen.getByRole("button", { name: "Apply" }))
    fireEvent.change(screen.getByLabelText("Your proposal"), { target: { value: "I can deliver this" } })
    fireEvent.change(screen.getByLabelText("Timeline"), { target: { value: "2 weeks" } })
    fireEvent.change(screen.getByLabelText("Your budget (₦)"), { target: { value: "150000" } })
    query = { ...query, isError: true }
    rerender(<Marketplace />)
    expect(screen.getByLabelText("Your proposal")).toHaveValue("I can deliver this")
    const form = screen.getByLabelText("Your proposal").closest("form")!
    fireEvent.submit(form)
    fireEvent.submit(form)
    expect(screen.getByRole("button", { name: "Applied", hidden: true })).toBeDisabled()
    await waitFor(() => expect(mocks.submit).toHaveBeenCalledTimes(1))
    expect(mocks.submit).toHaveBeenCalledWith({ jobId: "j1", proposal_text: "I can deliver this", timeline: "2 weeks", budget: "150000", creditCost: 5 })
  })

  it("shows Applied immediately after successful submission", async () => {
    render(<Marketplace />, { wrapper: wrap })
    fireEvent.click(screen.getByRole("button", { name: "Apply" }))
    fireEvent.change(screen.getByLabelText("Your proposal"), { target: { value: "My proposal" } })
    fireEvent.change(screen.getByLabelText("Timeline"), { target: { value: "1 week" } })
    fireEvent.change(screen.getByLabelText("Your budget (₦)"), { target: { value: "100000" } })
    fireEvent.submit(screen.getByLabelText("Your proposal").closest("form")!)
    await waitFor(() => expect(screen.getByRole("button", { name: "Applied" })).toBeDisabled())
  })

  it("redirects a non-freelancer even while jobs are loading", () => {
    mocks.auth.mockReturnValue({ profile: { account_type: "agency" } })
    query = { ...query, isLoading: true, data: undefined }
    render(<MemoryRouter initialEntries={["/freelancer/marketplace"]}><Routes><Route path="/" element={<p>Home</p>} /><Route path="/freelancer/marketplace" element={<Marketplace />} /></Routes></MemoryRouter>)
    expect(screen.getByText("Home")).toBeInTheDocument()
    expect(mocks.dashboard).toHaveBeenCalledWith(false)
    expect(mocks.jobs).toHaveBeenCalledWith(expect.anything(), false)
  })
})
