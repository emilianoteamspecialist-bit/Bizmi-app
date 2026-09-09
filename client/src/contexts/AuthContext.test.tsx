import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import { AuthProvider, useAuth } from "./AuthContext"

const getSessionMock = vi.fn()
const onAuthStateChangeMock = vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } }))
const fromMock = vi.fn()

vi.mock("../lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: (...args: unknown[]) => getSessionMock(...args),
      onAuthStateChange: (...args: unknown[]) => onAuthStateChangeMock(...args),
    },
    from: (...args: unknown[]) => fromMock(...args),
  },
}))

function Probe() {
  const { user, profile, loading } = useAuth()
  if (loading) return <div>loading</div>
  return <div>{user ? `signed in: ${user.id}` : "signed out"}{profile ? ` (${profile.account_type})` : ""}</div>
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("AuthProvider", () => {
  it("exposes no user when there is no session", async () => {
    getSessionMock.mockResolvedValue({ data: { session: null } })

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    )

    await waitFor(() => expect(screen.getByText("signed out")).toBeInTheDocument())
  })

  it("loads the user and profile when a session exists", async () => {
    getSessionMock.mockResolvedValue({ data: { session: { user: { id: "user-1" } } } })
    const single = vi.fn().mockResolvedValue({ data: { account_type: "freelancer" }, error: null })
    fromMock.mockReturnValue({ select: vi.fn(() => ({ eq: vi.fn(() => ({ single })) })) })

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    )

    await waitFor(() => expect(screen.getByText("signed in: user-1 (freelancer)")).toBeInTheDocument())
  })
})
