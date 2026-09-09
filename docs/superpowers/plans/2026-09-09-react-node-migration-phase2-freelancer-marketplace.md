# React + Node Migration — Phase 2a (Freelancer Dashboard + Saved Jobs) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give `client/` its first real, data-driven authenticated pages: `/freelancer/dashboard` (stat tiles + a "matched briefs" preview with bookmark/apply/view-agency actions) and `/freelancer/saved-jobs` (the freelancer's bookmarked jobs, with the same apply flow), both wired to the Express endpoints Phase 1 already built. This is the first slice of the spec's Phase 2 row ("Freelancer + agency core") — the full marketplace browse page, agency-side pages, and profile editors are separate follow-on plans.

**Architecture:** `client/` adds `@tanstack/react-query` for server-state (the spec's stated replacement for Next's server-component fetching) and a client-side `AuthContext` + `RequireAuth` route guard (nothing in `client/` currently checks the session before rendering a protected page). Every data need funnels through a small `client/src/lib/queries/*.ts` layer of typed hooks wrapping the existing `apiFetch` helper — pages never call `apiFetch` directly. One new, small server endpoint is added (`GET /api/agencies/:agencyId/image`) because the current app fetches another agency's public logo via a direct browser Supabase query that has no Phase-1 equivalent (Phase 1's `GET /api/user/agency-image` is self-scoped only).

**Tech Stack:** Same as Phase 0/1 client stack, plus `@tanstack/react-query` (new) and four more shadcn/Radix primitives (`Dialog`, `Avatar`, `Select`, `Sheet`, `Textarea` — `Textarea` needs no Radix package). Server side: same Express/TypeScript/Vitest/Supertest stack as Phase 1, one new route file.

**Spec:** `docs/superpowers/specs/2026-09-08-nextjs-to-react-node-migration-design.md` (Section 7, Phase 2 row; Section 6 for the UI direction this plan's ported pages already satisfy — card-driven browsing, stat-tile dashboards — since the original pages were already built close to that direction)

## Global Constraints

- No SSR — `client/` is a pure SPA. Where the original Next.js pages fetched data server-side before render (`app/freelancer/dashboard/page.tsx`, `app/freelancer/saved-jobs/page.tsx`), the ported pages fetch client-side on mount via TanStack Query and show a loading skeleton until data arrives — this is the accepted, spec'd tradeoff (Section 2, SEO/SSR non-goal), not a regression to fix.
- `RequireAuth` only checks "is there an authenticated session" — it does not redirect based on `account_type` (agency/admin/influencer dashboards don't exist in `client/` yet). Instead, `Dashboard.tsx` itself redirects to `/` if the signed-in user's `account_type` isn't `"freelancer"`, since the original's agency/admin/influencer redirect targets (`/agency/dashboard`, `/admin/dashboard`, `/influencer/dashboard`) aren't built yet — redirecting to a 404 would be worse than redirecting home. This is a deliberate, minimal adaptation to the current state of the port, not a design change.
- Every new page/component in this plan imports UI primitives from `@/components/ui/*` and shared components from `@/components/shared/*`, matching the existing `client/` alias convention (`components.json` from Phase 0).
- `getAvatarUrl` on the client reads `import.meta.env.VITE_SUPABASE_URL` (the client's own env var, already defined in `client/.env`/`client/.env.example` since Phase 0) — never `SUPABASE_URL` (that's server-only).
- The new `GET /api/agencies/:agencyId/image` route follows Phase 1's established conventions: mounted behind `requireAuth`, wrapped in `asyncHandler`, returns `{ image: string | null }` (matching `GET /api/user/agency-image`'s shape), uses the caller's own RLS-scoped `req.supabase` (never the service-role client — this is a user-facing read).
- Money/credits math is never computed client-side beyond display formatting — `submitProposal`'s credit deduction already happens server-side (Phase 1); the client only sends `budget`/`timeline`/`proposal_text`/`creditCost` and displays the server's response.

---

## Task 1: Add TanStack Query (`client/src/lib/queryClient.ts`)

**Files:**
- Modify: `client/package.json` (add `@tanstack/react-query`)
- Create: `client/src/lib/queryClient.ts`
- Modify: `client/src/App.tsx` (wrap routes in `QueryClientProvider`)
- Test: `client/src/App.test.tsx` (extend)

**Interfaces:**
- Produces: `queryClient` (a `QueryClient` singleton) from `client/src/lib/queryClient.ts`. Every task from here on that adds a `useQuery`/`useMutation` hook relies on `<QueryClientProvider client={queryClient}>` being mounted above it in the tree — this task provides that.

- [ ] **Step 1: Add the dependency**

Edit `client/package.json` — add to `dependencies` (alphabetized alongside the existing entries):

```json
    "@tanstack/react-query": "^5.62.0",
```

- [ ] **Step 2: Install**

Run: `cd client && npm install`
Expected: installs cleanly

- [ ] **Step 3: Create `client/src/lib/queryClient.ts`**

```typescript
import { QueryClient } from "@tanstack/react-query"

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
})
```

- [ ] **Step 4: Write the failing test**

```tsx
// client/src/App.test.tsx — add this describe block to the existing file
describe("QueryClientProvider", () => {
  it("renders the app without a 'No QueryClient set' error", () => {
    // A component using useQuery outside a provider throws synchronously on
    // render — rendering the full App at "/" and not throwing is proof the
    // provider is mounted above the router.
    expect(() => renderAt("/")).not.toThrow()
  })
})
```

- [ ] **Step 5: Run test to verify it fails**

Run: `cd client && npx vitest run src/App.test.tsx`
Expected: this specific test PASSES even before Step 6 (nothing in the current tree uses `useQuery` yet, so it can't throw) — this is expected and fine; the real proof comes from Task 6 onward, where every new hook-using component would immediately throw without this provider. Confirm the existing App tests still pass, and proceed.

- [ ] **Step 6: Wrap the app in `QueryClientProvider`**

```tsx
// client/src/App.tsx
import { BrowserRouter, Routes, Route } from "react-router-dom"
import { QueryClientProvider } from "@tanstack/react-query"
import { queryClient } from "./lib/queryClient"
import Landing from "./pages/Landing"
import Login from "./pages/Login"
import Signup from "./pages/Signup"

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `cd client && npx vitest run src/App.test.tsx`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add client/package.json client/package-lock.json client/src/lib/queryClient.ts client/src/App.tsx client/src/App.test.tsx
git commit -m "Add TanStack Query and mount QueryClientProvider"
```

---

## Task 2: Client `AuthContext` + `RequireAuth` route guard

**Files:**
- Create: `client/src/contexts/AuthContext.tsx`
- Create: `client/src/components/RequireAuth.tsx`
- Test: `client/src/contexts/AuthContext.test.tsx`
- Test: `client/src/components/RequireAuth.test.tsx`

**Interfaces:**
- Consumes: `supabase` (`client/src/lib/supabase.ts`, Phase 0).
- Produces: `AuthProvider` (wraps the app) and `useAuth()` (returns `{ user, profile, loading, refreshProfile, signOut }`) from `client/src/contexts/AuthContext.tsx`; `RequireAuth` (a component taking `children: ReactNode`, rendering a redirect to `/login` when unauthenticated) from `client/src/components/RequireAuth.tsx`. Tasks 7-8's pages consume `useAuth()` for the current user/profile and are wrapped in `RequireAuth` at the route level (Task 9).

- [ ] **Step 1: Write the failing test for `AuthContext`**

```tsx
// client/src/contexts/AuthContext.test.tsx
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client && npx vitest run src/contexts/AuthContext.test.tsx`
Expected: FAIL — `Cannot find module './AuthContext'`

- [ ] **Step 3: Write `client/src/contexts/AuthContext.tsx`**

```tsx
import type React from "react"
import { createContext, useContext, useEffect, useState } from "react"
import type { User } from "@supabase/supabase-js"
import { supabase } from "../lib/supabase"

interface AuthContextType {
  user: User | null
  profile: any | null
  loading: boolean
  refreshProfile: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  refreshProfile: async () => {},
  signOut: async () => {},
})

export const useAuth = () => useContext(AuthContext)

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchProfile = async (userId: string) => {
    const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).single()
    if (error) {
      console.error("Error fetching profile:", error)
      return
    }
    setProfile(data)
  }

  useEffect(() => {
    let isMounted = true

    const init = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!isMounted) return

      if (session?.user) {
        setUser(session.user)
        await fetchProfile(session.user.id)
      }
      setLoading(false)
    }

    init()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event: string, session: { user: User } | null) => {
      if (!isMounted) return

      if (session?.user) {
        setUser(session.user)
        if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
          await fetchProfile(session.user.id)
        }
      } else if (event === "SIGNED_OUT") {
        setUser(null)
        setProfile(null)
      }
      setLoading(false)
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [])

  const refreshProfile = async () => {
    if (user?.id) await fetchProfile(user.id)
  }

  const signOut = async () => {
    setUser(null)
    setProfile(null)
    try {
      await supabase.auth.signOut({ scope: "local" })
    } catch {
      /* session already gone locally — nothing to do */
    }
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, refreshProfile, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd client && npx vitest run src/contexts/AuthContext.test.tsx`
Expected: PASS

- [ ] **Step 5: Write the failing test for `RequireAuth`**

```tsx
// client/src/components/RequireAuth.test.tsx
import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { MemoryRouter, Routes, Route } from "react-router-dom"
import RequireAuth from "./RequireAuth"

const useAuthMock = vi.fn()
vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => useAuthMock(),
}))

function renderAt(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/login" element={<div>login page</div>} />
        <Route
          path="/protected"
          element={
            <RequireAuth>
              <div>secret content</div>
            </RequireAuth>
          }
        />
      </Routes>
    </MemoryRouter>
  )
}

describe("RequireAuth", () => {
  it("shows nothing (no redirect) while auth is still loading", () => {
    useAuthMock.mockReturnValue({ user: null, loading: true })
    renderAt("/protected")
    expect(screen.queryByText("secret content")).not.toBeInTheDocument()
    expect(screen.queryByText("login page")).not.toBeInTheDocument()
  })

  it("redirects to /login when there is no user", () => {
    useAuthMock.mockReturnValue({ user: null, loading: false })
    renderAt("/protected")
    expect(screen.getByText("login page")).toBeInTheDocument()
  })

  it("renders children when a user is present", () => {
    useAuthMock.mockReturnValue({ user: { id: "user-1" }, loading: false })
    renderAt("/protected")
    expect(screen.getByText("secret content")).toBeInTheDocument()
  })
})
```

- [ ] **Step 6: Run test to verify it fails**

Run: `cd client && npx vitest run src/components/RequireAuth.test.tsx`
Expected: FAIL — `Cannot find module './RequireAuth'`

- [ ] **Step 7: Write `client/src/components/RequireAuth.tsx`**

```tsx
import type { ReactNode } from "react"
import { Navigate } from "react-router-dom"
import { useAuth } from "../contexts/AuthContext"

export default function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) return null
  if (!user) return <Navigate to="/login" replace />

  return <>{children}</>
}
```

- [ ] **Step 8: Run tests to verify they pass**

Run: `cd client && npx vitest run src/contexts/AuthContext.test.tsx src/components/RequireAuth.test.tsx`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add client/src/contexts/AuthContext.tsx client/src/contexts/AuthContext.test.tsx client/src/components/RequireAuth.tsx client/src/components/RequireAuth.test.tsx
git commit -m "Add client AuthContext and RequireAuth route guard"
```

---

## Task 3: Port UI primitives (Dialog, Avatar, Select, Sheet, Textarea)

**Files:**
- Modify: `client/package.json` (add `@radix-ui/react-dialog`, `@radix-ui/react-avatar`, `@radix-ui/react-select`)
- Create: `client/src/components/ui/dialog.tsx`
- Create: `client/src/components/ui/avatar.tsx`
- Create: `client/src/components/ui/select.tsx`
- Create: `client/src/components/ui/sheet.tsx`
- Create: `client/src/components/ui/textarea.tsx`
- Test: `client/src/components/ui/dialog.test.tsx`

**Interfaces:**
- Produces: `Dialog`/`DialogContent`/`DialogHeader`/`DialogTitle`/`DialogDescription`, `Avatar`/`AvatarImage`/`AvatarFallback`, `Select`/`SelectTrigger`/`SelectContent`/`SelectItem`/`SelectValue`, `Sheet`/`SheetContent`/`SheetHeader`/`SheetTitle`/`SheetDescription`, `Textarea` — same names/props as the existing root `components/ui/*`. Task 4's `Modal` imports the `Dialog*` set; Tasks 7-8 import all of these directly.

- [ ] **Step 1: Add the Radix dependencies**

Edit `client/package.json` — add to `dependencies` (alphabetized):

```json
    "@radix-ui/react-avatar": "1.1.2",
    "@radix-ui/react-dialog": "1.1.4",
    "@radix-ui/react-select": "2.1.4",
```

(Versions match what the root app already pins in `package.json`.)

- [ ] **Step 2: Install**

Run: `cd client && npm install`
Expected: installs cleanly

- [ ] **Step 3: Create `client/src/components/ui/dialog.tsx`** (exact copy of `components/ui/dialog.tsx`, no `"use client"`)

```tsx
import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"

const Dialog = DialogPrimitive.Root
const DialogTrigger = DialogPrimitive.Trigger
const DialogPortal = DialogPrimitive.Portal
const DialogClose = DialogPrimitive.Close

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/80  data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
  />
))
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-xl duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-xl",
        className
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
        <X className="h-4 w-4" />
        <span className="sr-only">Close</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPortal>
))
DialogContent.displayName = DialogPrimitive.Content.displayName

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col space-y-1.5 text-center sm:text-left", className)} {...props} />
)
DialogHeader.displayName = "DialogHeader"

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("text-lg font-bold font-heading leading-none tracking-tight", className)}
    {...props}
  />
))
DialogTitle.displayName = DialogPrimitive.Title.displayName

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
))
DialogDescription.displayName = DialogPrimitive.Description.displayName

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
}
```

- [ ] **Step 4: Create `client/src/components/ui/avatar.tsx`** (exact copy of `components/ui/avatar.tsx`, no `"use client"`)

```tsx
import * as React from "react"
import * as AvatarPrimitive from "@radix-ui/react-avatar"

import { cn } from "@/lib/utils"

const Avatar = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Root ref={ref} className={cn("relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full", className)} {...props} />
))
Avatar.displayName = AvatarPrimitive.Root.displayName

const AvatarImage = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Image>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Image>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Image ref={ref} className={cn("aspect-square h-full w-full", className)} {...props} />
))
AvatarImage.displayName = AvatarPrimitive.Image.displayName

const AvatarFallback = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Fallback>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Fallback ref={ref} className={cn("flex h-full w-full items-center justify-center rounded-full bg-muted", className)} {...props} />
))
AvatarFallback.displayName = AvatarPrimitive.Fallback.displayName

export { Avatar, AvatarImage, AvatarFallback }
```

- [ ] **Step 5: Create `client/src/components/ui/select.tsx`** (exact copy of `components/ui/select.tsx`, no `"use client"`)

```tsx
import * as React from "react"
import * as SelectPrimitive from "@radix-ui/react-select"
import { Check, ChevronDown, ChevronUp } from "lucide-react"

import { cn } from "@/lib/utils"

const Select = SelectPrimitive.Root
const SelectGroup = SelectPrimitive.Group
const SelectValue = SelectPrimitive.Value

const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    className={cn(
      "flex h-12 w-full items-center justify-between rounded-md border border-input bg-background px-4 py-2 text-sm ring-offset-background transition-all placeholder:text-muted-foreground focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1",
      className
    )}
    {...props}
  >
    {children}
    <SelectPrimitive.Icon asChild>
      <ChevronDown className="h-4 w-4 opacity-50" />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
))
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName

const SelectScrollUpButton = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.ScrollUpButton>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollUpButton>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollUpButton ref={ref} className={cn("flex cursor-default items-center justify-center py-1", className)} {...props}>
    <ChevronUp className="h-4 w-4" />
  </SelectPrimitive.ScrollUpButton>
))
SelectScrollUpButton.displayName = SelectPrimitive.ScrollUpButton.displayName

const SelectScrollDownButton = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.ScrollDownButton>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollDownButton>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollDownButton ref={ref} className={cn("flex cursor-default items-center justify-center py-1", className)} {...props}>
    <ChevronDown className="h-4 w-4" />
  </SelectPrimitive.ScrollDownButton>
))
SelectScrollDownButton.displayName = SelectPrimitive.ScrollDownButton.displayName

const SelectContent = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(({ className, children, position = "popper", ...props }, ref) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      ref={ref}
      className={cn(
        "relative z-50 max-h-96 min-w-[8rem] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
        position === "popper" && "data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1",
        className
      )}
      position={position}
      {...props}
    >
      <SelectScrollUpButton />
      <SelectPrimitive.Viewport className={cn("p-1", position === "popper" && "h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)]")}>
        {children}
      </SelectPrimitive.Viewport>
      <SelectScrollDownButton />
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
))
SelectContent.displayName = SelectPrimitive.Content.displayName

const SelectLabel = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Label>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Label ref={ref} className={cn("py-1.5 pl-8 pr-2 text-sm font-semibold", className)} {...props} />
))
SelectLabel.displayName = SelectPrimitive.Label.displayName

const SelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className
    )}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <SelectPrimitive.ItemIndicator>
        <Check className="h-4 w-4" />
      </SelectPrimitive.ItemIndicator>
    </span>
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
  </SelectPrimitive.Item>
))
SelectItem.displayName = SelectPrimitive.Item.displayName

const SelectSeparator = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Separator ref={ref} className={cn("-mx-1 my-1 h-px bg-muted", className)} {...props} />
))
SelectSeparator.displayName = SelectPrimitive.Separator.displayName

export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
  SelectScrollUpButton,
  SelectScrollDownButton,
}
```

- [ ] **Step 6: Create `client/src/components/ui/sheet.tsx`** (exact copy of `components/ui/sheet.tsx`, no `"use client"`)

```tsx
import * as React from "react"
import * as SheetPrimitive from "@radix-ui/react-dialog"
import { cva, type VariantProps } from "class-variance-authority"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"

const Sheet = SheetPrimitive.Root
const SheetTrigger = SheetPrimitive.Trigger
const SheetClose = SheetPrimitive.Close
const SheetPortal = SheetPrimitive.Portal

const SheetOverlay = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Overlay
    className={cn("fixed inset-0 z-50 bg-black/80  data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0", className)}
    {...props}
    ref={ref}
  />
))
SheetOverlay.displayName = SheetPrimitive.Overlay.displayName

const sheetVariants = cva(
  "fixed z-50 gap-4 bg-background p-6 shadow-lg transition ease-in-out data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:duration-300 data-[state=open]:duration-500",
  {
    variants: {
      side: {
        top: "inset-x-0 top-0 border-b data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top",
        bottom: "inset-x-0 bottom-0 border-t data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
        left: "inset-y-0 left-0 h-full w-3/4 border-r data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left sm:max-w-sm",
        right: "inset-y-0 right-0 h-full w-3/4  border-l data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right sm:max-w-sm",
      },
    },
    defaultVariants: { side: "right" },
  }
)

interface SheetContentProps extends React.ComponentPropsWithoutRef<typeof SheetPrimitive.Content>, VariantProps<typeof sheetVariants> {}

const SheetContent = React.forwardRef<React.ElementRef<typeof SheetPrimitive.Content>, SheetContentProps>(
  ({ side = "right", className, children, ...props }, ref) => (
    <SheetPortal>
      <SheetOverlay />
      <SheetPrimitive.Content ref={ref} className={cn(sheetVariants({ side }), className)} {...props}>
        {children}
        <SheetPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-secondary">
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </SheetPrimitive.Close>
      </SheetPrimitive.Content>
    </SheetPortal>
  )
)
SheetContent.displayName = SheetPrimitive.Content.displayName

const SheetHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col space-y-2 text-center sm:text-left", className)} {...props} />
)
SheetHeader.displayName = "SheetHeader"

const SheetTitle = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Title>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Title ref={ref} className={cn("text-lg font-semibold text-foreground", className)} {...props} />
))
SheetTitle.displayName = SheetPrimitive.Title.displayName

const SheetDescription = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Description>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Description ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
))
SheetDescription.displayName = SheetPrimitive.Description.displayName

export { Sheet, SheetPortal, SheetOverlay, SheetTrigger, SheetClose, SheetContent, SheetHeader, SheetTitle, SheetDescription }
```

(Note: `text-primaryoreground` in the original file is a typo for `text-foreground` — corrected here since it's a trivial, obvious fix ported into new code, not a behavior change worth preserving.)

- [ ] **Step 7: Create `client/src/components/ui/textarea.tsx`** (exact copy of `components/ui/textarea.tsx`)

```tsx
import * as React from "react"

import { cn } from "@/lib/utils"

const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<"textarea">>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "flex min-h-[80px] w-full rounded-xl border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        className
      )}
      ref={ref}
      {...props}
    />
  )
})
Textarea.displayName = "Textarea"

export { Textarea }
```

- [ ] **Step 8: Write a smoke test for `Dialog`**

```tsx
// client/src/components/ui/dialog.test.tsx
import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { Dialog, DialogContent, DialogTitle } from "./dialog"

describe("Dialog", () => {
  it("renders its content when open", () => {
    render(
      <Dialog open>
        <DialogContent>
          <DialogTitle>Test dialog</DialogTitle>
          <p>Body content</p>
        </DialogContent>
      </Dialog>
    )
    expect(screen.getByText("Test dialog")).toBeInTheDocument()
    expect(screen.getByText("Body content")).toBeInTheDocument()
  })
})
```

- [ ] **Step 9: Run test**

Run: `cd client && npx vitest run src/components/ui/dialog.test.tsx`
Expected: PASS

- [ ] **Step 10: Commit**

```bash
git add client/package.json client/package-lock.json client/src/components/ui/dialog.tsx client/src/components/ui/dialog.test.tsx client/src/components/ui/avatar.tsx client/src/components/ui/select.tsx client/src/components/ui/sheet.tsx client/src/components/ui/textarea.tsx
git commit -m "Port Dialog, Avatar, Select, Sheet, Textarea UI primitives to client"
```

---

## Task 4: Port shared components (Modal, StatBadge, Reveal) + client avatar helper

**Files:**
- Create: `client/src/components/shared/modal.tsx`
- Create: `client/src/components/shared/stat-badge.tsx`
- Create: `client/src/components/shared/reveal.tsx`
- Create: `client/src/lib/avatar.ts`
- Test: `client/src/lib/avatar.test.ts`

**Interfaces:**
- Consumes: `Dialog`/`DialogContent`/`DialogHeader`/`DialogTitle`/`DialogDescription` (Task 3).
- Produces: `Modal` (props: `isOpen`, `onClose`, `title?`, `description?`, `srLabel?`, `maxWidth?`, `children`), `StatBadge` (props: `variant?`, `icon?`, `children`), `Reveal` (props: `delay?`, `repeat?`, `children`) from `client/src/components/shared/*`; `getAvatarUrl(path)`/`resolveAvatar(row)` from `client/src/lib/avatar.ts`. Tasks 7-8 import all four.

- [ ] **Step 1: Create `client/src/components/shared/modal.tsx`** (exact copy of `components/shared/modal.tsx`)

```tsx
import * as React from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

interface ModalProps {
  title?: string
  description?: string
  srLabel?: string
  isOpen: boolean
  onClose: () => void
  children: React.ReactNode
  className?: string
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl" | "5xl"
}

export function Modal({ title, description, srLabel, isOpen, onClose, children, className, maxWidth = "lg" }: ModalProps) {
  const maxWidthClasses = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
    xl: "max-w-xl",
    "2xl": "max-w-2xl",
    "3xl": "max-w-3xl",
    "4xl": "max-w-4xl",
    "5xl": "max-w-5xl",
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className={cn(maxWidthClasses[maxWidth], className)}>
        {title || description ? (
          <DialogHeader className="space-y-2 pb-4">
            <DialogTitle className={cn("text-2xl font-bold font-heading", !title && "sr-only")}>{title ?? srLabel ?? "Dialog"}</DialogTitle>
            {description && <DialogDescription className="text-muted-foreground font-medium">{description}</DialogDescription>}
          </DialogHeader>
        ) : (
          <DialogTitle className="sr-only">{srLabel ?? "Dialog"}</DialogTitle>
        )}
        <div className="pt-2">{children}</div>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Create `client/src/components/shared/stat-badge.tsx`** (exact copy of `components/shared/stat-badge.tsx`)

```tsx
import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const statBadgeVariants = cva(
  "inline-flex items-center rounded-md border px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider transition-colors",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary/10 text-primary",
        success: "border-transparent bg-success/10 text-success",
        warning: "border-transparent bg-warning/10 text-warning",
        info: "border-transparent bg-info/10 text-info",
        destructive: "border-transparent bg-destructive/10 text-destructive",
        muted: "border-transparent bg-surface-2 text-muted-foreground",
        outline: "border-border bg-transparent text-muted-foreground",
        dark: "border-transparent bg-slate-900 text-white",
      },
    },
    defaultVariants: { variant: "default" },
  }
)

export interface StatBadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof statBadgeVariants> {
  icon?: React.ReactNode
}

function StatBadge({ className, variant, icon, children, ...props }: StatBadgeProps) {
  return (
    <div className={cn(statBadgeVariants({ variant }), className)} {...props}>
      {icon && <span className="mr-1.5">{icon}</span>}
      {children}
    </div>
  )
}

export { StatBadge, statBadgeVariants }
```

- [ ] **Step 3: Create `client/src/components/shared/reveal.tsx`** (exact copy of `components/reveal.tsx`, no `"use client"`)

```tsx
import { motion } from "framer-motion"
import type { ReactNode } from "react"

export function Reveal({
  children,
  className,
  delay = 0,
  repeat = false,
}: {
  children: ReactNode
  className?: string
  delay?: number
  repeat?: boolean
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: !repeat, margin: "-60px" }}
      transition={{ duration: 0.45, ease: "easeOut", delay }}
    >
      {children}
    </motion.div>
  )
}
```

- [ ] **Step 4: Write the failing test for the client avatar helper**

```typescript
// client/src/lib/avatar.test.ts
import { describe, it, expect, beforeEach, vi } from "vitest"

beforeEach(() => {
  vi.stubEnv("VITE_SUPABASE_URL", "https://example.supabase.co")
})

describe("getAvatarUrl", () => {
  it("builds a public storage URL for a given path", async () => {
    const { getAvatarUrl } = await import("./avatar")
    expect(getAvatarUrl("user-1/logo.png")).toBe("https://example.supabase.co/storage/v1/object/public/avatars/user-1/logo.png")
  })

  it("returns an empty string for a missing path", async () => {
    const { getAvatarUrl } = await import("./avatar")
    expect(getAvatarUrl(null)).toBe("")
    expect(getAvatarUrl(undefined)).toBe("")
  })
})

describe("resolveAvatar", () => {
  it("prefers logo_path over logo_data", async () => {
    const { resolveAvatar } = await import("./avatar")
    expect(resolveAvatar({ logo_path: "a/b.png", logo_data: "data:image/png;base64,xyz" })).toBe(
      "https://example.supabase.co/storage/v1/object/public/avatars/a/b.png"
    )
  })

  it("falls back to image_data when no path is present", async () => {
    const { resolveAvatar } = await import("./avatar")
    expect(resolveAvatar({ image_data: "data:image/png;base64,xyz" })).toBe("data:image/png;base64,xyz")
  })
})
```

- [ ] **Step 5: Run test to verify it fails**

Run: `cd client && npx vitest run src/lib/avatar.test.ts`
Expected: FAIL — `Cannot find module './avatar'`

- [ ] **Step 6: Create `client/src/lib/avatar.ts`**

```typescript
const BUCKET = "avatars"

function supabaseBaseUrl(): string {
  return import.meta.env.VITE_SUPABASE_URL || ""
}

export function getAvatarUrl(path: string | null | undefined): string {
  if (!path) return ""
  const base = supabaseBaseUrl()
  if (!base) return ""
  return `${base}/storage/v1/object/public/${BUCKET}/${path}`
}

export function resolveAvatar(
  row:
    | { logo_path?: string | null; image_path?: string | null; logo_data?: string | null; image_data?: string | null }
    | null
    | undefined
): string {
  if (!row) return ""
  const path = row.logo_path || row.image_path
  if (path) return getAvatarUrl(path)
  return row.logo_data || row.image_data || ""
}
```

- [ ] **Step 7: Run test to verify it passes**

Run: `cd client && npx vitest run src/lib/avatar.test.ts`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add client/src/components/shared/modal.tsx client/src/components/shared/stat-badge.tsx client/src/components/shared/reveal.tsx client/src/lib/avatar.ts client/src/lib/avatar.test.ts
git commit -m "Port Modal, StatBadge, Reveal shared components and client avatar helper"
```

---

## Task 5: New server route — `GET /api/agencies/:agencyId/image`

**Files:**
- Create: `server/src/routes/agencies.ts`
- Modify: `server/src/app.ts`
- Test: `server/src/routes/agencies.test.ts`
- Test: `server/src/app.test.ts` (extend)

**Interfaces:**
- Consumes: `asyncHandler` (`server/src/lib/http.ts`, Phase 1); `resolveAvatar` (`server/src/lib/avatar.ts`, Phase 1).
- Produces: `agenciesRouter` (default export), mounted at `/api/agencies` behind `requireAuth` in `app.ts`. Task 6's `client/src/lib/queries/agencies.ts` calls `GET /api/agencies/:agencyId/image`.

This route exists because the current Next.js app fetches another agency's public logo via a direct browser Supabase query (`SavedJobsClient.tsx`'s `loadAgencyImage`) that Phase 1 never ported — Phase 1's `GET /api/user/agency-image` is self-scoped (returns the *caller's own* agency image), which doesn't help a freelancer viewing a job poster's logo.

- [ ] **Step 1: Write the failing tests**

```typescript
// server/src/routes/agencies.test.ts
import { describe, it, expect, vi } from "vitest"
import express from "express"
import request from "supertest"
import agenciesRouter from "./agencies.js"

function appWith(user: { id: string }, supabase: any) {
  const app = express()
  app.use(express.json())
  app.use((req: any, _res, next) => {
    req.user = user
    req.supabase = supabase
    next()
  })
  app.use("/", agenciesRouter)
  return app
}

describe("GET /:agencyId/image", () => {
  it("returns the resolved image for the given agency", async () => {
    process.env.SUPABASE_URL = "https://example.supabase.co"
    const maybeSingle = vi.fn().mockResolvedValue({ data: { image_path: "agency-1/logo.png" }, error: null })
    const supabase = { from: vi.fn(() => ({ select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle })) })) })) }

    const res = await request(appWith({ id: "freelancer-1" }, supabase)).get("/agency-1/image")

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ image: "https://example.supabase.co/storage/v1/object/public/avatars/agency-1/logo.png" })
    expect(supabase.from).toHaveBeenCalledWith("agency_image")
  })

  it("returns { image: null } when the agency has no image row", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null })
    const supabase = { from: vi.fn(() => ({ select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle })) })) })) }

    const res = await request(appWith({ id: "freelancer-1" }, supabase)).get("/agency-2/image")

    expect(res.body).toEqual({ image: null })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd server && npx vitest run src/routes/agencies.test.ts`
Expected: FAIL — `Cannot find module './agencies.js'`

- [ ] **Step 3: Write the implementation**

```typescript
// server/src/routes/agencies.ts
import { Router } from "express"
import { asyncHandler } from "../lib/http.js"
import { resolveAvatar } from "../lib/avatar.js"

const agenciesRouter = Router()

agenciesRouter.get(
  "/:agencyId/image",
  asyncHandler(async (req, res) => {
    const { agencyId } = req.params

    const { data, error } = await req.supabase!
      .from("agency_image")
      .select("image_path, image_data")
      .eq("agency_id", agencyId)
      .maybeSingle()

    if (error || !data) {
      res.json({ image: null })
      return
    }

    res.json({ image: resolveAvatar(data) || null })
  })
)

export default agenciesRouter
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd server && npx vitest run src/routes/agencies.test.ts`
Expected: PASS

- [ ] **Step 5: Mount the router in `server/src/app.ts`**

```typescript
// server/src/app.ts — add the import and mount line
import agenciesRouter from "./routes/agencies.js"
// ...alongside the other requireAuth-gated mounts:
app.use("/api/agencies", requireAuth, agenciesRouter)
```

- [ ] **Step 6: Add an auth-gate test to `server/src/app.test.ts`**

```typescript
// server/src/app.test.ts — add inside the "auth gate on Phase 1 routers" describe block (or a new one)
it("requires auth on /api/agencies", async () => {
  const res = await request(createApp()).get("/api/agencies/agency-1/image")
  expect(res.status).toBe(401)
})
```

- [ ] **Step 7: Run the full server test suite**

Run: `cd server && npm test`
Expected: All tests PASS

- [ ] **Step 8: Commit**

```bash
git add server/src/routes/agencies.ts server/src/routes/agencies.test.ts server/src/app.ts server/src/app.test.ts
git commit -m "Add GET /api/agencies/:agencyId/image for viewing another agency's public logo"
```

---

## Task 6: Client data-hooks layer (`client/src/lib/queries/*.ts`)

**Files:**
- Create: `client/src/lib/queries/jobs.ts`
- Create: `client/src/lib/queries/user.ts`
- Create: `client/src/lib/queries/proposals.ts`
- Create: `client/src/lib/queries/agencies.ts`
- Test: `client/src/lib/queries/jobs.test.tsx`
- Test: `client/src/lib/queries/user.test.tsx`
- Test: `client/src/lib/queries/proposals.test.tsx`
- Test: `client/src/lib/queries/agencies.test.tsx`

**Interfaces:**
- Consumes: `apiFetch` (`client/src/lib/api.ts`, Phase 0); `queryClient` (Task 1, used only inside tests via a wrapper).
- Produces: `useJobsQuery(params)`, `useSavedJobsQuery()`, `useToggleBookmarkMutation()` from `jobs.ts`; `useDashboardQuery()` from `user.ts`; `useSubmitProposalMutation()` from `proposals.ts`; `useAgencyImageQuery(agencyId, enabled)` from `agencies.ts`. Tasks 7-8 import all six hooks — no page calls `apiFetch` directly.

- [ ] **Step 1: Write the failing tests**

```tsx
// client/src/lib/queries/jobs.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { ReactNode } from "react"

const apiFetchMock = vi.fn()
vi.mock("../api", () => ({ apiFetch: (...args: unknown[]) => apiFetchMock(...args) }))

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

beforeEach(() => {
  apiFetchMock.mockReset()
})

describe("useJobsQuery", () => {
  it("calls GET /api/jobs with the given params as a query string", async () => {
    apiFetchMock.mockResolvedValue({ jobs: [{ id: "job-1" }], totalCount: 1 })
    const { useJobsQuery } = await import("./jobs")

    const { result } = renderHook(() => useJobsQuery({ searchQuery: "react", limit: 6 }), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(apiFetchMock).toHaveBeenCalledWith("/api/jobs?searchQuery=react&limit=6")
    expect(result.current.data).toEqual({ jobs: [{ id: "job-1" }], totalCount: 1 })
  })
})

describe("useSavedJobsQuery", () => {
  it("calls GET /api/jobs/saved", async () => {
    apiFetchMock.mockResolvedValue({ jobs: [] })
    const { useSavedJobsQuery } = await import("./jobs")

    const { result } = renderHook(() => useSavedJobsQuery(), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(apiFetchMock).toHaveBeenCalledWith("/api/jobs/saved")
  })
})

describe("useToggleBookmarkMutation", () => {
  it("POSTs to /api/jobs/:jobId/bookmark with the new isBookmarked value", async () => {
    apiFetchMock.mockResolvedValue({ success: true })
    const { useToggleBookmarkMutation } = await import("./jobs")

    const { result } = renderHook(() => useToggleBookmarkMutation(), { wrapper })
    result.current.mutate({ jobId: "job-1", isBookmarked: false })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(apiFetchMock).toHaveBeenCalledWith("/api/jobs/job-1/bookmark", {
      method: "POST",
      body: JSON.stringify({ isBookmarked: false }),
    })
  })
})
```

```tsx
// client/src/lib/queries/user.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { ReactNode } from "react"

const apiFetchMock = vi.fn()
vi.mock("../api", () => ({ apiFetch: (...args: unknown[]) => apiFetchMock(...args) }))

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

beforeEach(() => {
  apiFetchMock.mockReset()
})

describe("useDashboardQuery", () => {
  it("calls GET /api/user/dashboard", async () => {
    apiFetchMock.mockResolvedValue({ profile: { id: "user-1" }, credits: 10, balance: 0, isVerified: true })
    const { useDashboardQuery } = await import("./user")

    const { result } = renderHook(() => useDashboardQuery(), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(apiFetchMock).toHaveBeenCalledWith("/api/user/dashboard")
    expect(result.current.data?.credits).toBe(10)
  })
})
```

```tsx
// client/src/lib/queries/proposals.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { ReactNode } from "react"

const apiFetchMock = vi.fn()
vi.mock("../api", () => ({ apiFetch: (...args: unknown[]) => apiFetchMock(...args) }))

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

beforeEach(() => {
  apiFetchMock.mockReset()
})

describe("useSubmitProposalMutation", () => {
  it("POSTs to /api/proposals/jobs/:jobId with the proposal payload", async () => {
    apiFetchMock.mockResolvedValue({ success: true, alreadySubmitted: false })
    const { useSubmitProposalMutation } = await import("./proposals")

    const { result } = renderHook(() => useSubmitProposalMutation(), { wrapper })
    result.current.mutate({
      jobId: "job-1",
      proposal_text: "I can do this",
      timeline: "2 weeks",
      budget: "5000",
      creditCost: 2,
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(apiFetchMock).toHaveBeenCalledWith("/api/proposals/jobs/job-1", {
      method: "POST",
      body: JSON.stringify({ proposal_text: "I can do this", timeline: "2 weeks", budget: "5000", creditCost: 2 }),
    })
  })
})
```

```tsx
// client/src/lib/queries/agencies.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { ReactNode } from "react"

const apiFetchMock = vi.fn()
vi.mock("../api", () => ({ apiFetch: (...args: unknown[]) => apiFetchMock(...args) }))

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

beforeEach(() => {
  apiFetchMock.mockReset()
})

describe("useAgencyImageQuery", () => {
  it("calls GET /api/agencies/:agencyId/image when enabled", async () => {
    apiFetchMock.mockResolvedValue({ image: "https://example.com/logo.png" })
    const { useAgencyImageQuery } = await import("./agencies")

    const { result } = renderHook(() => useAgencyImageQuery("agency-1", true), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(apiFetchMock).toHaveBeenCalledWith("/api/agencies/agency-1/image")
  })

  it("does not fetch when disabled", async () => {
    const { useAgencyImageQuery } = await import("./agencies")
    renderHook(() => useAgencyImageQuery(undefined, false), { wrapper })
    expect(apiFetchMock).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd client && npx vitest run src/lib/queries/jobs.test.tsx src/lib/queries/user.test.tsx src/lib/queries/proposals.test.tsx src/lib/queries/agencies.test.tsx`
Expected: FAIL — modules don't exist yet

- [ ] **Step 3: Create `client/src/lib/queries/jobs.ts`**

```typescript
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { apiFetch } from "../api"

export type JobsQueryParams = {
  searchQuery?: string
  offset?: number
  limit?: number
  fromDate?: string
  toDate?: string
  maxCredits?: number
  jobType?: string
  categorySkills?: string[]
}

function buildJobsQueryString(params: JobsQueryParams): string {
  const search = new URLSearchParams()
  if (params.searchQuery) search.set("searchQuery", params.searchQuery)
  if (params.offset !== undefined) search.set("offset", String(params.offset))
  if (params.limit !== undefined) search.set("limit", String(params.limit))
  if (params.fromDate) search.set("fromDate", params.fromDate)
  if (params.toDate) search.set("toDate", params.toDate)
  if (params.maxCredits !== undefined) search.set("maxCredits", String(params.maxCredits))
  if (params.jobType) search.set("jobType", params.jobType)
  if (params.categorySkills) for (const skill of params.categorySkills) search.append("categorySkills", skill)
  const qs = search.toString()
  return qs ? `?${qs}` : ""
}

export function useJobsQuery(params: JobsQueryParams) {
  return useQuery({
    queryKey: ["jobs", params],
    queryFn: () => apiFetch<{ jobs: any[]; totalCount: number; error?: string }>(`/api/jobs${buildJobsQueryString(params)}`),
  })
}

export function useSavedJobsQuery() {
  return useQuery({
    queryKey: ["jobs", "saved"],
    queryFn: () => apiFetch<{ jobs: any[] }>("/api/jobs/saved"),
  })
}

export function useToggleBookmarkMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ jobId, isBookmarked }: { jobId: string; isBookmarked: boolean }) =>
      apiFetch<{ success: boolean }>(`/api/jobs/${jobId}/bookmark`, {
        method: "POST",
        body: JSON.stringify({ isBookmarked }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jobs"] })
    },
  })
}
```

- [ ] **Step 4: Create `client/src/lib/queries/user.ts`**

```typescript
import { useQuery } from "@tanstack/react-query"
import { apiFetch } from "../api"

export type DashboardData = {
  profile: any
  credits: number
  balance: number
  isVerified: boolean
}

export function useDashboardQuery() {
  return useQuery({
    queryKey: ["user", "dashboard"],
    queryFn: () => apiFetch<DashboardData>("/api/user/dashboard"),
  })
}
```

- [ ] **Step 5: Create `client/src/lib/queries/proposals.ts`**

```typescript
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { apiFetch } from "../api"

export type SubmitProposalInput = {
  jobId: string
  proposal_text: string
  timeline: string
  budget: string
  creditCost: number
  attachments?: string[]
}

export type SubmitProposalResult =
  | { success: true; alreadySubmitted?: boolean }
  | { success: false; error: string; code?: string }

export function useSubmitProposalMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ jobId, ...body }: SubmitProposalInput) =>
      apiFetch<SubmitProposalResult>(`/api/proposals/jobs/${jobId}`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jobs"] })
    },
  })
}
```

- [ ] **Step 6: Create `client/src/lib/queries/agencies.ts`**

```typescript
import { useQuery } from "@tanstack/react-query"
import { apiFetch } from "../api"

export function useAgencyImageQuery(agencyId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ["agencies", agencyId, "image"],
    queryFn: () => apiFetch<{ image: string | null }>(`/api/agencies/${agencyId}/image`),
    enabled: enabled && !!agencyId,
  })
}
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `cd client && npx vitest run src/lib/queries/jobs.test.tsx src/lib/queries/user.test.tsx src/lib/queries/proposals.test.tsx src/lib/queries/agencies.test.tsx`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add client/src/lib/queries/
git commit -m "Add TanStack Query hooks for jobs, user dashboard, proposals, and agency images"
```

---

## Task 7: Freelancer dashboard page (`/freelancer/dashboard`)

**Files:**
- Create: `client/src/pages/freelancer/Dashboard.tsx`
- Test: `client/src/pages/freelancer/Dashboard.test.tsx`

**Interfaces:**
- Consumes: `useAuth` (Task 2); `Modal`, `StatBadge`, `Reveal` (Task 4); `Avatar`/`AvatarImage`/`AvatarFallback`, `Select*`, `Sheet*`, `Textarea` (Task 3); `useJobsQuery`, `useToggleBookmarkMutation` (Task 6, `jobs.ts`); `useDashboardQuery` (Task 6, `user.ts`); `useSubmitProposalMutation` (Task 6, `proposals.ts`); `getAvatarUrl` (Task 4, `avatar.ts`); `ALL_CATEGORIES`, `getSkillsForCategory` (`client/src/lib/categories.ts`, Phase 0).
- Produces: default export `Dashboard`, mounted at `/freelancer/dashboard` in Task 9's `App.tsx`.

- [ ] **Step 1: Write the failing tests**

```tsx
// client/src/pages/freelancer/Dashboard.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

const useAuthMock = vi.fn()
vi.mock("../../contexts/AuthContext", () => ({ useAuth: () => useAuthMock() }))

const useJobsQueryMock = vi.fn()
const useToggleBookmarkMutationMock = vi.fn()
vi.mock("../../lib/queries/jobs", () => ({
  useJobsQuery: (...args: unknown[]) => useJobsQueryMock(...args),
  useToggleBookmarkMutation: () => useToggleBookmarkMutationMock(),
}))

const useDashboardQueryMock = vi.fn()
vi.mock("../../lib/queries/user", () => ({
  useDashboardQuery: () => useDashboardQueryMock(),
}))

const useSubmitProposalMutationMock = vi.fn()
vi.mock("../../lib/queries/proposals", () => ({
  useSubmitProposalMutation: () => useSubmitProposalMutationMock(),
}))

function renderDashboard() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

import Dashboard from "./Dashboard"

beforeEach(() => {
  vi.clearAllMocks()
  useAuthMock.mockReturnValue({ user: { id: "freelancer-1" }, profile: { full_name: "Jane Doe", account_type: "freelancer" } })
  useToggleBookmarkMutationMock.mockReturnValue({ mutate: vi.fn() })
  useSubmitProposalMutationMock.mockReturnValue({ mutate: vi.fn(), isPending: false })
})

describe("Dashboard", () => {
  it("shows a loading state while the dashboard query is pending", () => {
    useDashboardQueryMock.mockReturnValue({ isLoading: true, data: undefined })
    useJobsQueryMock.mockReturnValue({ isLoading: true, data: undefined })

    renderDashboard()

    expect(screen.getByTestId("dashboard-skeleton")).toBeInTheDocument()
  })

  it("renders the stat tiles and matched jobs once data loads", async () => {
    useDashboardQueryMock.mockReturnValue({
      isLoading: false,
      data: { profile: { full_name: "Jane Doe", skills: ["React"] }, credits: 42, balance: 5000, isVerified: true },
    })
    useJobsQueryMock.mockReturnValue({
      isLoading: false,
      data: {
        jobs: [
          {
            id: "job-1",
            title: "Build a landing page",
            budget_min: 1000,
            budget_max: 2000,
            created_at: new Date().toISOString(),
            has_applied: false,
            proposals: 1,
            skills: ["React"],
            agency_info: { company_name: "Acme", logo_path: null },
          },
        ],
        totalCount: 1,
      },
    })

    renderDashboard()

    await waitFor(() => expect(screen.getByText("Build a landing page")).toBeInTheDocument())
    expect(screen.getByText("42")).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client && npx vitest run src/pages/freelancer/Dashboard.test.tsx`
Expected: FAIL — `Cannot find module './Dashboard'`

- [ ] **Step 3: Write `client/src/pages/freelancer/Dashboard.tsx`**

```tsx
import { useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Reveal } from "@/components/shared/reveal"
import { Modal } from "@/components/shared/modal"
import { StatBadge } from "@/components/shared/stat-badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { useAuth } from "@/contexts/AuthContext"
import { useJobsQuery, useToggleBookmarkMutation } from "@/lib/queries/jobs"
import { useDashboardQuery } from "@/lib/queries/user"
import { useSubmitProposalMutation } from "@/lib/queries/proposals"
import { getAvatarUrl } from "@/lib/avatar"
import { ALL_CATEGORIES, getSkillsForCategory, type Category } from "@/lib/categories"
import {
  MapPin,
  Search,
  Send,
  Loader2,
  CheckCircle,
  ArrowUpRight,
  Bookmark,
  BadgeCheck,
  Briefcase,
  CreditCard,
} from "lucide-react"

function transformJob(job: any) {
  return {
    ...job,
    budget: `₦ ${job.budget_min?.toLocaleString()} - ₦ ${job.budget_max?.toLocaleString()}`,
    agencyInfo: {
      ...job.agency_info,
      name: job.agency_info?.company_name || job.agency_info?.full_name || "Unknown Agency",
      logo: getAvatarUrl(job.agency_info?.logo_path),
    },
  }
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { profile } = useAuth()

  const [selectedJob, setSelectedJob] = useState<any>(null)
  const [showFilterModal, setShowFilterModal] = useState(false)
  const [showPlaceBidModal, setShowPlaceBidModal] = useState(false)
  const [showAgencyModal, setShowAgencyModal] = useState(false)
  const [selectedAgency, setSelectedAgency] = useState<any>(null)
  const [filters, setFilters] = useState({ keywords: "", category: "" })
  const [bidData, setBidData] = useState({ proposal: "", timeline: "", budget: "" })

  const jobsParams = useMemo(
    () => ({
      searchQuery: filters.keywords,
      limit: 6,
      categorySkills: filters.category ? (getSkillsForCategory(filters.category as Category) as unknown as string[]) : undefined,
    }),
    [filters]
  )

  const dashboardQuery = useDashboardQuery()
  const jobsQuery = useJobsQuery(jobsParams)
  const toggleBookmark = useToggleBookmarkMutation()
  const submitProposal = useSubmitProposalMutation()

  const isLoading = dashboardQuery.isLoading || jobsQuery.isLoading

  if (isLoading) {
    return (
      <div data-testid="dashboard-skeleton" className="min-h-screen bg-surface pb-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-pulse">
          <div className="space-y-2">
            <div className="h-3 w-24 bg-foreground/5 rounded" />
            <div className="h-7 w-64 bg-foreground/5 rounded" />
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 bg-card border border-border rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  const dashboardData = dashboardQuery.data
  const profileData = dashboardData?.profile ?? profile
  const creditBalance = dashboardData?.credits ?? 0
  const totalBalance = dashboardData?.balance ?? 0
  const isNINVerified = !!dashboardData?.isVerified
  const jobs = (jobsQuery.data?.jobs ?? []).map(transformJob)

  const greeting = (() => {
    const hour = new Date().getHours()
    if (hour < 12) return "Good morning"
    if (hour < 17) return "Good afternoon"
    return "Good evening"
  })()
  const firstName = profileData?.full_name?.split(" ")[0] || "there"
  const openBriefs = jobs.length

  const profileFields: { key: string; label: string }[] = [
    { key: "full_name", label: "display name" },
    { key: "bio", label: "a professional bio" },
    { key: "skills", label: "your skills" },
    { key: "location", label: "your location" },
    { key: "hourly_rate", label: "an hourly rate" },
    { key: "experience_level", label: "experience level" },
  ]
  const completedFields = profileFields.filter((f) => {
    const v = (profileData as any)?.[f.key]
    return Array.isArray(v) ? v.length > 0 : !!v
  })
  const profileCompletion = Math.round((completedFields.length / profileFields.length) * 100)
  const missing = profileFields.filter((f) => !completedFields.find((c) => c.key === f.key))

  const handleJobAction = (job: any, action: "bookmark" | "view" | "apply") => {
    if (action === "view") {
      setSelectedAgency(job.agencyInfo)
      setShowAgencyModal(true)
    } else if (action === "apply") {
      if (!isNINVerified) {
        alert("Please verify your identity (NIN) before placing a bid.")
        return
      }
      if (creditBalance < job.credit_cost) {
        alert(`Insufficient credits! You need ${job.credit_cost} credits.`)
        return
      }
      setSelectedJob(job)
      setShowPlaceBidModal(true)
    } else if (action === "bookmark") {
      toggleBookmark.mutate({ jobId: job.id, isBookmarked: !!job.isBookmarked })
    }
  }

  const applyFilters = () => setShowFilterModal(false)
  const resetFilters = () => setFilters({ keywords: "", category: "" })

  const submitBid = () => {
    if (!selectedJob) return
    submitProposal.mutate(
      {
        jobId: selectedJob.id,
        proposal_text: bidData.proposal,
        timeline: bidData.timeline,
        budget: bidData.budget,
        creditCost: selectedJob.credit_cost,
      },
      {
        onSuccess: (result) => {
          if (!result.success) {
            alert(result.error === "Unauthorized" ? "You must be signed in to submit a proposal." : `Error submitting proposal: ${result.error}`)
            return
          }
          alert(result.alreadySubmitted ? "You have already submitted a proposal for this job." : `Proposal submitted! ${selectedJob.credit_cost} credits deducted.`)
          setShowPlaceBidModal(false)
          setBidData({ proposal: "", timeline: "", budget: "" })
        },
        onError: () => alert("Error submitting proposal. Please try again."),
      }
    )
  }

  return (
    <div className="min-h-screen bg-surface pb-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div className="space-y-1 min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {greeting}, {firstName}
            </p>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              {openBriefs > 0 ? `${openBriefs} ${openBriefs === 1 ? "brief" : "briefs"} match your stack` : "Let's find your next brief"}
            </h1>
            <p className="text-sm text-muted-foreground">Find projects, file proposals, and track your standing.</p>
          </div>
        </header>

        <Reveal>
          <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <button onClick={() => navigate("/freelancer/profile")} className="text-left rounded-xl border border-border bg-card p-4 hover:border-foreground/20 transition-colors">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground">Profile</p>
                <BadgeCheck className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground tabular-nums">
                {profileCompletion}
                <span className="text-lg text-muted-foreground">%</span>
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{profileCompletion === 100 ? "Hire-ready" : `${missing.length} field${missing.length !== 1 ? "s" : ""} to go`}</p>
            </button>

            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground">Credits</p>
                <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground tabular-nums">{creditBalance}</p>
            </div>

            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground">Escrow</p>
              </div>
              <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground tabular-nums">₦{totalBalance.toLocaleString()}</p>
            </div>

            <div className="rounded-xl border border-primary/30 bg-card p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground">Open briefs</p>
                <Briefcase className="h-3.5 w-3.5 text-primary" />
              </div>
              <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground tabular-nums">{openBriefs}</p>
              <p className="mt-1 text-xs text-muted-foreground">Matched to you</p>
            </div>
          </section>
        </Reveal>

        <Reveal delay={0.08}>
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-sm font-semibold text-foreground">
                Matched to your stack <span className="font-normal text-muted-foreground">· {jobs.length}</span>
              </h2>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setShowFilterModal(true)}>
                <Search className="h-3.5 w-3.5" /> Refine
              </Button>
            </div>

            {jobs.length === 0 ? (
              <div className="rounded-xl border border-border bg-card py-16 px-6 text-center">
                <div className="mx-auto h-11 w-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <Briefcase className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-sm font-semibold text-foreground">No briefs match yet</h3>
                <p className="mt-1 text-sm text-muted-foreground max-w-sm mx-auto">Add a few more skills to your profile so we can match you to the right work.</p>
              </div>
            ) : (
              <div className="rounded-xl border border-border bg-card divide-y divide-border overflow-hidden">
                {jobs.map((job) => (
                  <div key={job.id} className="p-4 sm:p-5 transition-colors hover:bg-surface/60">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <h3 className="text-sm font-semibold text-foreground">{job.title}</h3>
                          {job.has_applied && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-success/10 text-success">
                              <CheckCircle className="h-3 w-3" /> Applied
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Avatar className="h-4 w-4 rounded-sm">
                            <AvatarImage src={job.agencyInfo?.logo} className="object-cover" />
                            <AvatarFallback className="rounded-sm bg-foreground text-white text-[8px] font-semibold">
                              {job.agencyInfo?.name?.[0]?.toUpperCase() ?? "A"}
                            </AvatarFallback>
                          </Avatar>
                          <span className="truncate">{job.agencyInfo?.name}</span>
                        </div>
                        {job.description && <p className="text-sm text-muted-foreground line-clamp-1 max-w-2xl">{job.description}</p>}
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          <span className="font-medium text-foreground tabular-nums">{job.budget}</span>
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {job.location || "Remote"}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <Button variant="ghost" size="sm" onClick={() => handleJobAction(job, "view")}>Agency</Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleJobAction(job, "bookmark")} aria-label={job.isBookmarked ? "Saved" : "Save"}>
                          <Bookmark className={`h-4 w-4 ${job.isBookmarked ? "fill-primary text-primary" : ""}`} />
                        </Button>
                        <Button size="sm" onClick={() => handleJobAction(job, "apply")} disabled={job.has_applied}>
                          {job.has_applied ? "Applied" : "Quick apply"}
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </Reveal>
      </div>

      <Modal isOpen={showFilterModal} onClose={() => setShowFilterModal(false)} title="Refine Market" maxWidth="md">
        <div className="space-y-6">
          <div className="space-y-2.5">
            <Label className="eyebrow">Contextual Keywords</Label>
            <Input placeholder="Skills, companies, or titles..." value={filters.keywords} onChange={(e) => setFilters({ ...filters, keywords: e.target.value })} />
          </div>
          <div className="space-y-2.5">
            <Label className="eyebrow">Professional Field</Label>
            <Select value={filters.category} onValueChange={(v) => setFilters({ ...filters, category: v })}>
              <SelectTrigger className="bg-surface">
                <SelectValue placeholder="All Specializations" />
              </SelectTrigger>
              <SelectContent>
                {ALL_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-4 pt-6">
            <Button variant="ghost" className="flex-1" onClick={resetFilters}>Reset</Button>
            <Button className="flex-1" onClick={applyFilters}>Update Results</Button>
          </div>
        </div>
      </Modal>

      <Sheet open={showPlaceBidModal} onOpenChange={setShowPlaceBidModal}>
        <SheetContent className="sm:max-w-xl p-0">
          <div className="flex flex-col h-full">
            <SheetHeader className="p-10 border-b border-border">
              <SheetTitle className="text-2xl font-bold font-heading">Submit Proposal</SheetTitle>
              <SheetDescription>Explain why you&rsquo;re the best fit for this project.</SheetDescription>
            </SheetHeader>
            <div className="flex-1 overflow-y-auto p-10 space-y-10">
              {selectedJob && (
                <div className="p-8 bg-surface rounded-lg border border-border space-y-5">
                  <StatBadge variant="success">Verified Listing</StatBadge>
                  <h4 className="font-bold font-heading text-foreground text-2xl leading-tight">{selectedJob.title}</h4>
                </div>
              )}
              <div className="space-y-10">
                <div className="space-y-4">
                  <Label className="eyebrow">Professional Pitch</Label>
                  <Textarea className="min-h-[250px] p-6" value={bidData.proposal} onChange={(e) => setBidData({ ...bidData, proposal: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <Label className="eyebrow">Execution Timeline</Label>
                    <Input value={bidData.timeline} onChange={(e) => setBidData({ ...bidData, timeline: e.target.value })} />
                  </div>
                  <div className="space-y-4">
                    <Label className="eyebrow">Project Fee (₦)</Label>
                    <Input value={bidData.budget} onChange={(e) => setBidData({ ...bidData, budget: e.target.value })} className="font-bold" />
                  </div>
                </div>
              </div>
            </div>
            <div className="p-10 border-t border-border bg-surface/50">
              <Button size="lg" className="w-full h-16 text-lg" onClick={submitBid} disabled={submitProposal.isPending || !bidData.proposal || !bidData.timeline || !bidData.budget}>
                {submitProposal.isPending ? <Loader2 className="animate-spin mr-2" /> : <Send className="mr-2 h-5 w-5" />}
                Launch Proposal
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <Modal isOpen={showAgencyModal} onClose={() => setShowAgencyModal(false)} srLabel="Agency details" maxWidth="2xl">
        {selectedAgency && (
          <div className="space-y-6">
            <div className="flex items-center gap-6">
              <Avatar className="h-20 w-20 rounded-lg">
                <AvatarImage src={selectedAgency.logo} />
                <AvatarFallback className="bg-slate-900 text-white text-2xl font-black">{selectedAgency.name.charAt(0)}</AvatarFallback>
              </Avatar>
              <h3 className="text-2xl font-bold font-heading text-foreground">{selectedAgency.name}</h3>
            </div>
            <div className="pt-6 border-t border-border flex justify-end">
              <Button variant="outline" onClick={() => setShowAgencyModal(false)}>Close</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd client && npx vitest run src/pages/freelancer/Dashboard.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/freelancer/Dashboard.tsx client/src/pages/freelancer/Dashboard.test.tsx
git commit -m "Port freelancer dashboard page to client"
```

---

## Task 8: Saved jobs page (`/freelancer/saved-jobs`)

**Files:**
- Create: `client/src/pages/freelancer/SavedJobs.tsx`
- Test: `client/src/pages/freelancer/SavedJobs.test.tsx`

**Interfaces:**
- Consumes: `Modal` (Task 4); `Avatar`/`AvatarImage`/`AvatarFallback`, `Textarea` (Task 3); `useSavedJobsQuery` (Task 6, `jobs.ts`); `useSubmitProposalMutation` (Task 6, `proposals.ts`); `useAgencyImageQuery` (Task 6, `agencies.ts`).
- Produces: default export `SavedJobs`, mounted at `/freelancer/saved-jobs` in Task 9's `App.tsx`.

- [ ] **Step 1: Write the failing tests**

```tsx
// client/src/pages/freelancer/SavedJobs.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

const useSavedJobsQueryMock = vi.fn()
vi.mock("../../lib/queries/jobs", () => ({
  useSavedJobsQuery: () => useSavedJobsQueryMock(),
}))

const useSubmitProposalMutationMock = vi.fn()
vi.mock("../../lib/queries/proposals", () => ({
  useSubmitProposalMutation: () => useSubmitProposalMutationMock(),
}))

const useAgencyImageQueryMock = vi.fn()
vi.mock("../../lib/queries/agencies", () => ({
  useAgencyImageQuery: (...args: unknown[]) => useAgencyImageQueryMock(...args),
}))

function renderSavedJobs() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <SavedJobs />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

import SavedJobs from "./SavedJobs"

beforeEach(() => {
  vi.clearAllMocks()
  useSubmitProposalMutationMock.mockReturnValue({ mutate: vi.fn(), isPending: false })
  useAgencyImageQueryMock.mockReturnValue({ data: undefined })
})

describe("SavedJobs", () => {
  it("shows an empty state when there are no saved jobs", async () => {
    useSavedJobsQueryMock.mockReturnValue({ isLoading: false, data: { jobs: [] } })

    renderSavedJobs()

    await waitFor(() => expect(screen.getByText("No saved jobs yet")).toBeInTheDocument())
  })

  it("renders each saved job with its agency name and budget", async () => {
    useSavedJobsQueryMock.mockReturnValue({
      isLoading: false,
      data: {
        jobs: [
          {
            id: "job-1",
            title: "Build a mobile app",
            budget: "₦ 100,000 - ₦ 200,000",
            proposals: 3,
            credit_cost: 5,
            savedAt: "1/1/2026",
            agencyInfo: { id: "agency-1", name: "Acme Co" },
          },
        ],
      },
    })

    renderSavedJobs()

    await waitFor(() => expect(screen.getByText("Build a mobile app")).toBeInTheDocument())
    expect(screen.getByText("Acme Co")).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client && npx vitest run src/pages/freelancer/SavedJobs.test.tsx`
Expected: FAIL — `Cannot find module './SavedJobs'`

- [ ] **Step 3: Write `client/src/pages/freelancer/SavedJobs.tsx`**

```tsx
import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Modal } from "@/components/shared/modal"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Bookmark, BookmarkX, Calendar, Clock, CreditCard, Eye, MapPin, Send, Users, X } from "lucide-react"
import { useSavedJobsQuery } from "@/lib/queries/jobs"
import { useSubmitProposalMutation } from "@/lib/queries/proposals"
import { useAgencyImageQuery } from "@/lib/queries/agencies"

export default function SavedJobs() {
  const navigate = useNavigate()
  const savedJobsQuery = useSavedJobsQuery()
  const submitProposal = useSubmitProposalMutation()

  const [showPlaceBidModal, setShowPlaceBidModal] = useState(false)
  const [showAgencyModal, setShowAgencyModal] = useState(false)
  const [selectedJob, setSelectedJob] = useState<any>(null)
  const [selectedAgency, setSelectedAgency] = useState<any>(null)
  const [bidData, setBidData] = useState({ proposal: "", timeline: "", budget: "" })

  const agencyImageQuery = useAgencyImageQuery(selectedAgency?.id, showAgencyModal)

  if (savedJobsQuery.isLoading) {
    return (
      <div className="min-h-screen bg-surface">
        <div className="max-w-6xl mx-auto py-8 px-4">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-foreground/5 rounded w-1/4 mb-6"></div>
            <div className="h-32 bg-foreground/5 rounded"></div>
          </div>
        </div>
      </div>
    )
  }

  const savedJobs = savedJobsQuery.data?.jobs ?? []

  const handleJobAction = (job: any, action: "view" | "placeBid") => {
    if (action === "view") {
      setSelectedAgency(job.agencyInfo)
      setShowAgencyModal(true)
    } else if (action === "placeBid") {
      setSelectedJob(job)
      setShowPlaceBidModal(true)
    }
  }

  const submitBid = () => {
    if (!selectedJob) return
    submitProposal.mutate(
      {
        jobId: selectedJob.id,
        proposal_text: bidData.proposal,
        timeline: bidData.timeline,
        budget: bidData.budget,
        creditCost: selectedJob.credit_cost,
      },
      {
        onSuccess: (result) => {
          if (!result.success) {
            alert(result.error === "Unauthorized" ? "You must be signed in to bid." : result.error)
            return
          }
          alert(result.alreadySubmitted ? "You've already applied to this job." : "Proposal submitted successfully! Credits deducted.")
          setShowPlaceBidModal(false)
          setBidData({ proposal: "", timeline: "", budget: "" })
        },
        onError: () => alert("Error submitting proposal. Please try again."),
      }
    )
  }

  return (
    <div className="min-h-screen bg-surface pb-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <header className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Saved</p>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Saved jobs</h1>
          <p className="text-sm text-muted-foreground">Jobs you&apos;ve bookmarked for later.</p>
        </header>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground">
            Your saved jobs <span className="font-normal text-muted-foreground">· {savedJobs.length}</span>
          </h2>

          {savedJobs.length === 0 ? (
            <div className="rounded-xl border border-border bg-card py-16 px-6 text-center">
              <div className="mx-auto h-11 w-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <Bookmark className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-sm font-semibold text-foreground">No saved jobs yet</h3>
              <p className="mt-1 text-sm text-muted-foreground max-w-sm mx-auto">Bookmark jobs from the marketplace to find them here later.</p>
              <Button className="mt-5" onClick={() => navigate("/freelancer/dashboard")}>Browse jobs</Button>
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-card divide-y divide-border overflow-hidden">
              {savedJobs.map((job: any) => (
                <div key={job.id} className="p-4 sm:p-5">
                  <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="text-sm font-semibold text-foreground line-clamp-1">{job.title}</h3>
                          <p className="text-xs text-muted-foreground mt-0.5">{job.agencyInfo.name}</p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => handleJobAction(job, "view")}>
                            <Eye className="h-4 w-4" /> View
                          </Button>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span className="font-medium text-foreground tabular-nums">{job.budget}</span>
                        <span className="inline-flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {job.proposals} proposals
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <CreditCard className="h-3 w-3 text-primary" />
                          {job.credit_cost} credits
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Saved {job.savedAt}
                        </span>
                      </div>
                    </div>
                    <div className="shrink-0">
                      <Button className="w-full lg:w-auto gap-2" onClick={() => handleJobAction(job, "placeBid")}>
                        <Send className="h-4 w-4" /> Place bid
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <Modal isOpen={showAgencyModal} onClose={() => setShowAgencyModal(false)} srLabel="Agency details" maxWidth="2xl">
        {selectedAgency && (
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarImage src={agencyImageQuery.data?.image ?? undefined} alt={selectedAgency.name} className="object-cover" />
                <AvatarFallback className="text-lg font-semibold bg-surface-2 text-foreground">{selectedAgency.name.charAt(0).toUpperCase()}</AvatarFallback>
              </Avatar>
              <h3 className="text-xl font-bold">{selectedAgency.name}</h3>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h4 className="font-semibold mb-1">Location</h4>
                <p className="text-sm text-muted-foreground">{selectedAgency.location}</p>
              </div>
              <div>
                <h4 className="font-semibold mb-1">Total Jobs</h4>
                <p className="text-sm text-muted-foreground">{selectedAgency.totalJobs}</p>
              </div>
            </div>
            <div className="flex justify-center pt-4">
              <Button variant="outline" onClick={() => setShowAgencyModal(false)}>Close</Button>
            </div>
          </div>
        )}
      </Modal>

      {showPlaceBidModal && selectedJob && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end justify-end z-50">
          <div className="bg-card w-full max-w-md h-full overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold">Place Your Bid</h3>
                <Button variant="ghost" size="icon" onClick={() => setShowPlaceBidModal(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Your Proposal</label>
                  <Textarea value={bidData.proposal} onChange={(e) => setBidData({ ...bidData, proposal: e.target.value })} rows={4} />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Timeline</label>
                  <Input value={bidData.timeline} onChange={(e) => setBidData({ ...bidData, timeline: e.target.value })} />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Your Budget</label>
                  <Input value={bidData.budget} onChange={(e) => setBidData({ ...bidData, budget: e.target.value })} />
                </div>
                <Button
                  className="w-full"
                  onClick={submitBid}
                  disabled={submitProposal.isPending || !bidData.proposal || !bidData.timeline || !bidData.budget}
                >
                  <Send className="h-4 w-4 mr-2" />
                  Submit Proposal
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd client && npx vitest run src/pages/freelancer/SavedJobs.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/freelancer/SavedJobs.tsx client/src/pages/freelancer/SavedJobs.test.tsx
git commit -m "Port saved jobs page to client"
```

---

## Task 9: Wire routes into `App.tsx`, mount `AuthProvider`, verify end-to-end

**Files:**
- Modify: `client/src/App.tsx`
- Modify: `client/src/pages/Login.tsx`
- Test: `client/src/App.test.tsx` (extend)

**Interfaces:** none new — this task wires Tasks 2, 7, 8 together and fixes `Login.tsx`'s post-login redirect target so it points at a route that now exists.

- [ ] **Step 1: Update `client/src/App.tsx`**

```tsx
// client/src/App.tsx
import { BrowserRouter, Routes, Route } from "react-router-dom"
import { QueryClientProvider } from "@tanstack/react-query"
import { queryClient } from "./lib/queryClient"
import { AuthProvider } from "./contexts/AuthContext"
import RequireAuth from "./components/RequireAuth"
import Landing from "./pages/Landing"
import Login from "./pages/Login"
import Signup from "./pages/Signup"
import Dashboard from "./pages/freelancer/Dashboard"
import SavedJobs from "./pages/freelancer/SavedJobs"

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route
              path="/freelancer/dashboard"
              element={
                <RequireAuth>
                  <Dashboard />
                </RequireAuth>
              }
            />
            <Route
              path="/freelancer/saved-jobs"
              element={
                <RequireAuth>
                  <SavedJobs />
                </RequireAuth>
              }
            />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}
```

- [ ] **Step 2: Write the failing tests**

```tsx
// client/src/App.test.tsx — add this describe block
describe("protected routes", () => {
  it("redirects /freelancer/dashboard to /login when signed out", async () => {
    renderAt("/freelancer/dashboard")
    await screen.findByText(/Sign in/i)
  })
})
```

(This relies on the existing `renderAt` helper already in `App.test.tsx` from Task 9 of Phase 0 — it renders the full route table, including the new protected routes, with no mocked session, so `RequireAuth` genuinely redirects.)

- [ ] **Step 3: Run test to verify it fails**

Run: `cd client && npx vitest run src/App.test.tsx`
Expected: FAIL — the new routes aren't in `App.test.tsx`'s local route table yet (that test file renders its own `<Routes>`, not the real `App.tsx`) — update the test's `renderAt` helper to include the two new routes wrapped in `RequireAuth`, mirroring `App.tsx`:

```tsx
// client/src/App.test.tsx — update the existing renderAt helper
import RequireAuth from "./components/RequireAuth"
import Dashboard from "./pages/freelancer/Dashboard"
import SavedJobs from "./pages/freelancer/SavedJobs"

function renderAt(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/freelancer/dashboard" element={<RequireAuth><Dashboard /></RequireAuth>} />
        <Route path="/freelancer/saved-jobs" element={<RequireAuth><SavedJobs /></RequireAuth>} />
      </Routes>
    </MemoryRouter>
  )
}
```

Wrap this render in a `QueryClientProvider` too (a fresh `new QueryClient()` per test), since `Dashboard`/`SavedJobs` now use `useQuery` even when `RequireAuth` redirects before they'd render — `RequireAuth`'s redirect happens before `Dashboard`/`SavedJobs` mount, so no real fetch occurs, but the provider must still be present in the tree for consistency with `App.tsx`'s real structure.

- [ ] **Step 4: Fix `Login.tsx`'s redirect target**

`client/src/pages/Login.tsx` already navigates to `/freelancer/dashboard` for freelancer accounts (this was written in Phase 0 anticipating this route) — confirm this by reading the file; no change needed if the target is already `/freelancer/dashboard`. If it points anywhere else, correct it to `navigate("/freelancer/dashboard")` for the freelancer branch only.

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd client && npx vitest run src/App.test.tsx`
Expected: PASS

- [ ] **Step 6: Run the full client test suite**

Run: `cd client && npm test`
Expected: All tests PASS

- [ ] **Step 7: Manual smoke test**

1. In `server/`, run `npm run dev` (port 4000). In `client/`, run `npm run dev` (port 5173).
2. Sign in with an existing freelancer account at `http://localhost:5173/login`.
3. Confirm it lands on `/freelancer/dashboard`, shows stat tiles (credits/escrow/open briefs) and a list of matched jobs (or the empty state if none match).
4. Click "Save"/bookmark on a job, then navigate to `/freelancer/saved-jobs` and confirm it appears there.
5. Open the agency-view modal on a saved job and confirm the agency's logo loads (proves the new `GET /api/agencies/:agencyId/image` route works end-to-end) or falls back to the initial-letter avatar if the agency has no logo.
6. Submit a test proposal from either page and confirm the credit-deduction alert appears and the job flips to "Applied".

- [ ] **Step 8: Commit**

```bash
git add client/src/App.tsx client/src/App.test.tsx client/src/pages/Login.tsx
git commit -m "Wire freelancer dashboard and saved-jobs routes behind RequireAuth"
```

---

## Post-Phase-2a note

This plan covers only the freelancer dashboard's "matched briefs" preview and the saved-jobs page — not the full `/freelancer/marketplace` browse-and-filter page (which shares most of its logic with the dashboard but adds pagination, sort, and a denser filter sidebar) or any agency-side page. Given the spec's Phase 2 row ("Freelancer + agency core — marketplace, jobs, proposals, saved jobs, profiles, find-freelancers"), the remaining slices — each warranting their own plan — are: the full marketplace page, `/freelancer/proposals`, agency job management (`/agency/dashboard`, posting/editing jobs, responding to proposals), profile editors for both sides (which need new server routes — no update-profile action exists yet in the current app), and `/agency/find-freelancers`.
