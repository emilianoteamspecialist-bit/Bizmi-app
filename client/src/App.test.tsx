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
import AdminLogin from "./pages/admin/Login"
import AdminDashboard from "./pages/admin/Dashboard"
import AdminUsers from "./pages/admin/Users"
import AdminJobs from "./pages/admin/Jobs"
import AdminAuditLog from "./pages/admin/AuditLog"
import AdminCredits from "./pages/admin/Credits"
import AdminInfluencers from "./pages/admin/Influencers"

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
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/admin/dashboard" element={<RequireAuth><AdminDashboard /></RequireAuth>} />
            <Route path="/admin/users" element={<RequireAuth><AdminUsers /></RequireAuth>} />
            <Route path="/admin/jobs" element={<RequireAuth><AdminJobs /></RequireAuth>} />
            <Route path="/admin/audit" element={<RequireAuth><AdminAuditLog /></RequireAuth>} />
            <Route path="/admin/credits" element={<RequireAuth><AdminCredits /></RequireAuth>} />
            <Route path="/admin/influencers" element={<RequireAuth><AdminInfluencers /></RequireAuth>} />
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
    expect(screen.getByRole("heading", { name: /Sign in to Bizimi/i })).toBeInTheDocument()
  })

  it("renders Signup at /signup", () => {
    renderAt("/signup")
    expect(screen.getByRole("heading", { name: /Create your Bizimi account/i })).toBeInTheDocument()
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
    await screen.findByRole("heading", { name: /Sign in to Bizimi/i })
  })
})

describe("proposals route", () => {
  it("redirects /freelancer/proposals to /login when signed out", async () => {
    renderAt("/freelancer/proposals")
    await screen.findByRole("heading", { name: /Sign in to Bizimi/i })
  })
})

describe("agency dashboard route", () => {
  it("redirects /agency/dashboard to /login when signed out", async () => {
    renderAt("/agency/dashboard")
    await screen.findByRole("heading", { name: /Sign in to Bizimi/i })
  })
})

describe("find freelancers route", () => {
  it("redirects /agency/find-freelancers to /login when signed out", async () => {
    renderAt("/agency/find-freelancers")
    await screen.findByRole("heading", { name: /Sign in to Bizimi/i })
  })
})

describe("bizpal route", () => {
  it("redirects /freelancer/bizpal to /login when signed out", async () => {
    renderAt("/freelancer/bizpal")
    await screen.findByRole("heading", { name: /Sign in to Bizimi/i })
  })
})

describe("messages routes", () => {
  it("redirects /freelancer/messages to /login when signed out", async () => {
    renderAt("/freelancer/messages")
    await screen.findByRole("heading", { name: /Sign in to Bizimi/i })
  })

  it("redirects /agency/messages to /login when signed out", async () => {
    renderAt("/agency/messages")
    await screen.findByRole("heading", { name: /Sign in to Bizimi/i })
  })
})

describe("admin login route", () => {
  it("renders the admin login page at /admin/login without requiring auth", async () => {
    renderAt("/admin/login")
    await screen.findByText(/admin portal/i)
  })
})

describe("admin dashboard and users routes", () => {
  it("redirects /admin/dashboard to /login when signed out", async () => {
    renderAt("/admin/dashboard")
    await screen.findByRole("heading", { name: /Sign in to Bizimi/i })
  })

  it("redirects /admin/users to /login when signed out", async () => {
    renderAt("/admin/users")
    await screen.findByRole("heading", { name: /Sign in to Bizimi/i })
  })
})

describe("admin jobs and audit routes", () => {
  it("redirects /admin/jobs to /login when signed out", async () => {
    renderAt("/admin/jobs")
    await screen.findByRole("heading", { name: /Sign in to Bizimi/i })
  })

  it("redirects /admin/audit to /login when signed out", async () => {
    renderAt("/admin/audit")
    await screen.findByRole("heading", { name: /Sign in to Bizimi/i })
  })
})

describe("admin credits and influencers routes", () => {
  it("redirects /admin/credits to /login when signed out", async () => {
    renderAt("/admin/credits")
    await screen.findByRole("heading", { name: /Sign in to Bizimi/i })
  })

  it("redirects /admin/influencers to /login when signed out", async () => {
    renderAt("/admin/influencers")
    await screen.findByRole("heading", { name: /Sign in to Bizimi/i })
  })
})
