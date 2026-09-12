# React + Node Migration — Phase 2c (Agency Job Management) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port `/agency/dashboard` — the agency's hiring desk: stat tiles, a jobs list with edit/pause/resume/close actions, a 4-step post/edit-job wizard, and a proposals-review modal with accept/reject — to `client/`. This is the first agency-side page in the new client; before this plan, `client/` only has freelancer pages.

**Architecture:** One new server route (`GET /api/jobs/:jobId/proposals`) replaces a raw browser Supabase query the original page makes — everything else this page needs already exists from Phase 1 (`GET /api/jobs/agency`, `POST /api/jobs`, `PUT /api/jobs/:jobId`, `PATCH /api/jobs/:jobId/status`, `POST /api/proposals/:proposalId/respond`, `POST /api/user/freelancer-logos`). Client-side, the 4-step wizard and the proposals modal are split into their own component files (each is substantial on its own) and composed by the page itself.

**Tech Stack:** Same as Phase 2a/2b's client stack, plus one new shadcn/Radix primitive (`DropdownMenu`, `@radix-ui/react-dropdown-menu`). No new server dependencies.

**Spec:** `docs/superpowers/specs/2026-09-08-nextjs-to-react-node-migration-design.md` (Section 7, Phase 2 row)

## Global Constraints

- **Escrow, disputes, and messaging are entirely out of scope**, deferred to their own spec-mandated phases (Phase 4 for escrow — gated on the Supabase-side escrow v2 migration finishing; Phase 5 for disputes; Phase 3 for realtime messaging). Concretely, this means: no "Fund Job" button, no `/api/escrow/*` calls, no dispute modal, no "Message Freelancer" flow, no `conversations`/`messages` table access. An accepted proposal is shown with a status badge only — no action buttons — until Phase 3/4 land.
- **No realtime subscription.** The original subscribes to Postgres-changes on `proposals` to auto-refresh proposal counts. This plan drops that (Phase 3's realtime-messaging work is the natural home for re-introducing Supabase Realtime in the new client) — the agency sees fresh counts on navigation/refetch, not live-push.
- **No link to `/workspace/:jobId`.** That portal doesn't exist in `client/` yet; the "Workspace" button is dropped rather than linking to a dead route.
- **Dead code is not ported.** The original's `showJobActionModal`/`actionType`/"Job Action Modal" state and JSX are never actually triggered by any working code path (`handleJobAction`'s dropdown callers open the post-job wizard or call the status mutation directly, never `setShowJobActionModal(true)`) — this is unreachable code in the source, not a feature to preserve. Pause/resume/close call the status mutation directly from the dropdown item; "close" (irreversible per the original's own copy) is guarded by a native `confirm()`.
- **Status colors use this codebase's semantic tokens**, not the original's literal Tailwind colors (`bg-green-100 text-green-800`, etc.) — every other ported page (`Dashboard.tsx`, `Proposals.tsx`) uses `bg-success/10 text-success`, `bg-warning/10 text-warning`, `bg-muted text-muted-foreground` for status indicators; this page follows the same convention for consistency, not a redesign.
- `Dashboard.tsx` (Phase 2a) redirects to `/` when the signed-in user's `account_type` isn't `"freelancer"` — this page does the mirror check: redirect to `/` when `account_type` isn't `"agency"`. Bake this in from the start (a prior phase's final review found this omitted from a brief and had to fix it after the fact).
- The new `GET /api/jobs/:jobId/proposals` route follows Phase 1's established conventions: mounted behind `requireAuth` (already true for the whole `/api/jobs` router), wrapped in `asyncHandler`, uses the caller's RLS-scoped `req.supabase`, and adds an explicit ownership check (the job's `agency_id` must equal the caller) as defense-in-depth beyond RLS — matching the pattern `updateJob` already established in the same file.
- Every data need funnels through a query/mutation hook in `client/src/lib/queries/*.ts` — no page or component calls `apiFetch` directly.

---

## Task 1: Port the DropdownMenu UI primitive

**Files:**
- Modify: `client/package.json` (add `@radix-ui/react-dropdown-menu`)
- Create: `client/src/components/ui/dropdown-menu.tsx`
- Test: `client/src/components/ui/dropdown-menu.test.tsx`

**Interfaces:**
- Produces: `DropdownMenu`, `DropdownMenuTrigger`, `DropdownMenuContent`, `DropdownMenuItem` (the four names this plan actually uses) plus the full re-export set matching the root `components/ui/dropdown-menu.tsx` (`DropdownMenuCheckboxItem`, `DropdownMenuRadioItem`, `DropdownMenuLabel`, `DropdownMenuSeparator`, `DropdownMenuShortcut`, `DropdownMenuGroup`, `DropdownMenuPortal`, `DropdownMenuSub`, `DropdownMenuSubContent`, `DropdownMenuSubTrigger`, `DropdownMenuRadioGroup`). Task 7's `AgencyDashboard.tsx` imports `DropdownMenu`/`DropdownMenuTrigger`/`DropdownMenuContent`/`DropdownMenuItem`.

- [ ] **Step 1: Add the dependency**

Edit `client/package.json` — add to `dependencies` (alphabetized):

```json
    "@radix-ui/react-dropdown-menu": "2.1.4",
```

(Matches the version the root app already pins.)

- [ ] **Step 2: Install**

Run: `cd client && npm install`
Expected: installs cleanly

- [ ] **Step 3: Write the failing test**

```tsx
// client/src/components/ui/dropdown-menu.test.tsx
import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./dropdown-menu"

describe("DropdownMenu", () => {
  it("opens and shows its items when the trigger is clicked", async () => {
    const user = userEvent.setup()
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Open menu</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>Edit</DropdownMenuItem>
          <DropdownMenuItem>Delete</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )

    expect(screen.queryByText("Edit")).not.toBeInTheDocument()
    await user.click(screen.getByText("Open menu"))
    expect(await screen.findByText("Edit")).toBeInTheDocument()
    expect(screen.getByText("Delete")).toBeInTheDocument()
  })
})
```

- [ ] **Step 4: Run test to verify it fails**

Run: `cd client && npx vitest run src/components/ui/dropdown-menu.test.tsx`
Expected: FAIL — `Cannot find module './dropdown-menu'`

- [ ] **Step 5: Create `client/src/components/ui/dropdown-menu.tsx`** (exact copy of `components/ui/dropdown-menu.tsx`, no `"use client"`)

```tsx
import * as React from "react"
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu"
import { Check, ChevronRight, Circle } from "lucide-react"

import { cn } from "@/lib/utils"

const DropdownMenu = DropdownMenuPrimitive.Root
const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger
const DropdownMenuGroup = DropdownMenuPrimitive.Group
const DropdownMenuPortal = DropdownMenuPrimitive.Portal
const DropdownMenuSub = DropdownMenuPrimitive.Sub
const DropdownMenuRadioGroup = DropdownMenuPrimitive.RadioGroup

const DropdownMenuSubTrigger = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.SubTrigger>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubTrigger> & { inset?: boolean }
>(({ className, inset, children, ...props }, ref) => (
  <DropdownMenuPrimitive.SubTrigger
    ref={ref}
    className={cn(
      "flex cursor-default gap-2 select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-accent data-[state=open]:bg-accent [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
      inset && "pl-8",
      className
    )}
    {...props}
  >
    {children}
    <ChevronRight className="ml-auto" />
  </DropdownMenuPrimitive.SubTrigger>
))
DropdownMenuSubTrigger.displayName = DropdownMenuPrimitive.SubTrigger.displayName

const DropdownMenuSubContent = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.SubContent>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubContent>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.SubContent
    ref={ref}
    className={cn(
      "z-50 min-w-[8rem] overflow-hidden rounded-xl border bg-popover p-1 text-popover-foreground shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
      className
    )}
    {...props}
  />
))
DropdownMenuSubContent.displayName = DropdownMenuPrimitive.SubContent.displayName

const DropdownMenuContent = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <DropdownMenuPrimitive.Portal>
    <DropdownMenuPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        "z-50 min-w-[8rem] overflow-hidden rounded-xl border bg-popover p-1 text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
        className
      )}
      {...props}
    />
  </DropdownMenuPrimitive.Portal>
))
DropdownMenuContent.displayName = DropdownMenuPrimitive.Content.displayName

const DropdownMenuItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item> & { inset?: boolean }
>(({ className, inset, ...props }, ref) => (
  <DropdownMenuPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
      inset && "pl-8",
      className
    )}
    {...props}
  />
))
DropdownMenuItem.displayName = DropdownMenuPrimitive.Item.displayName

const DropdownMenuCheckboxItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.CheckboxItem>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.CheckboxItem>
>(({ className, children, checked, ...props }, ref) => (
  <DropdownMenuPrimitive.CheckboxItem
    ref={ref}
    className={cn(
      "relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className
    )}
    checked={checked}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <DropdownMenuPrimitive.ItemIndicator>
        <Check className="h-4 w-4" />
      </DropdownMenuPrimitive.ItemIndicator>
    </span>
    {children}
  </DropdownMenuPrimitive.CheckboxItem>
))
DropdownMenuCheckboxItem.displayName = DropdownMenuPrimitive.CheckboxItem.displayName

const DropdownMenuRadioItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.RadioItem>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.RadioItem>
>(({ className, children, ...props }, ref) => (
  <DropdownMenuPrimitive.RadioItem
    ref={ref}
    className={cn(
      "relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className
    )}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <DropdownMenuPrimitive.ItemIndicator>
        <Circle className="h-2 w-2 fill-current" />
      </DropdownMenuPrimitive.ItemIndicator>
    </span>
    {children}
  </DropdownMenuPrimitive.RadioItem>
))
DropdownMenuRadioItem.displayName = DropdownMenuPrimitive.RadioItem.displayName

const DropdownMenuLabel = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Label> & { inset?: boolean }
>(({ className, inset, ...props }, ref) => (
  <DropdownMenuPrimitive.Label ref={ref} className={cn("px-2 py-1.5 text-sm font-semibold", inset && "pl-8", className)} {...props} />
))
DropdownMenuLabel.displayName = DropdownMenuPrimitive.Label.displayName

const DropdownMenuSeparator = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.Separator ref={ref} className={cn("-mx-1 my-1 h-px bg-muted", className)} {...props} />
))
DropdownMenuSeparator.displayName = DropdownMenuPrimitive.Separator.displayName

const DropdownMenuShortcut = ({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) => {
  return <span className={cn("ml-auto text-xs tracking-widest opacity-60", className)} {...props} />
}
DropdownMenuShortcut.displayName = "DropdownMenuShortcut"

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuGroup,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuRadioGroup,
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd client && npx vitest run src/components/ui/dropdown-menu.test.tsx`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add client/package.json client/package-lock.json client/src/components/ui/dropdown-menu.tsx client/src/components/ui/dropdown-menu.test.tsx
git commit -m "Port DropdownMenu UI primitive to client"
```

---

## Task 2: New server route — `GET /api/jobs/:jobId/proposals`

**Files:**
- Modify: `server/src/routes/jobs.ts`
- Test: `server/src/routes/jobs.test.ts` (extend)

**Interfaces:**
- Consumes: `asyncHandler` (`server/src/lib/http.ts`, Phase 1) — already imported in this file.
- Produces: a new route on the existing `jobsRouter`, `GET /:jobId/proposals` (full path `/api/jobs/:jobId/proposals`). Returns `{ proposals: JobProposal[] }` where each proposal embeds `profiles: { id, full_name, bio, location, phone, website } | null`. Task 5's `client/src/lib/queries/jobs.ts` (`useJobProposalsQuery`) calls this endpoint.

This route exists because the current Next.js app fetches an agency's job proposals via a direct browser Supabase query (`app/agency/dashboard/page.tsx`'s `handleViewProposals`) with an embedded `profiles!proposals_freelancer_id_fkey` join — Phase 1 never ported this (it only ported the freelancer's own proposal reads).

- [ ] **Step 1: Write the failing tests**

```typescript
// server/src/routes/jobs.test.ts — add this describe block to the existing file
describe("GET /:jobId/proposals", () => {
  it("returns the job's proposals with embedded freelancer profiles when the caller owns the job", async () => {
    const jobMaybeSingle = vi.fn().mockResolvedValue({ data: { id: "job-1", agency_id: "agency-1" }, error: null })
    const proposalsOrder = vi.fn().mockResolvedValue({
      data: [
        {
          id: "prop-1",
          job_id: "job-1",
          freelancer_id: "freelancer-1",
          proposal_text: "I can do this",
          budget: 5000,
          timeline: "2 weeks",
          attachments: null,
          status: "pending",
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-01T00:00:00Z",
          profiles: { id: "freelancer-1", full_name: "Jane Doe", bio: "A dev", location: "Lagos", phone: null, website: null },
        },
      ],
      error: null,
    })
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "jobs") {
          return { select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: jobMaybeSingle })) })) }
        }
        if (table === "proposals") {
          return { select: vi.fn(() => ({ eq: vi.fn(() => ({ order: proposalsOrder })) })) }
        }
        throw new Error(`unexpected table ${table}`)
      }),
    }

    const res = await request(appWith({ id: "agency-1" }, supabase)).get("/job-1/proposals")

    expect(res.status).toBe(200)
    expect(res.body.proposals).toHaveLength(1)
    expect(res.body.proposals[0].profiles).toEqual({
      id: "freelancer-1",
      full_name: "Jane Doe",
      bio: "A dev",
      location: "Lagos",
      phone: null,
      website: null,
    })
  })

  it("returns 403 when the caller does not own the job", async () => {
    const jobMaybeSingle = vi.fn().mockResolvedValue({ data: { id: "job-1", agency_id: "agency-other" }, error: null })
    const supabase = {
      from: vi.fn(() => ({ select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: jobMaybeSingle })) })) })),
    }

    const res = await request(appWith({ id: "agency-1" }, supabase)).get("/job-1/proposals")

    expect(res.status).toBe(403)
    expect(res.body).toEqual({ error: "Forbidden" })
  })

  it("returns an empty list when the job doesn't exist", async () => {
    const jobMaybeSingle = vi.fn().mockResolvedValue({ data: null, error: null })
    const supabase = {
      from: vi.fn(() => ({ select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: jobMaybeSingle })) })) })),
    }

    const res = await request(appWith({ id: "agency-1" }, supabase)).get("/job-1/proposals")

    expect(res.body).toEqual({ proposals: [] })
  })
})
```

(This test file already has an `appWith(user, supabase)` helper and top-level imports of `express`, `request` from `supertest`, `jobsRouter`, and `describe`/`it`/`expect`/`vi` from an earlier phase — reuse the existing `appWith` helper, don't rebuild the app inline or re-import anything.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd server && npx vitest run src/routes/jobs.test.ts`
Expected: FAIL — 404 on `/job-1/proposals` (route doesn't exist yet)

- [ ] **Step 3: Add the route to `server/src/routes/jobs.ts`**

```typescript
// server/src/routes/jobs.ts — add this route (e.g. after the existing PUT /:jobId route, before `export default jobsRouter`)
jobsRouter.get(
  "/:jobId/proposals",
  asyncHandler(async (req, res) => {
    const { jobId } = req.params
    const supabase = req.supabase!
    const user = req.user!

    const { data: job, error: jobError } = await supabase.from("jobs").select("id, agency_id").eq("id", jobId).maybeSingle()

    if (jobError || !job) {
      res.json({ proposals: [] })
      return
    }
    if (job.agency_id !== user.id) {
      res.status(403).json({ error: "Forbidden" })
      return
    }

    const { data, error } = await supabase
      .from("proposals")
      .select(
        `id, job_id, freelancer_id, proposal_text, budget, timeline, attachments, status, created_at, updated_at,
         profiles!proposals_freelancer_id_fkey ( id, full_name, bio, location, phone, website )`
      )
      .eq("job_id", jobId)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Error fetching job proposals:", error)
      res.json({ proposals: [] })
      return
    }

    res.json({ proposals: data || [] })
  })
)
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd server && npx vitest run src/routes/jobs.test.ts`
Expected: PASS

- [ ] **Step 5: Run the full server test suite**

Run: `cd server && npm test`
Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git add server/src/routes/jobs.ts server/src/routes/jobs.test.ts
git commit -m "Add GET /api/jobs/:jobId/proposals for agency proposal review"
```

---

## Task 3: Agency job hooks (`client/src/lib/queries/jobs.ts`)

**Files:**
- Modify: `client/src/lib/queries/jobs.ts`
- Test: `client/src/lib/queries/jobs.test.tsx` (extend)

**Interfaces:**
- Consumes: `apiFetch` (already imported in this file).
- Produces (added to the existing file, alongside `useJobsQuery`/`useSavedJobsQuery`/`useToggleBookmarkMutation` — do not remove or modify those): `AgencyJob` type; `useAgencyJobsQuery()`; `useCreateJobMutation()`; `useUpdateJobMutation()`; `useUpdateJobStatusMutation()`; `JobProposal` type; `useJobProposalsQuery(jobId: string | undefined, enabled: boolean)`. Task 5's `PostJobModal.tsx` and Task 6's `ProposalsModal.tsx` and Task 7's `AgencyDashboard.tsx` import these.

- [ ] **Step 1: Write the failing tests**

```tsx
// client/src/lib/queries/jobs.test.tsx — add this describe block to the existing file
describe("useAgencyJobsQuery", () => {
  it("calls GET /api/jobs/agency", async () => {
    apiFetchMock.mockResolvedValue({ jobs: [{ id: "job-1", proposals: 2 }] })
    const { useAgencyJobsQuery } = await import("./jobs")

    const { result } = renderHook(() => useAgencyJobsQuery(), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(apiFetchMock).toHaveBeenCalledWith("/api/jobs/agency")
  })
})

describe("useCreateJobMutation", () => {
  it("POSTs to /api/jobs with the job payload and idempotencyKey", async () => {
    apiFetchMock.mockResolvedValue({ success: true })
    const { useCreateJobMutation } = await import("./jobs")

    const { result } = renderHook(() => useCreateJobMutation(), { wrapper })
    result.current.mutate({ title: "Build a site", idempotencyKey: "key-1" } as any)

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(apiFetchMock).toHaveBeenCalledWith("/api/jobs", {
      method: "POST",
      body: JSON.stringify({ title: "Build a site", idempotencyKey: "key-1" }),
    })
  })
})

describe("useUpdateJobMutation", () => {
  it("PUTs to /api/jobs/:jobId with the job payload", async () => {
    apiFetchMock.mockResolvedValue({ success: true })
    const { useUpdateJobMutation } = await import("./jobs")

    const { result } = renderHook(() => useUpdateJobMutation(), { wrapper })
    result.current.mutate({ jobId: "job-1", title: "Updated title" } as any)

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(apiFetchMock).toHaveBeenCalledWith("/api/jobs/job-1", {
      method: "PUT",
      body: JSON.stringify({ title: "Updated title" }),
    })
  })
})

describe("useUpdateJobStatusMutation", () => {
  it("PATCHes to /api/jobs/:jobId/status with the new status", async () => {
    apiFetchMock.mockResolvedValue({ success: true })
    const { useUpdateJobStatusMutation } = await import("./jobs")

    const { result } = renderHook(() => useUpdateJobStatusMutation(), { wrapper })
    result.current.mutate({ jobId: "job-1", status: "paused" })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(apiFetchMock).toHaveBeenCalledWith("/api/jobs/job-1/status", {
      method: "PATCH",
      body: JSON.stringify({ status: "paused" }),
    })
  })
})

describe("useJobProposalsQuery", () => {
  it("calls GET /api/jobs/:jobId/proposals when enabled", async () => {
    apiFetchMock.mockResolvedValue({ proposals: [] })
    const { useJobProposalsQuery } = await import("./jobs")

    const { result } = renderHook(() => useJobProposalsQuery("job-1", true), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(apiFetchMock).toHaveBeenCalledWith("/api/jobs/job-1/proposals")
  })

  it("does not fetch when disabled", async () => {
    const { useJobProposalsQuery } = await import("./jobs")
    renderHook(() => useJobProposalsQuery(undefined, false), { wrapper })
    expect(apiFetchMock).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd client && npx vitest run src/lib/queries/jobs.test.tsx`
Expected: FAIL — the new hooks don't exist yet

- [ ] **Step 3: Add the implementation to `client/src/lib/queries/jobs.ts`**

```typescript
// client/src/lib/queries/jobs.ts — add to the existing file
// (merge `useQueryClient` into the existing `useQuery`/`useMutation` import from "@tanstack/react-query" if not already present)

export type AgencyJob = {
  id: string
  title: string
  description: string
  budget_min: number | null
  budget_max: number | null
  duration: string
  location: string
  job_type: string
  credit_cost: number
  status: "active" | "paused" | "closed"
  skills: string[]
  created_at: string
  agency_id: string
  proposals: number
}

export function useAgencyJobsQuery() {
  return useQuery({
    queryKey: ["jobs", "agency"],
    queryFn: () => apiFetch<{ jobs: AgencyJob[] }>("/api/jobs/agency"),
  })
}

export type JobInput = {
  title: string
  description: string
  skills: string[]
  budget_min: number | null
  budget_max: number | null
  duration: string
  location: string
  job_type: string
  credit_cost: number
}

export function useCreateJobMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: JobInput & { idempotencyKey: string }) =>
      apiFetch<{ success: boolean; deduped?: boolean; error?: string; code?: string }>("/api/jobs", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jobs", "agency"] })
    },
  })
}

export function useUpdateJobMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ jobId, ...input }: JobInput & { jobId: string }) =>
      apiFetch<{ success: boolean; error?: string; code?: string }>(`/api/jobs/${jobId}`, {
        method: "PUT",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jobs", "agency"] })
    },
  })
}

export function useUpdateJobStatusMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ jobId, status }: { jobId: string; status: string }) =>
      apiFetch<{ success: boolean }>(`/api/jobs/${jobId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jobs", "agency"] })
    },
  })
}

export type JobProposal = {
  id: string
  job_id: string
  freelancer_id: string
  proposal_text: string
  budget: number | string | null
  timeline: string | null
  attachments: string[] | null
  status: "pending" | "accepted" | "rejected"
  created_at: string
  updated_at: string
  profiles: {
    id: string
    full_name: string | null
    bio: string | null
    location: string | null
    phone: string | null
    website: string | null
  } | null
}

export function useJobProposalsQuery(jobId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ["jobs", jobId, "proposals"],
    queryFn: () => apiFetch<{ proposals: JobProposal[] }>(`/api/jobs/${jobId}/proposals`),
    enabled: enabled && !!jobId,
  })
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd client && npx vitest run src/lib/queries/jobs.test.tsx`
Expected: PASS (all tests in the file, old and new)

- [ ] **Step 5: Commit**

```bash
git add client/src/lib/queries/jobs.ts client/src/lib/queries/jobs.test.tsx
git commit -m "Add agency job hooks (list/create/update/status/proposals) to client"
```

---

## Task 4: Proposal-response and freelancer-logos hooks

**Files:**
- Modify: `client/src/lib/queries/proposals.ts`
- Modify: `client/src/lib/queries/user.ts`
- Test: `client/src/lib/queries/proposals.test.tsx` (extend)
- Test: `client/src/lib/queries/user.test.tsx` (extend)

**Interfaces:**
- Produces: `useRespondToProposalMutation()` added to `client/src/lib/queries/proposals.ts` (alongside the existing `useSubmitProposalMutation`/`useMyProposalsQuery`/`Proposal` — do not modify those). `mutate()` is called as `mutate({ proposalId, jobId, action })`.
- Produces: `useFreelancerLogosQuery(freelancerIds: string[])` added to `client/src/lib/queries/user.ts` (alongside the existing `useDashboardQuery` — do not modify it). Returns `{ logos: Record<string, string> }`.
- Task 6's `ProposalsModal.tsx` imports both.

- [ ] **Step 1: Write the failing tests**

```tsx
// client/src/lib/queries/proposals.test.tsx — add this describe block to the existing file
describe("useRespondToProposalMutation", () => {
  it("POSTs to /api/proposals/:proposalId/respond with the action, and invalidates the job's proposals", async () => {
    apiFetchMock.mockResolvedValue({ success: true })
    const { useRespondToProposalMutation } = await import("./proposals")

    const { result } = renderHook(() => useRespondToProposalMutation(), { wrapper })
    result.current.mutate({ proposalId: "prop-1", jobId: "job-1", action: "accept" })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(apiFetchMock).toHaveBeenCalledWith("/api/proposals/prop-1/respond", {
      method: "POST",
      body: JSON.stringify({ action: "accept" }),
    })
  })
})
```

```tsx
// client/src/lib/queries/user.test.tsx — add this describe block to the existing file
describe("useFreelancerLogosQuery", () => {
  it("POSTs to /api/user/freelancer-logos with the given ids when there are any", async () => {
    apiFetchMock.mockResolvedValue({ logos: { "freelancer-1": "https://example.com/a.png" } })
    const { useFreelancerLogosQuery } = await import("./user")

    const { result } = renderHook(() => useFreelancerLogosQuery(["freelancer-1"]), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(apiFetchMock).toHaveBeenCalledWith("/api/user/freelancer-logos", {
      method: "POST",
      body: JSON.stringify({ freelancerIds: ["freelancer-1"] }),
    })
    expect(result.current.data?.logos).toEqual({ "freelancer-1": "https://example.com/a.png" })
  })

  it("does not fetch when the id list is empty", async () => {
    const { useFreelancerLogosQuery } = await import("./user")
    renderHook(() => useFreelancerLogosQuery([]), { wrapper })
    expect(apiFetchMock).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd client && npx vitest run src/lib/queries/proposals.test.tsx src/lib/queries/user.test.tsx`
Expected: FAIL — the new hooks don't exist yet

- [ ] **Step 3: Add `useRespondToProposalMutation` to `client/src/lib/queries/proposals.ts`**

```typescript
// client/src/lib/queries/proposals.ts — add to the existing file
export function useRespondToProposalMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ proposalId, action }: { proposalId: string; jobId: string; action: "accept" | "reject" }) =>
      apiFetch<{ success: boolean; error?: string }>(`/api/proposals/${proposalId}/respond`, {
        method: "POST",
        body: JSON.stringify({ action }),
      }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["jobs", variables.jobId, "proposals"] })
      queryClient.invalidateQueries({ queryKey: ["jobs", "agency"] })
    },
  })
}
```

(`useQueryClient` and `useMutation` are already imported in this file from Phase 2a/2b — reuse, don't re-import.)

- [ ] **Step 4: Add `useFreelancerLogosQuery` to `client/src/lib/queries/user.ts`**

```typescript
// client/src/lib/queries/user.ts — add to the existing file
// (merge `useQuery` into whatever "@tanstack/react-query" import already exists, if needed)

export function useFreelancerLogosQuery(freelancerIds: string[]) {
  return useQuery({
    queryKey: ["user", "freelancer-logos", freelancerIds],
    queryFn: () =>
      apiFetch<{ logos: Record<string, string> }>("/api/user/freelancer-logos", {
        method: "POST",
        body: JSON.stringify({ freelancerIds }),
      }),
    enabled: freelancerIds.length > 0,
  })
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd client && npx vitest run src/lib/queries/proposals.test.tsx src/lib/queries/user.test.tsx`
Expected: PASS (all tests in both files, old and new)

- [ ] **Step 6: Commit**

```bash
git add client/src/lib/queries/proposals.ts client/src/lib/queries/proposals.test.tsx client/src/lib/queries/user.ts client/src/lib/queries/user.test.tsx
git commit -m "Add respond-to-proposal and freelancer-logos hooks to client"
```

---

## Task 5: `PostJobModal` component

**Files:**
- Create: `client/src/pages/agency/PostJobModal.tsx`
- Test: `client/src/pages/agency/PostJobModal.test.tsx`

**Interfaces:**
- Consumes: `useCreateJobMutation`, `useUpdateJobMutation`, `AgencyJob`, `JobInput` (Task 3, `@/lib/queries/jobs`); `ALL_SKILLS` (`@/lib/categories`, already ported from an earlier phase); `Button`, `Input`, `Label`, `Textarea`, `Select*`, `Badge` (all already ported in earlier phases).
- Produces: default export `PostJobModal`, props `{ isOpen: boolean; onClose: () => void; editingJob: AgencyJob | null; onSuccess: () => void }`. Task 7's `AgencyDashboard.tsx` renders it.

- [ ] **Step 1: Write the failing tests**

```tsx
// client/src/pages/agency/PostJobModal.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

const useCreateJobMutationMock = vi.fn()
const useUpdateJobMutationMock = vi.fn()
vi.mock("../../lib/queries/jobs", () => ({
  useCreateJobMutation: () => useCreateJobMutationMock(),
  useUpdateJobMutation: () => useUpdateJobMutationMock(),
}))

import PostJobModal from "./PostJobModal"

function renderModal(props: Partial<React.ComponentProps<typeof PostJobModal>> = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <PostJobModal isOpen onClose={vi.fn()} editingJob={null} onSuccess={vi.fn()} {...props} />
    </QueryClientProvider>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  useCreateJobMutationMock.mockReturnValue({ mutate: vi.fn(), isPending: false })
  useUpdateJobMutationMock.mockReturnValue({ mutate: vi.fn(), isPending: false })
})

describe("PostJobModal", () => {
  it("renders step 1 fields when creating a new job", () => {
    renderModal()
    expect(screen.getByText(/step 1 of 4/i)).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/full-stack developer/i)).toBeInTheDocument()
  })

  it("pre-fills the form when editingJob is provided", () => {
    renderModal({
      editingJob: {
        id: "job-1",
        title: "Existing job",
        description: "Existing description",
        budget_min: 1000,
        budget_max: 2000,
        duration: "2 weeks",
        location: "Lagos",
        job_type: "Remote",
        credit_cost: 10,
        status: "active",
        skills: ["React"],
        created_at: "2026-01-01T00:00:00Z",
        agency_id: "agency-1",
        proposals: 0,
      },
    })
    expect(screen.getByDisplayValue("Existing job")).toBeInTheDocument()
  })

  it("disables Next on step 1 until title, description, and duration are filled", async () => {
    const user = userEvent.setup()
    renderModal()
    const nextButton = screen.getByRole("button", { name: /next/i })
    expect(nextButton).toBeDisabled()

    await user.type(screen.getByPlaceholderText(/full-stack developer/i), "A job")
    await user.type(screen.getByPlaceholderText(/describe your project/i), "A description")
    await user.type(screen.getByPlaceholderText(/2 weeks, 1 month/i), "2 weeks")

    expect(nextButton).not.toBeDisabled()
  })

  it("calls createJob mutation with the assembled input and idempotencyKey on final submit", async () => {
    const mutate = vi.fn()
    useCreateJobMutationMock.mockReturnValue({ mutate, isPending: false })
    const user = userEvent.setup()
    renderModal()

    await user.type(screen.getByPlaceholderText(/full-stack developer/i), "A job")
    await user.type(screen.getByPlaceholderText(/describe your project/i), "A description")
    await user.type(screen.getByPlaceholderText(/2 weeks, 1 month/i), "2 weeks")
    await user.click(screen.getByRole("button", { name: /next/i }))

    // Step 2: pick at least one skill and leave credits at its default.
    const firstSkillCheckbox = screen.getAllByRole("checkbox")[0]
    await user.click(firstSkillCheckbox)
    await user.click(screen.getByRole("button", { name: /next/i }))

    // Step 3: job type, location, budgets.
    await user.click(screen.getByText(/select job type/i))
    await user.click(await screen.findByText("Remote"))
    await user.type(screen.getByPlaceholderText(/lagos, nigeria/i), "Lagos")
    await user.type(screen.getByPlaceholderText("100000"), "100000")
    await user.type(screen.getByPlaceholderText("500000"), "500000")
    await user.click(screen.getByRole("button", { name: /next/i }))

    // Step 4: submit.
    await user.click(screen.getByRole("button", { name: /post job/i }))

    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "A job",
        description: "A description",
        duration: "2 weeks",
        job_type: "Remote",
        location: "Lagos",
        budget_min: 100000,
        budget_max: 500000,
        idempotencyKey: expect.any(String),
      })
    )
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client && npx vitest run src/pages/agency/PostJobModal.test.tsx`
Expected: FAIL — `Cannot find module './PostJobModal'`

- [ ] **Step 3: Write `client/src/pages/agency/PostJobModal.tsx`**

```tsx
import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { X } from "lucide-react"
import { useCreateJobMutation, useUpdateJobMutation, type AgencyJob, type JobInput } from "@/lib/queries/jobs"
import { ALL_SKILLS } from "@/lib/categories"

const emptyForm = {
  title: "",
  description: "",
  budgetMin: "",
  budgetMax: "",
  duration: "",
  location: "",
  jobType: "",
  credits: 5,
}

export default function PostJobModal({
  isOpen,
  onClose,
  editingJob,
  onSuccess,
}: {
  isOpen: boolean
  onClose: () => void
  editingJob: AgencyJob | null
  onSuccess: () => void
}) {
  const [step, setStep] = useState(1)
  const [form, setForm] = useState(emptyForm)
  const [selectedSkills, setSelectedSkills] = useState<string[]>([])
  const idempotencyKeyRef = useRef<string | null>(null)

  const createJob = useCreateJobMutation()
  const updateJob = useUpdateJobMutation()
  const isPending = createJob.isPending || updateJob.isPending

  useEffect(() => {
    if (!isOpen) return
    if (editingJob) {
      setForm({
        title: editingJob.title,
        description: editingJob.description,
        budgetMin: editingJob.budget_min?.toString() ?? "",
        budgetMax: editingJob.budget_max?.toString() ?? "",
        duration: editingJob.duration,
        location: editingJob.location,
        jobType: editingJob.job_type,
        credits: editingJob.credit_cost,
      })
      setSelectedSkills(editingJob.skills || [])
    } else {
      setForm(emptyForm)
      setSelectedSkills([])
      idempotencyKeyRef.current = null
    }
    setStep(1)
  }, [isOpen, editingJob])

  if (!isOpen) return null

  const addSkill = (skill: string) => {
    if (!selectedSkills.includes(skill)) setSelectedSkills([...selectedSkills, skill])
  }
  const removeSkill = (skill: string) => setSelectedSkills(selectedSkills.filter((s) => s !== skill))

  const canAdvanceFromStep1 = !!form.title && !!form.description && !!form.duration
  const canAdvanceFromStep2 = selectedSkills.length > 0 && !!form.credits
  const canAdvanceFromStep3 = !!form.jobType && !!form.location && !!form.budgetMin && !!form.budgetMax

  const handleSubmit = () => {
    if (!idempotencyKeyRef.current) idempotencyKeyRef.current = crypto.randomUUID()

    const jobInput: JobInput = {
      title: form.title,
      description: form.description,
      skills: selectedSkills,
      budget_min: form.budgetMin ? Number.parseInt(form.budgetMin) : null,
      budget_max: form.budgetMax ? Number.parseInt(form.budgetMax) : null,
      duration: form.duration,
      location: form.location,
      job_type: form.jobType,
      credit_cost: form.credits,
    }

    const onDone = (result: { success: boolean; error?: string }) => {
      if (!result.success) {
        alert(`Error saving job: ${result.error}`)
        return
      }
      idempotencyKeyRef.current = null
      onSuccess()
    }

    if (editingJob) {
      updateJob.mutate({ jobId: editingJob.id, ...jobInput }, { onSuccess: onDone, onError: () => alert("Error saving job. Please try again.") })
    } else {
      createJob.mutate(
        { ...jobInput, idempotencyKey: idempotencyKeyRef.current },
        { onSuccess: onDone, onError: () => alert("Error saving job. Please try again.") }
      )
    }
  }

  const canAdvance = step === 1 ? canAdvanceFromStep1 : step === 2 ? canAdvanceFromStep2 : step === 3 ? canAdvanceFromStep3 : true

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50">
      <div className="fixed right-0 top-0 h-full w-full max-w-sm sm:max-w-md lg:max-w-2xl bg-card shadow-xl">
        <div className="h-full flex flex-col">
          <div className="flex items-center justify-between p-6 border-b border-border">
            <div>
              <h3 className="text-xl font-semibold text-foreground">{editingJob ? "Edit Job Post" : "Post a Job"}</h3>
              <p className="text-sm text-muted-foreground">
                Step {step} of 4 - {step === 1 ? "Job Details" : step === 2 ? "Skills & Credits" : step === 3 ? "Job Type & Budget" : "Review & Post"}
              </p>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            {step === 1 && (
              <div className="space-y-6">
                <div>
                  <Label className="text-sm font-medium mb-3 block">Job Title *</Label>
                  <Input
                    placeholder="e.g. Full-Stack Developer for E-commerce Platform"
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium mb-3 block">Job Description *</Label>
                  <Textarea
                    rows={8}
                    placeholder="Describe your project in detail..."
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium mb-3 block">Duration *</Label>
                  <Input
                    placeholder="e.g. 2 weeks, 1 month, 3 months"
                    value={form.duration}
                    onChange={(e) => setForm({ ...form, duration: e.target.value })}
                  />
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-6">
                <div>
                  <Label className="text-sm font-medium mb-3 block">Required Skills *</Label>
                  <div className="border border-border rounded-lg p-4 max-h-80 overflow-y-auto">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {ALL_SKILLS.map((skill) => (
                        <label key={skill} className="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-surface-2">
                          <input
                            type="checkbox"
                            checked={selectedSkills.includes(skill)}
                            onChange={(e) => (e.target.checked ? addSkill(skill) : removeSkill(skill))}
                          />
                          <span className="text-sm">{skill}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
                {selectedSkills.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-3">Selected Skills ({selectedSkills.length}):</p>
                    <div className="flex flex-wrap gap-2">
                      {selectedSkills.map((skill) => (
                        <Badge key={skill} variant="secondary">
                          {skill}
                          <button onClick={() => removeSkill(skill)} className="ml-2">
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                <div>
                  <Label className="text-sm font-medium mb-3 block">Credits Required *</Label>
                  <Select value={form.credits.toString()} onValueChange={(v) => setForm({ ...form, credits: Number.parseInt(v) })}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select credits" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">5 Credits</SelectItem>
                      <SelectItem value="10">10 Credits</SelectItem>
                      <SelectItem value="15">15 Credits</SelectItem>
                      <SelectItem value="20">20 Credits (Maximum)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-6">
                <div>
                  <Label className="text-sm font-medium mb-3 block">Job Type *</Label>
                  <Select value={form.jobType} onValueChange={(v) => setForm({ ...form, jobType: v })}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select job type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Remote">Remote</SelectItem>
                      <SelectItem value="Hybrid">Hybrid</SelectItem>
                      <SelectItem value="On-site">On-site</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-sm font-medium mb-3 block">Location *</Label>
                  <Input placeholder="e.g. Lagos, Nigeria" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium mb-3 block">Min Budget (₦) *</Label>
                    <Input type="number" placeholder="100000" value={form.budgetMin} onChange={(e) => setForm({ ...form, budgetMin: e.target.value })} />
                  </div>
                  <div>
                    <Label className="text-sm font-medium mb-3 block">Max Budget (₦) *</Label>
                    <Input type="number" placeholder="500000" value={form.budgetMax} onChange={(e) => setForm({ ...form, budgetMax: e.target.value })} />
                  </div>
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-6">
                <div className="bg-surface-2 p-6 rounded-lg border border-border">
                  <h4 className="font-semibold mb-4">Job Preview</h4>
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-1">Title</p>
                      <p className="font-semibold">{form.title}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-1">Description</p>
                      <p className="text-sm whitespace-pre-wrap">{form.description}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-2">Required Skills ({selectedSkills.length})</p>
                      <div className="flex flex-wrap gap-2">
                        {selectedSkills.map((skill) => (
                          <Badge key={skill} variant="outline" className="text-xs">
                            {skill}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground mb-1">Budget Range</p>
                        <p className="font-semibold">
                          ₦ {Number.parseInt(form.budgetMin || "0").toLocaleString()} - ₦ {Number.parseInt(form.budgetMax || "0").toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground mb-1">Duration</p>
                        <p className="font-semibold">{form.duration}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground mb-1">Job Type</p>
                        <p className="font-semibold">{form.jobType}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground mb-1">Location</p>
                        <p className="font-semibold">{form.location}</p>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-1">Credits Required</p>
                      <p className="font-semibold">{form.credits} Credits</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-border p-6">
            <div className="flex justify-between">
              <Button
                variant="outline"
                onClick={() => (step > 1 ? setStep(step - 1) : onClose())}
              >
                {step === 1 ? "Cancel" : "Back"}
              </Button>
              <Button
                onClick={() => (step < 4 ? setStep(step + 1) : handleSubmit())}
                disabled={isPending || !canAdvance}
              >
                {step === 4 ? (isPending ? "Posting..." : "Post Job") : "Next"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd client && npx vitest run src/pages/agency/PostJobModal.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/agency/PostJobModal.tsx client/src/pages/agency/PostJobModal.test.tsx
git commit -m "Port agency post/edit-job wizard modal to client"
```

---

## Task 6: `ProposalsModal` component

**Files:**
- Create: `client/src/pages/agency/ProposalsModal.tsx`
- Test: `client/src/pages/agency/ProposalsModal.test.tsx`

**Interfaces:**
- Consumes: `useJobProposalsQuery`, `AgencyJob`, `JobProposal` (Task 3, `@/lib/queries/jobs`); `useRespondToProposalMutation` (Task 4, `@/lib/queries/proposals`); `useFreelancerLogosQuery` (Task 4, `@/lib/queries/user`); `Card`/`CardHeader`/`CardContent`/`CardTitle`, `Avatar`/`AvatarImage`/`AvatarFallback`, `Badge`, `Input`, `Button` (all already ported).
- Produces: default export `ProposalsModal`, props `{ job: AgencyJob | null; isOpen: boolean; onClose: () => void }`. Task 7's `AgencyDashboard.tsx` renders it.

- [ ] **Step 1: Write the failing tests**

```tsx
// client/src/pages/agency/ProposalsModal.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

const useJobProposalsQueryMock = vi.fn()
vi.mock("../../lib/queries/jobs", () => ({
  useJobProposalsQuery: (...args: unknown[]) => useJobProposalsQueryMock(...args),
}))

const useRespondToProposalMutationMock = vi.fn()
vi.mock("../../lib/queries/proposals", () => ({
  useRespondToProposalMutation: () => useRespondToProposalMutationMock(),
}))

const useFreelancerLogosQueryMock = vi.fn()
vi.mock("../../lib/queries/user", () => ({
  useFreelancerLogosQuery: (...args: unknown[]) => useFreelancerLogosQueryMock(...args),
}))

import ProposalsModal from "./ProposalsModal"

const job = {
  id: "job-1",
  title: "Build a landing page",
  description: "",
  budget_min: null,
  budget_max: null,
  duration: "",
  location: "",
  job_type: "",
  credit_cost: 5,
  status: "active" as const,
  skills: [],
  created_at: "2026-01-01T00:00:00Z",
  agency_id: "agency-1",
  proposals: 1,
}

function renderModal(props: Partial<React.ComponentProps<typeof ProposalsModal>> = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <ProposalsModal job={job} isOpen onClose={vi.fn()} {...props} />
    </QueryClientProvider>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  useRespondToProposalMutationMock.mockReturnValue({ mutate: vi.fn(), isPending: false })
  useFreelancerLogosQueryMock.mockReturnValue({ data: { logos: {} } })
})

describe("ProposalsModal", () => {
  it("shows an empty state when there are no proposals", async () => {
    useJobProposalsQueryMock.mockReturnValue({ isLoading: false, isError: false, data: { proposals: [] } })
    renderModal()
    await waitFor(() => expect(screen.getByText("No Proposals Yet")).toBeInTheDocument())
  })

  it("renders a pending proposal with Accept/Reject buttons", async () => {
    useJobProposalsQueryMock.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        proposals: [
          {
            id: "prop-1",
            job_id: "job-1",
            freelancer_id: "freelancer-1",
            proposal_text: "I can build this",
            budget: 5000,
            timeline: "2 weeks",
            attachments: null,
            status: "pending",
            created_at: "2026-01-01T00:00:00Z",
            updated_at: "2026-01-01T00:00:00Z",
            profiles: { id: "freelancer-1", full_name: "Jane Doe", bio: null, location: "Lagos", phone: null, website: null },
          },
        ],
      },
    })

    renderModal()

    await waitFor(() => expect(screen.getByText("Jane Doe")).toBeInTheDocument())
    expect(screen.getByRole("button", { name: /accept/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /reject/i })).toBeInTheDocument()
  })

  it("calls the respond mutation with accept when Accept is clicked", async () => {
    const mutate = vi.fn()
    useRespondToProposalMutationMock.mockReturnValue({ mutate, isPending: false })
    useJobProposalsQueryMock.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        proposals: [
          {
            id: "prop-1",
            job_id: "job-1",
            freelancer_id: "freelancer-1",
            proposal_text: "I can build this",
            budget: 5000,
            timeline: "2 weeks",
            attachments: null,
            status: "pending",
            created_at: "2026-01-01T00:00:00Z",
            updated_at: "2026-01-01T00:00:00Z",
            profiles: { id: "freelancer-1", full_name: "Jane Doe", bio: null, location: "Lagos", phone: null, website: null },
          },
        ],
      },
    })

    renderModal()
    const acceptButton = await screen.findByRole("button", { name: /accept/i })
    acceptButton.click()

    expect(mutate).toHaveBeenCalledWith(expect.objectContaining({ proposalId: "prop-1", jobId: "job-1", action: "accept" }))
  })

  it("filters proposals by the search term (freelancer name)", async () => {
    useJobProposalsQueryMock.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        proposals: [
          {
            id: "prop-1",
            job_id: "job-1",
            freelancer_id: "freelancer-1",
            proposal_text: "text",
            budget: null,
            timeline: null,
            attachments: null,
            status: "pending",
            created_at: "2026-01-01T00:00:00Z",
            updated_at: "2026-01-01T00:00:00Z",
            profiles: { id: "freelancer-1", full_name: "Jane Doe", bio: null, location: null, phone: null, website: null },
          },
          {
            id: "prop-2",
            job_id: "job-1",
            freelancer_id: "freelancer-2",
            proposal_text: "text",
            budget: null,
            timeline: null,
            attachments: null,
            status: "pending",
            created_at: "2026-01-01T00:00:00Z",
            updated_at: "2026-01-01T00:00:00Z",
            profiles: { id: "freelancer-2", full_name: "John Smith", bio: null, location: null, phone: null, website: null },
          },
        ],
      },
    })

    renderModal()
    await waitFor(() => expect(screen.getByText("Jane Doe")).toBeInTheDocument())

    const searchInput = screen.getByPlaceholderText(/search freelancers/i)
    searchInput.dispatchEvent(new Event("focus"))
    ;(searchInput as HTMLInputElement).value = "Jane"
    searchInput.dispatchEvent(new Event("input", { bubbles: true }))

    await waitFor(() => {
      expect(screen.getByText("Jane Doe")).toBeInTheDocument()
      expect(screen.queryByText("John Smith")).not.toBeInTheDocument()
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client && npx vitest run src/pages/agency/ProposalsModal.test.tsx`
Expected: FAIL — `Cannot find module './ProposalsModal'`

- [ ] **Step 3: Write `client/src/pages/agency/ProposalsModal.tsx`**

```tsx
import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { CheckCircle, FileText, Search, X, XCircle } from "lucide-react"
import { useJobProposalsQuery, type AgencyJob, type JobProposal } from "@/lib/queries/jobs"
import { useRespondToProposalMutation } from "@/lib/queries/proposals"
import { useFreelancerLogosQuery } from "@/lib/queries/user"

function statusBadgeClass(status: string) {
  switch (status) {
    case "accepted":
      return "bg-success/10 text-success"
    case "rejected":
      return "bg-destructive/10 text-destructive"
    default:
      return "bg-warning/10 text-warning"
  }
}

export default function ProposalsModal({ job, isOpen, onClose }: { job: AgencyJob | null; isOpen: boolean; onClose: () => void }) {
  const [searchTerm, setSearchTerm] = useState("")
  const proposalsQuery = useJobProposalsQuery(job?.id, isOpen)
  const respond = useRespondToProposalMutation()

  const proposals: JobProposal[] = proposalsQuery.data?.proposals ?? []
  const freelancerIds = proposals.map((p) => p.freelancer_id)
  const logosQuery = useFreelancerLogosQuery(freelancerIds)
  const logos = logosQuery.data?.logos ?? {}

  if (!isOpen || !job) return null

  const filteredProposals = proposals.filter((proposal) => {
    if (!searchTerm) return true
    const term = searchTerm.toLowerCase()
    return (
      (proposal.profiles?.full_name?.toLowerCase() || "").includes(term) ||
      (proposal.profiles?.location?.toLowerCase() || "").includes(term) ||
      (proposal.profiles?.bio?.toLowerCase() || "").includes(term) ||
      (proposal.proposal_text?.toLowerCase() || "").includes(term)
    )
  })

  const handleClose = () => {
    setSearchTerm("")
    onClose()
  }

  const handleRespond = (proposalId: string, action: "accept" | "reject") => {
    respond.mutate(
      { proposalId, jobId: job.id, action },
      {
        onSuccess: (result) => {
          if (!result.success) {
            alert(result.error === "Forbidden" ? "You can only act on proposals for your own jobs." : `Error updating proposal: ${result.error}`)
            return
          }
          alert(`Proposal ${action}ed successfully!`)
        },
        onError: () => alert("Error updating proposal. Please try again."),
      }
    )
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-full sm:max-w-lg md:max-w-2xl lg:max-w-4xl max-h-[90vh] overflow-y-auto rounded-lg">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl">Proposals for "{job.title}"</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {proposals.length} proposal{proposals.length !== 1 ? "s" : ""} received
                {searchTerm && <span> • {filteredProposals.length} matching</span>}
              </p>
            </div>
            <Button variant="ghost" size="icon" onClick={handleClose} aria-label="Close">
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="mt-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search freelancers by name, location, bio, or proposal..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {proposalsQuery.isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin inline-block w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
              <p className="text-muted-foreground mt-4">Loading proposals...</p>
            </div>
          ) : proposalsQuery.isError ? (
            <div className="text-center py-8">
              <p className="text-sm font-semibold text-foreground">Couldn't load proposals</p>
              <p className="text-sm text-muted-foreground">Please try again.</p>
            </div>
          ) : proposals.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">No Proposals Yet</h3>
              <p className="text-muted-foreground">Freelancers haven't submitted any proposals for this job yet.</p>
            </div>
          ) : filteredProposals.length === 0 ? (
            <div className="text-center py-8">
              <Search className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">No Matching Proposals</h3>
              <p className="text-muted-foreground">No proposals match your search criteria. Try different keywords.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {filteredProposals.map((proposal) => (
                <div key={proposal.id} className="border border-border rounded-lg p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={logos[proposal.freelancer_id]} alt="Freelancer" />
                        <AvatarFallback>{proposal.profiles?.full_name?.charAt(0) || "F"}</AvatarFallback>
                      </Avatar>
                      <div>
                        <h4 className="font-semibold">{proposal.profiles?.full_name || "Unknown Freelancer"}</h4>
                        <p className="text-sm text-muted-foreground">{proposal.profiles?.location || "Location not specified"}</p>
                        <p className="text-xs text-muted-foreground">Submitted {new Date(proposal.created_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <Badge className={statusBadgeClass(proposal.status)}>{proposal.status.charAt(0).toUpperCase() + proposal.status.slice(1)}</Badge>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <h5 className="font-medium mb-2">Proposal</h5>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">{proposal.proposal_text}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <h5 className="font-medium mb-1">Timeline</h5>
                        <p className="text-sm text-muted-foreground">{proposal.timeline || "Not specified"}</p>
                      </div>
                      <div>
                        <h5 className="font-medium mb-1">Budget</h5>
                        <p className="text-sm font-semibold text-primary">{proposal.budget || "Not specified"}</p>
                      </div>
                    </div>
                    {proposal.profiles?.bio && (
                      <div>
                        <h5 className="font-medium mb-1">About Freelancer</h5>
                        <p className="text-sm text-muted-foreground">{proposal.profiles.bio}</p>
                      </div>
                    )}
                    {proposal.status === "pending" && (
                      <div className="flex flex-col sm:flex-row gap-2 pt-4">
                        <Button
                          variant="outline"
                          className="flex-1 border-destructive text-destructive hover:bg-destructive/5"
                          onClick={() => handleRespond(proposal.id, "reject")}
                          disabled={respond.isPending}
                        >
                          <XCircle className="h-4 w-4 mr-2" />
                          Reject
                        </Button>
                        <Button className="flex-1" onClick={() => handleRespond(proposal.id, "accept")} disabled={respond.isPending}>
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Accept
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd client && npx vitest run src/pages/agency/ProposalsModal.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/agency/ProposalsModal.tsx client/src/pages/agency/ProposalsModal.test.tsx
git commit -m "Port agency proposals-review modal to client (messaging/escrow deferred)"
```

---

## Task 7: `AgencyDashboard` page

**Files:**
- Create: `client/src/pages/agency/Dashboard.tsx`
- Test: `client/src/pages/agency/Dashboard.test.tsx`

**Interfaces:**
- Consumes: `useAuth` (`@/contexts/AuthContext`, Phase 2a); `useAgencyJobsQuery`, `useUpdateJobStatusMutation`, `AgencyJob` (Task 3); `PostJobModal` (Task 5); `ProposalsModal` (Task 6); `Reveal` (`@/components/shared/reveal`, Phase 2a); `DropdownMenu`/`DropdownMenuTrigger`/`DropdownMenuContent`/`DropdownMenuItem` (Task 1); `Button` (already ported).
- Produces: default export `AgencyDashboard`, mounted at `/agency/dashboard` in Task 8's `App.tsx`.

- [ ] **Step 1: Write the failing tests**

```tsx
// client/src/pages/agency/Dashboard.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

const useAuthMock = vi.fn()
vi.mock("../../contexts/AuthContext", () => ({ useAuth: () => useAuthMock() }))

const useAgencyJobsQueryMock = vi.fn()
const useUpdateJobStatusMutationMock = vi.fn()
vi.mock("../../lib/queries/jobs", () => ({
  useAgencyJobsQuery: () => useAgencyJobsQueryMock(),
  useUpdateJobStatusMutation: () => useUpdateJobStatusMutationMock(),
}))

vi.mock("./PostJobModal", () => ({ default: () => null }))
vi.mock("./ProposalsModal", () => ({ default: () => null }))

import AgencyDashboard from "./Dashboard"

function renderDashboard() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <AgencyDashboard />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  useAuthMock.mockReturnValue({ user: { id: "agency-1" }, profile: { company_name: "Acme Co", account_type: "agency" } })
  useUpdateJobStatusMutationMock.mockReturnValue({ mutate: vi.fn(), isPending: false })
})

describe("AgencyDashboard", () => {
  it("shows a loading state while the agency jobs query is pending", () => {
    useAgencyJobsQueryMock.mockReturnValue({ isLoading: true, data: undefined })
    renderDashboard()
    expect(screen.getByTestId("agency-dashboard-skeleton")).toBeInTheDocument()
  })

  it("renders stat tiles and the jobs list once data loads", async () => {
    useAgencyJobsQueryMock.mockReturnValue({
      isLoading: false,
      data: {
        jobs: [
          {
            id: "job-1",
            title: "Build a landing page",
            description: "A landing page",
            budget_min: 100000,
            budget_max: 200000,
            duration: "2 weeks",
            location: "Lagos",
            job_type: "Remote",
            credit_cost: 5,
            status: "active",
            skills: ["React"],
            created_at: "2026-01-01T00:00:00Z",
            agency_id: "agency-1",
            proposals: 3,
          },
        ],
      },
    })

    renderDashboard()

    await waitFor(() => expect(screen.getByText("Build a landing page")).toBeInTheDocument())
    expect(screen.getByText("Acme Co")).toBeInTheDocument()
  })

  it("shows the empty state and a Post a job button when there are no jobs", async () => {
    useAgencyJobsQueryMock.mockReturnValue({ isLoading: false, isError: false, data: { jobs: [] } })
    renderDashboard()
    await waitFor(() => expect(screen.getByText("No jobs yet")).toBeInTheDocument())
  })

  it("shows an error state instead of the empty state when the jobs query fails", async () => {
    useAgencyJobsQueryMock.mockReturnValue({ isLoading: false, isError: true, data: undefined })
    renderDashboard()
    await waitFor(() => expect(screen.getByText("Couldn't load your hiring desk")).toBeInTheDocument())
    expect(screen.queryByText("No jobs yet")).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client && npx vitest run src/pages/agency/Dashboard.test.tsx`
Expected: FAIL — `Cannot find module './Dashboard'`

- [ ] **Step 3: Write `client/src/pages/agency/Dashboard.tsx`**

```tsx
import { useState } from "react"
import { Navigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Reveal } from "@/components/shared/reveal"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Calendar, Clock, Edit, FileText, MapPin, MoreHorizontal, Pause, Play, Plus, Users, X } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { useAgencyJobsQuery, useUpdateJobStatusMutation, type AgencyJob } from "@/lib/queries/jobs"
import PostJobModal from "./PostJobModal"
import ProposalsModal from "./ProposalsModal"

function statusColor(status: string) {
  switch (status) {
    case "active":
      return "bg-success/10 text-success border-success/30"
    case "paused":
      return "bg-warning/10 text-warning border-warning/30"
    default:
      return "bg-muted text-muted-foreground border-border"
  }
}

function statusIcon(status: string) {
  switch (status) {
    case "active":
      return <Play className="h-3 w-3" />
    case "paused":
      return <Pause className="h-3 w-3" />
    case "closed":
      return <X className="h-3 w-3" />
    default:
      return null
  }
}

export default function AgencyDashboard() {
  const { profile } = useAuth()
  const [showPostJobModal, setShowPostJobModal] = useState(false)
  const [editingJob, setEditingJob] = useState<AgencyJob | null>(null)
  const [viewingProposalsJob, setViewingProposalsJob] = useState<AgencyJob | null>(null)

  const agencyJobsQuery = useAgencyJobsQuery()
  const updateJobStatus = useUpdateJobStatusMutation()

  if (agencyJobsQuery.isLoading) {
    return (
      <div data-testid="agency-dashboard-skeleton" className="min-h-screen bg-surface pb-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-pulse">
          <div className="h-7 w-56 bg-foreground/5 rounded" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 bg-card border border-border rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (agencyJobsQuery.isError) {
    return (
      <div className="min-h-screen bg-surface pb-20 flex items-center justify-center">
        <div className="text-center space-y-2">
          <p className="text-sm font-semibold text-foreground">Couldn't load your hiring desk</p>
          <p className="text-sm text-muted-foreground">Please try refreshing the page.</p>
        </div>
      </div>
    )
  }

  if (profile && profile.account_type !== "agency") {
    return <Navigate to="/" replace />
  }

  const jobs: AgencyJob[] = agencyJobsQuery.data?.jobs ?? []
  const agencyName = profile?.company_name || profile?.full_name || "Your"

  const activeJobs = jobs.filter((j) => j.status === "active").length
  const pausedJobs = jobs.filter((j) => j.status === "paused").length
  const closedJobs = jobs.filter((j) => j.status === "closed").length
  const totalProposals = jobs.reduce((sum, j) => sum + j.proposals, 0)

  const openPostJobModal = () => {
    setEditingJob(null)
    setShowPostJobModal(true)
  }

  const handlePauseResume = (job: AgencyJob) => {
    const newStatus = job.status === "paused" ? "active" : "paused"
    updateJobStatus.mutate(
      { jobId: job.id, status: newStatus },
      { onError: () => alert("Error updating job. Please try again.") }
    )
  }

  const handleClose = (job: AgencyJob) => {
    if (!confirm("Close this job permanently? This action cannot be undone.")) return
    updateJobStatus.mutate(
      { jobId: job.id, status: "closed" },
      { onError: () => alert("Error updating job. Please try again.") }
    )
  }

  return (
    <div className="min-h-screen bg-surface pb-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div className="space-y-1 min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Hiring desk</p>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground truncate">
              {agencyName === "Your" ? "Your hiring desk" : agencyName}
            </h1>
            <p className="text-sm text-muted-foreground">Compose briefs, weigh proposals, hire decisively.</p>
          </div>
          <Button onClick={openPostJobModal} className="h-10 px-4 rounded-lg gap-2 shrink-0 w-full sm:w-auto justify-center">
            <Plus className="h-4 w-4" /> Post a job
          </Button>
        </header>

        <Reveal>
          <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: "Active", value: activeJobs, icon: Play, tone: "text-success", accent: false },
              { label: "Paused", value: pausedJobs, icon: Pause, tone: "text-warning", accent: false },
              { label: "Closed", value: closedJobs, icon: X, tone: "text-muted-foreground", accent: false },
              { label: "Proposals", value: totalProposals, icon: Users, tone: "text-primary", accent: true },
            ].map((stat) => (
              <div key={stat.label} className={`rounded-xl border bg-card p-4 ${stat.accent ? "border-primary/30" : "border-border"}`}>
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-muted-foreground">{stat.label}</p>
                  <stat.icon className={`h-3.5 w-3.5 ${stat.tone}`} />
                </div>
                <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground tabular-nums">{stat.value}</p>
              </div>
            ))}
          </section>
        </Reveal>

        <Reveal delay={0.08}>
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-foreground">
              Your jobs <span className="font-normal text-muted-foreground">· {jobs.length}</span>
            </h2>

            {jobs.length === 0 ? (
              <div className="rounded-xl border border-border bg-card py-16 px-6 text-center">
                <div className="mx-auto h-11 w-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <FileText className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-sm font-semibold text-foreground">No jobs yet</h3>
                <p className="mt-1 text-sm text-muted-foreground max-w-sm mx-auto">
                  Post your first opportunity and we'll bring qualified freelancers to your door.
                </p>
                <Button className="mt-5 gap-2" onClick={openPostJobModal}>
                  <Plus className="h-4 w-4" /> Post a job
                </Button>
              </div>
            ) : (
              <div className="rounded-xl border border-border bg-card divide-y divide-border overflow-hidden">
                {jobs.map((job) => (
                  <div key={job.id} className="p-4 sm:p-5 transition-colors hover:bg-surface/60">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <div className="flex items-center gap-2.5">
                          <h3 className="text-sm font-semibold text-foreground truncate">{job.title}</h3>
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border ${statusColor(job.status)}`}>
                            {statusIcon(job.status)}
                            {job.status}
                          </span>
                        </div>
                        {job.description && <p className="text-sm text-muted-foreground line-clamp-1 max-w-2xl">{job.description}</p>}
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          <span className="font-medium text-foreground tabular-nums">
                            ₦{job.budget_min?.toLocaleString() ?? "—"} – ₦{job.budget_max?.toLocaleString() ?? "—"}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {job.duration || "Flexible"}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {job.location || "Remote"}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(job.created_at).toLocaleDateString("en-NG", { day: "numeric", month: "short" })}
                          </span>
                          <span className="font-medium text-primary">
                            {job.proposals} {job.proposals === 1 ? "proposal" : "proposals"}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Button variant="outline" size="sm" onClick={() => setViewingProposalsJob(job)}>
                          Review bids
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-52">
                            <DropdownMenuItem
                              onClick={() => {
                                setEditingJob(job)
                                setShowPostJobModal(true)
                              }}
                            >
                              <Edit className="mr-2 h-4 w-4 text-muted-foreground" /> Edit brief
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handlePauseResume(job)}>
                              <Pause className="mr-2 h-4 w-4 text-muted-foreground" /> {job.status === "paused" ? "Resume hiring" : "Pause hiring"}
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => handleClose(job)}>
                              <X className="mr-2 h-4 w-4" /> Close listing
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                    {!!job.skills?.length && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {job.skills.slice(0, 6).map((sk) => (
                          <span key={sk} className="px-2 py-0.5 rounded-md bg-surface-2 text-muted-foreground text-[11px]">
                            {sk}
                          </span>
                        ))}
                        {job.skills.length > 6 && <span className="px-2 py-0.5 text-[11px] text-muted-foreground">+{job.skills.length - 6}</span>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </Reveal>
      </div>

      <PostJobModal
        isOpen={showPostJobModal}
        onClose={() => {
          setShowPostJobModal(false)
          setEditingJob(null)
        }}
        editingJob={editingJob}
        onSuccess={() => {
          setShowPostJobModal(false)
          setEditingJob(null)
          alert(editingJob ? "Job updated successfully!" : "Job posted successfully!")
        }}
      />

      <ProposalsModal job={viewingProposalsJob} isOpen={!!viewingProposalsJob} onClose={() => setViewingProposalsJob(null)} />
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd client && npx vitest run src/pages/agency/Dashboard.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/agency/Dashboard.tsx client/src/pages/agency/Dashboard.test.tsx
git commit -m "Port agency dashboard page to client (escrow/disputes/messaging deferred)"
```

---

## Task 8: Wire the route into `App.tsx`

**Files:**
- Modify: `client/src/App.tsx`
- Test: `client/src/App.test.tsx` (extend)

**Interfaces:** none new — this task wires Task 7's page into the existing route table.

- [ ] **Step 1: Write the failing test**

```tsx
// client/src/App.test.tsx — add this describe block to the existing file
describe("agency dashboard route", () => {
  it("redirects /agency/dashboard to /login when signed out", async () => {
    renderAt("/agency/dashboard")
    await screen.findByText(/Sign in/i)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client && npx vitest run src/App.test.tsx`
Expected: FAIL — no route registered for `/agency/dashboard` in the test's local route table

- [ ] **Step 3: Update `client/src/App.tsx`**

Import `AgencyDashboard` from `./pages/agency/Dashboard` and add a new `<Route path="/agency/dashboard" element={<RequireAuth><AgencyDashboard /></RequireAuth>} />` — placed alongside the other `/freelancer/*` `RequireAuth`-wrapped routes and, critically, **before** the existing catch-all `<Route path="*">` route (read the current file first to confirm exactly where that catch-all sits, and insert before it — a route placed after the catch-all is unreachable, since React Router matches in declaration order).

- [ ] **Step 4: Update `App.test.tsx`'s `renderAt` helper**

Add the same route (imported `AgencyDashboard`, wrapped in `RequireAuth`) to the helper's local `<Routes>` table, before its own copy of the catch-all route, mirroring how earlier phases added `/freelancer/dashboard`, `/freelancer/saved-jobs`, and `/freelancer/proposals` there.

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd client && npx vitest run src/App.test.tsx`
Expected: PASS

- [ ] **Step 6: Run the full client test suite**

Run: `cd client && npm test`
Expected: All tests PASS

- [ ] **Step 7: Commit**

```bash
git add client/src/App.tsx client/src/App.test.tsx
git commit -m "Wire agency dashboard route behind RequireAuth"
```

---

## Post-Phase-2c note

This plan covers the agency's core hiring flow only: post/edit/pause/resume/close jobs, and review/accept/reject proposals. Deferred to later phases: escrow funding and payout ("Fund Job", the accepted-proposal action buttons) → Phase 4, gated on the Supabase-side escrow v2 migration; disputes → Phase 5; messaging and the live proposals-count subscription → Phase 3. Remaining Phase 2 slices after this one: the full `/freelancer/marketplace` browse page, profile editors for both sides (need new update-profile server routes), and `/agency/find-freelancers` (needs a new search server route).
