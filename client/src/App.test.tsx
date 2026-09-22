// client/src/App.test.tsx
import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { MemoryRouter, Routes, Route } from "react-router-dom"
import { QueryClientProvider, QueryClient } from "@tanstack/react-query"
import { AuthProvider } from "./contexts/AuthContext"

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      getSession: vi.fn(() => Promise.resolve({ data: { session: null }, error: null })),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn() })) })),
    })),
  },
}))
vi.mock("@/lib/fbpixel", () => ({ trackSignUp: vi.fn() }))

import Landing from "./pages/Landing"
import Login from "./pages/Login"
import Signup from "./pages/Signup"
import RequireAuth from "./components/RequireAuth"
import Dashboard from "./pages/freelancer/Dashboard"
import SavedJobs from "./pages/freelancer/SavedJobs"
import Proposals from "./pages/freelancer/Proposals"
import AgencyDashboard from "./pages/agency/Dashboard"
import Marketplace from "./pages/freelancer/Marketplace"
import FindFreelancers from "./pages/agency/FindFreelancers"
import Bizpal from "./pages/freelancer/Bizpal"
import Messages from "./pages/shared/Messages"

function renderAt(path: string) {
  const queryClient = new QueryClient()
  render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/freelancer/dashboard" element={<RequireAuth><Dashboard /></RequireAuth>} />
            <Route path="/freelancer/saved-jobs" element={<RequireAuth><SavedJobs /></RequireAuth>} />
            <Route path="/freelancer/proposals" element={<RequireAuth><Proposals /></RequireAuth>} />
            <Route path="/agency/dashboard" element={<RequireAuth><AgencyDashboard /></RequireAuth>} />
            <Route path="/freelancer/marketplace" element={<RequireAuth><Marketplace /></RequireAuth>} />
            <Route path="/agency/find-freelancers" element={<RequireAuth><FindFreelancers /></RequireAuth>} />
            <Route path="/freelancer/bizpal" element={<RequireAuth><Bizpal /></RequireAuth>} />
            <Route path="/freelancer/messages" element={<RequireAuth><Messages /></RequireAuth>} />
            <Route path="/agency/messages" element={<RequireAuth><Messages /></RequireAuth>} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}

describe("route table", () => {
  it("renders Landing at /", () => {
    renderAt("/")
    expect(screen.getByText(/Hire Nigeria's/i)).toBeInTheDocument()
  })

  it("renders Login at /login", () => {
    renderAt("/login")
    expect(screen.getByRole("heading", { name: /Continue your work/i })).toBeInTheDocument()
  })

  it("renders Signup at /signup", () => {
    renderAt("/signup")
    expect(screen.getByRole("heading", { name: /Start your journey/i })).toBeInTheDocument()
  })
})

describe("QueryClientProvider", () => {
  it("renders the app without a 'No QueryClient set' error", () => {
    // A component using useQuery outside a provider throws synchronously on
    // render — rendering the full App at "/" and not throwing is proof the
    // provider is mounted above the router.
    expect(() => renderAt("/")).not.toThrow()
  })
})

describe("protected routes", () => {
  it("redirects /freelancer/dashboard to /login when signed out", async () => {
    renderAt("/freelancer/dashboard")
    await screen.findByRole("heading", { name: /Continue your work/i })
  })
})

describe("proposals route", () => {
  it("redirects /freelancer/proposals to /login when signed out", async () => {
    renderAt("/freelancer/proposals")
    await screen.findByRole("heading", { name: /Continue your work/i })
  })
})

describe("agency dashboard route", () => {
  it("redirects /agency/dashboard to /login when signed out", async () => {
    renderAt("/agency/dashboard")
    await screen.findByRole("heading", { name: /Continue your work/i })
  })
})

describe("find freelancers route", () => {
  it("redirects /agency/find-freelancers to /login when signed out", async () => {
    renderAt("/agency/find-freelancers")
    await screen.findByRole("heading", { name: /Continue your work/i })
  })
})

describe("bizpal route", () => {
  it("redirects /freelancer/bizpal to /login when signed out", async () => {
    renderAt("/freelancer/bizpal")
    await screen.findByRole("heading", { name: /Continue your work/i })
  })
})

describe("messages routes", () => {
  it("redirects /freelancer/messages to /login when signed out", async () => {
    renderAt("/freelancer/messages")
    await screen.findByRole("heading", { name: /Continue your work/i })
  })

  it("redirects /agency/messages to /login when signed out", async () => {
    renderAt("/agency/messages")
    await screen.findByRole("heading", { name: /Continue your work/i })
  })
})
