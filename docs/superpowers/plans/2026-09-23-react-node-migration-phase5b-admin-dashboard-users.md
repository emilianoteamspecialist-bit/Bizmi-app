# Phase 5b: Admin dashboard + user management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the first two usable admin pages — `/admin/dashboard` (platform overview + stat tiles) and `/admin/users` (full user CRM with functional disable/enable) — plus the first admin *write* path in this migration, `POST /api/admin/users/:id/disable`, backed by the Supabase Admin Auth API and an audit-log helper.

**Architecture:** Same conventions as Phase 5a: Express routes behind `requireAuth` + `requireAdmin`, TanStack Query hooks via `apiFetch`, React pages using the already-ported `Tabs`/`AdminSidebar`/`useAdminUsersQuery` from Phase 5a (merged, `main` at `99885da`). The disable route uses the service-role client (`createServiceClient`, `server/src/lib/supabase.ts`) — this is the correct boundary per `CLAUDE.md` ("service-role client... for admin server routes that must act on behalf of the system") since it calls `auth.admin.updateUserById`, a privileged Auth Admin API method no user-scoped client can call.

**Tech Stack:** React 19, Vite, TanStack Query, React Router, Express, Supabase (`auth.admin.updateUserById` for ban/unban).

**Spec:** `docs/superpowers/specs/2026-09-08-nextjs-to-react-node-migration-design.md` (Phase 5 row). Continues Phase 5a — see `docs/superpowers/plans/2026-09-23-react-node-migration-phase5a-admin-foundation.md` for the primitives/route this plan builds on.

## Global Constraints

- Admin authorization check is `profile.role === "admin" || profile.account_type === "admin"` — never just one field (`CLAUDE.md`). Phase 5a's final review caught a real bug where this was missed in one file despite being stated as a Global Constraint there too — **every task below that adds an admin-identity check must use this exact OR expression**, and the self-review pass on this plan must specifically re-grep every task's code sample for any single-field admin check before this plan is executed.
- `AdminDashboard` and `AdminUsers` both use the plain `<div className="flex h-screen bg-surface"><AdminSidebar />...` layout (no `SidebarProvider`/`SidebarInset`) — the Phase 5a-established simplification. Both use `Tabs`/`TabsList`/`TabsTrigger`/`TabsContent` from `@/components/ui/tabs` and `AdminSidebar` from `@/components/AdminSidebar`, both already merged.
- **Deliberate simplification vs. legacy:** the legacy `AdminDashboardClient`/`UsersClient` each independently merge and re-sort `agencies`/`freelancers` arrays client-side (`[...agencies, ...freelancers].sort((a,b) => ...)`) because their Next.js `page.tsx` wrappers fetched agencies and freelancers as two separate arrays. This migration's `GET /api/admin/users` (Phase 5a) already returns ALL users pre-sorted by `created_at` descending in one array — client-side `.filter()` preserves relative order, so no client-side sort is needed. Both pages below derive `agencies`/`freelancers` via a plain `.filter()` on the already-sorted `users` array. Do not re-add a client-side sort; it would be redundant dead code.
- The legacy `AdminDashboardClient`'s "Disable user" action is a **non-functional stub** (`console.log("Disabling user:", userId)`, comment: "Add actual disable functionality later") — port it as a stub. Do NOT wire the dashboard's own dropdown item to `useDisableUserMutation`; that's `AdminUsers`' job (which has the real, functional version in legacy). This is intentional legacy behavior to preserve, not an oversight to fix.
- Legacy `UsersClient`'s "View details" links point to `/admin/users/[id]`, a per-user detail page **not built by this plan or anywhere in the current Phase 5 roadmap** (memory: `react-node-migration-status.md` doesn't list it as a planned sub-plan). Port the link as-is (`<Link to={\`/admin/users/${user.id}\`}>`) — it will 404 to the catch-all until a future plan builds that page, matching the same "link to a not-yet-built route" convention already established for `AdminSidebar`'s own nav links in Phase 5a. Do not build the detail page in this plan.
- `window.confirm`/`window.alert` are used directly for the disable/enable confirmation and result messaging, matching legacy exactly (low-stakes admin-only interaction, not worth a custom dialog component for this phase).
- This plan's Task 1 is the first admin **write** path in this migration (account suspension via the Supabase Admin Auth API) — brief its task reviewer AND the final whole-branch reviewer to treat it with the same scrutiny as Phase 3a's financial write paths: confirm an admin cannot disable themselves, cannot disable another admin, and that the audit log write happens (best-effort, must never block the actual disable on a logging failure — matching `logAdminAction`'s own try/catch-and-log-only contract).

---

## Task 1: `server/src/lib/adminAudit.ts` + `POST /api/admin/users/:id/disable`

**Files:**
- Create: `server/src/lib/adminAudit.ts`
- Test: `server/src/lib/adminAudit.test.ts`
- Modify: `server/src/routes/admin.ts`
- Modify: `server/src/routes/admin.test.ts`

**Interfaces:**
- Produces: `logAdminAction(service: SupabaseClient, entry: {adminId: string, action: string, targetType?: string, targetId?: string, details?: Record<string, unknown>}): Promise<void>` — a best-effort audit write, never throws. Will be reused by Phase 5c (job moderation) and Phase 5d (influencer payouts, settings) — do not let those future plans redefine it.
- Produces: `POST /api/admin/users/:id/disable` — request body `{ disabled: boolean }`; response `{ success: true, disabled: boolean }` on success, `{ error: string }` at 400/403/404/500.

- [ ] **Step 1: Write the failing tests for `adminAudit.ts`**

```ts
// server/src/lib/adminAudit.test.ts
import { describe, it, expect, vi } from "vitest"
import { logAdminAction } from "./adminAudit.js"

describe("logAdminAction", () => {
  it("inserts a row into admin_audit_log with the given fields", async () => {
    const insertMock = vi.fn().mockResolvedValue({ error: null })
    const service = { from: vi.fn(() => ({ insert: insertMock })) } as any

    await logAdminAction(service, {
      adminId: "admin-1",
      action: "user.disable",
      targetType: "user",
      targetId: "u-2",
      details: { reason: "spam" },
    })

    expect(service.from).toHaveBeenCalledWith("admin_audit_log")
    expect(insertMock).toHaveBeenCalledWith({
      admin_id: "admin-1",
      action: "user.disable",
      target_type: "user",
      target_id: "u-2",
      details: { reason: "spam" },
    })
  })

  it("defaults optional fields to null and never throws when the insert reports an error", async () => {
    const service = { from: vi.fn(() => ({ insert: vi.fn().mockResolvedValue({ error: { message: "boom" } }) })) } as any
    await expect(logAdminAction(service, { adminId: "admin-1", action: "user.disable" })).resolves.toBeUndefined()
    expect(service.from).toHaveBeenCalledWith("admin_audit_log")
  })

  it("never throws when the insert call itself rejects", async () => {
    const service = { from: vi.fn(() => ({ insert: vi.fn().mockRejectedValue(new Error("network")) })) } as any
    await expect(logAdminAction(service, { adminId: "admin-1", action: "user.disable" })).resolves.toBeUndefined()
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd server && npx vitest run src/lib/adminAudit.test.ts`
Expected: FAIL — `Cannot find module './adminAudit.js'`

- [ ] **Step 3: Implement `adminAudit.ts`**

```ts
// server/src/lib/adminAudit.ts
import type { SupabaseClient } from "@supabase/supabase-js"

// Best-effort admin audit logging. Never throws -- an audit failure must not
// break the underlying admin action.
export async function logAdminAction(
  service: SupabaseClient,
  entry: {
    adminId: string
    action: string
    targetType?: string
    targetId?: string
    details?: Record<string, unknown>
  }
): Promise<void> {
  try {
    const { error } = await service.from("admin_audit_log").insert({
      admin_id: entry.adminId,
      action: entry.action,
      target_type: entry.targetType ?? null,
      target_id: entry.targetId ?? null,
      details: entry.details ?? null,
    })
    if (error) {
      console.error("admin audit log insert failed", { action: entry.action, error: error.message })
    }
  } catch (err) {
    console.error("admin audit log unexpected error", { action: entry.action, err })
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd server && npx vitest run src/lib/adminAudit.test.ts`
Expected: PASS

- [ ] **Step 5: Write the failing tests for the disable route**

Add to `server/src/routes/admin.test.ts`, near the top (before the existing `describe("GET /users", ...)` block), a hoisted mock for the service-role client — the existing tests in this file don't need it (they use `req.supabase` directly, not `createServiceClient()`), so this mock has zero effect on them:

```ts
// Add near the top of server/src/routes/admin.test.ts, alongside the existing imports
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
```

Then add this new `describe` block anywhere after the existing ones in the same file:

```ts
describe("POST /users/:id/disable", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    auditInsertMock.mockResolvedValue({ error: null })
  })

  it("disables a non-admin user via the Supabase Admin Auth API and logs the action", async () => {
    maybeSingleMock.mockResolvedValue({ data: { role: "freelancer", account_type: "freelancer" }, error: null })
    updateUserByIdMock.mockResolvedValue({ error: null })

    const res = await request(appWith({})).post("/users/u-2/disable").send({ disabled: true })

    expect(updateUserByIdMock).toHaveBeenCalledWith("u-2", { ban_duration: "876000h" })
    expect(auditInsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ admin_id: "admin-1", action: "user.disable", target_id: "u-2" })
    )
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ success: true, disabled: true })
  })

  it("re-enables a user with ban_duration 'none' and logs 'user.enable'", async () => {
    maybeSingleMock.mockResolvedValue({ data: { role: "freelancer", account_type: "freelancer" }, error: null })
    updateUserByIdMock.mockResolvedValue({ error: null })

    const res = await request(appWith({})).post("/users/u-2/disable").send({ disabled: false })

    expect(updateUserByIdMock).toHaveBeenCalledWith("u-2", { ban_duration: "none" })
    expect(auditInsertMock).toHaveBeenCalledWith(expect.objectContaining({ action: "user.enable" }))
    expect(res.body).toEqual({ success: true, disabled: false })
  })

  it("returns 400 when disabled is not a boolean", async () => {
    const res = await request(appWith({})).post("/users/u-2/disable").send({ disabled: "yes" })
    expect(res.status).toBe(400)
    expect(updateUserByIdMock).not.toHaveBeenCalled()
  })

  it("returns 400 when an admin tries to disable their own account", async () => {
    const res = await request(appWith({})).post("/users/admin-1/disable").send({ disabled: true })
    expect(res.status).toBe(400)
    expect(updateUserByIdMock).not.toHaveBeenCalled()
  })

  it("returns 404 when the target user doesn't exist", async () => {
    maybeSingleMock.mockResolvedValue({ data: null, error: null })
    const res = await request(appWith({})).post("/users/u-404/disable").send({ disabled: true })
    expect(res.status).toBe(404)
    expect(updateUserByIdMock).not.toHaveBeenCalled()
  })

  it("returns 403 when the target is also an admin via account_type", async () => {
    maybeSingleMock.mockResolvedValue({ data: { role: "freelancer", account_type: "admin" }, error: null })
    const res = await request(appWith({})).post("/users/admin-2/disable").send({ disabled: true })
    expect(res.status).toBe(403)
    expect(updateUserByIdMock).not.toHaveBeenCalled()
  })

  it("returns 403 when the target is also an admin via role (not account_type) — this codebase uses both fields inconsistently, see CLAUDE.md", async () => {
    maybeSingleMock.mockResolvedValue({ data: { role: "admin", account_type: "freelancer" }, error: null })
    const res = await request(appWith({})).post("/users/admin-2/disable").send({ disabled: true })
    expect(res.status).toBe(403)
    expect(updateUserByIdMock).not.toHaveBeenCalled()
  })

  it("returns 500 when the Supabase Admin Auth API call fails", async () => {
    maybeSingleMock.mockResolvedValue({ data: { account_type: "freelancer" }, error: null })
    updateUserByIdMock.mockResolvedValue({ error: { message: "boom" } })
    const res = await request(appWith({})).post("/users/u-2/disable").send({ disabled: true })
    expect(res.status).toBe(500)
  })
})
```

Note: `appWith` and `request`/`express` imports already exist at the top of `server/src/routes/admin.test.ts` from Phase 5a's Task 3 — `appWith(supabase)` hardcodes `req.user = { id: "admin-1" }`, which is why the "disable own account" test targets `/users/admin-1/disable`. The `supabase` argument passed to `appWith({})` is irrelevant for these new tests since this route calls `createServiceClient()` (mocked above), not `req.supabase`.

- [ ] **Step 6: Run the tests to verify they fail**

Run: `cd server && npx vitest run src/routes/admin.test.ts -t "disable"`
Expected: FAIL — route doesn't exist yet.

- [ ] **Step 7: Implement the route**

Add to `server/src/routes/admin.ts`. First, update the import line at the top:

```ts
import { createServiceClient } from "../lib/supabase.js"
import { logAdminAction } from "../lib/adminAudit.js"
```

Then add the route (after the existing `GET /users` route):

```ts
adminRouter.post(
  "/users/:id/disable",
  asyncHandler(async (req, res) => {
    const targetUserId = req.params.id
    const { disabled } = req.body ?? {}

    if (typeof disabled !== "boolean") {
      res.status(400).json({ error: "Body must include { disabled: boolean }" })
      return
    }

    if (targetUserId === req.user!.id) {
      res.status(400).json({ error: "You cannot disable your own account" })
      return
    }

    const service = createServiceClient()

    const { data: targetProfile } = await service
      .from("profiles")
      .select("role, account_type")
      .eq("id", targetUserId)
      .maybeSingle()

    if (!targetProfile) {
      res.status(404).json({ error: "User not found" })
      return
    }
    if (targetProfile.role === "admin" || targetProfile.account_type === "admin") {
      res.status(403).json({ error: "Cannot disable an admin account" })
      return
    }

    const { error } = await service.auth.admin.updateUserById(targetUserId, {
      ban_duration: disabled ? "876000h" : "none",
    })

    if (error) {
      console.error("Failed to update user ban state:", error)
      res.status(500).json({ error: error.message })
      return
    }

    await logAdminAction(service, {
      adminId: req.user!.id,
      action: disabled ? "user.disable" : "user.enable",
      targetType: "user",
      targetId: targetUserId,
    })

    res.json({ success: true, disabled })
  })
)
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `cd server && npx vitest run src/routes/admin.test.ts`
Expected: PASS (all tests in the file, old and new)

- [ ] **Step 9: Run the full server test suite**

Run: `cd server && npx vitest run`
Expected: PASS

- [ ] **Step 10: Run tsc**

Run: `cd server && npx tsc --noEmit`
Expected: only the known pre-existing `src/routes/user.test.ts(230,52)` error — nothing else.

- [ ] **Step 11: Self-check before committing**

Run `git show --stat` on your own commit immediately after committing (Step 12) and confirm the file list matches exactly what this task touches (`server/src/lib/adminAudit.ts`, `server/src/lib/adminAudit.test.ts`, `server/src/routes/admin.ts`, `server/src/routes/admin.test.ts`) — no more, no fewer. Other subagents may be committing concurrently in this same shared worktree on disjoint client-side files; if your commit shows extra files or your own `git commit` reports "nothing to commit" after you believed you had staged changes, STOP and investigate via `git log`/`git status` before doing anything destructive — recover via `git reset --soft HEAD~1` + selective `git restore --staged` on the files that aren't yours, never `git reset --hard`.

- [ ] **Step 12: Commit**

```bash
git add server/src/lib/adminAudit.ts server/src/lib/adminAudit.test.ts server/src/routes/admin.ts server/src/routes/admin.test.ts
git commit -m "feat(server): add POST /api/admin/users/:id/disable and admin audit logging"
```

---

## Task 2: Client `useDisableUserMutation` hook

**Files:**
- Modify: `client/src/lib/queries/admin.ts`
- Modify: `client/src/lib/queries/admin.test.tsx`

**Interfaces:**
- Consumes: `apiFetch` (existing).
- Produces: `useDisableUserMutation()` — `mutate({userId: string, disabled: boolean})`, invalidates `["admin", "users"]` on success. Consumed by Task 4 (`AdminUsers` page).

- [ ] **Step 1: Write the failing test**

Add to `client/src/lib/queries/admin.test.tsx` (this file already has a `wrapper` helper and `apiFetchMock` from Phase 5a — reuse them):

```tsx
describe("useDisableUserMutation", () => {
  it("POSTs /api/admin/users/:id/disable and invalidates the admin users list", async () => {
    apiFetchMock.mockResolvedValue({ success: true, disabled: true })
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const invalidateSpy = vi.spyOn(client, "invalidateQueries")
    const { useDisableUserMutation } = await import("./admin")

    const { result } = renderHook(() => useDisableUserMutation(), {
      wrapper: ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>,
    })
    result.current.mutate({ userId: "u-2", disabled: true })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(apiFetchMock).toHaveBeenCalledWith("/api/admin/users/u-2/disable", {
      method: "POST",
      body: JSON.stringify({ disabled: true }),
    })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["admin", "users"] })
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd client && npx vitest run src/lib/queries/admin.test.tsx -t "useDisableUserMutation"`
Expected: FAIL — `useDisableUserMutation` doesn't exist yet.

- [ ] **Step 3: Implement the hook**

Update the top of `client/src/lib/queries/admin.ts`'s import line:

```ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
```

Add the hook at the end of the file:

```ts
export function useDisableUserMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ userId, disabled }: { userId: string; disabled: boolean }) =>
      apiFetch<{ success: boolean; disabled: boolean }>(`/api/admin/users/${userId}/disable`, {
        method: "POST",
        body: JSON.stringify({ disabled }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] })
    },
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

Confirm via `git show --stat` that your commit touches only `client/src/lib/queries/admin.ts` and `client/src/lib/queries/admin.test.tsx` (see Task 1 Step 11's note on the shared-worktree git race risk).

```bash
git add client/src/lib/queries/admin.ts client/src/lib/queries/admin.test.tsx
git commit -m "feat(client): add useDisableUserMutation hook"
```

---

## Task 3: `AdminDashboard` page

**Files:**
- Create: `client/src/pages/admin/Dashboard.tsx`
- Test: `client/src/pages/admin/Dashboard.test.tsx`

**Interfaces:**
- Consumes: `useAdminUsersQuery`, `type AdminUser` (`@/lib/queries/admin`, already merged in Phase 5a); `AdminSidebar` (`@/components/AdminSidebar`, already merged); `Tabs`/`TabsList`/`TabsTrigger`/`TabsContent` (`@/components/ui/tabs`, already merged); `DropdownMenu` family (`@/components/ui/dropdown-menu`, already merged from an earlier phase); `Button`, `Input` (already ported).
- Produces: default export `AdminDashboard`. Consumed by Task 5's route wiring.

- [ ] **Step 1: Write the failing tests**

```tsx
// client/src/pages/admin/Dashboard.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"

const useAdminUsersQueryMock = vi.fn()
vi.mock("../../lib/queries/admin", () => ({ useAdminUsersQuery: () => useAdminUsersQueryMock() }))

const signOutMock = vi.fn()
vi.mock("../../contexts/AuthContext", () => ({ useAuth: () => ({ signOut: signOutMock }) }))

import AdminDashboard from "./Dashboard"

const agency = { id: "a-1", email: "a@x.com", full_name: "Acme Agency", account_type: "agency", created_at: "2026-01-01T00:00:00Z", wallet_balance: 5000 }
const freelancer = { id: "f-1", email: "f@x.com", full_name: "Jane Freelancer", account_type: "freelancer", created_at: "2026-01-02T00:00:00Z", wallet_balance: null }

function renderPage() {
  return render(<MemoryRouter><AdminDashboard /></MemoryRouter>)
}

beforeEach(() => {
  vi.clearAllMocks()
  useAdminUsersQueryMock.mockReturnValue({ isLoading: false, data: { users: [agency, freelancer] } })
})

describe("AdminDashboard", () => {
  it("shows a loading state while users are pending", () => {
    useAdminUsersQueryMock.mockReturnValue({ isLoading: true, data: undefined })
    renderPage()
    expect(screen.getByText(/loading dashboard/i)).toBeInTheDocument()
  })

  it("shows stat tiles derived from the users list", () => {
    renderPage()
    expect(within(screen.getByTestId("stat-total-users")).getByText("2")).toBeInTheDocument()
    expect(within(screen.getByTestId("stat-agencies")).getByText("1")).toBeInTheDocument()
    expect(within(screen.getByTestId("stat-freelancers")).getByText("1")).toBeInTheDocument()
  })

  it("lists all users in the All tab", () => {
    renderPage()
    expect(screen.getByText("Acme Agency")).toBeInTheDocument()
    expect(screen.getByText("Jane Freelancer")).toBeInTheDocument()
  })

  it("filters the All tab by search term", async () => {
    const user = userEvent.setup()
    renderPage()
    await user.type(screen.getByPlaceholderText(/search all users/i), "Jane")
    expect(screen.queryByText("Acme Agency")).not.toBeInTheDocument()
    expect(screen.getByText("Jane Freelancer")).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd client && npx vitest run src/pages/admin/Dashboard.test.tsx`
Expected: FAIL — `Cannot find module './Dashboard'`

- [ ] **Step 3: Implement the page**

```tsx
// client/src/pages/admin/Dashboard.tsx
import { useState } from "react"
import { Users, Briefcase, UserPlus, Shield, MoreVertical } from "lucide-react"
import AdminSidebar from "@/components/AdminSidebar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useAdminUsersQuery, type AdminUser } from "@/lib/queries/admin"

export default function AdminDashboard() {
  const usersQuery = useAdminUsersQuery()
  const [allSearchQuery, setAllSearchQuery] = useState("")
  const [agencySearchQuery, setAgencySearchQuery] = useState("")
  const [freelancerSearchQuery, setFreelancerSearchQuery] = useState("")

  const users = usersQuery.data?.users ?? []
  const agencies = users.filter((u) => u.account_type === "agency")
  const freelancers = users.filter((u) => u.account_type === "freelancer")

  const todayString = new Date().toISOString().split("T")[0]
  const newUsersToday = users.filter((u) => u.created_at && new Date(u.created_at).toISOString().split("T")[0] === todayString).length

  const tiles = [
    { label: "Total users", testId: "stat-total-users", value: users.length, icon: Users, tile: "bg-primary/10 text-primary" },
    { label: "New today", testId: "stat-new-today", value: newUsersToday, icon: UserPlus, tile: "bg-jade/10 text-jade" },
    { label: "Agencies", testId: "stat-agencies", value: agencies.length, icon: Briefcase, tile: "bg-info/10 text-info" },
    { label: "Freelancers", testId: "stat-freelancers", value: freelancers.length, icon: Users, tile: "bg-aubergine/10 text-aubergine" },
  ]

  // Legacy stub -- disabling a user from the dashboard is not yet wired to a
  // real mutation there (AdminUsers has the functional version). Preserve as-is.
  const handleDisableUser = (userId: string) => {
    console.log("Disabling user:", userId)
  }

  const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString()

  function UserTable({ users, type, searchQuery }: { users: AdminUser[]; type: string; searchQuery: string }) {
    const filtered = users.filter(
      (user) =>
        user.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.email?.toLowerCase().includes(searchQuery.toLowerCase())
    )

    if (filtered.length === 0) {
      return <div className="rounded-xl border border-border bg-card py-12 text-center text-sm text-muted-foreground">No {type === "all" ? "users" : `${type}s`} found</div>
    }

    return (
      <div className="rounded-xl border border-border bg-card divide-y divide-border overflow-hidden">
        {filtered.map((user) => (
          <div key={user.id} className="flex items-center justify-between gap-3 p-4 transition-colors hover:bg-surface/60">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-9 w-9 shrink-0 rounded-full bg-surface-2 flex items-center justify-center text-sm font-semibold text-foreground">
                {(user.full_name || user.email || "?").charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-medium text-foreground truncate">{user.full_name || "No name"}</h3>
                  <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-primary-soft text-primary capitalize">
                    {user.account_type}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground tabular-nums">
                  Joined {formatDate(user.created_at)}
                  {user.account_type === "agency" && user.wallet_balance != null && ` · Wallet ₦${user.wallet_balance.toLocaleString()}`}
                </p>
              </div>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => handleDisableUser(user.id)}
                  className="text-destructive focus:text-destructive focus:bg-destructive/10"
                >
                  Disable user
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ))}
      </div>
    )
  }

  if (usersQuery.isLoading) {
    return (
      <div className="flex h-screen bg-surface">
        <AdminSidebar />
        <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">Loading dashboard…</div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-surface">
      <AdminSidebar />
      <div className="flex-1 overflow-auto">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
          <header className="space-y-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-foreground">
              <Shield className="h-3.5 w-3.5 text-primary" /> Admin console
            </span>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">Dashboard</h1>
              <p className="text-sm text-muted-foreground">Overview of platform activity.</p>
            </div>
          </header>

          <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {tiles.map((t) => (
              <div key={t.label} data-testid={t.testId} className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-muted-foreground">{t.label}</p>
                  <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${t.tile}`}>
                    <t.icon className="h-4 w-4" />
                  </div>
                </div>
                <p className="mt-3 text-3xl font-semibold tracking-tight text-foreground tabular-nums">{t.value}</p>
              </div>
            ))}
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-foreground">User management</h2>
            <Tabs defaultValue="all" className="w-full">
              <TabsList className="grid w-full grid-cols-3 sm:max-w-lg">
                <TabsTrigger value="all">All ({users.length})</TabsTrigger>
                <TabsTrigger value="agencies">Agencies ({agencies.length})</TabsTrigger>
                <TabsTrigger value="freelancers">Freelancers ({freelancers.length})</TabsTrigger>
              </TabsList>

              <TabsContent value="all" className="mt-4 space-y-3">
                <Input
                  placeholder="Search all users by name or email…"
                  value={allSearchQuery}
                  onChange={(e) => setAllSearchQuery(e.target.value)}
                  className="sm:max-w-sm"
                />
                <UserTable users={users} type="all" searchQuery={allSearchQuery} />
              </TabsContent>

              <TabsContent value="agencies" className="mt-4 space-y-3">
                <Input
                  placeholder="Search agencies by name or email…"
                  value={agencySearchQuery}
                  onChange={(e) => setAgencySearchQuery(e.target.value)}
                  className="sm:max-w-sm"
                />
                <UserTable users={agencies} type="agency" searchQuery={agencySearchQuery} />
              </TabsContent>

              <TabsContent value="freelancers" className="mt-4 space-y-3">
                <Input
                  placeholder="Search freelancers by name or email…"
                  value={freelancerSearchQuery}
                  onChange={(e) => setFreelancerSearchQuery(e.target.value)}
                  className="sm:max-w-sm"
                />
                <UserTable users={freelancers} type="freelancer" searchQuery={freelancerSearchQuery} />
              </TabsContent>
            </Tabs>
          </section>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd client && npx vitest run src/pages/admin/Dashboard.test.tsx`
Expected: PASS

- [ ] **Step 5: Run tsc**

Run: `cd client && npx tsc --noEmit`
Expected: clean.

- [ ] **Step 6: Self-check then commit**

Confirm via `git show --stat` that your commit touches only `client/src/pages/admin/Dashboard.tsx` and `client/src/pages/admin/Dashboard.test.tsx`.

```bash
git add client/src/pages/admin/Dashboard.tsx client/src/pages/admin/Dashboard.test.tsx
git commit -m "Port admin dashboard page to client"
```

---

## Task 4: `AdminUsers` page

**Files:**
- Create: `client/src/pages/admin/Users.tsx`
- Test: `client/src/pages/admin/Users.test.tsx`

**Interfaces:**
- Consumes: `useAdminUsersQuery`, `useDisableUserMutation` (Task 2), `type AdminUser` (`@/lib/queries/admin`); `AdminSidebar`, `Tabs` family, `DropdownMenu` family, `Button` — all already merged.
- Produces: default export `AdminUsers`. Consumed by Task 5's route wiring.

- [ ] **Step 1: Write the failing tests**

```tsx
// client/src/pages/admin/Users.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"

const useAdminUsersQueryMock = vi.fn()
const disableMutate = vi.fn()
vi.mock("../../lib/queries/admin", () => ({
  useAdminUsersQuery: () => useAdminUsersQueryMock(),
  useDisableUserMutation: () => ({ mutate: disableMutate, isPending: false }),
}))

const signOutMock = vi.fn()
vi.mock("../../contexts/AuthContext", () => ({ useAuth: () => ({ signOut: signOutMock }) }))

import AdminUsers from "./Users"

const agency = { id: "a-1", email: "a@x.com", full_name: "Acme Agency", account_type: "agency", created_at: "2026-01-01T00:00:00Z", wallet_balance: 5000 }
const freelancer = { id: "f-1", email: "f@x.com", full_name: "Jane Freelancer", account_type: "freelancer", created_at: "2026-01-02T00:00:00Z", wallet_balance: null }

function renderPage() {
  return render(<MemoryRouter><AdminUsers /></MemoryRouter>)
}

beforeEach(() => {
  vi.clearAllMocks()
  useAdminUsersQueryMock.mockReturnValue({ isLoading: false, data: { users: [agency, freelancer] } })
  vi.stubGlobal("confirm", vi.fn(() => true))
  vi.stubGlobal("alert", vi.fn())
})

describe("AdminUsers", () => {
  it("shows a loading state while users are pending", () => {
    useAdminUsersQueryMock.mockReturnValue({ isLoading: true, data: undefined })
    renderPage()
    expect(screen.getByText(/loading users/i)).toBeInTheDocument()
  })

  it("lists users grouped into tabs by account type", () => {
    renderPage()
    expect(screen.getByRole("tab", { name: /all \(2\)/i })).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: /agencies \(1\)/i })).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: /freelancers \(1\)/i })).toBeInTheDocument()
  })

  it("disables a user after confirmation, via the real mutation", async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(within(screen.getByTestId("user-row-f-1")).getByRole("button"))
    await user.click(screen.getByText("Disable user"))

    expect(window.confirm).toHaveBeenCalled()
    expect(disableMutate).toHaveBeenCalledWith(
      { userId: "f-1", disabled: true },
      expect.objectContaining({ onSuccess: expect.any(Function), onError: expect.any(Function) })
    )
  })

  it("does not call the mutation if the confirmation is declined", async () => {
    vi.stubGlobal("confirm", vi.fn(() => false))
    const user = userEvent.setup()
    renderPage()

    await user.click(within(screen.getByTestId("user-row-f-1")).getByRole("button"))
    await user.click(screen.getByText("Disable user"))

    expect(disableMutate).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd client && npx vitest run src/pages/admin/Users.test.tsx`
Expected: FAIL — `Cannot find module './Users'`

- [ ] **Step 3: Implement the page**

```tsx
// client/src/pages/admin/Users.tsx
import { useState } from "react"
import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { MoreVertical } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import AdminSidebar from "@/components/AdminSidebar"
import { useAdminUsersQuery, useDisableUserMutation, type AdminUser } from "@/lib/queries/admin"

export default function AdminUsers() {
  const usersQuery = useAdminUsersQuery()
  const disableUser = useDisableUserMutation()
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null)

  const users = usersQuery.data?.users ?? []
  const agencies = users.filter((u) => u.account_type === "agency")
  const freelancers = users.filter((u) => u.account_type === "freelancer")

  const handleSetDisabled = (userId: string, disabled: boolean) => {
    const action = disabled ? "disable" : "enable"
    if (!confirm(`Are you sure you want to ${action} this user?`)) return

    setUpdatingUserId(userId)
    disableUser.mutate(
      { userId, disabled },
      {
        onSuccess: () => alert(`User ${disabled ? "disabled" : "enabled"} successfully.`),
        onError: (err) => alert(err instanceof Error ? err.message : `Failed to ${action} user.`),
        onSettled: () => setUpdatingUserId(null),
      }
    )
  }

  const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString()

  function UserTable({ users, type }: { users: AdminUser[]; type: string }) {
    if (users.length === 0) {
      return <div className="rounded-xl border border-border bg-card py-12 text-center text-sm text-muted-foreground">No {type === "all" ? "users" : `${type}s`} found</div>
    }
    return (
      <div className="rounded-xl border border-border bg-card divide-y divide-border overflow-hidden">
        {users.map((user) => (
          <div key={user.id} data-testid={`user-row-${user.id}`} className="flex items-center justify-between gap-3 p-4 transition-colors hover:bg-surface/60">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-9 w-9 shrink-0 rounded-full bg-surface-2 flex items-center justify-center text-sm font-semibold text-foreground">
                {(user.full_name || user.email || "?").charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Link to={`/admin/users/${user.id}`} className="text-sm font-medium text-foreground truncate hover:text-primary hover:underline">
                    {user.full_name || "No name"}
                  </Link>
                  <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-primary-soft text-primary capitalize">
                    {user.account_type}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground tabular-nums">
                  Joined {formatDate(user.created_at)}
                  {user.account_type === "agency" && user.wallet_balance != null && ` · Wallet ₦${user.wallet_balance.toLocaleString()}`}
                </p>
              </div>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link to={`/admin/users/${user.id}`}>View details</Link>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleSetDisabled(user.id, true)}
                  disabled={updatingUserId === user.id}
                  className="text-destructive focus:text-destructive focus:bg-destructive/10"
                >
                  Disable user
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleSetDisabled(user.id, false)} disabled={updatingUserId === user.id}>
                  Enable user
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ))}
      </div>
    )
  }

  if (usersQuery.isLoading) {
    return (
      <div className="flex h-screen bg-surface">
        <AdminSidebar />
        <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">Loading users…</div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-surface">
      <AdminSidebar />
      <div className="flex-1 overflow-auto">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
          <header className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Admin</p>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">User management</h1>
            <p className="text-sm text-muted-foreground">Manage agencies and freelancers.</p>
          </header>

          <Tabs defaultValue="all" className="w-full">
            <TabsList className="grid w-full grid-cols-3 sm:max-w-lg">
              <TabsTrigger value="all">All ({users.length})</TabsTrigger>
              <TabsTrigger value="agencies">Agencies ({agencies.length})</TabsTrigger>
              <TabsTrigger value="freelancers">Freelancers ({freelancers.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="mt-4">
              <UserTable users={users} type="all" />
            </TabsContent>
            <TabsContent value="agencies" className="mt-4">
              <UserTable users={agencies} type="agency" />
            </TabsContent>
            <TabsContent value="freelancers" className="mt-4">
              <UserTable users={freelancers} type="freelancer" />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd client && npx vitest run src/pages/admin/Users.test.tsx`
Expected: PASS

- [ ] **Step 5: Run tsc**

Run: `cd client && npx tsc --noEmit`
Expected: clean.

- [ ] **Step 6: Self-check then commit**

Confirm via `git show --stat` that your commit touches only `client/src/pages/admin/Users.tsx` and `client/src/pages/admin/Users.test.tsx`.

```bash
git add client/src/pages/admin/Users.tsx client/src/pages/admin/Users.test.tsx
git commit -m "Port admin user management page to client"
```

---

## Task 5: Wire `/admin/dashboard` and `/admin/users` into `App.tsx`

**Files:**
- Modify: `client/src/App.tsx`
- Test: `client/src/App.test.tsx` (extend)

**Interfaces:** none new — wires Task 3's and Task 4's pages in, both `RequireAuth`-wrapped (matching the freelancer/agency dashboard convention — role mismatch is checked inline inside each page in a later task if ever needed; neither `AdminDashboard` nor `AdminUsers` currently does an inline role-redirect, matching how this plan's scope doesn't add one — `/admin/login`'s own role check is what actually gates entry to the admin area today, consistent with Phase 5a).

- [ ] **Step 1: Write the failing tests**

Add to `client/src/App.test.tsx` (extend the existing `describe("admin login route", ...)` block or add a new one, following the exact pattern already used for `/admin/login`, `/freelancer/bizpal`, etc.):

```tsx
describe("admin dashboard and users routes", () => {
  it("redirects /admin/dashboard to /login when signed out", async () => {
    renderAt("/admin/dashboard")
    await screen.findByRole("heading", { name: /Continue your work/i })
  })

  it("redirects /admin/users to /login when signed out", async () => {
    renderAt("/admin/users")
    await screen.findByRole("heading", { name: /Continue your work/i })
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd client && npx vitest run src/App.test.tsx -t "admin dashboard and users routes"`
Expected: FAIL — neither route is registered yet.

- [ ] **Step 3: Update `client/src/App.tsx`**

Read the current file first. Add the imports alongside the other page imports:

```tsx
import AdminDashboard from "./pages/admin/Dashboard"
import AdminUsers from "./pages/admin/Users"
```

Add both routes, `RequireAuth`-wrapped (matching every other protected route's pattern), before the catch-all:

```tsx
            <Route
              path="/admin/dashboard"
              element={
                <RequireAuth>
                  <AdminDashboard />
                </RequireAuth>
              }
            />
            <Route
              path="/admin/users"
              element={
                <RequireAuth>
                  <AdminUsers />
                </RequireAuth>
              }
            />
```

- [ ] **Step 4: Update `App.test.tsx`'s `renderAt` helper**

Add the same imports and routes to the helper's local `<Routes>` table, matching the existing pattern.

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
git commit -m "Wire /admin/dashboard and /admin/users routes behind RequireAuth"
```

---

## Post-Phase-5b note

This plan completes the second slice of Phase 5. `/admin/dashboard` and `/admin/users` are now live, with the first admin write path (account disable/enable) in place. Deliberately deferred: `/admin/users/[id]` (a per-user detail page the legacy `UsersClient`'s "View details" links point to — not built here or currently on the Phase 5 roadmap; links 404 to the catch-all until a future plan builds it). Next: Phase 5c (job moderation + audit log), Phase 5d (credits oversight + influencer program admin), Phase 5e (influencer self-service portal) — see the "Phase 5 slicing" section of the `react-node-migration-status` memory for full detail on each. `/admin/disputes`, `/admin/transactions`, `/disputes/[id]` remain blocked behind the Supabase-side escrow v2 migration.
