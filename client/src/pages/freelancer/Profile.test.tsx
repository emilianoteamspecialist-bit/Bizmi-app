import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor, fireEvent } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Routes, Route } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

const useAuthMock = vi.fn()
vi.mock("../../contexts/AuthContext", () => ({ useAuth: () => useAuthMock() }))

const useFreelancerLogosQueryMock = vi.fn()
const updateProfileMutate = vi.fn()
const uploadAvatarMutate = vi.fn()
vi.mock("../../lib/queries/user", () => ({
  useFreelancerLogosQuery: (...args: unknown[]) => useFreelancerLogosQueryMock(...args),
  useUpdateProfileMutation: () => ({ mutate: updateProfileMutate, isPending: false }),
  useUploadAvatarMutation: () => ({ mutate: uploadAvatarMutate, isPending: false }),
}))

import FreelancerProfile from "./Profile"

function renderProfile() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/freelancer/profile"]}>
        <Routes>
          <Route path="/" element={<div>home</div>} />
          <Route path="/freelancer/profile" element={<FreelancerProfile />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  useAuthMock.mockReturnValue({
    user: { id: "freelancer-1" },
    profile: { full_name: "Jane Doe", bio: "A bio", account_type: "freelancer", skills: ["React"] },
    refreshProfile: vi.fn(),
  })
  useFreelancerLogosQueryMock.mockReturnValue({ data: { logos: {} } })
})

describe("FreelancerProfile", () => {
  it("redirects home when the signed-in user's account_type isn't freelancer", async () => {
    useAuthMock.mockReturnValue({
      user: { id: "agency-1" },
      profile: { account_type: "agency" },
      refreshProfile: vi.fn(),
    })
    renderProfile()
    await waitFor(() => expect(screen.getByText("home")).toBeInTheDocument())
  })

  it("renders the current profile read-only, then reveals form fields in edit mode", async () => {
    renderProfile()
    expect(screen.getByText("Jane Doe")).toBeInTheDocument()
    expect(screen.getByDisplayValue("A bio")).toBeInTheDocument()
    expect(screen.queryByLabelText("Full name")).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole("button", { name: /edit profile/i }))

    expect(screen.getByLabelText("Full name")).toHaveValue("Jane Doe")
  })

  it("saves whitelisted fields and refreshes the profile on success", async () => {
    const refreshProfile = vi.fn()
    useAuthMock.mockReturnValue({
      user: { id: "freelancer-1" },
      profile: { full_name: "Jane Doe", account_type: "freelancer" },
      refreshProfile,
    })
    updateProfileMutate.mockImplementation((_input, { onSuccess }) => onSuccess({ success: true }))
    renderProfile()

    await userEvent.click(screen.getByRole("button", { name: /edit profile/i }))
    await userEvent.clear(screen.getByLabelText("Full name"))
    await userEvent.type(screen.getByLabelText("Full name"), "Jane Smith")
    await userEvent.click(screen.getByRole("button", { name: /save changes/i }))

    expect(updateProfileMutate.mock.calls[0][0]).toMatchObject({ full_name: "Jane Smith" })
    await waitFor(() => expect(refreshProfile).toHaveBeenCalled())
  })

  it("re-syncs the read-only view when the profile arrives after this page has already mounted", async () => {
    useAuthMock.mockReturnValue({
      user: { id: "freelancer-1" },
      profile: null,
      refreshProfile: vi.fn(),
    })
    const { rerender } = renderProfile()
    expect(screen.getByText("Your name")).toBeInTheDocument()

    useAuthMock.mockReturnValue({
      user: { id: "freelancer-1" },
      profile: { full_name: "Jane Doe", bio: "A bio", account_type: "freelancer", skills: ["React"] },
      refreshProfile: vi.fn(),
    })
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    rerender(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={["/freelancer/profile"]}>
          <Routes>
            <Route path="/" element={<div>home</div>} />
            <Route path="/freelancer/profile" element={<FreelancerProfile />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    )

    await waitFor(() => expect(screen.getByText("Jane Doe")).toBeInTheDocument())
  })

  it("uploads a selected avatar image", async () => {
    uploadAvatarMutate.mockImplementation(() => {})
    renderProfile()
    await userEvent.click(screen.getByRole("button", { name: /edit profile/i }))

    const file = new File(["hello"], "avatar.png", { type: "image/png" })
    const input = document.getElementById("avatar-upload") as HTMLInputElement
    fireEvent.change(input, { target: { files: [file] } })

    await waitFor(() =>
      expect(uploadAvatarMutate).toHaveBeenCalledWith(
        expect.objectContaining({ fileName: "avatar.png", mimeType: "image/png" }),
        expect.anything()
      )
    )
  })
})
