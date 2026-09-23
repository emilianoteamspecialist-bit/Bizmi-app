# Phase 5a: Admin foundation (auth, users API, shared primitives) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the admin vertical's foundation in `client/`/`server/`: the `Tabs` UI primitive, the `AdminSidebar` nav component, the first admin server route (`GET /api/admin/users`, the first real consumer of the already-scaffolded `requireAdmin` middleware), the matching client query hook, and the admin login page — enough for an admin to sign in and reach a (currently route-stub) admin area.

**Architecture:** Same conventions as every prior phase of this migration: Express route behind `requireAuth` + `requireAdmin` (both already exist, `requireAdmin` unused until this plan), TanStack Query hook consuming it via `apiFetch`, React page component, wired into `App.tsx`. `requireAdmin` accepts `profile.role === "admin"` OR `profile.account_type === "admin"` (already implemented this way — the codebase uses both fields inconsistently, see `CLAUDE.md`).

**Tech Stack:** React 19, Vite, TanStack Query, React Router, Express, Supabase, `@radix-ui/react-tabs` (new dependency, version pinned to match the legacy app's `1.1.2`).

**Spec:** `docs/superpowers/specs/2026-09-08-nextjs-to-react-node-migration-design.md` (Phase 5 row: "Admin, disputes, influencer portals" — this plan covers the escrow-independent admin-auth/users slice only; `/admin/disputes` and `/admin/transactions` are explicitly out of scope, gated behind the still-incomplete Supabase-side escrow v2 migration per `docs/escrow-production-plan.md`).

## Global Constraints

- Admin authorization check is `profile.role === "admin" || profile.account_type === "admin"` — never just one field (`CLAUDE.md`).
- `requireAdmin` (`server/src/middleware/admin.ts`, already exists and tested) queries `profiles.role`/`profiles.account_type` via `req.supabase` and returns 403 if neither matches. Mount admin routes as `app.use("/api/admin", requireAuth, requireAdmin, adminRouter)` — `requireAdmin` assumes `requireAuth` already ran (needs `req.user`/`req.supabase`).
- Client-side role mismatch (logged in, not admin) redirects to `/` via `<Navigate to="/" replace />` — the exact pattern already used in `client/src/pages/freelancer/Dashboard.tsx:101-102` (`if (profile && profile.account_type !== "freelancer") return <Navigate to="/" replace />`). Do not build a new `RequireAdmin` wrapper component — every other role in this codebase does this as an inline check inside the page component, not a wrapper; stay consistent.
- Client-side "not logged in at all" case is handled by the existing generic `RequireAuth` component (redirects to `/login`, not `/admin/login`) — this is an intentional simplification from legacy (which redirected straight to `/admin/login`): `Login.tsx` already redirects post-sign-in by role including `admin → /admin/dashboard` (`client/src/pages/Login.tsx:47`), so the end state is identical either way, and it avoids a parallel "not authenticated" gate.
- **Deliberate simplification vs. legacy, do not "fix" back:** the legacy `AdminDashboardClient` wraps its layout in `@/components/ui/sidebar`'s `SidebarProvider`/`SidebarInset` (a 765-line shadcn primitive with mobile-drawer/collapse state) — but the actual `AdminSidebar` nav component it renders is a fully self-contained, self-positioning (`fixed inset-y-0 left-0`) custom component that does NOT use or need that primitive at all (confirmed by reading `components/admin-sidebar.tsx` — no import of the Sidebar primitive). Every other legacy admin page (`Users`, `Jobs`, `Audit`, `Credits`, `Influencers`) renders `AdminSidebar` inside a plain `<div className="flex h-screen bg-surface">`, without the Provider/Inset wrapper, with identical visual result. This plan ports `AdminSidebar` once and uses the plain flex layout everywhere, including the port of the Dashboard page (in the next sub-plan) — do not port the 765-line Sidebar primitive; it would be pure dead weight for zero behavior difference.
- `AdminSidebar`'s nav list includes links to admin routes not built by this plan yet (`/admin/jobs`, `/admin/audit`, `/admin/credits`, `/admin/influencers`, `/admin/transactions`, `/admin/disputes`, `/admin/analytics`) — port the full nav list as-is (matching legacy). Clicking an unbuilt route hits the app's catch-all (`<Route path="*" element={<Navigate to="/" replace />} />`) same as every other "not yet ported" link elsewhere in this migration (e.g. `FindFreelancers`'s contact button) — expected, not a bug to fix in this plan.
- Money-adjacent admin actions are out of scope for this plan (disable/enable user, job moderation, influencer payouts, audit log) — this plan is read-only (`GET /api/admin/users`) plus the login flow. The next sub-plan (5b) covers the first write path (`POST /api/admin/users/:id/disable`) and needs its own security-focused final review given the established pattern of financial/account-action bugs surfacing in this migration.

---

## Task 1: Port the `Tabs` UI primitive

**Files:**
- Create: `client/src/components/ui/tabs.tsx`
- Test: `client/src/components/ui/tabs.test.tsx`
- Modify: `client/package.json` (add `@radix-ui/react-tabs`)

**Interfaces:**
- Produces: `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` — consumed by Task 7 (AdminDashboard, next sub-plan) and Task 8 (AdminUsers, next sub-plan). Not consumed within this plan itself.

- [ ] **Step 1: Add the dependency**

Add to `client/package.json`'s `dependencies` block, alphabetically among the existing `@radix-ui/*` entries (matching the legacy app's pinned version):

```json
    "@radix-ui/react-tabs": "1.1.2",
```

Run: `cd client && npm install`
Expected: installs cleanly, `client/package-lock.json` updates.

- [ ] **Step 2: Write the failing test**

```tsx
// client/src/components/ui/tabs.test.tsx
import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./tabs"

describe("Tabs", () => {
  it("shows the default tab's content and switches on trigger click", async () => {
    const { default: userEvent } = await import("@testing-library/user-event")
    const user = userEvent.setup()

    render(
      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="agencies">Agencies</TabsTrigger>
        </TabsList>
        <TabsContent value="all">All content</TabsContent>
        <TabsContent value="agencies">Agencies content</TabsContent>
      </Tabs>
    )

    expect(screen.getByText("All content")).toBeInTheDocument()
    expect(screen.queryByText("Agencies content")).not.toBeInTheDocument()

    await user.click(screen.getByRole("tab", { name: "Agencies" }))

    expect(screen.getByText("Agencies content")).toBeInTheDocument()
    expect(screen.queryByText("All content")).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `cd client && npx vitest run src/components/ui/tabs.test.tsx`
Expected: FAIL — `Cannot find module './tabs'`

- [ ] **Step 4: Implement the primitive**

```tsx
// client/src/components/ui/tabs.tsx
import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"

import { cn } from "@/lib/utils"

const Tabs = TabsPrimitive.Root

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      "inline-flex h-10 items-center justify-center rounded-xl bg-muted p-1 text-muted-foreground",
      className
    )}
    {...props}
  />
))
TabsList.displayName = TabsPrimitive.List.displayName

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm",
      className
    )}
    {...props}
  />
))
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      className
    )}
    {...props}
  />
))
TabsContent.displayName = TabsPrimitive.Content.displayName

export { Tabs, TabsList, TabsTrigger, TabsContent }
```

Note: the legacy source (`components/ui/tabs.tsx:32`) has `data-[state=active]:text-primaryoreground` — a stray leftover from a find-replace typo (`primary` + `oreground`, should be `text-foreground`). Fixed above; do not port the typo.

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd client && npx vitest run src/components/ui/tabs.test.tsx`
Expected: PASS

- [ ] **Step 6: Run tsc**

Run: `cd client && npx tsc --noEmit`
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add client/package.json client/package-lock.json client/src/components/ui/tabs.tsx client/src/components/ui/tabs.test.tsx
git commit -m "Port Tabs UI primitive to client"
```

---

## Task 2: Port the `AdminSidebar` nav component

**Files:**
- Create: `client/src/components/AdminSidebar.tsx`
- Test: `client/src/components/AdminSidebar.test.tsx`

**Interfaces:**
- Consumes: `useAuth` (`@/contexts/AuthContext`, existing) for `signOut()`.
- Produces: default export `AdminSidebar` (no props) — consumed by Task 7/8 (AdminDashboard, AdminUsers) in the next sub-plan, not within this plan.

- [ ] **Step 1: Write the failing test**

```tsx
// client/src/components/AdminSidebar.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"

const signOutMock = vi.fn()
vi.mock("../contexts/AuthContext", () => ({ useAuth: () => ({ signOut: signOutMock }) }))

const navigateMock = vi.fn()
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom")
  return { ...actual, useNavigate: () => navigateMock }
})

beforeEach(() => vi.clearAllMocks())

describe("AdminSidebar", () => {
  it("renders every nav link", async () => {
    const { default: AdminSidebar } = await import("./AdminSidebar")
    render(<MemoryRouter><AdminSidebar /></MemoryRouter>)

    for (const name of ["Dashboard", "Transactions", "Credits", "Analytics", "Disputes", "Jobs", "Influencers", "Users", "Audit Log"]) {
      expect(screen.getByRole("link", { name })).toBeInTheDocument()
    }
  })

  it("highlights the active route", async () => {
    const { default: AdminSidebar } = await import("./AdminSidebar")
    render(<MemoryRouter initialEntries={["/admin/users"]}><AdminSidebar /></MemoryRouter>)

    expect(screen.getByRole("link", { name: "Users" })).toHaveClass("bg-primary")
    expect(screen.getByRole("link", { name: "Dashboard" })).not.toHaveClass("bg-primary")
  })

  it("signs out and navigates to /admin/login on logout", async () => {
    const { default: userEvent } = await import("@testing-library/user-event")
    const user = userEvent.setup()
    const { default: AdminSidebar } = await import("./AdminSidebar")
    render(<MemoryRouter><AdminSidebar /></MemoryRouter>)

    await user.click(screen.getByRole("button", { name: /logout/i }))

    expect(signOutMock).toHaveBeenCalled()
    expect(navigateMock).toHaveBeenCalledWith("/admin/login")
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd client && npx vitest run src/components/AdminSidebar.test.tsx`
Expected: FAIL — `Cannot find module './AdminSidebar'`

- [ ] **Step 3: Implement the component**

```tsx
// client/src/components/AdminSidebar.tsx
import { useState } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import { LayoutDashboard, CreditCard, DollarSign, BarChart3, LogOut, Menu, X, ShieldAlert, Users, ScrollText, Briefcase, Megaphone } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"

const navigation = [
  { name: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
  { name: "Transactions", href: "/admin/transactions", icon: CreditCard },
  { name: "Credits", href: "/admin/credits", icon: DollarSign },
  { name: "Analytics", href: "/admin/analytics", icon: BarChart3 },
  { name: "Disputes", href: "/admin/disputes", icon: ShieldAlert },
  { name: "Jobs", href: "/admin/jobs", icon: Briefcase },
  { name: "Influencers", href: "/admin/influencers", icon: Megaphone },
  { name: "Users", href: "/admin/users", icon: Users },
  { name: "Audit Log", href: "/admin/audit", icon: ScrollText },
]

export default function AdminSidebar() {
  const location = useLocation()
  const navigate = useNavigate()
  const { signOut } = useAuth()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  const handleLogout = async () => {
    await signOut()
    navigate("/admin/login")
  }

  return (
    <>
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="bg-white p-2 rounded-xl shadow-md" aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}>
          {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      <div
        className={`
        fixed inset-y-0 left-0 z-40 w-64 bg-gradient-to-b from-aubergine to-ink text-white shadow-xl transform transition-transform duration-300 ease-in-out
        lg:translate-x-0 lg:static lg:inset-0
        ${isMobileMenuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
      `}
      >
        <div className="flex flex-col h-full">
          <div className="flex items-center gap-2.5 h-16 px-5 border-b border-white/10">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
              <ShieldAlert className="h-4 w-4 text-white" />
            </div>
            <div className="leading-tight">
              <p className="text-sm font-semibold">Admin</p>
              <p className="text-[10px] text-white/50">Bizimi console</p>
            </div>
          </div>

          <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto">
            {navigation.map((item) => {
              const isActive = location.pathname === item.href
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`
                    flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors
                    ${
                      isActive
                        ? "bg-primary text-white shadow-sm shadow-primary/30"
                        : "text-white/70 hover:bg-white/10 hover:text-white"
                    }
                  `}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <item.icon className="h-5 w-5 shrink-0" />
                  {item.name}
                </Link>
              )
            })}
          </nav>

          <div className="p-3 border-t border-white/10">
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 w-full px-3 py-2.5 text-sm font-medium text-white/70 rounded-lg hover:bg-white/10 hover:text-white transition-colors"
            >
              <LogOut className="h-5 w-5 shrink-0" />
              Logout
            </button>
          </div>
        </div>
      </div>

      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-30 bg-black bg-opacity-50 lg:hidden" onClick={() => setIsMobileMenuOpen(false)} />
      )}
    </>
  )
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd client && npx vitest run src/components/AdminSidebar.test.tsx`
Expected: PASS

- [ ] **Step 5: Run tsc**

Run: `cd client && npx tsc --noEmit`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add client/src/components/AdminSidebar.tsx client/src/components/AdminSidebar.test.tsx
git commit -m "Port AdminSidebar nav component to client"
```

---

## Task 3: `GET /api/admin/users` server route + mount the admin router

**Files:**
- Create: `server/src/routes/admin.ts`
- Test: `server/src/routes/admin.test.ts`
- Modify: `server/src/app.ts`

**Interfaces:**
- Produces: `GET /api/admin/users` — response `{ users: AdminUser[] }` where `AdminUser = { id, email, full_name, account_type, created_at, wallet_balance }`, ordered by `created_at` descending. Mounted at `/api/admin` behind `requireAuth, requireAdmin`.

- [ ] **Step 1: Write the failing test**

```ts
// server/src/routes/admin.test.ts
import { describe, it, expect, vi } from "vitest"
import request from "supertest"
import express from "express"
import adminRouter from "./admin.js"

function appWith(supabase: any) {
  const app = express()
  app.use(express.json())
  app.use((req: any, _res, next) => {
    req.user = { id: "admin-1" }
    req.supabase = supabase
    next()
  })
  app.use("/", adminRouter)
  return app
}

describe("GET /users", () => {
  it("lists all profiles, newest first", async () => {
    const orderMock = vi.fn().mockResolvedValue({
      data: [
        { id: "u-1", email: "a@x.com", full_name: "Agency A", account_type: "agency", created_at: "2026-01-02T00:00:00Z", wallet_balance: 5000 },
        { id: "u-2", email: "f@x.com", full_name: "Freelancer F", account_type: "freelancer", created_at: "2026-01-01T00:00:00Z", wallet_balance: null },
      ],
      error: null,
    })
    const supabase = { from: vi.fn(() => ({ select: vi.fn(() => ({ order: orderMock })) })) }

    const res = await request(appWith(supabase)).get("/users")

    expect(res.status).toBe(200)
    expect(supabase.from).toHaveBeenCalledWith("profiles")
    expect(orderMock).toHaveBeenCalledWith("created_at", { ascending: false })
    expect(res.body.users).toHaveLength(2)
    expect(res.body.users[0].id).toBe("u-1")
  })

  it("returns an empty list on a query error", async () => {
    const supabase = { from: vi.fn(() => ({ select: vi.fn(() => ({ order: vi.fn().mockResolvedValue({ data: null, error: { message: "boom" } }) })) })) }
    const res = await request(appWith(supabase)).get("/users")
    expect(res.body).toEqual({ users: [] })
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd server && npx vitest run src/routes/admin.test.ts`
Expected: FAIL — `Cannot find module './admin.js'`

- [ ] **Step 3: Implement the route**

```ts
// server/src/routes/admin.ts
import { Router } from "express"
import { asyncHandler } from "../lib/http.js"

const adminRouter = Router()

adminRouter.get(
  "/users",
  asyncHandler(async (req, res) => {
    const { data, error } = await req.supabase!
      .from("profiles")
      .select("id, email, full_name, account_type, created_at, wallet_balance")
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Error fetching admin users list:", error)
      res.json({ users: [] })
      return
    }

    res.json({ users: data || [] })
  })
)

export default adminRouter
```

- [ ] **Step 4: Mount the router in `app.ts`**

Read the current `server/src/app.ts` first. Add the import alongside the existing route imports:

```ts
import adminRouter from "./routes/admin.js"
```

Add the middleware import alongside the existing `requireAuth` import:

```ts
import { requireAdmin } from "./middleware/admin.js"
```

Add the mount alongside the existing `app.use("/api/...", requireAuth, ...)` lines:

```ts
  app.use("/api/admin", requireAuth, requireAdmin, adminRouter)
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd server && npx vitest run src/routes/admin.test.ts`
Expected: PASS

- [ ] **Step 6: Run the full server test suite**

Run: `cd server && npx vitest run`
Expected: PASS (all files, including the existing `middleware/admin.test.ts` which already covers `requireAdmin` itself — this task only newly *consumes* it)

- [ ] **Step 7: Run tsc**

Run: `cd server && npx tsc --noEmit`
Expected: only the known pre-existing `src/routes/user.test.ts(230,52)` tuple-type error — nothing else.

- [ ] **Step 8: Commit**

```bash
git add server/src/routes/admin.ts server/src/routes/admin.test.ts server/src/app.ts
git commit -m "feat(server): add GET /api/admin/users, mount admin router behind requireAdmin"
```

---

## Task 4: Client `useAdminUsersQuery` hook

**Files:**
- Create: `client/src/lib/queries/admin.ts`
- Test: `client/src/lib/queries/admin.test.tsx`

**Interfaces:**
- Consumes: `apiFetch` (`client/src/lib/api.ts`, existing).
- Produces: `AdminUser` type, `useAdminUsersQuery()`. Consumed by the next sub-plan's `AdminDashboard`/`AdminUsers` pages, not within this plan.

- [ ] **Step 1: Write the failing test**

```tsx
// client/src/lib/queries/admin.test.tsx
import { describe, it, expect, vi } from "vitest"
import { renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { ReactNode } from "react"

const apiFetchMock = vi.fn()
vi.mock("../api", () => ({ apiFetch: (...args: unknown[]) => apiFetchMock(...args) }))

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

describe("useAdminUsersQuery", () => {
  it("GETs /api/admin/users", async () => {
    apiFetchMock.mockResolvedValue({ users: [{ id: "u-1", email: "a@x.com", full_name: "Agency A", account_type: "agency", created_at: "2026-01-01T00:00:00Z", wallet_balance: 5000 }] })
    const { useAdminUsersQuery } = await import("./admin")

    const { result } = renderHook(() => useAdminUsersQuery(), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(apiFetchMock).toHaveBeenCalledWith("/api/admin/users")
    expect(result.current.data?.users[0].full_name).toBe("Agency A")
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd client && npx vitest run src/lib/queries/admin.test.tsx`
Expected: FAIL — `client/src/lib/queries/admin.ts` doesn't exist yet.

- [ ] **Step 3: Implement the hook**

```ts
// client/src/lib/queries/admin.ts
import { useQuery } from "@tanstack/react-query"
import { apiFetch } from "../api"

export type AdminUser = {
  id: string
  email: string
  full_name: string
  account_type: string
  created_at: string
  wallet_balance: number | null
}

export function useAdminUsersQuery() {
  return useQuery({
    queryKey: ["admin", "users"],
    queryFn: () => apiFetch<{ users: AdminUser[] }>("/api/admin/users"),
  })
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd client && npx vitest run src/lib/queries/admin.test.tsx`
Expected: PASS

- [ ] **Step 5: Run tsc**

Run: `cd client && npx tsc --noEmit`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add client/src/lib/queries/admin.ts client/src/lib/queries/admin.test.tsx
git commit -m "feat(client): add useAdminUsersQuery hook"
```

---

## Task 5: `AdminLogin` page

**Files:**
- Create: `client/src/pages/admin/Login.tsx`
- Test: `client/src/pages/admin/Login.test.tsx`

**Interfaces:**
- Consumes: `supabase` (`client/src/lib/supabase.ts`, existing) directly for sign-in + the post-sign-in profile check (matching the legacy page and the already-ported top-level `Login.tsx`, neither of which route this through `AuthContext`'s `useAuth()` for the sign-in call itself — `AuthContext`'s own `onAuthStateChange` listener reacts automatically).
- Produces: default export `AdminLogin`. Consumed by the route wiring in Task 6.

- [ ] **Step 1: Write the failing test**

```tsx
// client/src/pages/admin/Login.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"

const navigateMock = vi.fn()
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom")
  return { ...actual, useNavigate: () => navigateMock }
})

const signInWithPasswordMock = vi.fn()
const signOutMock = vi.fn()
const singleMock = vi.fn()
vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: { signInWithPassword: (...args: unknown[]) => signInWithPasswordMock(...args), signOut: (...args: unknown[]) => signOutMock(...args) },
    from: vi.fn(() => ({ select: vi.fn(() => ({ eq: vi.fn(() => ({ single: singleMock })) })) })),
  },
}))

import AdminLogin from "./Login"

beforeEach(() => vi.clearAllMocks())

function renderPage() {
  return render(<MemoryRouter><AdminLogin /></MemoryRouter>)
}

async function submit(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/email/i), "admin@bizimi.com")
  await user.type(screen.getByLabelText(/password/i), "hunter2")
  await user.click(screen.getByRole("button", { name: /sign in/i }))
}

describe("AdminLogin", () => {
  it("signs in and navigates to /admin/dashboard when the profile is an admin", async () => {
    const user = userEvent.setup()
    signInWithPasswordMock.mockResolvedValue({ data: { user: { id: "admin-1" } }, error: null })
    singleMock.mockResolvedValue({ data: { role: "admin" }, error: null })
    renderPage()

    await submit(user)

    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith("/admin/dashboard"))
    expect(signOutMock).not.toHaveBeenCalled()
  })

  it("signs the user back out and shows an error when the profile is not an admin", async () => {
    const user = userEvent.setup()
    signInWithPasswordMock.mockResolvedValue({ data: { user: { id: "u-2" } }, error: null })
    singleMock.mockResolvedValue({ data: { role: "freelancer" }, error: null })
    renderPage()

    await submit(user)

    await waitFor(() => expect(signOutMock).toHaveBeenCalled())
    expect(screen.getByText(/access denied/i)).toBeInTheDocument()
    expect(navigateMock).not.toHaveBeenCalled()
  })

  it("shows the auth error message when sign-in fails", async () => {
    const user = userEvent.setup()
    // Real Supabase AuthError instances extend Error — mock as a real Error, not a
    // plain {message} object, so it actually exercises the `err instanceof Error`
    // branch in the component (a plain object would silently fall through to the
    // generic fallback message and this test would be asserting dead code).
    signInWithPasswordMock.mockResolvedValue({ data: { user: null }, error: new Error("Invalid login credentials") })
    renderPage()

    await submit(user)

    await waitFor(() => expect(screen.getByText("Invalid login credentials")).toBeInTheDocument())
    expect(navigateMock).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd client && npx vitest run src/pages/admin/Login.test.tsx`
Expected: FAIL — `Cannot find module './Login'`

- [ ] **Step 3: Implement the page**

```tsx
// client/src/pages/admin/Login.tsx
import type React from "react"
import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { supabase } from "@/lib/supabase"

export default function AdminLogin() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password })

      if (authError) throw authError

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", data.user!.id)
        .single()

      if (profileError || profile?.role !== "admin") {
        await supabase.auth.signOut()
        throw new Error("Access denied. Admin privileges required.")
      }

      navigate("/admin/dashboard")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-orange-100">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
            </div>
            <h1 className="text-primaryxl font-bold text-slate-900 mb-2">Admin Portal</h1>
            <p className="text-slate-600">Sign in to access the admin dashboard</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6" noValidate>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-2">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-colors"
                placeholder="Enter your email"
                required
                disabled={loading}
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-2">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-colors"
                placeholder="Enter your password"
                required
                disabled={loading}
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-white py-3 px-4 rounded-lg hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>

          <div className="mt-8 text-center">
            <p className="text-xs text-slate-500">Authorized personnel only. All activities are logged.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
```

Note: `noValidate` is added to the `<form>` (not present in the legacy version) — this migration's established fix for native HTML5 `required` validation silently blocking `onSubmit` in some browsers/test environments (see `TopUpCreditsModal.tsx` for precedent). The visible `required` attributes stay for the native affordance; `noValidate` just stops them from intercepting submission.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd client && npx vitest run src/pages/admin/Login.test.tsx`
Expected: PASS

- [ ] **Step 5: Run tsc**

Run: `cd client && npx tsc --noEmit`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add client/src/pages/admin/Login.tsx client/src/pages/admin/Login.test.tsx
git commit -m "Port admin login page to client"
```

---

## Task 6: Wire `/admin/login` into `App.tsx`

**Files:**
- Modify: `client/src/App.tsx`
- Test: `client/src/App.test.tsx` (extend)

**Interfaces:** none new — wires Task 5's page in as a public route (not wrapped in `RequireAuth`, matching how `/login` itself is mounted).

- [ ] **Step 1: Write the failing test**

Add to `client/src/App.test.tsx` (a new top-level `describe`, after the existing route describes):

```tsx
describe("admin login route", () => {
  it("renders the admin login page at /admin/login without requiring auth", async () => {
    renderAt("/admin/login")
    await screen.findByText(/admin portal/i)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd client && npx vitest run src/App.test.tsx -t "admin login route"`
Expected: FAIL — route not registered yet.

- [ ] **Step 3: Update `client/src/App.tsx`**

Read the current file first. Add the import alongside the other page imports:

```tsx
import AdminLogin from "./pages/admin/Login"
```

Add the route alongside the other public routes (`/login`, `/signup`), NOT inside a `RequireAuth` wrapper, and before the catch-all:

```tsx
            <Route path="/admin/login" element={<AdminLogin />} />
```

- [ ] **Step 4: Update `App.test.tsx`'s `renderAt` helper**

Add the same import and route to the helper's local `<Routes>` table, matching the existing pattern for every other route added there.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd client && npx vitest run src/App.test.tsx`
Expected: PASS

- [ ] **Step 6: Run the full client test suite**

Run: `cd client && npm test`
Expected: All tests PASS

- [ ] **Step 7: Run tsc**

Run: `cd client && npx tsc --noEmit`
Expected: clean.

- [ ] **Step 8: Commit**

```bash
git add client/src/App.tsx client/src/App.test.tsx
git commit -m "Wire /admin/login route"
```

---

## Post-Phase-5a note

This plan intentionally stops short of a usable admin dashboard — `/admin/dashboard` and `/admin/users` themselves, plus the first admin write path (`POST /api/admin/users/:id/disable`) and the `admin_audit_log` port, are the next sub-plan (5b), which needs its own security-focused final review given this migration's established pattern of real bugs surfacing in account-action/financial-adjacent admin code. After 5b: 5c (jobs moderation + audit log page), 5d (credits oversight + influencer program admin), 5e (influencer self-service portal: dashboard, referrals, earnings) — all still escrow-independent. `/admin/disputes`, `/admin/transactions`, `/disputes/[id]` remain blocked behind the Supabase-side escrow v2 migration.
