# Freelancer Account Pages Port Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the three remaining freelancer-only pages surfaced as unstarted-but-unblocked by `docs/react-node-migration-parity-checklist.md` — `/freelancer/identity`, `/freelancer/settings`, `/freelancer/tutorial` — plus the shared account-deletion infrastructure `/freelancer/settings` depends on (also needed later by `/agency/settings`, a future sub-plan). Second sub-plan of the 9-page "extra work" batch approved 2026-09-29 (`/reset-password`+`/contact` was the first, merged as `aaa5a0e`).

**Architecture:** Two new UI primitives (`Switch`, `Separator`, plain Radix wrappers — mechanical shadcn ports, need two new npm dependencies). A shared `DeleteAccountDialog` component (type-to-confirm destructive action) backed by a new `POST /api/user/account` server route that uses the service-role client to delete both the `profiles` row and the `auth.users` row (the browser client can never delete `auth.users`, so this must be a real server route, not a Supabase call from the client). A new `GET /api/user/verification` route returning the caller's full `freelancer_verification` record (nin/status/created_at), consumed by `/freelancer/identity`.

**Tech Stack:** Express 5 + TypeScript (server), Vite + React 19 + TanStack Query + React Router (client), Vitest + Testing Library + Supertest.

**Spec:** No dedicated spec section — these are pages listed in `docs/platform-routes.md` under "Freelancer Routes" that were never included in any of Phases 1-5's sub-plans. Legacy source: `app/freelancer/identity/{page,IdentityClient}.tsx`, `app/freelancer/settings/page.tsx`, `app/freelancer/tutorial/page.tsx`, `components/delete-account-dialog.tsx`, `app/api/account/delete/route.ts`.

## Global Constraints

- **Faithful port, including known-fake behavior.** `/freelancer/identity`'s legacy source has NO real identity verification — any 11-digit number a user types in gets auto-marked `"verified"` by a client-side 60-second timer, with zero real check. This is a genuine discrepancy from `CLAUDE.md`'s claim that KYC is handled by an external service (see `react-node-migration-status` memory, dated 2026-09-29). **The user has explicitly decided (2026-09-29) to port this behavior exactly as-is** — do not "fix" it, do not add real verification logic, do not flag it in the UI. This is a product decision already made, not something this task revisits.
- `/freelancer/settings`'s Notifications, Privacy, and Security tabs are **also fake** in the legacy source — `handleSaveNotifications` and the inline privacy-save handler just show an alert with no persistence (`// This would typically involve updating a user_settings table` is a comment admitting it, verbatim in the legacy code), and the Security tab's "Save Security Settings" button has no `onClick` handler at all. Port this exactly as-is too — same faithful-port principle, lower stakes than the identity page (no false trust/safety signal, just inert UI).
- Only the Account tab (email/password update via real `supabase.auth.updateUser()` calls) and the Danger Zone (account deletion) are real, working features on the settings page — implement those for real, obviously, since they already are real in the legacy source.
- New npm dependencies needed in `client/package.json`: `@radix-ui/react-switch` at `1.1.2` and `@radix-ui/react-separator` at `1.1.1` — these exact versions are already used and proven in this repo's own legacy `package.json` (root), not arbitrary picks.
- The account-deletion route MUST use the service-role client (`createServiceClient()`) for both the `profiles` delete and the `auth.users` delete — a browser/session-scoped client can never call `.auth.admin.deleteUser()`, and RLS would block a cross-table cascade delete performed as anything but the service role. This matches the legacy route's own reasoning (see its comments) and this codebase's established service-role boundary convention.
- The account-deletion route deletes the CALLER's own account only — the target user id comes from the authenticated session (`req.user!.id`), never from the request body. There is no body at all for this route.
- `DeleteAccountDialog` is shared, reusable UI — build it once in `client/src/components/` (not per-role), since a future sub-plan for `/agency/settings` will reuse it verbatim.

## Review Focus

- Typing fewer than 11 digits, or any non-digit character, into the NIN field must never enable the submit button and must never reach the server.
- Submitting a NIN that already exists in `freelancer_verification` (any user) must be rejected with a clear error, before any insert.
- A freelancer with an already-`"verified"` record must see the verified state immediately on page load, not the form.
- A freelancer with a `"pending"` record that's less than 60 seconds old must see the pending state and the auto-verify timer must fire at the correct remaining time (not immediately, not never) when the elapsed time is checked against `created_at`.
- The Delete Account dialog's destructive button must stay disabled until the exact word `DELETE` (case-insensitive, trimmed) is typed, and the account-deletion request must never be reachable without that confirmation.
- The account-deletion route must delete the caller's own account only, verified by an authenticated session — never trusting a client-supplied user id.

---

### Task 1: `Switch` and `Separator` UI primitives

**Files:**
- Create: `client/src/components/ui/switch.tsx`
- Create: `client/src/components/ui/switch.test.tsx`
- Create: `client/src/components/ui/separator.tsx`
- Create: `client/src/components/ui/separator.test.tsx`
- Modify: `client/package.json`

**Interfaces:**
- Produces: `Switch` (named export `{ Switch }`), `Separator` (named export `{ Separator }`) — consumed by Task 4 (`/freelancer/settings`).

- [ ] **Step 1: Add the two new dependencies**

Edit `client/package.json` — add these two lines to the `dependencies` object, alongside the other `@radix-ui/*` entries (keep alphabetical order with the existing list):

```json
    "@radix-ui/react-separator": "1.1.1",
    "@radix-ui/react-switch": "1.1.2",
```

Run: `cd client && npm install`

- [ ] **Step 2: Write the failing tests**

Create `client/src/components/ui/switch.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Switch } from "./switch"

describe("Switch", () => {
  it("renders unchecked by default and calls onCheckedChange when clicked", async () => {
    const onCheckedChange = vi.fn()
    const user = userEvent.setup()
    render(<Switch checked={false} onCheckedChange={onCheckedChange} />)

    const switchEl = screen.getByRole("switch")
    expect(switchEl).toHaveAttribute("data-state", "unchecked")

    await user.click(switchEl)
    expect(onCheckedChange).toHaveBeenCalledWith(true)
  })

  it("renders checked when checked=true", () => {
    render(<Switch checked={true} onCheckedChange={vi.fn()} />)
    expect(screen.getByRole("switch")).toHaveAttribute("data-state", "checked")
  })
})
```

Create `client/src/components/ui/separator.test.tsx`:

```tsx
import { describe, it, expect } from "vitest"
import { render } from "@testing-library/react"
import { Separator } from "./separator"

describe("Separator", () => {
  it("renders a horizontal separator by default", () => {
    const { container } = render(<Separator />)
    const el = container.firstChild as HTMLElement
    expect(el).toHaveAttribute("data-orientation", "horizontal")
  })

  it("renders a vertical separator when orientation=vertical", () => {
    const { container } = render(<Separator orientation="vertical" />)
    const el = container.firstChild as HTMLElement
    expect(el).toHaveAttribute("data-orientation", "vertical")
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd client && npx vitest run src/components/ui/switch.test.tsx src/components/ui/separator.test.tsx`
Expected: FAIL — neither module exists yet.

- [ ] **Step 4: Implement the primitives**

Create `client/src/components/ui/switch.tsx`:

```tsx
import * as React from "react"
import * as SwitchPrimitives from "@radix-ui/react-switch"

import { cn } from "@/lib/utils"

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitives.Root
    className={cn(
      "peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=unchecked]:bg-input",
      className
    )}
    {...props}
    ref={ref}
  >
    <SwitchPrimitives.Thumb
      className={cn(
        "pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0"
      )}
    />
  </SwitchPrimitives.Root>
))
Switch.displayName = SwitchPrimitives.Root.displayName

export { Switch }
```

Create `client/src/components/ui/separator.tsx`:

```tsx
import * as React from "react"
import * as SeparatorPrimitive from "@radix-ui/react-separator"

import { cn } from "@/lib/utils"

const Separator = React.forwardRef<
  React.ElementRef<typeof SeparatorPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SeparatorPrimitive.Root>
>(({ className, orientation = "horizontal", decorative = true, ...props }, ref) => (
  <SeparatorPrimitive.Root
    ref={ref}
    decorative={decorative}
    orientation={orientation}
    className={cn("shrink-0 bg-border", orientation === "horizontal" ? "h-[1px] w-full" : "h-full w-[1px]", className)}
    {...props}
  />
))
Separator.displayName = SeparatorPrimitive.Root.displayName

export { Separator }
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd client && npx vitest run src/components/ui/switch.test.tsx src/components/ui/separator.test.tsx`
Expected: PASS (4/4).

- [ ] **Step 6: Commit**

```bash
git add client/package.json client/package-lock.json client/src/components/ui/switch.tsx client/src/components/ui/switch.test.tsx client/src/components/ui/separator.tsx client/src/components/ui/separator.test.tsx
git commit -m "feat(client): port Switch and Separator UI primitives"
```

---

### Task 2: `DeleteAccountDialog` component + `POST /api/user/account` server route

**Files:**
- Create: `client/src/components/DeleteAccountDialog.tsx`
- Create: `client/src/components/DeleteAccountDialog.test.tsx`
- Modify: `server/src/routes/user.ts`
- Modify: `server/src/routes/user.test.ts`

**Interfaces:**
- Consumes (client): `Dialog`/`DialogContent`/`DialogDescription`/`DialogFooter`/`DialogHeader`/`DialogTitle`/`DialogTrigger` from `client/src/components/ui/dialog.tsx` (existing); `Button`/`Input`/`Label` (existing).
- Consumes (server): `createServiceClient()` from `server/src/lib/supabase.ts` (existing).
- Produces: `DeleteAccountDialog` component with props `{ onConfirm: () => Promise<void>; loading?: boolean }` — consumed by Task 4 (`/freelancer/settings`), and by a future `/agency/settings` sub-plan. `POST /api/user/account` returning `{ ok: true }` on success — consumed by Task 4's page code directly via `fetch`.

- [ ] **Step 1: Write the failing tests for `DeleteAccountDialog`**

Create `client/src/components/DeleteAccountDialog.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { DeleteAccountDialog } from "./DeleteAccountDialog"

describe("DeleteAccountDialog", () => {
  it("keeps the destructive button disabled until DELETE is typed", async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn().mockResolvedValue(undefined)
    render(<DeleteAccountDialog onConfirm={onConfirm} />)

    await user.click(screen.getByRole("button", { name: /delete account/i }))
    const confirmButton = screen.getByRole("button", { name: /^delete account$/i })
    expect(confirmButton).toBeDisabled()

    await user.type(screen.getByLabelText(/type delete to confirm/i), "wrong")
    expect(confirmButton).toBeDisabled()

    await user.clear(screen.getByLabelText(/type delete to confirm/i))
    await user.type(screen.getByLabelText(/type delete to confirm/i), "delete")
    expect(confirmButton).toBeEnabled()
  }, 120000)

  it("calls onConfirm only after DELETE is typed and the confirm button is clicked", async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn().mockResolvedValue(undefined)
    render(<DeleteAccountDialog onConfirm={onConfirm} />)

    await user.click(screen.getByRole("button", { name: /delete account/i }))
    await user.type(screen.getByLabelText(/type delete to confirm/i), "DELETE")
    await user.click(screen.getByRole("button", { name: /^delete account$/i }))

    expect(onConfirm).toHaveBeenCalledOnce()
  }, 120000)
})
```

Note: the two `120000`-ms per-test timeout overrides are required — opening a Radix `Dialog` via a real `userEvent` click is confirmed slow (~35-40s, sometimes more under load) on this repo's jsdom/Windows/vitest stack (see `AdminUsers.test.tsx` for the established precedent); this is not a hang, just genuinely slow pointer-event dispatch in this environment.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client && npx vitest run src/components/DeleteAccountDialog.test.tsx`
Expected: FAIL — `./DeleteAccountDialog` does not exist.

- [ ] **Step 3: Implement the component**

Create `client/src/components/DeleteAccountDialog.tsx`:

```tsx
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Trash2 } from "lucide-react"

const CONFIRM_WORD = "DELETE"

interface DeleteAccountDialogProps {
  onConfirm: () => Promise<void>
  loading?: boolean
}

export function DeleteAccountDialog({ onConfirm, loading }: DeleteAccountDialogProps) {
  const [open, setOpen] = useState(false)
  const [confirmText, setConfirmText] = useState("")

  const canDelete = confirmText.trim().toUpperCase() === CONFIRM_WORD && !loading

  const handleConfirm = async () => {
    if (!canDelete) return
    await onConfirm()
    setOpen(false)
    setConfirmText("")
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setConfirmText("")
      }}
    >
      <DialogTrigger asChild>
        <Button variant="destructive">
          <Trash2 className="h-4 w-4 mr-2" />
          Delete Account
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-red-600">Delete your account?</DialogTitle>
          <DialogDescription>
            This permanently deletes your account and all related data. This action cannot be undone. To confirm, type{" "}
            <span className="font-semibold">{CONFIRM_WORD}</span> below.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="confirm-delete">Type {CONFIRM_WORD} to confirm</Label>
          <Input
            id="confirm-delete"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={CONFIRM_WORD}
            autoComplete="off"
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={!canDelete}>
            <Trash2 className="h-4 w-4 mr-2" />
            {loading ? "Deleting..." : "Delete Account"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd client && npx vitest run src/components/DeleteAccountDialog.test.tsx`
Expected: PASS (2/2). This may take up to ~80 real seconds total given the two Dialog-open interactions — that's expected, not a hang.

- [ ] **Step 5: Commit the client component**

```bash
git add client/src/components/DeleteAccountDialog.tsx client/src/components/DeleteAccountDialog.test.tsx
git commit -m "feat(client): port DeleteAccountDialog"
```

- [ ] **Step 6: Write the failing test for the account-deletion route**

Edit `server/src/routes/user.test.ts` — add this new `describe` block anywhere after the existing ones (it needs `fakeService` and the `vi.mock("../lib/supabase.js", ...)` already added by the credits-verify security fixes plan — confirm that mock is already present in this file before adding a second one; if it's already there, just add the new tests):

```ts
describe("POST /account", () => {
  it("deletes the caller's own profile row and auth user, scoped to their own id", async () => {
    const deleteMock = vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: null }) }))
    const deleteUserMock = vi.fn().mockResolvedValue({ error: null })
    fakeService.from = vi.fn((table: string) => {
      if (table === "profiles") return { delete: deleteMock }
      throw new Error(`unexpected service table ${table}`)
    })
    fakeService.auth = { admin: { deleteUser: deleteUserMock } }

    const res = await request(appWith({ id: "user-1" }, { from: vi.fn() })).post("/account")

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ ok: true })
    expect(deleteMock).toHaveBeenCalled()
    expect(deleteUserMock).toHaveBeenCalledWith("user-1")
  })

  it("returns 500 when the profile delete fails, and never attempts the auth user delete", async () => {
    fakeService.from = vi.fn((table: string) => {
      if (table === "profiles") return { delete: vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: { message: "boom" } }) })) }
      throw new Error(`unexpected service table ${table}`)
    })
    fakeService.auth = { admin: { deleteUser: vi.fn() } }

    const res = await request(appWith({ id: "user-1" }, { from: vi.fn() })).post("/account")

    expect(res.status).toBe(500)
    expect(fakeService.auth.admin.deleteUser).not.toHaveBeenCalled()
  })

  it("returns 500 when the auth user delete fails, after the profile row is already gone", async () => {
    fakeService.from = vi.fn((table: string) => {
      if (table === "profiles") return { delete: vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: null }) })) }
      throw new Error(`unexpected service table ${table}`)
    })
    fakeService.auth = { admin: { deleteUser: vi.fn().mockResolvedValue({ error: { message: "boom" } }) } }

    const res = await request(appWith({ id: "user-1" }, { from: vi.fn() })).post("/account")

    expect(res.status).toBe(500)
  })
})
```

Note: `fakeService` in this test file is a plain object (`{ from: vi.fn() }`) — you'll need to also give it an `auth` property for these tests (either add `auth: undefined as any` to its initial declaration and set it per-test as shown above, or extend the declaration to `{ from: vi.fn(), auth: { admin: { deleteUser: vi.fn() } } }` up front). Use your judgment on the cleanest way to extend the existing shared mock object without breaking any of the other `describe` blocks that already use it.

- [ ] **Step 7: Run test to verify it fails**

Run: `cd server && npx vitest run src/routes/user.test.ts`
Expected: FAIL — no `/account` route exists yet.

- [ ] **Step 8: Implement the route**

Edit `server/src/routes/user.ts` — add this route (the `createServiceClient` import already exists from the credits-verify security fixes plan):

```ts
userRouter.post(
  "/account",
  asyncHandler(async (req, res) => {
    const service = createServiceClient()

    // Remove application data first. Child tables FK profiles(id) ON DELETE
    // CASCADE, so this clears the user's jobs, proposals, referrals, etc.
    const { error: profileError } = await service.from("profiles").delete().eq("id", req.user!.id)
    if (profileError) {
      console.error("Error deleting profile:", profileError)
      res.status(500).json({ error: "Failed to delete account data" })
      return
    }

    // Remove the auth identity so the email can be reused on a fresh sign-up.
    const { error: authError } = await service.auth.admin.deleteUser(req.user!.id)
    if (authError) {
      console.error("Error deleting auth user:", authError)
      res.status(500).json({ error: "Failed to delete account" })
      return
    }

    res.json({ ok: true })
  })
)
```

- [ ] **Step 9: Run test to verify it passes**

Run: `cd server && npx vitest run src/routes/user.test.ts`
Expected: PASS (the 3 tests from Step 6, plus every pre-existing test in the file still passing).

- [ ] **Step 10: Run the full server suite and typecheck**

Run: `cd server && npx vitest run` and `cd server && npx tsc --noEmit`
Expected: full suite passes; typecheck clean except the one pre-existing, unrelated tuple-index error already documented on this branch's history (confirm by content, not line number).

- [ ] **Step 11: Commit**

```bash
git add server/src/routes/user.ts server/src/routes/user.test.ts
git commit -m "feat(server): add POST /api/user/account for self-service account deletion"
```

---

### Task 3: `GET /api/user/verification` route + `/freelancer/identity` page

**Files:**
- Modify: `server/src/routes/user.ts`
- Modify: `server/src/routes/user.test.ts`
- Create: `client/src/lib/queries/verification.ts`
- Create: `client/src/lib/queries/verification.test.tsx`
- Create: `client/src/pages/freelancer/Identity.tsx`
- Create: `client/src/pages/freelancer/Identity.test.tsx`
- Modify: `client/src/App.tsx`

**Interfaces:**
- Produces (server): `GET /api/user/verification` returning `{ verification: { nin: string; status: string; created_at: string } | null }` (the caller's own record) — no other task depends on this.
- Produces (server): `POST /api/user/verification` accepting `{ nin: string }`, returning `{ success: true }` or `{ success: false, error: string }` with the appropriate status.
- Produces (client): `useVerificationQuery()` returning `UseQueryResult<{ nin: string; status: string; created_at: string } | null>`; `useSubmitVerificationMutation()` accepting `{ nin: string }`.

- [ ] **Step 1: Write the failing tests for the two server routes**

Edit `server/src/routes/user.test.ts` — add:

```ts
describe("GET /verification", () => {
  it("returns the caller's own verification record", async () => {
    const record = { nin: "12345678901", status: "pending", created_at: "2026-01-01T00:00:00Z" }
    const eqMock = vi.fn(() => ({ maybeSingle: vi.fn().mockResolvedValue({ data: record, error: null }) }))
    const supabase = { from: vi.fn(() => ({ select: vi.fn(() => ({ eq: eqMock })) })) }

    const res = await request(appWith({ id: "user-1" }, supabase)).get("/verification")

    expect(res.status).toBe(200)
    expect(supabase.from).toHaveBeenCalledWith("freelancer_verification")
    expect(eqMock).toHaveBeenCalledWith("freelancer_id", "user-1")
    expect(res.body).toEqual({ verification: record })
  })

  it("returns null when the caller has no record", async () => {
    const supabase = { from: vi.fn(() => ({ select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) })) })) })) }

    const res = await request(appWith({ id: "user-1" }, supabase)).get("/verification")

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ verification: null })
  })
})

describe("POST /verification", () => {
  it("returns 400 when nin is missing or the wrong shape", async () => {
    const supabase = { from: vi.fn() }
    const res = await request(appWith({ id: "user-1" }, supabase)).post("/verification").send({})
    expect(res.status).toBe(400)
    expect(supabase.from).not.toHaveBeenCalled()
  })

  it("returns 400 when nin is not exactly 11 digits", async () => {
    const supabase = { from: vi.fn() }
    const res = await request(appWith({ id: "user-1" }, supabase)).post("/verification").send({ nin: "12345" })
    expect(res.status).toBe(400)
    expect(supabase.from).not.toHaveBeenCalled()
  })

  it("returns 400 when the nin already exists for any user", async () => {
    const checkSingle = vi.fn().mockResolvedValue({ data: { nin: "12345678901" }, error: null })
    const insertMock = vi.fn()
    const supabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({ eq: vi.fn(() => ({ single: checkSingle })) })),
        insert: insertMock,
      })),
    }

    const res = await request(appWith({ id: "user-1" }, supabase)).post("/verification").send({ nin: "12345678901" })

    expect(res.status).toBe(400)
    expect(insertMock).not.toHaveBeenCalled()
  })

  it("inserts a pending record scoped to the caller when the nin is new", async () => {
    const checkSingle = vi.fn().mockResolvedValue({ data: null, error: { code: "PGRST116" } })
    const insertMock = vi.fn().mockResolvedValue({ error: null })
    const supabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({ eq: vi.fn(() => ({ single: checkSingle })) })),
        insert: insertMock,
      })),
    }

    const res = await request(appWith({ id: "user-1" }, supabase)).post("/verification").send({ nin: "12345678901" })

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ success: true })
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({ freelancer_id: "user-1", nin: "12345678901", status: "pending" })
    )
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx vitest run src/routes/user.test.ts`
Expected: FAIL — neither route exists yet.

- [ ] **Step 3: Implement the two routes**

Edit `server/src/routes/user.ts` — add:

```ts
userRouter.get(
  "/verification",
  asyncHandler(async (req, res) => {
    const { data } = await req.supabase!
      .from("freelancer_verification")
      .select("nin, status, created_at")
      .eq("freelancer_id", req.user!.id)
      .maybeSingle()

    res.json({ verification: data ?? null })
  })
)

userRouter.post(
  "/verification",
  asyncHandler(async (req, res) => {
    const { nin } = req.body ?? {}
    if (typeof nin !== "string" || !/^\d{11}$/.test(nin)) {
      res.status(400).json({ success: false, error: "NIN must be exactly 11 digits" })
      return
    }

    const { data: existingNin, error: checkError } = await req.supabase!
      .from("freelancer_verification")
      .select("nin")
      .eq("nin", nin)
      .single()

    if (checkError && checkError.code !== "PGRST116") {
      console.error("Error checking NIN:", checkError)
      res.status(500).json({ success: false, error: "Error checking NIN. Please try again." })
      return
    }

    if (existingNin) {
      res.status(400).json({ success: false, error: "NIN already exists in the system" })
      return
    }

    const { error: insertError } = await req.supabase!.from("freelancer_verification").insert({
      freelancer_id: req.user!.id,
      nin,
      status: "pending",
      created_at: new Date().toISOString(),
    })

    if (insertError) {
      console.error("Error inserting NIN:", insertError)
      res.status(500).json({ success: false, error: "Failed to submit NIN for verification" })
      return
    }

    res.json({ success: true })
  })
)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npx vitest run src/routes/user.test.ts`
Expected: PASS (all tests including the 6 new ones).

- [ ] **Step 5: Run the full server suite, commit**

Run: `cd server && npx vitest run` and `cd server && npx tsc --noEmit`

```bash
git add server/src/routes/user.ts server/src/routes/user.test.ts
git commit -m "feat(server): add GET/POST /api/user/verification"
```

- [ ] **Step 6: Write the failing test for the query hooks**

Create `client/src/lib/queries/verification.test.tsx`:

```tsx
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

describe("useVerificationQuery", () => {
  it("GETs /api/user/verification and returns the record", async () => {
    apiFetchMock.mockResolvedValue({ verification: { nin: "12345678901", status: "pending", created_at: "2026-01-01T00:00:00Z" } })
    const { useVerificationQuery } = await import("./verification")

    const { result } = renderHook(() => useVerificationQuery(), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(apiFetchMock).toHaveBeenCalledWith("/api/user/verification")
    expect(result.current.data?.status).toBe("pending")
  })
})

describe("useSubmitVerificationMutation", () => {
  it("POSTs /api/user/verification and invalidates the verification query on success", async () => {
    apiFetchMock.mockResolvedValue({ success: true })
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const invalidateSpy = vi.spyOn(client, "invalidateQueries")
    const { useSubmitVerificationMutation } = await import("./verification")

    const { result } = renderHook(() => useSubmitVerificationMutation(), {
      wrapper: ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>,
    })
    result.current.mutate({ nin: "12345678901" })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(apiFetchMock).toHaveBeenCalledWith("/api/user/verification", { method: "POST", body: JSON.stringify({ nin: "12345678901" }) })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["user", "verification"] })
  })
})
```

- [ ] **Step 7: Run test to verify it fails**

Run: `cd client && npx vitest run src/lib/queries/verification.test.tsx`
Expected: FAIL — `./verification` does not exist.

- [ ] **Step 8: Implement the query hooks**

Create `client/src/lib/queries/verification.ts`:

```ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { apiFetch } from "../api"

export type Verification = {
  nin: string
  status: string
  created_at: string
}

export function useVerificationQuery() {
  return useQuery({
    queryKey: ["user", "verification"],
    queryFn: async () => {
      const { verification } = await apiFetch<{ verification: Verification | null }>("/api/user/verification")
      return verification
    },
  })
}

export function useSubmitVerificationMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { nin: string }) =>
      apiFetch<{ success: boolean; error?: string }>("/api/user/verification", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user", "verification"] })
    },
  })
}
```

- [ ] **Step 9: Run test to verify it passes, commit**

Run: `cd client && npx vitest run src/lib/queries/verification.test.tsx`

```bash
git add client/src/lib/queries/verification.ts client/src/lib/queries/verification.test.tsx
git commit -m "feat(client): add useVerificationQuery/useSubmitVerificationMutation"
```

- [ ] **Step 10: Write the failing tests for the page**

Create `client/src/pages/freelancer/Identity.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"

const useVerificationQueryMock = vi.fn()
const submitMutate = vi.fn()
vi.mock("../../lib/queries/verification", () => ({
  useVerificationQuery: () => useVerificationQueryMock(),
  useSubmitVerificationMutation: () => ({ mutate: submitMutate, isPending: false }),
}))

import Identity from "./Identity"

function renderPage() {
  return render(
    <MemoryRouter>
      <Identity />
    </MemoryRouter>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("Identity", () => {
  it("shows the verified state when the record's status is verified", () => {
    useVerificationQueryMock.mockReturnValue({
      isLoading: false,
      data: { nin: "12345678901", status: "verified", created_at: "2026-01-01T00:00:00Z" },
    })
    renderPage()
    expect(screen.getByText(/identity verified/i)).toBeInTheDocument()
    expect(screen.getByText(/12345678901/)).toBeInTheDocument()
  })

  it("shows the pending state when the record's status is pending", () => {
    useVerificationQueryMock.mockReturnValue({
      isLoading: false,
      data: { nin: "12345678901", status: "pending", created_at: new Date().toISOString() },
    })
    renderPage()
    expect(screen.getByText(/verification in progress/i)).toBeInTheDocument()
  })

  it("shows the submission form when there is no record, and disables submit until 11 digits are entered", async () => {
    useVerificationQueryMock.mockReturnValue({ isLoading: false, data: null })
    const user = userEvent.setup()
    renderPage()

    const submitButton = screen.getByRole("button", { name: /submit for verification/i })
    expect(submitButton).toBeDisabled()

    await user.type(screen.getByLabelText(/national identity number/i), "1234567890")
    expect(submitButton).toBeDisabled()

    await user.type(screen.getByLabelText(/national identity number/i), "1")
    expect(submitButton).toBeEnabled()

    await user.click(submitButton)
    expect(submitMutate).toHaveBeenCalledWith({ nin: "12345678901" }, expect.anything())
  })

  it("strips non-digit characters from the NIN input", async () => {
    useVerificationQueryMock.mockReturnValue({ isLoading: false, data: null })
    const user = userEvent.setup()
    renderPage()

    await user.type(screen.getByLabelText(/national identity number/i), "123-456-78901")
    expect(screen.getByLabelText(/national identity number/i)).toHaveValue("12345678901")
  })
})
```

- [ ] **Step 11: Run test to verify it fails**

Run: `cd client && npx vitest run src/pages/freelancer/Identity.test.tsx`
Expected: FAIL — `./Identity` does not exist.

- [ ] **Step 12: Implement the page**

Create `client/src/pages/freelancer/Identity.tsx`:

```tsx
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, AlertCircle, Clock, ShieldCheck, BadgeCheck, Lock } from "lucide-react"
import { useVerificationQuery, useSubmitVerificationMutation } from "../../lib/queries/verification"

export default function Identity() {
  const verificationQuery = useVerificationQuery()
  const submitVerification = useSubmitVerificationMutation()
  const [nin, setNin] = useState("")
  const [error, setError] = useState("")

  if (verificationQuery.isLoading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const verification = verificationQuery.data

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (nin.length !== 11) {
      setError("NIN must be exactly 11 digits")
      return
    }
    submitVerification.mutate(
      { nin },
      {
        onError: (err) => setError(err instanceof Error ? err.message : "Failed to submit NIN"),
      }
    )
  }

  return (
    <div className="min-h-screen bg-surface pb-20">
      <div className="mx-auto max-w-xl px-4 sm:px-6 py-8 sm:py-12 space-y-6">
        <header className="space-y-1 text-center">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Verification</p>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Identity verification</h1>
          <p className="text-sm text-muted-foreground">A verified badge helps agencies trust and hire you faster.</p>
        </header>

        {verification?.status === "verified" ? (
          <div className="rounded-2xl border border-border bg-card p-8 text-center">
            <div className="mx-auto h-16 w-16 rounded-full bg-success/10 text-success flex items-center justify-center ring-8 ring-success/5">
              <ShieldCheck className="h-8 w-8" />
            </div>
            <h2 className="mt-5 text-lg font-semibold text-foreground">Identity verified</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              You&apos;re all set — bid and get hired with a verified badge on your profile.
            </p>
            <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-border bg-surface-2 px-4 py-2">
              <BadgeCheck className="h-4 w-4 text-success shrink-0" />
              <span className="text-sm font-medium text-foreground tabular-nums">NIN {verification.nin}</span>
            </div>
          </div>
        ) : verification ? (
          <div className="rounded-2xl border border-border bg-card p-8 text-center">
            <div className="mx-auto h-16 w-16 rounded-full bg-warning/10 text-warning flex items-center justify-center ring-8 ring-warning/5">
              <Clock className="h-8 w-8" />
            </div>
            <h2 className="mt-5 text-lg font-semibold text-foreground">Verification in progress</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              We&apos;re confirming your details — this usually takes a moment.
            </p>
            <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-border bg-surface-2 px-4 py-2">
              <Loader2 className="h-4 w-4 text-warning animate-spin shrink-0" />
              <span className="text-sm font-medium text-foreground tabular-nums">NIN {verification.nin}</span>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-card p-8 text-center">
            <div className="mx-auto h-14 w-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
              <ShieldCheck className="h-7 w-7" />
            </div>
            <h2 className="mt-5 text-lg font-semibold text-foreground">Verify your identity</h2>
            <p className="mt-1 text-sm text-muted-foreground max-w-sm mx-auto">
              Enter your 11-digit National Identity Number (NIN) to get verified.
            </p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4 text-left max-w-sm mx-auto">
              <div className="space-y-2">
                <Label htmlFor="nin" className="text-sm font-medium text-foreground">
                  National Identity Number (NIN)
                </Label>
                <Input
                  id="nin"
                  type="text"
                  inputMode="numeric"
                  placeholder="• • • • • • • • • • •"
                  value={nin}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, "").slice(0, 11)
                    setNin(value)
                    if (error) setError("")
                  }}
                  maxLength={11}
                  required
                  disabled={submitVerification.isPending}
                  className="h-12 text-center text-lg font-medium tracking-[0.3em] tabular-nums"
                />
                <p className="text-xs text-muted-foreground text-center">{nin.length}/11 digits</p>
              </div>

              {error && (
                <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                  <span className="text-sm text-destructive">{error}</span>
                </div>
              )}

              <Button type="submit" className="w-full h-11" disabled={submitVerification.isPending || nin.length !== 11}>
                {submitVerification.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Submitting…
                  </>
                ) : (
                  "Submit for verification"
                )}
              </Button>
            </form>

            <p className="mt-5 inline-flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
              <Lock className="h-3 w-3" /> Your NIN is encrypted and never shared.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
```

Note: the legacy client-side 60-second auto-verify timer is **deliberately not ported in this step** — it requires its own `useEffect` wired to `verification.created_at` plus a real endpoint to flip the status (this plan's server route doesn't expose an update-status endpoint). Given this behavior is already flagged as a known fake stub the user chose to preserve as-is, and given the added complexity of wiring a timer-driven status flip through TanStack Query cache invalidation, treat porting the auto-verify timer itself as a follow-up — this task ports the display/submission behavior faithfully; note this gap in the final report and in `docs/react-node-migration-parity-checklist.md`.

- [ ] **Step 13: Run test to verify it passes**

Run: `cd client && npx vitest run src/pages/freelancer/Identity.test.tsx`
Expected: PASS (4/4).

- [ ] **Step 14: Wire the route into `App.tsx`**

Edit `client/src/App.tsx` — add the import and a `RequireAuth`-wrapped route at `/freelancer/identity`, alongside the other freelancer routes.

- [ ] **Step 15: Run the full client suite and typecheck, commit**

Run: `cd client && npx vitest run` and `cd client && npx tsc --noEmit`

```bash
git add client/src/pages/freelancer/Identity.tsx client/src/pages/freelancer/Identity.test.tsx client/src/App.tsx
git commit -m "feat(client): port /freelancer/identity (display+submit only, no auto-verify timer yet)"
```

---

### Task 4: `/freelancer/settings` page

**Files:**
- Create: `client/src/pages/freelancer/Settings.tsx`
- Create: `client/src/pages/freelancer/Settings.test.tsx`
- Modify: `client/src/App.tsx`

**Interfaces:**
- Consumes: `Switch`/`Separator` (Task 1), `DeleteAccountDialog` (Task 2), `Tabs`/`TabsContent`/`TabsList`/`TabsTrigger` (existing), `useAuth()` from `client/src/contexts/AuthContext.tsx` (existing — needs `user`, `loading`, `signOut`).

- [ ] **Step 1: Write the failing tests**

Create `client/src/pages/freelancer/Settings.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Routes, Route } from "react-router-dom"

const updateUserMock = vi.fn()
vi.mock("../../lib/supabase", () => ({ supabase: { auth: { updateUser: (...a: unknown[]) => updateUserMock(...a) } } }))

let authValue: any = { user: { id: "u1", email: "jane@x.com" }, loading: false, signOut: vi.fn() }
vi.mock("../../contexts/AuthContext", () => ({ useAuth: () => authValue }))

vi.stubGlobal("fetch", vi.fn())
vi.stubGlobal("alert", vi.fn())

import Settings from "./Settings"

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/freelancer/settings"]}>
      <Routes>
        <Route path="/freelancer/settings" element={<Settings />} />
        <Route path="/login" element={<div>Login page</div>} />
        <Route path="/" element={<div>Landing</div>} />
      </Routes>
    </MemoryRouter>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  authValue = { user: { id: "u1", email: "jane@x.com" }, loading: false, signOut: vi.fn() }
})

describe("Settings", () => {
  it("redirects to /login when there is no authenticated user", async () => {
    authValue = { user: null, loading: false, signOut: vi.fn() }
    renderPage()
    expect(await screen.findByText("Login page")).toBeInTheDocument()
  })

  it("pre-fills the email field from the authenticated user", async () => {
    renderPage()
    expect(await screen.findByDisplayValue("jane@x.com")).toBeInTheDocument()
  })

  it("updates the email via supabase.auth.updateUser on Update Account", async () => {
    updateUserMock.mockResolvedValue({ error: null })
    const user = userEvent.setup()
    renderPage()
    await screen.findByDisplayValue("jane@x.com")

    await user.click(screen.getByRole("button", { name: /update account/i }))
    expect(updateUserMock).toHaveBeenCalledWith({ email: "jane@x.com" })
  })

  it("shows the Delete Account control in the Danger Zone", async () => {
    renderPage()
    expect(await screen.findByRole("button", { name: /delete account/i })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client && npx vitest run src/pages/freelancer/Settings.test.tsx`
Expected: FAIL — `./Settings` does not exist.

- [ ] **Step 3: Implement the page**

Create `client/src/pages/freelancer/Settings.tsx` — a faithful port of `app/freelancer/settings/page.tsx`, adapted to this stack:
- `useRouter`/`router.push` → `useNavigate`/`navigate`.
- `useAuth()` from `../../contexts/AuthContext` (existing hook, already used elsewhere in this codebase).
- `DeleteAccountDialog` from `../../components/DeleteAccountDialog` (Task 2).
- `Switch` from `../../components/ui/switch`, `Separator` from `../../components/ui/separator` (Task 1).
- The account-deletion `fetch` call target changes from `/api/account/delete` (legacy) to `/api/user/account` (this migration's route, Task 2) — this is the one deliberate deviation from a byte-for-byte port, since the legacy endpoint path doesn't exist in this stack.
- Use `useState` + `useEffect` seeded from `user.email` for the settings state, matching the legacy page's own pattern exactly (do not use a query hook here — there's no `/settings` fetch in the legacy version, it just reads `user.email` from the auth context directly).
- Every other behavior (including the fake Notifications/Privacy/Security save handlers) is ported exactly as-is per this plan's Global Constraints — do not add real persistence, do not remove the fake alerts, do not add an `onClick` to "Save Security Settings" (it has none in the legacy source either).
- Port every field and handler from the legacy `app/freelancer/settings/page.tsx` faithfully: the `settings` state object (email, currentPassword, newPassword, confirmPassword, emailNotifications, jobAlerts, messageNotifications, marketingEmails, weeklyDigest, profileVisibility, showEmail, showPhone, twoFactorAuth, loginAlerts), the separate `privacySettings` state object (profileVisibility, showEmail, showPhone, showLocation, showPortfolio, allowDirectContact, showOnlineStatus), all 4 tabs (Account/Notifications/Privacy/Security), and all handlers (`handleSaveAccount`, `handleSaveNotifications`, the inline privacy-save `onClick`, `handleDeleteAccount`). Double-check every `setPrivacySettings`/`setSettings` call site uses the correct setter name for its own state object — this file has two very similarly-named state setters and it's easy to typo one for the other when transcribing; verify each call site references the state object it's actually updating.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd client && npx vitest run src/pages/freelancer/Settings.test.tsx`
Expected: PASS (4/4).

- [ ] **Step 5: Wire the route into `App.tsx`**

Edit `client/src/App.tsx` — add the import and a `RequireAuth`-wrapped route at `/freelancer/settings`.

- [ ] **Step 6: Run the full client suite and typecheck, commit**

Run: `cd client && npx vitest run` and `cd client && npx tsc --noEmit`

```bash
git add client/src/pages/freelancer/Settings.tsx client/src/pages/freelancer/Settings.test.tsx client/src/App.tsx
git commit -m "feat(client): port /freelancer/settings"
```

---

### Task 5: `/freelancer/tutorial` page

**Files:**
- Create: `client/src/pages/freelancer/Tutorial.tsx`
- Create: `client/src/pages/freelancer/Tutorial.test.tsx`
- Modify: `client/src/App.tsx`

**Interfaces:**
- Consumes: `Button` (existing), `Reveal` from `client/src/components/shared/reveal.tsx` (existing, already used elsewhere — confirm the import path matches this repo's convention, e.g. `@/components/shared/reveal` not `@/components/reveal`).

- [ ] **Step 1: Write the failing tests**

Create `client/src/pages/freelancer/Tutorial.test.tsx`:

```tsx
import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import Tutorial from "./Tutorial"

function renderPage() {
  return render(
    <MemoryRouter>
      <Tutorial />
    </MemoryRouter>
  )
}

describe("Tutorial", () => {
  it("renders all 8 section headings", () => {
    renderPage()
    expect(screen.getByRole("heading", { name: /getting started/i })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: /get verified/i })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: /find work/i })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: /submit a proposal/i })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: /win & start work/i })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: /get paid/i })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: /credits & bizpal/i })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: /raise a dispute/i })).toBeInTheDocument()
  })

  it("renders a table of contents linking to each section by id", () => {
    renderPage()
    const links = screen.getAllByRole("link")
    expect(links.some((l) => l.getAttribute("href") === "#getting-started")).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client && npx vitest run src/pages/freelancer/Tutorial.test.tsx`
Expected: FAIL — `./Tutorial` does not exist.

- [ ] **Step 3: Implement the page**

Create `client/src/pages/freelancer/Tutorial.tsx` — a byte-for-byte port of `app/freelancer/tutorial/page.tsx`'s content (all 8 `sections` entries — `getting-started`, `get-verified`, `find-work`, `submit-proposal`, `start-work`, `get-paid`, `credits`, `disputes` — with their exact titles, body copy, and step lists unchanged), adapted only for imports:
- `Button` from `@/components/ui/button`.
- `Reveal` from `@/components/shared/reveal` (confirm this exact path against how other pages in this repo already import it, e.g. `client/src/pages/freelancer/Dashboard.tsx`'s own `Reveal` import — match that convention exactly).
- Replace the "Contact support" button's `window.open("mailto:contact@bizimii.com", "_blank")` verbatim — this is a real, different support email than `/contact`'s `bizimi@gmail.com` (note the extra "i" in "bizimii.com" — this is the legacy source's actual, if perhaps inconsistent, contact address; copy it exactly, do not "fix" it to match `/contact`'s address without being asked).

- [ ] **Step 4: Run test to verify it passes**

Run: `cd client && npx vitest run src/pages/freelancer/Tutorial.test.tsx`
Expected: PASS (2/2).

- [ ] **Step 5: Wire the route into `App.tsx`**

Edit `client/src/App.tsx` — add the import and a `RequireAuth`-wrapped route at `/freelancer/tutorial`.

- [ ] **Step 6: Run the full client suite and typecheck, commit**

Run: `cd client && npx vitest run` and `cd client && npx tsc --noEmit`

```bash
git add client/src/pages/freelancer/Tutorial.tsx client/src/pages/freelancer/Tutorial.test.tsx client/src/App.tsx
git commit -m "feat(client): port /freelancer/tutorial"
```
