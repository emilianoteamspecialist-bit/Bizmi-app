import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Routes, Route } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

const useAuthMock = vi.fn()
vi.mock("../../contexts/AuthContext", () => ({ useAuth: () => useAuthMock() }))

const useFindFreelancersQueryMock = vi.fn()
vi.mock("../../lib/queries/freelancers", () => ({
  useFindFreelancersQuery: (...args: unknown[]) => useFindFreelancersQueryMock(...args),
}))

import FindFreelancers from "./FindFreelancers"

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/agency/find-freelancers"]}>
        <Routes>
          <Route path="/" element={<div>home</div>} />
          <Route path="/agency/find-freelancers" element={<FindFreelancers />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

const oneFreelancer = {
  id: "f-1",
  full_name: "Jane Doe",
  bio: "I build things",
  location: "Lagos",
  skills: ["Web Development"],
  created_at: "2026-01-01T00:00:00Z",
  logo: null,
  verification_status: "verified",
  jobs_completed: 6,
}

beforeEach(() => {
  vi.clearAllMocks()
  useAuthMock.mockReturnValue({ profile: { account_type: "agency" } })
})

describe("FindFreelancers", () => {
  it("redirects home when the signed-in user's account_type isn't agency", async () => {
    useAuthMock.mockReturnValue({ profile: { account_type: "freelancer" } })
    useFindFreelancersQueryMock.mockReturnValue({ isLoading: false, isError: false, data: undefined, fetchNextPage: vi.fn(), hasNextPage: false, isFetchingNextPage: false })
    renderPage()
    await waitFor(() => expect(screen.getByText("home")).toBeInTheDocument())
  })

  it("shows a loading skeleton while the first page is pending", () => {
    useFindFreelancersQueryMock.mockReturnValue({ isLoading: true, isError: false, data: undefined, fetchNextPage: vi.fn(), hasNextPage: false, isFetchingNextPage: false })
    renderPage()
    expect(screen.getByTestId("find-freelancers-skeleton")).toBeInTheDocument()
  })

  it("shows an error state instead of the empty state when the search fails", () => {
    useFindFreelancersQueryMock.mockReturnValue({ isLoading: false, isError: true, data: undefined, fetchNextPage: vi.fn(), hasNextPage: false, isFetchingNextPage: false })
    renderPage()
    expect(screen.getByText("Couldn't load freelancers")).toBeInTheDocument()
    expect(screen.queryByText("No freelancers found")).not.toBeInTheDocument()
  })

  it("shows the empty state when there are no results", () => {
    useFindFreelancersQueryMock.mockReturnValue({
      isLoading: false,
      isError: false,
      data: { pages: [{ freelancers: [], hasMore: false }] },
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
    })
    renderPage()
    expect(screen.getByText("No freelancers found")).toBeInTheDocument()
  })

  it("renders freelancer cards and opens the profile modal on 'View profile'", async () => {
    useFindFreelancersQueryMock.mockReturnValue({
      isLoading: false,
      isError: false,
      data: { pages: [{ freelancers: [oneFreelancer], hasMore: false }] },
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
    })
    const user = userEvent.setup()
    renderPage()

    expect(screen.getByText("Jane Doe")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: /view profile/i }))

    expect(screen.getByText("About")).toBeInTheDocument()
  })

  it("shows a 'Load more' button when hasNextPage is true and calls fetchNextPage when clicked", async () => {
    const fetchNextPage = vi.fn()
    useFindFreelancersQueryMock.mockReturnValue({
      isLoading: false,
      isError: false,
      data: { pages: [{ freelancers: [oneFreelancer], hasMore: true }] },
      fetchNextPage,
      hasNextPage: true,
      isFetchingNextPage: false,
    })
    const user = userEvent.setup()
    renderPage()

    await user.click(screen.getByRole("button", { name: /load more/i }))
    expect(fetchNextPage).toHaveBeenCalled()
  })

  it("triggers a new search when Search is clicked, passing the search box's text to the hook", async () => {
    useFindFreelancersQueryMock.mockReturnValue({
      isLoading: false,
      isError: false,
      data: { pages: [{ freelancers: [], hasMore: false }] },
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
    })
    const user = userEvent.setup()
    renderPage()

    await user.type(screen.getByPlaceholderText(/search by name/i), "react")
    await user.click(screen.getByRole("button", { name: /^search$/i }))

    expect(useFindFreelancersQueryMock).toHaveBeenLastCalledWith("react", true)
  })
})
