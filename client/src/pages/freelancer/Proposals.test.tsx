import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor, fireEvent } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"

const useMyProposalsQueryMock = vi.fn()
vi.mock("../../lib/queries/proposals", () => ({
  useMyProposalsQuery: (...args: unknown[]) => useMyProposalsQueryMock(...args),
}))

import Proposals from "./Proposals"

function renderProposals() {
  return render(
    <MemoryRouter>
      <Proposals />
    </MemoryRouter>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("Proposals", () => {
  it("shows the empty state when there are no proposals", async () => {
    useMyProposalsQueryMock.mockReturnValue({
      isLoading: false,
      isError: false,
      data: { pages: [{ proposals: [], hasMore: false }] },
      hasNextPage: false,
      fetchNextPage: vi.fn(),
      isFetchingNextPage: false,
    })

    renderProposals()

    await waitFor(() => expect(screen.getByText("No proposals yet")).toBeInTheDocument())
  })

  it("renders proposals from all fetched pages with their status", async () => {
    useMyProposalsQueryMock.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        pages: [
          {
            proposals: [
              {
                id: "p1",
                job_id: "job-1",
                proposal_text: "I can build this",
                status: "accepted",
                created_at: "2026-01-01T00:00:00Z",
                job_title: "Build a landing page",
                agency_name: "Acme Co",
              },
            ],
            hasMore: true,
          },
          {
            proposals: [
              {
                id: "p2",
                job_id: "job-2",
                proposal_text: "I can design this",
                status: "pending",
                created_at: "2026-01-02T00:00:00Z",
                job_title: "Design a logo",
                agency_name: "Beta Inc",
              },
            ],
            hasMore: false,
          },
        ],
      },
      hasNextPage: false,
      fetchNextPage: vi.fn(),
      isFetchingNextPage: false,
    })

    renderProposals()

    await waitFor(() => expect(screen.getByText("Build a landing page")).toBeInTheDocument())
    expect(screen.getByText("Design a logo")).toBeInTheDocument()
    expect(screen.getByText("Acme Co")).toBeInTheDocument()
    expect(screen.getByText("Beta Inc")).toBeInTheDocument()
    expect(screen.getByText("Accepted")).toBeInTheDocument()
  })

  it("keeps the search input visible while re-searching (isLoading true with a search term)", async () => {
    useMyProposalsQueryMock.mockReturnValue({
      isLoading: false,
      isError: false,
      data: { pages: [{ proposals: [{ id: "p1", job_title: "Old result", status: "pending", created_at: "2026-01-01T00:00:00Z" }], hasMore: false }] },
      hasNextPage: false,
      fetchNextPage: vi.fn(),
      isFetchingNextPage: false,
    })

    renderProposals()

    const searchInput = await screen.findByPlaceholderText(/search proposals/i)
    fireEvent.change(searchInput, { target: { value: "react" } })

    // Now simulate the in-flight re-search: isLoading flips true while a
    // searchTerm is already set in component state.
    useMyProposalsQueryMock.mockReturnValue({
      isLoading: true,
      isError: false,
      data: { pages: [{ proposals: [{ id: "p1", job_title: "Old result", status: "pending", created_at: "2026-01-01T00:00:00Z" }], hasMore: false }] },
      hasNextPage: false,
      fetchNextPage: vi.fn(),
      isFetchingNextPage: false,
    })
    fireEvent.change(searchInput, { target: { value: "react " } })

    // The search input must still be present/visible and not replaced by the
    // full-page loading skeleton.
    expect(screen.getByPlaceholderText(/search proposals/i)).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/search proposals/i)).toHaveValue("react ")
  })

  it("shows an error state when the query fails", async () => {
    useMyProposalsQueryMock.mockReturnValue({
      isLoading: false,
      isError: true,
      data: undefined,
      hasNextPage: false,
      fetchNextPage: vi.fn(),
      isFetchingNextPage: false,
    })

    renderProposals()

    await waitFor(() => expect(screen.getByText("Couldn't load your proposals")).toBeInTheDocument())
    expect(screen.queryByText("No proposals yet")).not.toBeInTheDocument()
  })

  it("shows a Load more button when hasNextPage is true, and calls fetchNextPage on click", async () => {
    const fetchNextPage = vi.fn()
    useMyProposalsQueryMock.mockReturnValue({
      isLoading: false,
      isError: false,
      data: { pages: [{ proposals: [{ id: "p1", job_title: "Job A", status: "pending", created_at: "2026-01-01T00:00:00Z" }], hasMore: true }] },
      hasNextPage: true,
      fetchNextPage,
      isFetchingNextPage: false,
    })

    renderProposals()

    const loadMoreButton = await screen.findByRole("button", { name: /load more/i })
    loadMoreButton.click()
    expect(fetchNextPage).toHaveBeenCalledOnce()
  })
})
