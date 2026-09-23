# Phase 5c: Job moderation + audit log Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `/admin/jobs` (moderation: remove/restore fraudulent or policy-violating job postings) and `/admin/audit` (a searchable log of consequential admin actions) — the third slice of Phase 5.

**Architecture:** Same conventions as Phase 5a/5b. New Express routes behind `requireAuth` + `requireAdmin`. `admin_audit_log`'s own RLS SELECT policy is single-field (`account_type`-only, see `supabase/migrations/20260623000000_admin_audit_log.sql`) — the audit-log GET route uses the service-role client (`createServiceClient`), not `req.supabase`, so a role-only admin (`role="admin"`, `account_type` something else) isn't wrongly shown an empty log. Job moderation writes also use the service-role client, matching legacy and this migration's established boundary rule (privileged/system-of-record writes).

**Tech Stack:** React 19, Vite, TanStack Query, React Router, Express, Supabase.

**Spec:** `docs/superpowers/specs/2026-09-08-nextjs-to-react-node-migration-design.md` (Phase 5 row). Third sub-plan of Phase 5 — builds on Phase 5a/5b (`Tabs`, `AdminSidebar`, `useAdminUsersQuery`, `adminAudit.ts`'s `logAdminAction`), both merged to `main`.

## Global Constraints

- Admin authorization check is `profile.role === "admin" || profile.account_type === "admin"` — never just one field (`CLAUDE.md`). This plan adds no NEW admin-identity check of its own (both new routes are mounted behind the existing `requireAuth, requireAdmin` stack) — but if any task's code sample below is ever edited during execution to add one, it must use this exact OR expression. Self-review already scanned every task below for this and found none needed.
- `jobs.moderation_status` is `not null default 'visible'` (`supabase/migrations/20260623010000_job_moderation.sql`) — every row already has a real value (the `ALTER TABLE ADD COLUMN ... DEFAULT` backfilled existing rows too). Legacy's defensive `moderation_status ?? "visible"` fallback is technically no longer necessary but is harmless — keep it anyway for parity and because a future `select("*")` on a table this migration doesn't fully control the schema of is cheap insurance.
- `admin_audit_log`'s own RLS SELECT policy checks `p.account_type = 'admin'` ONLY (not `role`) — this is a known, tracked, low-severity gap (see `react-node-migration-status` memory, security item #4). **This plan's `GET /api/admin/audit` route must use `createServiceClient()`, not `req.supabase`**, specifically to route around this gap — a role-only admin using the RLS-scoped client would see an empty audit log even though every other admin check in the app would grant them full access. This is the fix decided for this exact scenario when the gap was found; apply it here, don't defer it.
- `AdminJobs` and `AdminAuditLog` both use the plain `<div className="flex h-screen bg-surface"><AdminSidebar />...` layout (no `SidebarProvider`/`SidebarInset`), matching every admin page shipped so far.
- The `Table`/`TableHeader`/`TableBody`/`TableRow`/`TableHead`/`TableCell` UI primitive (`@/components/ui/table`) does not exist in `client/` yet — Task 1 ports it. Unlike `Tabs`/`Popover`/`DropdownMenu`, it has zero Radix dependency (a plain HTML `<table>` wrapper) — no portal, no pointer-event test-timing concerns like Phase 5b's `AdminUsers.test.tsx` hit.

---

## Task 1: Port the `Table` UI primitive

**Files:**
- Create: `client/src/components/ui/table.tsx`
- Test: `client/src/components/ui/table.test.tsx`

**Interfaces:**
- Produces: `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableHead`, `TableCell` (the legacy file also exports `TableFooter`/`TableCaption` — omit them, neither `AdminJobs` nor `AdminAuditLog` uses them, and this codebase doesn't port unused exports). Consumed by Task 4 (`AdminJobs`) and Task 5 (`AdminAuditLog`).

- [ ] **Step 1: Write the failing test**

```tsx
// client/src/components/ui/table.test.tsx
import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "./table"

describe("Table", () => {
  it("renders headers and rows", () => {
    render(
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>Job A</TableCell>
            <TableCell>Active</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    )

    expect(screen.getByRole("table")).toBeInTheDocument()
    expect(screen.getByRole("columnheader", { name: "Name" })).toBeInTheDocument()
    expect(screen.getByRole("cell", { name: "Job A" })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd client && npx vitest run src/components/ui/table.test.tsx`
Expected: FAIL — `Cannot find module './table'`

- [ ] **Step 3: Implement the primitive**

```tsx
// client/src/components/ui/table.tsx
import * as React from "react"

import { cn } from "@/lib/utils"

const Table = React.forwardRef<HTMLTableElement, React.HTMLAttributes<HTMLTableElement>>(
  ({ className, ...props }, ref) => (
    <div className="relative w-full overflow-auto">
      <table ref={ref} className={cn("w-full caption-bottom text-sm", className)} {...props} />
    </div>
  )
)
Table.displayName = "Table"

const TableHeader = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => <thead ref={ref} className={cn("[&_tr]:border-b", className)} {...props} />
)
TableHeader.displayName = "TableHeader"

const TableBody = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => <tbody ref={ref} className={cn("[&_tr:last-child]:border-0", className)} {...props} />
)
TableBody.displayName = "TableBody"

const TableRow = React.forwardRef<HTMLTableRowElement, React.HTMLAttributes<HTMLTableRowElement>>(
  ({ className, ...props }, ref) => (
    <tr ref={ref} className={cn("border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted", className)} {...props} />
  )
)
TableRow.displayName = "TableRow"

const TableHead = React.forwardRef<HTMLTableCellElement, React.ThHTMLAttributes<HTMLTableCellElement>>(
  ({ className, ...props }, ref) => (
    <th ref={ref} className={cn("h-12 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0", className)} {...props} />
  )
)
TableHead.displayName = "TableHead"

const TableCell = React.forwardRef<HTMLTableCellElement, React.TdHTMLAttributes<HTMLTableCellElement>>(
  ({ className, ...props }, ref) => <td ref={ref} className={cn("p-4 align-middle [&:has([role=checkbox])]:pr-0", className)} {...props} />
)
TableCell.displayName = "TableCell"

export { Table, TableHeader, TableBody, TableRow, TableHead, TableCell }
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd client && npx vitest run src/components/ui/table.test.tsx`
Expected: PASS

- [ ] **Step 5: Run tsc**

Run: `cd client && npx tsc --noEmit`
Expected: clean.

- [ ] **Step 6: Self-check then commit**

Confirm via `git show --stat` that your commit touches only `client/src/components/ui/table.tsx` and `client/src/components/ui/table.test.tsx` — other subagents may be committing concurrently in this shared worktree on disjoint files; if your commit shows extra files or your own `git commit` reports "nothing to commit" after you believed you had staged changes, STOP and investigate via `git log`/`git status` before doing anything destructive (recover via `git reset --soft HEAD~1` + selective `git restore --staged`, never `git reset --hard`).

```bash
git add client/src/components/ui/table.tsx client/src/components/ui/table.test.tsx
git commit -m "Port Table UI primitive to client"
```

---

## Task 2: `GET /api/admin/jobs`, `POST /api/admin/jobs/:id/moderate`, `GET /api/admin/audit`

These three routes are one task (not three) because the moderate and audit routes both extend the SAME shared `vi.hoisted` mock block that Phase 5b's Task 1 (the disable route) already added to `server/src/routes/admin.test.ts` — coordinating that one shared block across separate tasks with separate implementers would risk exactly the kind of git-race/merge-conflict-on-shared-state problem this migration has already hit once (Phase 5a's Tabs/AdminSidebar commit collision, a different kind of race but the same "two writers, one shared resource" shape). Doing it as one task with one implementer touching the mock block once avoids that entirely.

**Files:**
- Modify: `server/src/routes/admin.ts`
- Modify: `server/src/routes/admin.test.ts`

**Interfaces:**
- Produces: `GET /api/admin/jobs` — response `{ jobs: AdminJobRow[] }` where `AdminJobRow = { id, title, status, moderation_status, moderation_reason, agency_name, created_at, budget_min, budget_max }`, ordered by `created_at` descending, limited to 300. Uses `req.supabase` (matching legacy's own `page.tsx`, which reads via the cookie-aware client, not service-role — the caller is already known-admin via `requireAdmin`, and nothing here needs a privileged read).
- Produces: `POST /api/admin/jobs/:id/moderate` — request body `{ action: "remove" | "restore", reason?: string }`; response `{ success: true, moderation_status: string }` or `{ error: string }` at 400/404/500. Uses `createServiceClient()` (matching legacy's `moderate/route.ts`, which uses `createServiceRoleClient()`).
- Produces: `GET /api/admin/audit` — response `{ logs: AdminAuditEntry[] }` where `AdminAuditEntry = { id, action, target_type, target_id, details, created_at, admin: { full_name, email } | null }`, ordered by `created_at` descending, limited to 200. Uses `createServiceClient()` — this is the deliberate fix for `admin_audit_log`'s single-field (`account_type`-only) RLS read policy (see this plan's Global Constraints); a role-only admin using `req.supabase` would see an empty log.

- [ ] **Step 1: Read the current top of `server/src/routes/admin.test.ts`**

Confirm it currently looks like this (from Phase 5b's Task 1, already merged) before editing — if it doesn't match, STOP and re-read this brief's assumptions rather than guessing:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest"
import request from "supertest"
import express from "express"
import adminRouter from "./admin.js"

const { maybeSingleMock, updateUserByIdMock, auditInsertMock, fakeService } = vi.hoisted(() => {
  const maybeSingleMock = vi.fn()
  const updateUserByIdMock = vi.fn()
  const auditInsertMock = vi.fn().mockResolvedValue({ error: null })
  const fakeService = {
    from: vi.fn((table: string) => {
      if (table === "profiles") return { select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: maybeSingleMock })) })) }
      if (table === "admin_audit_log") return { insert: auditInsertMock }
      throw new Error(`unexpected table ${table}`)
    }),
    auth: { admin: { updateUserById: updateUserByIdMock } },
  }
  return { maybeSingleMock, updateUserByIdMock, auditInsertMock, fakeService }
})

vi.mock("../lib/supabase.js", () => ({ createServiceClient: () => fakeService }))

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
```

- [ ] **Step 2: Extend the hoisted mock block**

Replace that ENTIRE `vi.hoisted(...)` block (destructured assignment, the call itself, and the immediately-following `vi.mock` line) with this extended version — do not add a second `vi.hoisted` or a second `vi.mock("../lib/supabase.js", ...)` call, there must be exactly one of each in the file:

```ts
const { maybeSingleMock, updateUserByIdMock, auditInsertMock, jobLookupMock, jobUpdateEqMock, auditSelectLimitMock, fakeService } = vi.hoisted(() => {
  const maybeSingleMock = vi.fn()
  const updateUserByIdMock = vi.fn()
  const auditInsertMock = vi.fn().mockResolvedValue({ error: null })
  const jobLookupMock = vi.fn()
  const jobUpdateEqMock = vi.fn().mockResolvedValue({ error: null })
  const auditSelectLimitMock = vi.fn()
  const fakeService = {
    from: vi.fn((table: string) => {
      if (table === "profiles") return { select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: maybeSingleMock })) })) }
      if (table === "admin_audit_log") {
        return {
          insert: auditInsertMock,
          select: vi.fn(() => ({ order: vi.fn(() => ({ limit: auditSelectLimitMock })) })),
        }
      }
      if (table === "jobs") {
        return {
          select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: jobLookupMock })) })),
          update: vi.fn(() => ({ eq: jobUpdateEqMock })),
        }
      }
      throw new Error(`unexpected table ${table}`)
    }),
    auth: { admin: { updateUserById: updateUserByIdMock } },
  }
  return { maybeSingleMock, updateUserByIdMock, auditInsertMock, jobLookupMock, jobUpdateEqMock, auditSelectLimitMock, fakeService }
})

vi.mock("../lib/supabase.js", () => ({ createServiceClient: () => fakeService }))
```

Run: `cd server && npx vitest run src/routes/admin.test.ts` right after this step alone (before adding any new tests) — expect all of Phase 5b's existing tests (users list, disable/enable) to still PASS unchanged, since `maybeSingleMock`/`updateUserByIdMock`/`auditInsertMock`/`fakeService`'s shape for `"profiles"` and `admin_audit_log.insert` are untouched. This confirms the extension didn't regress anything before you add new tests on top of it.

- [ ] **Step 3: Write the failing tests**

Add to `server/src/routes/admin.test.ts` (after the existing `POST /users/:id/disable` describe block):

```ts
describe("GET /jobs", () => {
  it("lists jobs newest first, resolving agency display names", async () => {
    const jobsLimitMock = vi.fn().mockResolvedValue({
      data: [
        { id: "j-1", title: "Logo design", status: "open", moderation_status: "visible", moderation_reason: null, agency_id: "a-1", created_at: "2026-01-02T00:00:00Z", budget_min: 5000, budget_max: 10000 },
        { id: "j-2", title: "Spam job", status: "open", moderation_status: "removed", moderation_reason: "fraud", agency_id: "a-2", created_at: "2026-01-01T00:00:00Z", budget_min: null, budget_max: null },
      ],
      error: null,
    })
    const agenciesInMock = vi.fn().mockResolvedValue({
      data: [
        { id: "a-1", full_name: "Alice Agency", company_name: null },
        { id: "a-2", full_name: null, company_name: "Acme Co" },
      ],
      error: null,
    })
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "jobs") return { select: vi.fn(() => ({ order: vi.fn(() => ({ limit: jobsLimitMock })) })) }
        if (table === "profiles") return { select: vi.fn(() => ({ in: agenciesInMock })) }
        throw new Error(`unexpected table ${table}`)
      }),
    }

    const res = await request(appWith(supabase)).get("/jobs")

    expect(res.status).toBe(200)
    expect(res.body.jobs).toHaveLength(2)
    expect(res.body.jobs[0]).toEqual(expect.objectContaining({ id: "j-1", agency_name: "Alice Agency", moderation_status: "visible" }))
    expect(res.body.jobs[1]).toEqual(expect.objectContaining({ id: "j-2", agency_name: "Acme Co", moderation_status: "removed", moderation_reason: "fraud" }))
  })

  it("returns an empty list on a query error", async () => {
    const supabase = { from: vi.fn(() => ({ select: vi.fn(() => ({ order: vi.fn(() => ({ limit: vi.fn().mockResolvedValue({ data: null, error: { message: "boom" } }) })) })) })) }
    const res = await request(appWith(supabase)).get("/jobs")
    expect(res.body).toEqual({ jobs: [] })
  })
})

describe("POST /jobs/:id/moderate", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    auditInsertMock.mockResolvedValue({ error: null })
    jobUpdateEqMock.mockResolvedValue({ error: null })
  })

  it("removes a job with a reason and logs the action, via the service-role client", async () => {
    jobLookupMock.mockResolvedValue({ data: { id: "j-1", title: "Spam job", agency_id: "a-2" }, error: null })

    const res = await request(appWith({})).post("/jobs/j-1/moderate").send({ action: "remove", reason: "fraud" })

    expect(jobUpdateEqMock).toHaveBeenCalledWith("id", "j-1")
    expect(auditInsertMock).toHaveBeenCalledWith(expect.objectContaining({ admin_id: "admin-1", action: "job.remove", target_id: "j-1" }))
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ success: true, moderation_status: "removed" })
  })

  it("restores a job, clearing the reason, and logs 'job.restore'", async () => {
    jobLookupMock.mockResolvedValue({ data: { id: "j-1", title: "Logo design", agency_id: "a-1" }, error: null })

    const res = await request(appWith({})).post("/jobs/j-1/moderate").send({ action: "restore" })

    expect(auditInsertMock).toHaveBeenCalledWith(expect.objectContaining({ action: "job.restore" }))
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ success: true, moderation_status: "visible" })
  })

  it("returns 400 for an invalid action", async () => {
    const res = await request(appWith({})).post("/jobs/j-1/moderate").send({ action: "delete" })
    expect(res.status).toBe(400)
    expect(jobUpdateEqMock).not.toHaveBeenCalled()
  })

  it("returns 404 when the job doesn't exist", async () => {
    jobLookupMock.mockResolvedValue({ data: null, error: null })
    const res = await request(appWith({})).post("/jobs/j-404/moderate").send({ action: "remove" })
    expect(res.status).toBe(404)
    expect(jobUpdateEqMock).not.toHaveBeenCalled()
  })

  it("returns 500 when the update fails", async () => {
    jobLookupMock.mockResolvedValue({ data: { id: "j-1", title: "X", agency_id: "a-1" }, error: null })
    jobUpdateEqMock.mockResolvedValue({ error: { message: "boom" } })
    const res = await request(appWith({})).post("/jobs/j-1/moderate").send({ action: "remove" })
    expect(res.status).toBe(500)
  })
})

describe("GET /audit", () => {
  beforeEach(() => vi.clearAllMocks())

  it("lists audit entries newest first with the acting admin's name/email joined, via the service-role client", async () => {
    auditSelectLimitMock.mockResolvedValue({
      data: [
        { id: "log-1", action: "user.disable", target_type: "user", target_id: "u-2", details: { note: "spam" }, created_at: "2026-01-02T00:00:00Z", admin: { full_name: "Admin One", email: "admin1@bizimi.com" } },
      ],
      error: null,
    })

    const res = await request(appWith({})).get("/audit")

    expect(res.status).toBe(200)
    expect(res.body).toEqual({
      logs: [
        { id: "log-1", action: "user.disable", target_type: "user", target_id: "u-2", details: { note: "spam" }, created_at: "2026-01-02T00:00:00Z", admin: { full_name: "Admin One", email: "admin1@bizimi.com" } },
      ],
    })
  })

  it("returns an empty list on a query error", async () => {
    auditSelectLimitMock.mockResolvedValue({ data: null, error: { message: "boom" } })
    const res = await request(appWith({})).get("/audit")
    expect(res.body).toEqual({ logs: [] })
  })
})
```

- [ ] **Step 4: Run the tests to verify they fail**

Run: `cd server && npx vitest run src/routes/admin.test.ts -t "jobs|audit"`
Expected: FAIL — none of these three routes exist yet.

- [ ] **Step 5: Implement the routes**

Add to `server/src/routes/admin.ts` (after the existing `POST /users/:id/disable` route):

```ts
adminRouter.get(
  "/jobs",
  asyncHandler(async (req, res) => {
    const { data: jobs, error } = await req.supabase!
      .from("jobs")
      .select("id, title, status, moderation_status, moderation_reason, agency_id, created_at, budget_min, budget_max")
      .order("created_at", { ascending: false })
      .limit(300)

    if (error) {
      console.error("Error fetching admin jobs list:", error)
      res.json({ jobs: [] })
      return
    }

    const rows = jobs || []
    const agencyIds = [...new Set(rows.map((j) => j.agency_id).filter(Boolean))]
    const { data: agencies } = agencyIds.length
      ? await req.supabase!.from("profiles").select("id, full_name, company_name").in("id", agencyIds)
      : { data: [] as { id: string; full_name: string | null; company_name: string | null }[] }
    const nameById = new Map((agencies || []).map((a) => [a.id, a.company_name || a.full_name || "Agency"]))

    res.json({
      jobs: rows.map((j) => ({
        id: j.id,
        title: j.title,
        status: j.status,
        moderation_status: j.moderation_status ?? "visible",
        moderation_reason: j.moderation_reason ?? null,
        agency_name: nameById.get(j.agency_id) || "—",
        created_at: j.created_at,
        budget_min: j.budget_min,
        budget_max: j.budget_max,
      })),
    })
  })
)

adminRouter.post(
  "/jobs/:id/moderate",
  asyncHandler(async (req, res) => {
    const jobId = req.params.id
    const { action, reason } = req.body ?? {}

    if (action !== "remove" && action !== "restore") {
      res.status(400).json({ error: "action must be 'remove' or 'restore'" })
      return
    }

    const service = createServiceClient()

    const { data: job } = await service.from("jobs").select("id, title, agency_id").eq("id", jobId).maybeSingle()
    if (!job) {
      res.status(404).json({ error: "Job not found" })
      return
    }

    const removing = action === "remove"
    const { error } = await service
      .from("jobs")
      .update({
        moderation_status: removing ? "removed" : "visible",
        moderated_by: req.user!.id,
        moderated_at: new Date().toISOString(),
        moderation_reason: removing ? reason ?? null : null,
      })
      .eq("id", jobId)

    if (error) {
      console.error("Failed to update job moderation status:", error)
      res.status(500).json({ error: error.message })
      return
    }

    await logAdminAction(service, {
      adminId: req.user!.id,
      action: removing ? "job.remove" : "job.restore",
      targetType: "job",
      targetId: jobId,
      details: { title: job.title, agency_id: job.agency_id, reason: removing ? reason ?? null : null },
    })

    res.json({ success: true, moderation_status: removing ? "removed" : "visible" })
  })
)

adminRouter.get(
  "/audit",
  asyncHandler(async (_req, res) => {
    const service = createServiceClient()

    const { data, error } = await service
      .from("admin_audit_log")
      .select("id, action, target_type, target_id, details, created_at, admin:profiles!admin_audit_log_admin_id_fkey(full_name, email)")
      .order("created_at", { ascending: false })
      .limit(200)

    if (error) {
      console.error("Error fetching admin audit log:", error)
      res.json({ logs: [] })
      return
    }

    res.json({ logs: data || [] })
  })
)
```

Note: `GET /audit` deliberately does NOT use `req.supabase` — see this plan's Global Constraints for why (`admin_audit_log`'s own RLS read policy is single-field). Do not "simplify" it to `req.supabase!`.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `cd server && npx vitest run src/routes/admin.test.ts`
Expected: PASS (all tests in the file, old and new — confirms Phase 5b's disable-route tests still pass against the extended shared mock too)

- [ ] **Step 7: Run the full server test suite**

Run: `cd server && npx vitest run`
Expected: PASS

- [ ] **Step 8: Run tsc**

Run: `cd server && npx tsc --noEmit`
Expected: only the known pre-existing `src/routes/user.test.ts(230,52)` error.

- [ ] **Step 9: Self-check then commit**

Confirm via `git show --stat` that your commit touches only `server/src/routes/admin.ts` and `server/src/routes/admin.test.ts`.

```bash
git add server/src/routes/admin.ts server/src/routes/admin.test.ts
git commit -m "feat(server): add GET /api/admin/jobs, POST /api/admin/jobs/:id/moderate, GET /api/admin/audit"
```

---

## Task 3: Client hooks — `useAdminJobsQuery`, `useModerateJobMutation`, `useAdminAuditQuery`

**Files:**
- Modify: `client/src/lib/queries/admin.ts`
- Modify: `client/src/lib/queries/admin.test.tsx`

**Interfaces:**
- Produces: `type AdminJobRow`, `useAdminJobsQuery()`, `useModerateJobMutation()` (`mutate({jobId, action, reason?})`, invalidates `["admin", "jobs"]`); `type AdminAuditEntry`, `useAdminAuditQuery()`. Consumed by Task 4 (`AdminJobs`) and Task 5 (`AdminAuditLog`).

- [ ] **Step 1: Write the failing tests**

Add to `client/src/lib/queries/admin.test.tsx`:

```tsx
describe("useAdminJobsQuery", () => {
  it("GETs /api/admin/jobs", async () => {
    apiFetchMock.mockResolvedValue({ jobs: [{ id: "j-1", title: "Logo design", status: "open", moderation_status: "visible", moderation_reason: null, agency_name: "Acme", created_at: "2026-01-01T00:00:00Z", budget_min: 5000, budget_max: 10000 }] })
    const { useAdminJobsQuery } = await import("./admin")

    const { result } = renderHook(() => useAdminJobsQuery(), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(apiFetchMock).toHaveBeenCalledWith("/api/admin/jobs")
    expect(result.current.data?.jobs[0].title).toBe("Logo design")
  })
})

describe("useModerateJobMutation", () => {
  it("POSTs /api/admin/jobs/:id/moderate and invalidates the jobs list", async () => {
    apiFetchMock.mockResolvedValue({ success: true, moderation_status: "removed" })
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const invalidateSpy = vi.spyOn(client, "invalidateQueries")
    const { useModerateJobMutation } = await import("./admin")

    const { result } = renderHook(() => useModerateJobMutation(), {
      wrapper: ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>,
    })
    result.current.mutate({ jobId: "j-1", action: "remove", reason: "fraud" })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(apiFetchMock).toHaveBeenCalledWith("/api/admin/jobs/j-1/moderate", {
      method: "POST",
      body: JSON.stringify({ action: "remove", reason: "fraud" }),
    })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["admin", "jobs"] })
  })
})

describe("useAdminAuditQuery", () => {
  it("GETs /api/admin/audit", async () => {
    apiFetchMock.mockResolvedValue({ logs: [{ id: "log-1", action: "user.disable", target_type: "user", target_id: "u-2", details: null, created_at: "2026-01-01T00:00:00Z", admin: { full_name: "Admin One", email: "a@x.com" } }] })
    const { useAdminAuditQuery } = await import("./admin")

    const { result } = renderHook(() => useAdminAuditQuery(), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(apiFetchMock).toHaveBeenCalledWith("/api/admin/audit")
    expect(result.current.data?.logs[0].action).toBe("user.disable")
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd client && npx vitest run src/lib/queries/admin.test.tsx -t "AdminJobs|ModerateJob|AdminAudit"`
Expected: FAIL — none of these exports exist yet.

- [ ] **Step 3: Implement the hooks**

Add to `client/src/lib/queries/admin.ts` (at the end of the file):

```ts
export type AdminJobRow = {
  id: string
  title: string
  status: string
  moderation_status: string
  moderation_reason: string | null
  agency_name: string
  created_at: string
  budget_min: number | null
  budget_max: number | null
}

export function useAdminJobsQuery() {
  return useQuery({
    queryKey: ["admin", "jobs"],
    queryFn: () => apiFetch<{ jobs: AdminJobRow[] }>("/api/admin/jobs"),
  })
}

export function useModerateJobMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ jobId, action, reason }: { jobId: string; action: "remove" | "restore"; reason?: string | null }) =>
      apiFetch<{ success: boolean; moderation_status: string }>(`/api/admin/jobs/${jobId}/moderate`, {
        method: "POST",
        body: JSON.stringify({ action, reason }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "jobs"] })
    },
  })
}

export type AdminAuditEntry = {
  id: string
  action: string
  target_type: string | null
  target_id: string | null
  details: Record<string, unknown> | null
  created_at: string
  admin: { full_name: string | null; email: string | null } | null
}

export function useAdminAuditQuery() {
  return useQuery({
    queryKey: ["admin", "audit"],
    queryFn: () => apiFetch<{ logs: AdminAuditEntry[] }>("/api/admin/audit"),
  })
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd client && npx vitest run src/lib/queries/admin.test.tsx`
Expected: PASS (all tests in the file, old and new)

- [ ] **Step 5: Run tsc**

Run: `cd client && npx tsc --noEmit`
Expected: clean.

- [ ] **Step 6: Self-check then commit**

Confirm via `git show --stat` that your commit touches only `client/src/lib/queries/admin.ts` and `client/src/lib/queries/admin.test.tsx`.

```bash
git add client/src/lib/queries/admin.ts client/src/lib/queries/admin.test.tsx
git commit -m "feat(client): add useAdminJobsQuery, useModerateJobMutation, useAdminAuditQuery hooks"
```

---

## Task 4: `AdminJobs` page

**Files:**
- Create: `client/src/pages/admin/Jobs.tsx`
- Test: `client/src/pages/admin/Jobs.test.tsx`

**Interfaces:**
- Consumes: `useAdminJobsQuery`, `useModerateJobMutation`, `type AdminJobRow` (`@/lib/queries/admin`); `AdminSidebar`; `Tabs` family; `Table`/`TableHeader`/`TableBody`/`TableRow`/`TableHead`/`TableCell` (Task 1); `Button`, `Input`.
- Produces: default export `AdminJobs`. Consumed by Task 6's route wiring.

- [ ] **Step 1: Write the failing tests**

```tsx
// client/src/pages/admin/Jobs.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"

const useAdminJobsQueryMock = vi.fn()
const moderateMutate = vi.fn()
vi.mock("../../lib/queries/admin", () => ({
  useAdminJobsQuery: () => useAdminJobsQueryMock(),
  useModerateJobMutation: () => ({ mutate: moderateMutate, isPending: false }),
}))

import AdminJobs from "./Jobs"

const activeJob = { id: "j-1", title: "Logo design", status: "open", moderation_status: "visible", moderation_reason: null, agency_name: "Acme", created_at: "2026-01-01T00:00:00Z", budget_min: 5000, budget_max: 10000 }
const removedJob = { id: "j-2", title: "Spam job", status: "open", moderation_status: "removed", moderation_reason: "fraud", agency_name: "Shell Co", created_at: "2026-01-02T00:00:00Z", budget_min: null, budget_max: null }

function renderPage() {
  return render(<MemoryRouter><AdminJobs /></MemoryRouter>)
}

beforeEach(() => {
  vi.clearAllMocks()
  useAdminJobsQueryMock.mockReturnValue({ isLoading: false, data: { jobs: [activeJob, removedJob] } })
  vi.stubGlobal("prompt", vi.fn(() => "fraud"))
  vi.stubGlobal("confirm", vi.fn(() => true))
})

describe("AdminJobs", () => {
  it("splits jobs into Active and Removed tabs", () => {
    renderPage()
    expect(screen.getByRole("tab", { name: /active \(1\)/i })).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: /removed \(1\)/i })).toBeInTheDocument()
    expect(screen.getByText("Logo design")).toBeInTheDocument()
  })

  it("filters by search term across title and agency name", async () => {
    const user = userEvent.setup()
    renderPage()
    await user.type(screen.getByPlaceholderText(/search title or agency/i), "Acme")
    expect(screen.getByText("Logo design")).toBeInTheDocument()
  })

  it("removes a job with a prompted reason", async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByRole("button", { name: /remove/i }))
    expect(window.prompt).toHaveBeenCalled()
    expect(moderateMutate).toHaveBeenCalledWith({ jobId: "j-1", action: "remove", reason: "fraud" }, expect.anything())
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd client && npx vitest run src/pages/admin/Jobs.test.tsx`
Expected: FAIL — `Cannot find module './Jobs'`

- [ ] **Step 3: Implement the page**

```tsx
// client/src/pages/admin/Jobs.tsx
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import AdminSidebar from "@/components/AdminSidebar"
import { Ban, RotateCcw } from "lucide-react"
import { useAdminJobsQuery, useModerateJobMutation, type AdminJobRow } from "@/lib/queries/admin"

const fmtDate = (d?: string) => (d ? new Date(d).toLocaleDateString() : "—")
const fmtNaira = (n: number | null) => `₦${Number(n || 0).toLocaleString()}`

export default function AdminJobs() {
  const jobsQuery = useAdminJobsQuery()
  const moderate = useModerateJobMutation()
  const [search, setSearch] = useState("")
  const [busyId, setBusyId] = useState<string | null>(null)

  const jobs = jobsQuery.data?.jobs ?? []

  const handleModerate = (job: AdminJobRow, action: "remove" | "restore") => {
    let reason: string | null = null
    if (action === "remove") {
      reason = prompt("Reason for removing this job (optional):") || null
    } else if (!confirm("Restore this job to the marketplace?")) {
      return
    }
    setBusyId(job.id)
    moderate.mutate({ jobId: job.id, action, reason }, { onSettled: () => setBusyId(null) })
  }

  const matches = (j: AdminJobRow) =>
    !search.trim() || j.title.toLowerCase().includes(search.toLowerCase()) || j.agency_name.toLowerCase().includes(search.toLowerCase())

  const visible = jobs.filter((j) => j.moderation_status !== "removed" && matches(j))
  const removed = jobs.filter((j) => j.moderation_status === "removed" && matches(j))

  function JobTable({ rows, removedView }: { rows: AdminJobRow[]; removedView: boolean }) {
    return (
      <div className="rounded-xl border border-border bg-card overflow-x-auto">
        {rows.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">No jobs.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Agency</TableHead>
                <TableHead>Budget</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Posted</TableHead>
                {removedView && <TableHead>Reason</TableHead>}
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((j) => (
                <TableRow key={j.id}>
                  <TableCell className="font-medium text-foreground max-w-xs truncate">{j.title}</TableCell>
                  <TableCell className="text-muted-foreground">{j.agency_name}</TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground tabular-nums">
                    {fmtNaira(j.budget_min)} – {fmtNaira(j.budget_max)}
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-surface-2 text-muted-foreground capitalize">{j.status}</span>
                  </TableCell>
                  <TableCell className="text-muted-foreground tabular-nums">{fmtDate(j.created_at)}</TableCell>
                  {removedView && (
                    <TableCell className="text-xs text-muted-foreground max-w-[12rem] truncate">{j.moderation_reason || "—"}</TableCell>
                  )}
                  <TableCell className="text-right">
                    {removedView ? (
                      <Button size="sm" variant="outline" disabled={busyId === j.id} onClick={() => handleModerate(j, "restore")}>
                        <RotateCcw className="h-4 w-4 mr-1" /> Restore
                      </Button>
                    ) : (
                      <Button size="sm" variant="destructive" disabled={busyId === j.id} onClick={() => handleModerate(j, "remove")}>
                        <Ban className="h-4 w-4 mr-1" /> Remove
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    )
  }

  if (jobsQuery.isLoading) {
    return (
      <div className="flex h-screen bg-surface">
        <AdminSidebar />
        <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">Loading jobs…</div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-surface">
      <AdminSidebar />
      <div className="flex-1 overflow-auto">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-3">
            <header className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Admin</p>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">Job moderation</h1>
              <p className="text-sm text-muted-foreground">Remove fraudulent or policy-violating job postings from the marketplace.</p>
            </header>
            <Input placeholder="Search title or agency…" value={search} onChange={(e) => setSearch(e.target.value)} className="md:max-w-xs" />
          </div>

          <Tabs defaultValue="active" className="w-full">
            <TabsList className="grid w-full grid-cols-2 sm:max-w-xs">
              <TabsTrigger value="active">Active ({visible.length})</TabsTrigger>
              <TabsTrigger value="removed">Removed ({removed.length})</TabsTrigger>
            </TabsList>
            <TabsContent value="active" className="mt-4">
              <JobTable rows={visible} removedView={false} />
            </TabsContent>
            <TabsContent value="removed" className="mt-4">
              <JobTable rows={removed} removedView />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd client && npx vitest run src/pages/admin/Jobs.test.tsx`
Expected: PASS

- [ ] **Step 5: Run tsc**

Run: `cd client && npx tsc --noEmit`
Expected: clean.

- [ ] **Step 6: Self-check then commit**

Confirm via `git show --stat` that your commit touches only `client/src/pages/admin/Jobs.tsx` and `client/src/pages/admin/Jobs.test.tsx`.

```bash
git add client/src/pages/admin/Jobs.tsx client/src/pages/admin/Jobs.test.tsx
git commit -m "Port admin job moderation page to client"
```

---

## Task 5: `AdminAuditLog` page

**Files:**
- Create: `client/src/pages/admin/AuditLog.tsx`
- Test: `client/src/pages/admin/AuditLog.test.tsx`

**Interfaces:**
- Consumes: `useAdminAuditQuery`, `type AdminAuditEntry` (`@/lib/queries/admin`); `AdminSidebar`; `Table` family (Task 1); `Input`.
- Produces: default export `AdminAuditLog`. Consumed by Task 6's route wiring.

- [ ] **Step 1: Write the failing tests**

```tsx
// client/src/pages/admin/AuditLog.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"

const useAdminAuditQueryMock = vi.fn()
vi.mock("../../lib/queries/admin", () => ({ useAdminAuditQuery: () => useAdminAuditQueryMock() }))

import AdminAuditLog from "./AuditLog"

const entry = {
  id: "log-1",
  action: "user.disable",
  target_type: "user",
  target_id: "u-2",
  details: { note: "spam" },
  created_at: "2026-01-01T00:00:00Z",
  admin: { full_name: "Admin One", email: "admin1@bizimi.com" },
}

function renderPage() {
  return render(<MemoryRouter><AdminAuditLog /></MemoryRouter>)
}

beforeEach(() => {
  vi.clearAllMocks()
  useAdminAuditQueryMock.mockReturnValue({ isLoading: false, data: { logs: [entry] } })
})

describe("AdminAuditLog", () => {
  it("shows an empty state when there are no entries", () => {
    useAdminAuditQueryMock.mockReturnValue({ isLoading: false, data: { logs: [] } })
    renderPage()
    expect(screen.getByText(/no audit entries yet/i)).toBeInTheDocument()
  })

  it("lists entries with the acting admin's name", () => {
    renderPage()
    expect(screen.getByText("Admin One")).toBeInTheDocument()
    expect(screen.getByText("user.disable")).toBeInTheDocument()
  })

  it("filters by search term across action, admin, and target", async () => {
    const user = userEvent.setup()
    renderPage()
    await user.type(screen.getByPlaceholderText(/search action, admin, target/i), "nonexistent")
    expect(screen.queryByText("Admin One")).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd client && npx vitest run src/pages/admin/AuditLog.test.tsx`
Expected: FAIL — `Cannot find module './AuditLog'`

- [ ] **Step 3: Implement the page**

```tsx
// client/src/pages/admin/AuditLog.tsx
import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import AdminSidebar from "@/components/AdminSidebar"
import { useAdminAuditQuery, type AdminAuditEntry } from "@/lib/queries/admin"

const fmtDateTime = (d?: string) => (d ? new Date(d).toLocaleString() : "—")

function actionBadge(action: string) {
  const danger = action.includes("disable") || action.includes("refund")
  const cls = danger
    ? "bg-destructive/10 text-destructive"
    : action.includes("resolve")
      ? "bg-info/10 text-info"
      : "bg-surface-2 text-muted-foreground"
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full font-mono text-[11px] font-medium ${cls}`}>{action}</span>
}

export default function AdminAuditLog() {
  const auditQuery = useAdminAuditQuery()
  const [search, setSearch] = useState("")

  const allLogs = auditQuery.data?.logs ?? []
  const logs = allLogs.filter((l: AdminAuditEntry) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      l.action.toLowerCase().includes(q) ||
      (l.target_id || "").toLowerCase().includes(q) ||
      (l.target_type || "").toLowerCase().includes(q) ||
      (l.admin?.full_name || "").toLowerCase().includes(q) ||
      (l.admin?.email || "").toLowerCase().includes(q)
    )
  })

  if (auditQuery.isLoading) {
    return (
      <div className="flex h-screen bg-surface">
        <AdminSidebar />
        <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">Loading audit log…</div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-surface">
      <AdminSidebar />
      <div className="flex-1 overflow-auto">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-3">
            <header className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Admin</p>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">Audit log</h1>
              <p className="text-sm text-muted-foreground">A record of consequential admin actions (money movement, account changes).</p>
            </header>
            <Input placeholder="Search action, admin, target…" value={search} onChange={(e) => setSearch(e.target.value)} className="md:max-w-xs" />
          </div>

          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <h2 className="text-base font-semibold text-foreground">Recent actions ({logs.length})</h2>
            </div>
            <div className="overflow-x-auto">
              {logs.length === 0 ? (
                <div className="p-12 text-center text-sm text-muted-foreground">
                  No audit entries yet. Admin actions (dispute resolutions, user disable/enable) will appear here.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>When</TableHead>
                      <TableHead>Admin</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Target</TableHead>
                      <TableHead>Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((l: AdminAuditEntry) => (
                      <TableRow key={l.id}>
                        <TableCell className="whitespace-nowrap text-sm text-muted-foreground tabular-nums">{fmtDateTime(l.created_at)}</TableCell>
                        <TableCell className="text-sm text-foreground">{l.admin?.full_name || l.admin?.email || "—"}</TableCell>
                        <TableCell>{actionBadge(l.action)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {l.target_type ? (
                            <span>
                              {l.target_type}
                              {l.target_id && <span className="block font-mono text-[11px] text-muted-foreground/70">{l.target_id}</span>}
                            </span>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-xs">
                          {l.details ? <pre className="whitespace-pre-wrap break-words font-mono">{JSON.stringify(l.details)}</pre> : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd client && npx vitest run src/pages/admin/AuditLog.test.tsx`
Expected: PASS

- [ ] **Step 5: Run tsc**

Run: `cd client && npx tsc --noEmit`
Expected: clean.

- [ ] **Step 6: Self-check then commit**

Confirm via `git show --stat` that your commit touches only `client/src/pages/admin/AuditLog.tsx` and `client/src/pages/admin/AuditLog.test.tsx`.

```bash
git add client/src/pages/admin/AuditLog.tsx client/src/pages/admin/AuditLog.test.tsx
git commit -m "Port admin audit log page to client"
```

---

## Task 6: Wire `/admin/jobs` and `/admin/audit` into `App.tsx`

**Files:**
- Modify: `client/src/App.tsx`
- Test: `client/src/App.test.tsx` (extend)

**Interfaces:** none new — wires Task 4's and Task 5's pages in, both `RequireAuth`-wrapped.

- [ ] **Step 1: Write the failing tests**

Add to `client/src/App.test.tsx`:

```tsx
describe("admin jobs and audit routes", () => {
  it("redirects /admin/jobs to /login when signed out", async () => {
    renderAt("/admin/jobs")
    await screen.findByRole("heading", { name: /Continue your work/i })
  })

  it("redirects /admin/audit to /login when signed out", async () => {
    renderAt("/admin/audit")
    await screen.findByRole("heading", { name: /Continue your work/i })
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd client && npx vitest run src/App.test.tsx -t "admin jobs and audit routes"`
Expected: FAIL — neither route is registered yet.

- [ ] **Step 3: Update `client/src/App.tsx`**

Read the current file first. Add the imports:

```tsx
import AdminJobs from "./pages/admin/Jobs"
import AdminAuditLog from "./pages/admin/AuditLog"
```

Add both routes, `RequireAuth`-wrapped, after `/admin/users` and before the catch-all:

```tsx
            <Route
              path="/admin/jobs"
              element={
                <RequireAuth>
                  <AdminJobs />
                </RequireAuth>
              }
            />
            <Route
              path="/admin/audit"
              element={
                <RequireAuth>
                  <AdminAuditLog />
                </RequireAuth>
              }
            />
```

- [ ] **Step 4: Update `App.test.tsx`'s `renderAt` helper**

Add the same imports and routes to the helper's local `<Routes>` table.

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
git commit -m "Wire /admin/jobs and /admin/audit routes behind RequireAuth"
```

---

## Post-Phase-5c note

This plan completes the third slice of Phase 5. Next: Phase 5d (credits oversight + influencer program admin), Phase 5e (influencer self-service portal). `/admin/disputes`, `/admin/transactions`, `/disputes/[id]` remain blocked behind the Supabase-side escrow v2 migration.
