# React + Node Migration — Phase 2e (Agency Find Freelancers) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port `/agency/find-freelancers` — the agency's freelancer-search/browse page (search bar, category/trust-level filters, a paginated grid of freelancer cards, a freelancer detail modal) — to `client/`. This is the last remaining Phase 2 slice; after this, Phase 2 (freelancer + agency core) is complete.

**Architecture:** One new server route (`GET /api/freelancers`) replaces the original's combined server-component-SSR-plus-client-fetch data loading (`app/agency/find-freelancers/page.tsx` + `FindFreelancersClient.tsx`'s `loadFreelancers`) with a single paginated endpoint the client calls via `useInfiniteQuery`, mirroring the exact pattern already established for `GET /api/proposals/mine` (Phase 2b) and `useMarketplaceQuery` (freelancer marketplace browse phase). No SSR-seeded initial page load — like every other ported page, this one fetches on mount behind a loading skeleton.

**Tech Stack:** Same as prior Phase 2 slices (`client/`: React 19, TanStack Query, react-router, shadcn/Radix `Select`; `server/`: Express + `req.supabase`). No new dependencies.

**Spec:** `docs/superpowers/specs/2026-09-08-nextjs-to-react-node-migration-design.md` (Section 7, Phase 2 row)

## Global Constraints

- **Messaging is entirely out of scope**, deferred to Phase 3 (realtime messaging). The original's "Contact"/"Send Message" buttons and `handleContactFreelancer` (which creates/looks up a `conversations` row and navigates to `/agency/messages`) are dropped entirely — no `conversations`/`messages` table access anywhere in this plan's code. Only "View profile" remains as an action on each freelancer card.
- **No server-side role check beyond `requireAuth`.** The new `GET /api/freelancers` route follows the same pattern as the existing `GET /api/jobs/agency`: mounted behind the app-wide `requireAuth` middleware, uses the caller's RLS-scoped `req.supabase`, and does not additionally verify the caller's `account_type` — role gating happens client-side (see next point), matching this codebase's established convention.
- **Client-side role gate matches every other agency page**: `const { profile } = useAuth(); if (profile && profile.account_type !== "agency") return <Navigate to="/" replace />`. The original redirects freelancers to `/freelancer/dashboard` and admins to `/admin/dashboard` specifically — this plan uses the simpler single `/`-redirect already established by `AgencyDashboard`/`AgencyProfile`, not the original's per-role redirects, for consistency with the rest of `client/`.
- **Category and trust-level filters stay client-side**, applied only to whichever page(s) of results are currently loaded — this exactly matches the original's own behavior (both filters are computed in-memory over `transformed`, never sent to the server) and is a known, pre-existing limitation of the feature, not something to fix in this pass. The search-bar keyword and the filter modal's own "Keywords" field are the only inputs that actually reach the server.
- **The keyword search term is interpolated unsanitized into a PostgREST `.or()` filter**, exactly mirroring the existing, already-tracked pattern in `GET /api/proposals/mine` and the original Next.js action — this is a known, deferred issue across this whole migration, not something to fix here.
- **Status/category colors use this codebase's semantic tokens**, not the original's literal Tailwind colors (`bg-green-100 text-green-800 dark:bg-green-900/30...`, `bg-blue-100...`, `bg-orange-100...`). Trust badges: `bg-success/10 text-success` (Fully Verified), `bg-primary/10 text-primary` (Verified), `bg-muted text-muted-foreground` (New) — matching the semantic-token convention every other ported page follows.
- **Skills travel over the wire as an array** (`string[]`), not the original's comma-joined string — the client already has `getCategoriesForSkills(skills: string[])` from the already-ported `@/lib/categories`, so returning an array avoids a needless join-then-split round trip. `hourly_rate`/`experience_level` are dropped from the response entirely — the original always hardcodes them to `0`/`"Expert"` as placeholder fallbacks (there's no real per-freelancer data source for either field in the current schema), so faithfully porting fake data is not worth the wire bytes; the client page does not render either field.
- **Pagination follows the established `useInfiniteQuery` + "Load more" button pattern** (`GET /api/proposals/mine`, `useMarketplaceQuery`), not the original's manual offset/`hasMore` state — page size 20, matching `FREELANCERS_PER_PAGE` in the original.
- **Table names are used exactly as in the original**, including the existing typo/odd capitalization: `profiles`, `freelancer_logos`, `Freelancer_identitie` (not "Identity" — this is the real, existing table name), `freelancer_proposal_status`, `freelancer_skills`.
- Every data need funnels through a query/mutation hook in `client/src/lib/queries/*.ts` — no page or component calls `apiFetch` directly.

---

## Task 1: `GET /api/freelancers` server route

**Files:**
- Create: `server/src/routes/freelancers.ts`
- Test: `server/src/routes/freelancers.test.ts`
- Modify: `server/src/app.ts` (mount the new router)
- Test: `server/src/app.test.ts` (mount assertion, if the existing file has a pattern for it — otherwise skip; see Step 6)

**Interfaces:**
- Produces: `GET /api/freelancers?search=&offset=&limit=` — response `{ freelancers: FreelancerSearchResult[], hasMore: boolean }`, where `FreelancerSearchResult` is `{ id, full_name, bio, location, skills: string[], created_at, logo, verification_status, jobs_completed }`. Task 2's `useFindFreelancersQuery` consumes this shape exactly.

- [ ] **Step 1: Write the failing tests**

```ts
// server/src/routes/freelancers.test.ts
import { describe, it, expect, vi } from "vitest"
import request from "supertest"
import express from "express"
import freelancersRouter from "./freelancers"

function appWith(supabase: any) {
  const app = express()
  app.use(express.json())
  app.use((req: any, _res, next) => {
    req.supabase = supabase
    req.user = { id: "agency-1" }
    next()
  })
  app.use("/", freelancersRouter)
  return app
}

function makeSupabase(profilesData: any[], relatedData: Record<string, any[]> = {}) {
  return {
    from: vi.fn((table: string) => {
      if (table === "profiles") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn(() => ({
                range: vi.fn(() => Promise.resolve({ data: profilesData, error: null })),
              })),
            })),
          })),
        }
      }
      return {
        select: vi.fn(() => ({
          in: vi.fn(() => ({
            eq: vi.fn(() => Promise.resolve({ data: relatedData[table] ?? [], error: null })),
            then: (resolve: any) => resolve({ data: relatedData[table] ?? [], error: null }),
          })),
        })),
      }
    }),
  }
}

describe("GET /freelancers", () => {
  it("returns freelancers with logos, verification, completed-job counts, and skills joined in", async () => {
    const supabase = makeSupabase(
      [{ id: "f-1", full_name: "Jane Doe", bio: "A bio", location: "Lagos", created_at: "2026-01-01T00:00:00Z" }],
      {
        freelancer_logos: [{ freelancer_id: "f-1", logo_path: "f-1/avatar.png", logo_data: null }],
        Freelancer_identitie: [{ user_id: "f-1", verification_status: "verified" }],
        freelancer_proposal_status: [{ freelancer_id: "f-1", status: "completed" }],
        freelancer_skills: [{ user_id: "f-1", skill_name: "Web Development" }],
      }
    )
    process.env.SUPABASE_URL = "https://example.supabase.co"

    const res = await request(appWith(supabase)).get("/").query({ limit: "20", offset: "0" })

    expect(res.body.freelancers).toEqual([
      {
        id: "f-1",
        full_name: "Jane Doe",
        bio: "A bio",
        location: "Lagos",
        skills: ["Web Development"],
        created_at: "2026-01-01T00:00:00Z",
        logo: "https://example.supabase.co/storage/v1/object/public/avatars/f-1/avatar.png",
        verification_status: "verified",
        jobs_completed: 1,
      },
    ])
    expect(res.body.hasMore).toBe(false)
  })

  it("returns an empty page with hasMore false when there are no matching profiles", async () => {
    const supabase = makeSupabase([])
    const res = await request(appWith(supabase)).get("/").query({ limit: "20", offset: "0" })
    expect(res.body).toEqual({ freelancers: [], hasMore: false })
  })

  it("sets hasMore true when a full page of results comes back", async () => {
    const twenty = Array.from({ length: 20 }, (_, i) => ({
      id: `f-${i}`,
      full_name: `Freelancer ${i}`,
      bio: null,
      location: null,
      created_at: "2026-01-01T00:00:00Z",
    }))
    const supabase = makeSupabase(twenty)
    const res = await request(appWith(supabase)).get("/").query({ limit: "20", offset: "0" })
    expect(res.body.hasMore).toBe(true)
    expect(res.body.freelancers).toHaveLength(20)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd server && npx vitest run src/routes/freelancers.test.ts`
Expected: FAIL — `./freelancers` doesn't exist yet.

- [ ] **Step 3: Implement the route**

```ts
// server/src/routes/freelancers.ts
import { Router } from "express"
import { asyncHandler } from "../lib/http.js"
import { resolveAvatar } from "../lib/avatar.js"

const freelancersRouter = Router()

freelancersRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const limit = Number(req.query.limit ?? 20)
    const offset = Number(req.query.offset ?? 0)
    const search = typeof req.query.search === "string" ? req.query.search : ""

    const supabase = req.supabase!

    let query = supabase
      .from("profiles")
      .select("id, full_name, bio, location, created_at")
      .eq("account_type", "freelancer")
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1)

    if (search) {
      query = query.or(`full_name.ilike.%${search}%,bio.ilike.%${search}%`)
    }

    const { data: profilesData, error } = await query

    if (error) {
      console.error("Error searching freelancers:", error)
      res.json({ freelancers: [], hasMore: false })
      return
    }

    if (!profilesData || profilesData.length === 0) {
      res.json({ freelancers: [], hasMore: false })
      return
    }

    const freelancerIds = profilesData.map((p: { id: string }) => p.id)

    const [logosResult, verificationResult, completedJobsResult, skillsResult] = await Promise.all([
      supabase.from("freelancer_logos").select("freelancer_id, logo_path, logo_data").in("freelancer_id", freelancerIds),
      supabase.from("Freelancer_identitie").select("user_id, verification_status").in("user_id", freelancerIds),
      supabase
        .from("freelancer_proposal_status")
        .select("freelancer_id, status")
        .in("freelancer_id", freelancerIds)
        .eq("status", "completed"),
      supabase.from("freelancer_skills").select("user_id, skill_name").in("user_id", freelancerIds),
    ])

    const logoMap: Record<string, string> = {}
    logosResult.data?.forEach((l: { freelancer_id: string }) => {
      logoMap[l.freelancer_id] = resolveAvatar(l)
    })

    const verificationMap: Record<string, string> = {}
    verificationResult.data?.forEach((v: { user_id: string; verification_status: string }) => {
      verificationMap[v.user_id] = v.verification_status
    })

    const completedCountMap: Record<string, number> = {}
    completedJobsResult.data?.forEach((j: { freelancer_id: string }) => {
      completedCountMap[j.freelancer_id] = (completedCountMap[j.freelancer_id] || 0) + 1
    })

    const skillsMap: Record<string, string[]> = {}
    skillsResult.data?.forEach((s: { user_id: string; skill_name: string }) => {
      if (!skillsMap[s.user_id]) skillsMap[s.user_id] = []
      skillsMap[s.user_id].push(s.skill_name)
    })

    const freelancers = profilesData.map((p: { id: string; full_name: string; bio: string | null; location: string | null; created_at: string }) => ({
      id: p.id,
      full_name: p.full_name,
      bio: p.bio,
      location: p.location,
      skills: skillsMap[p.id] || [],
      created_at: p.created_at,
      logo: logoMap[p.id] || null,
      verification_status: verificationMap[p.id] || null,
      jobs_completed: completedCountMap[p.id] || 0,
    }))

    res.json({ freelancers, hasMore: profilesData.length === limit })
  })
)

export default freelancersRouter
```

- [ ] **Step 4: Mount the router**

In `server/src/app.ts`, add the import next to the other route imports:

```ts
import freelancersRouter from "./routes/freelancers.js"
```

Add the mount line next to the other `app.use("/api/...", requireAuth, ...)` lines:

```ts
  app.use("/api/freelancers", requireAuth, freelancersRouter)
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd server && npx vitest run src/routes/freelancers.test.ts`
Expected: PASS

- [ ] **Step 6: Run the full server test suite**

Run: `cd server && npx vitest run`
Expected: PASS (all existing tests still pass alongside the new ones)

- [ ] **Step 7: Commit**

```bash
git add server/src/routes/freelancers.ts server/src/routes/freelancers.test.ts server/src/app.ts
git commit -m "feat(server): add GET /api/freelancers for agency freelancer search"
```

---

## Task 2: `useFindFreelancersQuery` client hook

**Files:**
- Create: `client/src/lib/queries/freelancers.ts`
- Test: `client/src/lib/queries/freelancers.test.tsx`

**Interfaces:**
- Consumes: `apiFetch` (`client/src/lib/api.ts`, existing).
- Produces: `FreelancerSearchResult` type, `useFindFreelancersQuery(searchTerm: string, enabled: boolean)` — a `useInfiniteQuery` wrapping `GET /api/freelancers`. Task 3/4 consume both.

- [ ] **Step 1: Write the failing tests**

```tsx
// client/src/lib/queries/freelancers.test.tsx
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
  vi.clearAllMocks()
})

describe("useFindFreelancersQuery", () => {
  it("GETs /api/freelancers with search/offset/limit and returns the first page", async () => {
    apiFetchMock.mockResolvedValue({
      freelancers: [{ id: "f-1", full_name: "Jane Doe", bio: null, location: null, skills: [], created_at: "2026-01-01T00:00:00Z", logo: null, verification_status: null, jobs_completed: 0 }],
      hasMore: false,
    })
    const { useFindFreelancersQuery } = await import("./freelancers")

    const { result } = renderHook(() => useFindFreelancersQuery("react dev", true), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(apiFetchMock).toHaveBeenCalledWith("/api/freelancers?search=react%20dev&offset=0&limit=20")
    expect(result.current.data?.pages[0].freelancers[0].full_name).toBe("Jane Doe")
  })

  it("does not fetch when disabled", async () => {
    const { useFindFreelancersQuery } = await import("./freelancers")
    renderHook(() => useFindFreelancersQuery("", false), { wrapper })
    expect(apiFetchMock).not.toHaveBeenCalled()
  })

  it("computes the next page's offset from the total freelancers already loaded", async () => {
    apiFetchMock
      .mockResolvedValueOnce({
        freelancers: Array.from({ length: 20 }, (_, i) => ({ id: `f-${i}`, full_name: `F${i}`, bio: null, location: null, skills: [], created_at: "2026-01-01T00:00:00Z", logo: null, verification_status: null, jobs_completed: 0 })),
        hasMore: true,
      })
      .mockResolvedValueOnce({
        freelancers: [{ id: "f-20", full_name: "F20", bio: null, location: null, skills: [], created_at: "2026-01-01T00:00:00Z", logo: null, verification_status: null, jobs_completed: 0 }],
        hasMore: false,
      })
    const { useFindFreelancersQuery } = await import("./freelancers")

    const { result } = renderHook(() => useFindFreelancersQuery("", true), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    await result.current.fetchNextPage()
    await waitFor(() => expect(result.current.data?.pages).toHaveLength(2))

    expect(apiFetchMock).toHaveBeenLastCalledWith("/api/freelancers?search=&offset=20&limit=20")
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd client && npx vitest run src/lib/queries/freelancers.test.tsx`
Expected: FAIL — `client/src/lib/queries/freelancers.ts` doesn't exist yet.

- [ ] **Step 3: Implement the hook**

```ts
// client/src/lib/queries/freelancers.ts
import { useInfiniteQuery, keepPreviousData } from "@tanstack/react-query"
import { apiFetch } from "../api"

export type FreelancerSearchResult = {
  id: string
  full_name: string
  bio: string | null
  location: string | null
  skills: string[]
  created_at: string
  logo: string | null
  verification_status: string | null
  jobs_completed: number
}

type FreelancersPage = {
  freelancers: FreelancerSearchResult[]
  hasMore: boolean
}

const FREELANCERS_PAGE_SIZE = 20

export function useFindFreelancersQuery(searchTerm: string, enabled: boolean) {
  return useInfiniteQuery({
    queryKey: ["freelancers", searchTerm],
    queryFn: ({ pageParam }) =>
      apiFetch<FreelancersPage>(
        `/api/freelancers?search=${encodeURIComponent(searchTerm)}&offset=${pageParam}&limit=${FREELANCERS_PAGE_SIZE}`
      ),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage.hasMore) return undefined
      return allPages.reduce((sum, page) => sum + page.freelancers.length, 0)
    },
    placeholderData: keepPreviousData,
    enabled,
  })
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd client && npx vitest run src/lib/queries/freelancers.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add client/src/lib/queries/freelancers.ts client/src/lib/queries/freelancers.test.tsx
git commit -m "feat(client): add useFindFreelancersQuery hook"
```

---

## Task 3: `FreelancerProfileModal` component

**Files:**
- Create: `client/src/pages/agency/FreelancerProfileModal.tsx`
- Test: `client/src/pages/agency/FreelancerProfileModal.test.tsx`

**Interfaces:**
- Consumes: `FreelancerSearchResult` (Task 2, `@/lib/queries/freelancers`); `getCategoriesForSkills` (`@/lib/categories`, already ported); `Card`/`CardHeader`/`CardContent`/`CardTitle`, `Avatar`/`AvatarFallback`/`AvatarImage`, `Badge`, `Button` (all already ported).
- Produces: default export `FreelancerProfileModal`, props `{ freelancer: FreelancerSearchResult | null; isOpen: boolean; onClose: () => void }`. Task 4's `FindFreelancers.tsx` renders it.

- [ ] **Step 1: Write the failing tests**

```tsx
// client/src/pages/agency/FreelancerProfileModal.test.tsx
import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import FreelancerProfileModal from "./FreelancerProfileModal"
import type { FreelancerSearchResult } from "@/lib/queries/freelancers"

const freelancer: FreelancerSearchResult = {
  id: "freelancer-1",
  full_name: "Jane Doe",
  bio: "I build things",
  location: "Lagos",
  skills: ["Web Development"],
  created_at: "2026-01-01T00:00:00Z",
  logo: null,
  verification_status: "verified",
  jobs_completed: 6,
}

describe("FreelancerProfileModal", () => {
  it("renders nothing when closed", () => {
    const { container } = render(<FreelancerProfileModal freelancer={freelancer} isOpen={false} onClose={vi.fn()} />)
    expect(container).toBeEmptyDOMElement()
  })

  it("renders nothing when no freelancer is selected", () => {
    const { container } = render(<FreelancerProfileModal freelancer={null} isOpen onClose={vi.fn()} />)
    expect(container).toBeEmptyDOMElement()
  })

  it("shows the freelancer's details, trust badge, skills, and derived categories", () => {
    render(<FreelancerProfileModal freelancer={freelancer} isOpen onClose={vi.fn()} />)
    expect(screen.getByText("Jane Doe")).toBeInTheDocument()
    expect(screen.getByText("I build things")).toBeInTheDocument()
    expect(screen.getByText("Lagos")).toBeInTheDocument()
    expect(screen.getByText("Fully Verified")).toBeInTheDocument()
    expect(screen.getByText("Web Development")).toBeInTheDocument()
    expect(screen.getByText("Tech")).toBeInTheDocument()
    expect(screen.getByText("6")).toBeInTheDocument()
  })

  it("calls onClose when the close button is clicked", async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<FreelancerProfileModal freelancer={freelancer} isOpen onClose={onClose} />)
    await user.click(screen.getByRole("button", { name: /close/i }))
    expect(onClose).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd client && npx vitest run src/pages/agency/FreelancerProfileModal.test.tsx`
Expected: FAIL — `Cannot find module './FreelancerProfileModal'`

- [ ] **Step 3: Write `client/src/pages/agency/FreelancerProfileModal.tsx`**

```tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { MapPin, ShieldCheck, X } from "lucide-react"
import { getCategoriesForSkills } from "@/lib/categories"
import type { FreelancerSearchResult } from "@/lib/queries/freelancers"

function trustBadge(verificationStatus: string | null, jobsCompleted: number) {
  if (verificationStatus === "verified" && jobsCompleted >= 5) {
    return { label: "Fully Verified", className: "bg-success/10 text-success" }
  }
  if (verificationStatus === "verified") {
    return { label: "Verified", className: "bg-primary/10 text-primary" }
  }
  return { label: "New", className: "bg-muted text-muted-foreground" }
}

export default function FreelancerProfileModal({
  freelancer,
  isOpen,
  onClose,
}: {
  freelancer: FreelancerSearchResult | null
  isOpen: boolean
  onClose: () => void
}) {
  if (!isOpen || !freelancer) return null

  const badge = trustBadge(freelancer.verification_status, freelancer.jobs_completed)
  const categories = getCategoriesForSkills(freelancer.skills)

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Avatar className="h-16 w-16">
                <AvatarImage src={freelancer.logo || undefined} alt={freelancer.full_name} />
                <AvatarFallback className="text-lg font-semibold bg-primary text-white">
                  {freelancer.full_name?.charAt(0).toUpperCase() || "F"}
                </AvatarFallback>
              </Avatar>
              <div>
                <div className="flex items-center gap-2">
                  <CardTitle className="text-xl">{freelancer.full_name}</CardTitle>
                  <Badge className={`text-xs border-0 ${badge.className}`}>
                    {badge.label !== "New" && <ShieldCheck className="h-3 w-3 mr-1" />}
                    {badge.label}
                  </Badge>
                </div>
                {freelancer.location && (
                  <p className="text-sm text-muted-foreground flex items-center mt-1">
                    <MapPin className="h-3 w-3 mr-1" />
                    {freelancer.location}
                  </p>
                )}
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {freelancer.bio && (
            <div>
              <h4 className="font-semibold mb-2">About</h4>
              <p className="text-sm text-muted-foreground">{freelancer.bio}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <h4 className="font-semibold mb-1">Jobs Completed</h4>
              <p className="text-sm text-muted-foreground">{freelancer.jobs_completed}</p>
            </div>
            <div>
              <h4 className="font-semibold mb-1">Member Since</h4>
              <p className="text-sm text-muted-foreground">{new Date(freelancer.created_at).getFullYear()}</p>
            </div>
          </div>

          {freelancer.skills.length > 0 && (
            <div>
              <h4 className="font-semibold mb-2">Skills</h4>
              <div className="flex flex-wrap gap-2">
                {freelancer.skills.map((skill) => (
                  <Badge key={skill} variant="secondary">
                    {skill}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {categories.length > 0 && (
            <div>
              <h4 className="font-semibold mb-2">Categories</h4>
              <div className="flex flex-wrap gap-2">
                {categories.map((cat) => (
                  <Badge key={cat} variant="outline">
                    {cat}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd client && npx vitest run src/pages/agency/FreelancerProfileModal.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/agency/FreelancerProfileModal.tsx client/src/pages/agency/FreelancerProfileModal.test.tsx
git commit -m "Port agency freelancer-profile detail modal to client (messaging deferred)"
```

---

## Task 4: `FindFreelancers` page

**Files:**
- Create: `client/src/pages/agency/FindFreelancers.tsx`
- Test: `client/src/pages/agency/FindFreelancers.test.tsx`

**Interfaces:**
- Consumes: `useAuth` (`@/contexts/AuthContext`, existing); `useFindFreelancersQuery`, `FreelancerSearchResult` (Task 2); `FreelancerProfileModal` (Task 3); `getCategoriesForSkills`, `ALL_CATEGORIES`, `type Category` (`@/lib/categories`, existing); `Button`, `Input`, `Card`/`CardHeader`/`CardContent`/`CardTitle`, `Badge`, `Avatar`/`AvatarFallback`/`AvatarImage`, `Select*` (all already ported).
- Produces: default export `FindFreelancers`, mounted at `/agency/find-freelancers` in Task 5's `App.tsx`.

- [ ] **Step 1: Write the failing tests**

```tsx
// client/src/pages/agency/FindFreelancers.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"
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
      <MemoryRouter>
        <FindFreelancers />
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
    const { container } = renderPage()
    await waitFor(() => expect(container).not.toBeEmptyDOMElement())
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd client && npx vitest run src/pages/agency/FindFreelancers.test.tsx`
Expected: FAIL — `Cannot find module './FindFreelancers'`

- [ ] **Step 3: Write `client/src/pages/agency/FindFreelancers.tsx`**

```tsx
import { useState } from "react"
import { Navigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Briefcase, Filter, Loader2, MapPin, Search, ShieldCheck, X } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { useFindFreelancersQuery, type FreelancerSearchResult } from "@/lib/queries/freelancers"
import { ALL_CATEGORIES, getCategoriesForSkills, type Category } from "@/lib/categories"
import FreelancerProfileModal from "./FreelancerProfileModal"

function trustBadge(verificationStatus: string | null, jobsCompleted: number) {
  if (verificationStatus === "verified" && jobsCompleted >= 5) {
    return { label: "Fully Verified", className: "bg-success/10 text-success" }
  }
  if (verificationStatus === "verified") {
    return { label: "Verified", className: "bg-primary/10 text-primary" }
  }
  return { label: "New", className: "bg-muted text-muted-foreground" }
}

export default function FindFreelancers() {
  const { profile } = useAuth()
  const [searchTerm, setSearchTerm] = useState("")
  const [searchBoxValue, setSearchBoxValue] = useState("")
  const [showFilterModal, setShowFilterModal] = useState(false)
  const [selectedFreelancer, setSelectedFreelancer] = useState<FreelancerSearchResult | null>(null)
  const [filters, setFilters] = useState({ category: "" as Category | "", keywords: "", trustLevel: "" })

  const query = useFindFreelancersQuery(searchTerm, true)

  if (profile && profile.account_type !== "agency") {
    return <Navigate to="/" replace />
  }

  if (query.isLoading) {
    return (
      <div data-testid="find-freelancers-skeleton" className="min-h-screen bg-surface pb-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8 space-y-6 animate-pulse">
          <div className="h-7 w-56 bg-foreground/5 rounded" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-64 rounded-xl border border-border bg-card" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (query.isError) {
    return (
      <div className="min-h-screen bg-surface pb-20 flex items-center justify-center">
        <div className="text-center space-y-2">
          <p className="text-sm font-semibold text-foreground">Couldn't load freelancers</p>
          <p className="text-sm text-muted-foreground">Please try refreshing the page.</p>
        </div>
      </div>
    )
  }

  const freelancers = query.data?.pages.flatMap((page) => page.freelancers) ?? []

  const filtered = freelancers.filter((f) => {
    if (filters.category) {
      const categories = getCategoriesForSkills(f.skills)
      if (!categories.includes(filters.category as Category)) return false
    }
    if (filters.trustLevel) {
      const badge = trustBadge(f.verification_status, f.jobs_completed)
      if (filters.trustLevel === "Fully Verified" && badge.label !== "Fully Verified") return false
      if (filters.trustLevel === "Verified" && badge.label !== "Verified" && badge.label !== "Fully Verified") return false
    }
    return true
  })

  const runSearch = () => setSearchTerm(searchBoxValue)

  const applyFilters = () => {
    setSearchTerm(filters.keywords || searchBoxValue)
    setShowFilterModal(false)
  }

  const resetFilters = () => {
    setFilters({ category: "", keywords: "", trustLevel: "" })
    setSearchBoxValue("")
    setSearchTerm("")
  }

  return (
    <div className="min-h-screen bg-surface pb-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <header className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Marketplace</p>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Find freelancers</h1>
          <p className="text-sm text-muted-foreground">Search and connect with vetted talent across Nigeria.</p>
        </header>

        <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, skills, or keywords..."
                value={searchBoxValue}
                onChange={(e) => setSearchBoxValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && runSearch()}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={runSearch} className="h-10 px-4 rounded-lg gap-2">
                <Search className="h-4 w-4" />
                Search
              </Button>
              <Button variant="outline" className="h-10 px-4 rounded-lg gap-2" onClick={() => setShowFilterModal(true)}>
                <Filter className="h-4 w-4" />
                Filters
              </Button>
            </div>
          </div>
        </div>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">
              Freelancers <span className="font-normal text-muted-foreground">· {filtered.length}</span>
            </h2>
            {(filters.category || filters.trustLevel || filters.keywords) && (
              <Button variant="ghost" size="sm" onClick={resetFilters} className="text-primary">
                Clear filters
              </Button>
            )}
          </div>

          {filtered.length === 0 ? (
            <div className="rounded-xl border border-border bg-card py-16 px-6 text-center">
              <div className="mx-auto h-11 w-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <Search className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-sm font-semibold text-foreground">No freelancers found</h3>
              <p className="mt-1 text-sm text-muted-foreground max-w-sm mx-auto">Try adjusting your search or filters.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filtered.map((freelancer) => {
                  const badge = trustBadge(freelancer.verification_status, freelancer.jobs_completed)
                  const mainSkill = freelancer.skills[0] || "Freelancer"

                  return (
                    <Card
                      key={freelancer.id}
                      className="group overflow-hidden rounded-xl border border-border bg-card shadow-none hover:border-foreground/20 transition-colors"
                    >
                      <CardContent className="p-5">
                        <div className="flex items-start gap-4 mb-4">
                          <Avatar className="h-14 w-14 flex-shrink-0">
                            <AvatarImage src={freelancer.logo || undefined} alt={freelancer.full_name} />
                            <AvatarFallback className="bg-primary text-white text-lg font-semibold">
                              {freelancer.full_name?.charAt(0).toUpperCase() || "F"}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-semibold text-foreground truncate">{freelancer.full_name}</h3>
                              <Badge className={`text-xs border-0 ${badge.className}`}>
                                {badge.label !== "New" && <ShieldCheck className="h-3 w-3 mr-1" />}
                                {badge.label}
                              </Badge>
                            </div>
                            <p className="text-sm text-primary font-medium mt-0.5">{mainSkill}</p>
                            {freelancer.location && (
                              <p className="text-xs text-muted-foreground flex items-center mt-1">
                                <MapPin className="h-3 w-3 mr-1" />
                                {freelancer.location}
                              </p>
                            )}
                          </div>
                        </div>

                        {freelancer.bio && <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{freelancer.bio}</p>}

                        <div className="flex flex-wrap gap-1.5 mb-4">
                          {freelancer.skills.slice(0, 4).map((skill) => (
                            <span key={skill} className="px-2 py-0.5 rounded-md bg-surface-2 text-muted-foreground text-[11px]">
                              {skill}
                            </span>
                          ))}
                          {freelancer.skills.length > 4 && (
                            <span className="px-2 py-0.5 text-[11px] text-muted-foreground">+{freelancer.skills.length - 4}</span>
                          )}
                        </div>

                        <div className="flex items-center justify-between text-xs text-muted-foreground mb-4 pb-4 border-b border-border">
                          <div className="flex items-center gap-1.5">
                            <Briefcase className="h-3.5 w-3.5" />
                            <span>
                              {freelancer.jobs_completed} job{freelancer.jobs_completed !== 1 ? "s" : ""} done
                            </span>
                          </div>
                        </div>

                        <Button variant="outline" size="sm" className="w-full" onClick={() => setSelectedFreelancer(freelancer)}>
                          View profile
                        </Button>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>

              {query.hasNextPage && (
                <div className="flex justify-center mt-6">
                  <Button variant="outline" onClick={() => query.fetchNextPage()} disabled={query.isFetchingNextPage}>
                    {query.isFetchingNextPage ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Loading...
                      </>
                    ) : (
                      "Load more freelancers"
                    )}
                  </Button>
                </div>
              )}
            </>
          )}
        </section>
      </div>

      {showFilterModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Filter Freelancers</CardTitle>
                <Button variant="ghost" size="icon" onClick={() => setShowFilterModal(false)} aria-label="Close">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Keywords</label>
                <Input
                  placeholder='e.g. "logo", "UI/UX", "WordPress"'
                  value={filters.keywords}
                  onChange={(e) => setFilters({ ...filters, keywords: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Skill Category</label>
                <Select value={filters.category} onValueChange={(value) => setFilters({ ...filters, category: value as Category })}>
                  <SelectTrigger>
                    <SelectValue placeholder="All categories" />
                  </SelectTrigger>
                  <SelectContent>
                    {ALL_CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Trust Level</label>
                <Select value={filters.trustLevel} onValueChange={(value) => setFilters({ ...filters, trustLevel: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="All trust levels" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Verified">Verified & above</SelectItem>
                    <SelectItem value="Fully Verified">Fully Verified only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex space-x-2 pt-4">
                <Button
                  variant="outline"
                  className="flex-1 bg-transparent"
                  onClick={() => setFilters({ category: "", keywords: "", trustLevel: "" })}
                >
                  Reset
                </Button>
                <Button className="flex-1" onClick={applyFilters}>
                  Apply Filters
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <FreelancerProfileModal
        freelancer={selectedFreelancer}
        isOpen={!!selectedFreelancer}
        onClose={() => setSelectedFreelancer(null)}
      />
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd client && npx vitest run src/pages/agency/FindFreelancers.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/agency/FindFreelancers.tsx client/src/pages/agency/FindFreelancers.test.tsx
git commit -m "Port agency find-freelancers page to client (messaging deferred)"
```

---

## Task 5: Wire the route into `App.tsx`

**Files:**
- Modify: `client/src/App.tsx`
- Test: `client/src/App.test.tsx` (extend)

**Interfaces:** none new — this task wires Task 4's page into the existing route table.

- [ ] **Step 1: Write the failing test**

Add to `client/src/App.test.tsx` (a new top-level `describe`, after the existing `describe("agency dashboard route", ...)` block if present, otherwise anywhere after the other protected-route describes):

```tsx
describe("find freelancers route", () => {
  it("redirects /agency/find-freelancers to /login when signed out", async () => {
    renderAt("/agency/find-freelancers")
    await screen.findByRole("heading", { name: /Continue your work/i })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client && npx vitest run src/App.test.tsx -t "find freelancers"`
Expected: FAIL — no route registered for `/agency/find-freelancers`, so `RequireAuth`/redirect never runs and the assertion times out.

- [ ] **Step 3: Update `client/src/App.tsx`**

Read the current file first to find its import block and its `/agency/profile` route, and add both alongside them (before the existing catch-all `<Route path="*">` route — a route placed after the catch-all is unreachable). Add the import:

```tsx
import FindFreelancers from "./pages/agency/FindFreelancers"
```

Add the route, next to the other `/agency/*` routes:

```tsx
            <Route
              path="/agency/find-freelancers"
              element={
                <RequireAuth>
                  <FindFreelancers />
                </RequireAuth>
              }
            />
```

- [ ] **Step 4: Update `App.test.tsx`'s `renderAt` helper**

Add the same import and route to the helper's local `<Routes>` table, mirroring how every earlier phase added its own route there.

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd client && npx vitest run src/App.test.tsx`
Expected: PASS

- [ ] **Step 6: Run the full client test suite**

Run: `cd client && npm test`
Expected: All tests PASS

- [ ] **Step 7: Commit**

```bash
git add client/src/App.tsx client/src/App.test.tsx
git commit -m "Wire agency find-freelancers route behind RequireAuth"
```

---

## Post-Phase-2e note

This plan completes Phase 2 (freelancer + agency core). Deferred to later phases: messaging/"Contact freelancer" (Phase 3, realtime messaging), category/trust-level filters becoming server-side (not currently planned — the original never did this either), search-term sanitization (tracked migration-wide deferred issue). After this plan merges, the migration proceeds to Phase 3 (credits & realtime messaging), Phase 4 (escrow & payments — gated on an external Supabase-side v2 migration), Phase 5 (admin/disputes/influencer portals), Phase 6 (testing & regression hardening), Phase 7 (deployment & cutover).
