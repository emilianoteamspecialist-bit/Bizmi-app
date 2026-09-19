import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor, fireEvent } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Routes, Route } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

const useAuthMock = vi.fn()
vi.mock("../../contexts/AuthContext", () => ({ useAuth: () => useAuthMock() }))

const useAgencyImageQueryMock = vi.fn()
vi.mock("../../lib/queries/agencies", () => ({
  useAgencyImageQuery: (...args: unknown[]) => useAgencyImageQueryMock(...args),
}))

const updateProfileMutate = vi.fn()
const uploadAvatarMutate = vi.fn()
vi.mock("../../lib/queries/user", () => ({
  useUpdateProfileMutation: () => ({ mutate: updateProfileMutate, isPending: false }),
  useUploadAvatarMutation: () => ({ mutate: uploadAvatarMutate, isPending: false }),
}))

import AgencyProfile from "./Profile"

function renderProfile() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/agency/profile"]}>
        <Routes>
          <Route path="/" element={<div>home</div>} />
          <Route path="/agency/profile" element={<AgencyProfile />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  useAuthMock.mockReturnValue({
    user: { id: "agency-1" },
    profile: { company_name: "Acme Co", full_name: "Point Contact", bio: "We build things", account_type: "agency" },
    refreshProfile: vi.fn(),
  })
  useAgencyImageQueryMock.mockReturnValue({ data: { image: null } })
})

describe("AgencyProfile", () => {
  it("redirects home when the signed-in user's account_type isn't agency", async () => {
    useAuthMock.mockReturnValue({
      user: { id: "freelancer-1" },
      profile: { account_type: "freelancer" },
      refreshProfile: vi.fn(),
    })
    renderProfile()
    await waitFor(() => expect(screen.getByText("home")).toBeInTheDocument())
  })

  it("renders the current profile read-only, then reveals form fields in edit mode", async () => {
    renderProfile()
    expect(screen.getByText("Acme Co")).toBeInTheDocument()
    expect(screen.getByDisplayValue("We build things")).toBeInTheDocument()
    expect(screen.queryByLabelText("Company name")).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole("button", { name: /edit profile/i }))

    expect(screen.getByLabelText("Company name")).toHaveValue("Acme Co")
  })

  it("saves whitelisted fields and refreshes the profile on success", async () => {
    const refreshProfile = vi.fn()
    useAuthMock.mockReturnValue({
      user: { id: "agency-1" },
      profile: { company_name: "Acme Co", account_type: "agency" },
      refreshProfile,
    })
    updateProfileMutate.mockImplementation((_input, { onSuccess }) => onSuccess({ success: true }))
    renderProfile()

    await userEvent.click(screen.getByRole("button", { name: /edit profile/i }))
    await userEvent.clear(screen.getByLabelText("Company name"))
    await userEvent.type(screen.getByLabelText("Company name"), "Acme Corp")
    await userEvent.click(screen.getByRole("button", { name: /save changes/i }))

    expect(updateProfileMutate.mock.calls[0][0]).toMatchObject({ company_name: "Acme Corp" })
    await waitFor(() => expect(refreshProfile).toHaveBeenCalled())
  })

  it("uploads a selected logo image", async () => {
    uploadAvatarMutate.mockImplementation(() => {})
    renderProfile()
    await userEvent.click(screen.getByRole("button", { name: /edit profile/i }))

    const file = new File(["hello"], "logo.jpg", { type: "image/jpeg" })
    const input = document.getElementById("avatar-upload") as HTMLInputElement
    fireEvent.change(input, { target: { files: [file] } })

    await waitFor(() =>
      expect(uploadAvatarMutate).toHaveBeenCalledWith(
        expect.objectContaining({ fileName: "logo.jpg", mimeType: "image/jpeg" }),
        expect.anything()
      )
    )
  })
})
