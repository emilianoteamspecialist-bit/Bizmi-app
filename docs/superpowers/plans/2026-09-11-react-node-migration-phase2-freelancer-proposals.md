# React + Node Migration — Phase 2b (Freelancer Proposals) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port `/freelancer/proposals` (the freelancer's bid-management list — search, load-more pagination, a status badge per proposal, and a view-full-proposal modal) to `client/`, wired to Phase 1's existing `GET /api/proposals/mine` endpoint. No new server routes.

**Architecture:** A single page (`client/src/pages/freelancer/Proposals.tsx`) driven by one new TanStack Query hook (`useMyProposalsQuery`, added to the existing `client/src/lib/queries/proposals.ts` from Phase 2a) using `useInfiniteQuery` — the first use of that pattern in this codebase, replacing the original Next.js page's manual offset/append `useState` bookkeeping with TanStack Query's built-in pagination cursor. One more shadcn primitive (`Badge`) is ported for the attachments display.

**Tech Stack:** Same as Phase 2a's client stack — no new dependencies. `@tanstack/react-query`'s `useInfiniteQuery` (already installed, not yet used elsewhere in this codebase).

**Spec:** `docs/superpowers/specs/2026-09-08-nextjs-to-react-node-migration-design.md` (Section 7, Phase 2 row)

## Global Constraints

- **No escrow/payment code.** The original `ProposalsClient.tsx`'s "Start work" and "Complete work" actions are explicitly excluded from this port: they write directly to `freelancer_proposal_status`, read `freelancer_bank_details`, and call `/api/paystack/payout-freelancer` — all escrow/payout-adjacent functionality the spec gates behind the Supabase-side escrow v2 migration finishing (Section 7, Phase 4 row) and Phase 1 already established as "no money involved" for this stage of the port. This page becomes read-only (view your proposals and their status) until Phase 4.
- Reuses Phase 1's `GET /api/proposals/mine` unchanged (`{ proposals: any[], hasMore: boolean }`, query params `searchTerm`/`offset`/`limit`) — no server-side changes in this plan.
- Every data need funnels through the new `useMyProposalsQuery` hook — the page never calls `apiFetch` directly, matching Phase 2a's established convention.
- New UI primitive (`Badge`) is a verbatim port from the root `components/ui/badge.tsx`, `"use client"` dropped, matching Phase 0/2a's established porting convention.

---

## Task 1: Port the Badge UI primitive

**Files:**
- Create: `client/src/components/ui/badge.tsx`
- Test: `client/src/components/ui/badge.test.tsx`

**Interfaces:**
- Produces: `Badge` (props: `variant?`, plus standard `div` props), `badgeVariants` — same names/props as the existing root `components/ui/badge.tsx`. Task 3's `Proposals.tsx` imports `Badge`.

- [ ] **Step 1: Write the failing test**

```tsx
// client/src/components/ui/badge.test.tsx
import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { Badge } from "./badge"

describe("Badge", () => {
  it("renders its children and applies the outline variant class", () => {
    render(<Badge variant="outline">📎 file.pdf</Badge>)
    const badge = screen.getByText("📎 file.pdf")
    expect(badge).toBeInTheDocument()
    expect(badge.className).toContain("border-border")
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client && npx vitest run src/components/ui/badge.test.tsx`
Expected: FAIL — `Cannot find module './badge'`

- [ ] **Step 3: Create `client/src/components/ui/badge.tsx`** (exact copy of `components/ui/badge.tsx`)

```tsx
import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-widest transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground shadow-sm hover:bg-primary-hover",
        secondary: "border-transparent bg-surface-2 text-foreground hover:bg-muted",
        destructive: "border-transparent bg-destructive/10 text-destructive hover:bg-destructive/20",
        success: "border-transparent bg-success/10 text-success hover:bg-success/20",
        warning: "border-transparent bg-warning/10 text-warning hover:bg-warning/20",
        info: "border-transparent bg-info/10 text-info hover:bg-info/20",
        outline: "text-foreground border-border",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd client && npx vitest run src/components/ui/badge.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add client/src/components/ui/badge.tsx client/src/components/ui/badge.test.tsx
git commit -m "Port Badge UI primitive to client"
```

---

## Task 2: `useMyProposalsQuery` hook (`client/src/lib/queries/proposals.ts`)

**Files:**
- Modify: `client/src/lib/queries/proposals.ts`
- Test: `client/src/lib/queries/proposals.test.tsx` (extend)

**Interfaces:**
- Consumes: `apiFetch` (`client/src/lib/api.ts`, Phase 0).
- Produces: `useMyProposalsQuery(searchTerm: string)` — a `useInfiniteQuery` result whose `data.pages` is an array of `{ proposals: Proposal[]; hasMore: boolean }` pages, added to `client/src/lib/queries/proposals.ts` alongside the existing `useSubmitProposalMutation` from Phase 2a (do not remove or modify that export). Also exports a `Proposal` type. Task 3's `Proposals.tsx` imports both.

- [ ] **Step 1: Write the failing test**

```tsx
// client/src/lib/queries/proposals.test.tsx — add this describe block to the existing file
describe("useMyProposalsQuery", () => {
  it("fetches the first page from GET /api/proposals/mine with offset 0", async () => {
    apiFetchMock.mockResolvedValue({
      proposals: [{ id: "p1", job_title: "Build a site" }],
      hasMore: false,
    })
    const { useMyProposalsQuery } = await import("./proposals")

    const { result } = renderHook(() => useMyProposalsQuery(""), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(apiFetchMock).toHaveBeenCalledWith("/api/proposals/mine?searchTerm=&offset=0&limit=15")
    expect(result.current.data?.pages[0].proposals).toEqual([{ id: "p1", job_title: "Build a site" }])
  })

  it("computes the next page's offset from the cumulative proposal count", async () => {
    apiFetchMock
      .mockResolvedValueOnce({
        proposals: Array.from({ length: 15 }, (_, i) => ({ id: `p${i}` })),
        hasMore: true,
      })
      .mockResolvedValueOnce({ proposals: [{ id: "p15" }], hasMore: false })

    const { useMyProposalsQuery } = await import("./proposals")
    const { result } = renderHook(() => useMyProposalsQuery(""), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.hasNextPage).toBe(true)

    result.current.fetchNextPage()

    await waitFor(() => expect(result.current.data?.pages.length).toBe(2))
    expect(apiFetchMock).toHaveBeenLastCalledWith("/api/proposals/mine?searchTerm=&offset=15&limit=15")
  })

  it("URL-encodes the search term", async () => {
    apiFetchMock.mockResolvedValue({ proposals: [], hasMore: false })
    const { useMyProposalsQuery } = await import("./proposals")

    const { result } = renderHook(() => useMyProposalsQuery("react & node"), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(apiFetchMock).toHaveBeenCalledWith("/api/proposals/mine?searchTerm=react%20%26%20node&offset=0&limit=15")
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client && npx vitest run src/lib/queries/proposals.test.tsx`
Expected: FAIL — `useMyProposalsQuery is not a function` (or `undefined`)

- [ ] **Step 3: Add the implementation**

```typescript
// client/src/lib/queries/proposals.ts — add to the existing file (keep the existing imports/exports intact)
import { useInfiniteQuery } from "@tanstack/react-query"

const PROPOSALS_PAGE_SIZE = 15

export type Proposal = {
  id: string
  job_id: string
  freelancer_id: string
  proposal_text: string
  timeline: string | null
  budget: number | null
  attachments: string[] | null
  status: "pending" | "accepted" | "rejected"
  created_at: string
  updated_at: string
  job_title?: string
  job_description?: string
  job_budget_min?: number
  job_budget_max?: number
  job_type?: string
  job_duration?: string
  job_location?: string
  skills?: string[]
  agency_name?: string
  funding_status?: string
  job_status?: string
  freelancer_status?: string
}

type ProposalsPage = { proposals: Proposal[]; hasMore: boolean }

export function useMyProposalsQuery(searchTerm: string) {
  return useInfiniteQuery({
    queryKey: ["proposals", "mine", searchTerm],
    queryFn: ({ pageParam }) =>
      apiFetch<ProposalsPage>(
        `/api/proposals/mine?searchTerm=${encodeURIComponent(searchTerm)}&offset=${pageParam}&limit=${PROPOSALS_PAGE_SIZE}`
      ),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage.hasMore) return undefined
      return allPages.reduce((sum, page) => sum + page.proposals.length, 0)
    },
  })
}
```

(The `import { useMutation, useQueryClient } from "@tanstack/react-query"` line already at the top of this file, from Phase 2a, needs `useInfiniteQuery` added to it — one combined import, not a duplicate.)

- [ ] **Step 4: Run test to verify it passes**

Run: `cd client && npx vitest run src/lib/queries/proposals.test.tsx`
Expected: PASS (all tests in the file, old and new)

- [ ] **Step 5: Commit**

```bash
git add client/src/lib/queries/proposals.ts client/src/lib/queries/proposals.test.tsx
git commit -m "Add useMyProposalsQuery (useInfiniteQuery) for the proposals list"
```

---

## Task 3: Proposals page (`/freelancer/proposals`)

**Files:**
- Create: `client/src/pages/freelancer/Proposals.tsx`
- Test: `client/src/pages/freelancer/Proposals.test.tsx`

**Interfaces:**
- Consumes: `Badge` (Task 1); `useMyProposalsQuery`, `Proposal` type (Task 2); `Avatar`/`AvatarFallback`, `Input`, `Button` (already ported, Phase 0/2a).
- Produces: default export `Proposals`, mounted at `/freelancer/proposals` in Task 4's `App.tsx`.

- [ ] **Step 1: Write the failing tests**

```tsx
// client/src/pages/freelancer/Proposals.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
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
    expect(screen.getByText("Acme Co")).toBeInTheDocument()
    expect(screen.getByText("Accepted")).toBeInTheDocument()
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client && npx vitest run src/pages/freelancer/Proposals.test.tsx`
Expected: FAIL — `Cannot find module './Proposals'`

- [ ] **Step 3: Write `client/src/pages/freelancer/Proposals.tsx`**

```tsx
import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { CalendarDays, DollarSign, Clock, CheckCircle, XCircle, AlertCircle, FileText, Search, MapPin, Loader2, X } from "lucide-react"
import { useMyProposalsQuery, type Proposal } from "@/lib/queries/proposals"

function getStatusIcon(status: string) {
  switch (status) {
    case "accepted":
      return <CheckCircle className="h-3.5 w-3.5 text-success" />
    case "rejected":
      return <XCircle className="h-3.5 w-3.5 text-destructive" />
    default:
      return <AlertCircle className="h-3.5 w-3.5 text-primary" />
  }
}

function getStatusColor(status: string) {
  switch (status) {
    case "accepted":
      return "bg-success/10 text-success"
    case "rejected":
      return "bg-destructive/10 text-destructive"
    default:
      return "bg-primary-soft text-primary"
  }
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
}

export default function Proposals() {
  const [searchTerm, setSearchTerm] = useState("")
  const [viewingProposal, setViewingProposal] = useState<Proposal | null>(null)

  const query = useMyProposalsQuery(searchTerm)

  if (query.isLoading) {
    return (
      <div className="min-h-screen bg-surface pb-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
          <div className="space-y-2 animate-pulse">
            <div className="h-3 w-24 bg-foreground/5 rounded" />
            <div className="h-7 w-56 bg-foreground/5 rounded" />
          </div>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-40 bg-card border border-border rounded-xl animate-pulse" />
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
          <p className="text-sm font-semibold text-foreground">Couldn't load your proposals</p>
          <p className="text-sm text-muted-foreground">Please try refreshing the page.</p>
        </div>
      </div>
    )
  }

  const proposals: Proposal[] = query.data?.pages.flatMap((page) => page.proposals) ?? []

  return (
    <div className="min-h-screen bg-surface pb-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <header className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Proposals</p>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">My proposals</h1>
          <p className="text-sm text-muted-foreground">Track the status of your job applications.</p>
        </header>

        <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search proposals by job title or description..."
              className="pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {proposals.length === 0 ? (
          <div className="rounded-xl border border-border bg-card py-16 px-6 text-center">
            <div className="mx-auto h-11 w-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <FileText className="h-5 w-5" />
            </div>
            <h3 className="mt-4 text-sm font-semibold text-foreground">
              {searchTerm ? "No matching proposals" : "No proposals yet"}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground max-w-sm mx-auto">
              {searchTerm ? "Try a different search term or clear the search." : "Start applying to jobs to see your proposals here."}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {proposals.map((proposal) => (
              <div key={proposal.id} className="rounded-xl border border-border bg-card p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <h3 className="text-base font-semibold text-foreground line-clamp-2">{proposal.job_title}</h3>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5">
                        <Avatar className="h-5 w-5">
                          <AvatarFallback className="text-[10px] bg-surface-2 text-foreground">
                            {proposal.agency_name?.charAt(0) || "A"}
                          </AvatarFallback>
                        </Avatar>
                        <span className="truncate">{proposal.agency_name}</span>
                      </span>
                      <span className="text-border">·</span>
                      <span className="inline-flex items-center gap-1">
                        <CalendarDays className="h-3.5 w-3.5" /> Applied {formatDate(proposal.created_at)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(proposal.status)}`}>
                      {getStatusIcon(proposal.status)}
                      {proposal.status.charAt(0).toUpperCase() + proposal.status.slice(1)}
                    </span>
                    {proposal.status === "accepted" && proposal.funding_status === "funded" && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-success/10 text-success">
                        <CheckCircle className="h-3 w-3" /> Funded
                      </span>
                    )}
                  </div>
                </div>

                {proposal.job_description && (
                  <p className="mt-3 text-sm text-muted-foreground line-clamp-3">{proposal.job_description}</p>
                )}

                <div className="mt-4 grid grid-cols-2 lg:grid-cols-4 gap-4 border-y border-border py-4">
                  {[
                    { icon: DollarSign, label: "Your budget", val: proposal.budget || "Not specified" },
                    {
                      icon: DollarSign,
                      label: "Client budget",
                      val: `₦${(proposal.job_budget_min ?? 0).toLocaleString()} – ₦${(proposal.job_budget_max ?? 0).toLocaleString()}`,
                    },
                    { icon: Clock, label: "Your timeline", val: proposal.timeline || "Not specified" },
                    { icon: Clock, label: "Job duration", val: proposal.job_duration || "Not specified" },
                  ].map((m, i) => (
                    <div key={i} className="flex items-start gap-2 min-w-0">
                      <m.icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">{m.label}</p>
                        <p className="text-sm font-medium text-foreground truncate tabular-nums">{m.val}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {proposal.job_location && (
                  <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="h-4 w-4 shrink-0" />
                    <span>
                      Location: <span className="font-medium text-foreground">{proposal.job_location}</span>
                    </span>
                  </div>
                )}

                {!!proposal.skills?.length && (
                  <div className="mt-4">
                    <p className="text-xs font-medium text-muted-foreground mb-2">Skills</p>
                    <div className="flex flex-wrap gap-1.5">
                      {proposal.skills.map((skill, index) => (
                        <span key={index} className="px-2 py-0.5 rounded-md bg-surface-2 text-muted-foreground text-[11px]">
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-4 rounded-lg border border-border bg-surface-2 p-4">
                  <p className="text-xs font-medium text-muted-foreground mb-1.5">Your proposal</p>
                  <p className="text-sm text-foreground whitespace-pre-wrap line-clamp-4">{proposal.proposal_text}</p>
                  {(proposal.proposal_text?.length ?? 0) > 240 && (
                    <button onClick={() => setViewingProposal(proposal)} className="mt-2 text-xs font-medium text-primary hover:underline">
                      View all
                    </button>
                  )}
                </div>

                {proposal.attachments && proposal.attachments.length > 0 && (
                  <div className="mt-4">
                    <p className="text-xs font-medium text-muted-foreground mb-2">Attachments</p>
                    <div className="flex flex-wrap gap-2">
                      {proposal.attachments.map((attachment, index) => (
                        <Badge key={index} variant="outline" className="text-xs">
                          📎 {attachment}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}

            {query.hasNextPage && (
              <div className="flex justify-center pt-2">
                <Button onClick={() => query.fetchNextPage()} disabled={query.isFetchingNextPage} variant="outline">
                  {query.isFetchingNextPage ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Loading...
                    </>
                  ) : (
                    "Load more"
                  )}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {viewingProposal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setViewingProposal(null)}>
          <div
            className="w-full max-w-2xl max-h-[85vh] flex flex-col rounded-2xl border border-border bg-card shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 p-5 border-b border-border">
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Your proposal</p>
                <h3 className="text-base font-semibold text-foreground truncate">{viewingProposal.job_title}</h3>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => setViewingProposal(null)} aria-label="Close">
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{viewingProposal.proposal_text}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd client && npx vitest run src/pages/freelancer/Proposals.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/freelancer/Proposals.tsx client/src/pages/freelancer/Proposals.test.tsx
git commit -m "Port freelancer proposals page to client (Start/Complete work deferred to Phase 4)"
```

---

## Task 4: Wire the route into `App.tsx`

**Files:**
- Modify: `client/src/App.tsx`
- Test: `client/src/App.test.tsx` (extend)

**Interfaces:** none new — this task wires Task 3's page into the existing route table built across Phases 0 and 2a.

- [ ] **Step 1: Write the failing test**

```tsx
// client/src/App.test.tsx — add this describe block to the existing file (mirrors the Phase 2a "protected routes" block)
describe("proposals route", () => {
  it("redirects /freelancer/proposals to /login when signed out", async () => {
    renderAt("/freelancer/proposals")
    await screen.findByText(/Sign in/i)
  })
})
```

(This relies on the existing `renderAt` helper already updated in Phase 2a's Task 9 — extend that helper's route table, in the same file, to include the new route below.)

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client && npx vitest run src/App.test.tsx`
Expected: FAIL — no route registered for `/freelancer/proposals` in the test's local route table, so the test renders nothing matching `/login`'s content

- [ ] **Step 3: Update `client/src/App.tsx`**

```tsx
// client/src/App.tsx — add the import and one new <Route>, alongside the existing Dashboard/SavedJobs routes from Phase 2a
import Proposals from "./pages/freelancer/Proposals"
// ...inside <Routes>, alongside the other RequireAuth-wrapped routes:
<Route
  path="/freelancer/proposals"
  element={
    <RequireAuth>
      <Proposals />
    </RequireAuth>
  }
/>
```

- [ ] **Step 4: Update `App.test.tsx`'s `renderAt` helper**

Add the same route (imported `Proposals`, wrapped in `RequireAuth`) to the helper's local `<Routes>` table, mirroring how Phase 2a's Task 9 added `/freelancer/dashboard` and `/freelancer/saved-jobs` there.

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd client && npx vitest run src/App.test.tsx`
Expected: PASS

- [ ] **Step 6: Run the full client test suite**

Run: `cd client && npm test`
Expected: All tests PASS

- [ ] **Step 7: Commit**

```bash
git add client/src/App.tsx client/src/App.test.tsx
git commit -m "Wire freelancer proposals route behind RequireAuth"
```

---

## Post-Phase-2b note

This plan covers only the freelancer proposals *view* — read-only status tracking. The original page's "Start work" / "Complete work" actions (escrow-adjacent: `freelancer_proposal_status` writes, bank-details lookup, Paystack payout call) are deferred to Phase 4 (escrow & payments), gated on the Supabase-side escrow v2 migration per the spec. Remaining Phase 2 slices after this one: the full `/freelancer/marketplace` browse page, agency job management (`/agency/dashboard`), profile editors for both sides (need new update-profile server routes), and `/agency/find-freelancers` (needs a new search server route).
