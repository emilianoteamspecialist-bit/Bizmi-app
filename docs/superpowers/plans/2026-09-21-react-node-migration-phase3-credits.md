# React + Node Migration — Phase 3a (Freelancer Credits / Bizpal) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port `/freelancer/bizpal` — the freelancer's credit store: current balance, a "Buy credits" external Paystack link, a "Top up credits" modal that verifies a payment reference server-side and credits the account, purchase history with date filtering, and a static "how payout works" explainer — to `client/`. This is the first slice of Phase 3 ("Credits & realtime messaging" per the design spec); realtime messaging is a separate, later plan.

**Architecture:** Two new server endpoints on the existing `userRouter` (`server/src/routes/user.ts`, already home to `/credits`, `/profile`, `/avatar`, `/dashboard`): `GET /credits/history` (list the caller's `purchase_credits` rows) and `POST /credits/verify` (verify a payment reference against the Paystack API using the server-only secret key, then insert a `purchase_credits` row). The current balance reuses the already-ported `useDashboardQuery` (`credits` field) — no new balance endpoint. This is the first place in this migration's server code that calls an external HTTP API (Paystack's `/transaction/verify/:reference`); use Node's built-in global `fetch`.

**Tech Stack:** Same as prior phases (`client/`: React 19, TanStack Query, react-router; `server/`: Express + `req.supabase`). No new dependencies.

**Spec:** `docs/superpowers/specs/2026-09-08-nextjs-to-react-node-migration-design.md` (Section 7, Phase 3 row — "credit purchase flow, Paystack widget")

## Global Constraints

- **No inline Paystack JS widget.** The original app loads `https://js.paystack.co/v1/inline.js` globally in `app/layout.tsx` and references a "Paystack inline widget" in its own migration-inventory notes, but `PaystackPop.setup(...)` is never actually invoked anywhere in the current codebase — that script tag is dead weight from an earlier implementation. The real, current "buy credits" flow is: (1) a plain button that opens a fixed external Paystack Shop checkout link (`https://paystack.shop/pay/m7uebavu00`) in a new tab, where the user pays on Paystack's own hosted page, then (2) a "Top up credits" modal where the user manually pastes the amount paid and the payment reference from their receipt, which the server verifies against Paystack's API. This plan ports exactly that flow — no inline widget script, no `PaystackPop` integration.
- **Server-side `req.user!.id` replaces the client-supplied `user_id`.** The original's `/api/verify-transaction` route takes `user_id` from the request body and trusts it outright — any caller could pass an arbitrary `user_id` and credit someone else's account (or their own account under a different id if one existed). This is brand-new server code being written now, with no fidelity obligation to preserve that flaw (unlike a faithful port of pre-existing, already-shipped behavior) — the new route uses `req.user!.id` from the authenticated JWT exclusively; the client never sends a user id at all.
- **Rely on the existing DB-level `UNIQUE NOT NULL` constraint on `purchase_credits.paystack_reference`** (already present in the schema, see `scripts/create-credits-system-tables-v2.sql`) as the sole source of truth for duplicate-reference rejection. The original does a separate client-side pre-check query before calling verify (race-prone, and redundant with the DB constraint) — this plan drops that pre-check and instead has the server catch the resulting Postgres unique-violation (error code `23505`) and return a clean `400 { success: false, error: "This reference has already been used" }` instead of a generic 500.
- **The Paystack secret key (`PAYSTACK_SECRET_KEY`) is server-only** — used exclusively inside the new `POST /credits/verify` route via `process.env.PAYSTACK_SECRET_KEY`, never referenced anywhere in `client/`. Add the var (empty) to `server/.env.example`.
- **The "How payout works" panel is informational text only** — a static numbered list describing the (separate, Phase-4-gated) escrow/payout flow, plus a "Submit query" `mailto:` link. It contains no escrow API calls, no `Funded_jobs101` queries, and no `/api/escrow/*`/`/api/paystack/*` calls of any kind — porting this static copy is not building escrow functionality, and nothing here should be added beyond the literal text and the mailto link.
- **Current credits balance reuses `useDashboardQuery`** (`client/src/lib/queries/user.ts`, already ported) — its `credits` field is exactly the same aggregate the original computes. Do not add a second balance-fetching mechanism.
- **Role gate matches every other freelancer-only page**: `const { profile } = useAuth(); if (profile && profile.account_type !== "freelancer") return <Navigate to="/" replace />` — credits are a freelancer-only concept (agencies post jobs and pay in credits spent by freelancers, not vice versa).
- **Date-range filtering on purchase history stays client-side** over the full fetched list, matching the original exactly — this is a small, personal collection, not worth paginating or filtering server-side.
- **Status colors already use semantic tokens in the original for this specific page** (`bg-success/10 text-success`, `bg-warning/10 text-warning`, `bg-destructive/10 text-destructive`) — preserve as-is verbatim, no conversion needed.
- Every data need funnels through a query/mutation hook in `client/src/lib/queries/*.ts` — no page or component calls `apiFetch` directly.

---

## Task 1: `GET /credits/history` and `POST /credits/verify` server routes

**Files:**
- Modify: `server/src/routes/user.ts`
- Test: `server/src/routes/user.test.ts`
- Modify: `server/.env.example`

**Interfaces:**
- Produces: `GET /api/user/credits/history` — response `{ purchases: CreditPurchase[] }` where `CreditPurchase = { id, amount, credits_amount, status, created_at, paystack_reference }`.
- Produces: `POST /api/user/credits/verify` — request body `{ reference: string, credits_amount: number, amount: number }`; response `{ success: true, credits_added: number, purchase: CreditPurchase } | { success: false, error: string }` or a `400`/`500` status with `{ success: false, error: string }`.

- [ ] **Step 1: Write the failing tests**

Add to `server/src/routes/user.test.ts` (after the existing `describe("GET /credits", ...)` block):

```ts
describe("GET /credits/history", () => {
  it("returns the caller's purchase history, newest first", async () => {
    const orderMock = vi.fn().mockResolvedValue({
      data: [
        { id: "p-2", amount: 1000, credits_amount: 20, status: "completed", created_at: "2026-02-01T00:00:00Z", paystack_reference: "ref-2" },
        { id: "p-1", amount: 500, credits_amount: 10, status: "completed", created_at: "2026-01-01T00:00:00Z", paystack_reference: "ref-1" },
      ],
      error: null,
    })
    const eqMock = vi.fn(() => ({ order: orderMock }))
    const supabase = { from: vi.fn(() => ({ select: vi.fn(() => ({ eq: eqMock })) })) }

    const res = await request(appWith({ id: "user-1" }, supabase)).get("/credits/history")

    expect(res.status).toBe(200)
    expect(supabase.from).toHaveBeenCalledWith("purchase_credits")
    expect(eqMock).toHaveBeenCalledWith("freelancer_id", "user-1")
    expect(orderMock).toHaveBeenCalledWith("created_at", { ascending: false })
    expect(res.body.purchases).toHaveLength(2)
    expect(res.body.purchases[0].id).toBe("p-2")
  })

  it("returns an empty list on a query error", async () => {
    const orderMock = vi.fn().mockResolvedValue({ data: null, error: { message: "boom" } })
    const supabase = { from: vi.fn(() => ({ select: vi.fn(() => ({ eq: vi.fn(() => ({ order: orderMock })) })) })) }

    const res = await request(appWith({ id: "user-1" }, supabase)).get("/credits/history")

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ purchases: [] })
  })
})

describe("POST /credits/verify", () => {
  const validVerifyBody = { reference: "ref-123", credits_amount: 10, amount: 500 }

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("returns 400 when reference, credits_amount, or amount is missing or the wrong type", async () => {
    const supabase = { from: vi.fn() }
    const res = await request(appWith({ id: "user-1" }, supabase)).post("/credits/verify").send({ reference: "ref-123" })
    expect(res.status).toBe(400)
    expect(supabase.from).not.toHaveBeenCalled()
  })

  it("verifies with Paystack, inserts a completed purchase scoped to the caller, and returns success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ status: true, data: { status: "success", amount: 50000, currency: "NGN" } }),
      })
    )
    const insertedRow = { id: "p-1", amount: 500, credits_amount: 10, status: "completed", created_at: "2026-01-01T00:00:00Z", paystack_reference: "ref-123" }
    const singleMock = vi.fn().mockResolvedValue({ data: insertedRow, error: null })
    const selectMock = vi.fn(() => ({ single: singleMock }))
    const insertMock = vi.fn(() => ({ select: selectMock }))
    const supabase = { from: vi.fn(() => ({ insert: insertMock })) }

    const res = await request(appWith({ id: "user-1" }, supabase)).post("/credits/verify").send(validVerifyBody)

    expect(fetch).toHaveBeenCalledWith(
      "https://api.paystack.co/transaction/verify/ref-123",
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: expect.stringContaining("Bearer") }) })
    )
    expect(insertMock).toHaveBeenCalledWith({
      freelancer_id: "user-1",
      amount: 500,
      credits_amount: 10,
      paystack_reference: "ref-123",
      status: "completed",
    })
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ success: true, credits_added: 10, purchase: insertedRow })
  })

  it("returns 400 when Paystack reports the transaction as not successful", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ status: true, data: { status: "failed", amount: 50000, currency: "NGN" } }),
      })
    )
    const supabase = { from: vi.fn() }

    const res = await request(appWith({ id: "user-1" }, supabase)).post("/credits/verify").send(validVerifyBody)

    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
    expect(supabase.from).not.toHaveBeenCalled()
  })

  it("returns 400 when the paid amount doesn't match Paystack's recorded amount", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ status: true, data: { status: "success", amount: 10000, currency: "NGN" } }),
      })
    )
    const supabase = { from: vi.fn() }

    const res = await request(appWith({ id: "user-1" }, supabase)).post("/credits/verify").send(validVerifyBody)

    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
  })

  it("returns 400 with a clear message when the reference was already used", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ status: true, data: { status: "success", amount: 50000, currency: "NGN" } }),
      })
    )
    const singleMock = vi.fn().mockResolvedValue({ data: null, error: { code: "23505", message: "duplicate key" } })
    const supabase = { from: vi.fn(() => ({ insert: vi.fn(() => ({ select: vi.fn(() => ({ single: singleMock })) })) })) }

    const res = await request(appWith({ id: "user-1" }, supabase)).post("/credits/verify").send(validVerifyBody)

    expect(res.status).toBe(400)
    expect(res.body).toEqual({ success: false, error: "This reference has already been used" })
  })
})
```

The file's current import line is `import { describe, it, expect, vi } from "vitest"` — change it to `import { describe, it, expect, vi, afterEach } from "vitest"` (the new `POST /credits/verify` tests use `afterEach` to unstub the mocked global `fetch`).

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd server && npx vitest run src/routes/user.test.ts -t "credits/history|credits/verify"`
Expected: FAIL — neither route exists yet.

- [ ] **Step 3: Implement the routes**

In `server/src/routes/user.ts`, add (after the existing `GET /credits` block):

```ts
userRouter.get(
  "/credits/history",
  asyncHandler(async (req, res) => {
    const { data, error } = await req.supabase!
      .from("purchase_credits")
      .select("id, amount, credits_amount, status, created_at, paystack_reference")
      .eq("freelancer_id", req.user!.id)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Error fetching credit purchase history:", error)
      res.json({ purchases: [] })
      return
    }

    res.json({ purchases: data || [] })
  })
)

userRouter.post(
  "/credits/verify",
  asyncHandler(async (req, res) => {
    const { reference, credits_amount, amount } = req.body ?? {}
    if (typeof reference !== "string" || !reference.trim() || typeof credits_amount !== "number" || typeof amount !== "number") {
      res.status(400).json({ success: false, error: "reference, credits_amount, and amount are required" })
      return
    }

    const verifyRes = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` },
    })
    const verifyData = await verifyRes.json()

    if (!verifyRes.ok || verifyData.status === false) {
      res.status(400).json({ success: false, error: "Transaction verification failed" })
      return
    }

    const transaction = verifyData.data
    if (transaction.status !== "success") {
      res.status(400).json({ success: false, error: "Transaction not successful" })
      return
    }

    const expectedAmountKobo = Math.round(amount * 100)
    if (transaction.amount !== expectedAmountKobo) {
      res.status(400).json({ success: false, error: "Transaction amount does not match" })
      return
    }

    if (transaction.currency !== "NGN") {
      res.status(400).json({ success: false, error: "Invalid transaction currency" })
      return
    }

    const { data, error } = await req.supabase!
      .from("purchase_credits")
      .insert({
        freelancer_id: req.user!.id,
        amount,
        credits_amount,
        paystack_reference: reference,
        status: "completed",
      })
      .select()
      .single()

    if (error) {
      if (error.code === "23505") {
        res.status(400).json({ success: false, error: "This reference has already been used" })
        return
      }
      console.error("purchase_credits insert error:", error)
      res.status(500).json({ success: false, error: "Failed to save purchase record" })
      return
    }

    res.json({ success: true, credits_added: credits_amount, purchase: data })
  })
)
```

- [ ] **Step 4: Add the env var placeholder**

In `server/.env.example`, add a new line:

```
PAYSTACK_SECRET_KEY=
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd server && npx vitest run src/routes/user.test.ts`
Expected: PASS (all tests in the file, old and new)

- [ ] **Step 6: Run the full server test suite**

Run: `cd server && npx vitest run`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add server/src/routes/user.ts server/src/routes/user.test.ts server/.env.example
git commit -m "feat(server): add GET /credits/history and POST /credits/verify"
```

---

## Task 2: Client credits query/mutation hooks

**Files:**
- Create: `client/src/lib/queries/credits.ts`
- Test: `client/src/lib/queries/credits.test.tsx`

**Interfaces:**
- Consumes: `apiFetch` (`client/src/lib/api.ts`, existing).
- Produces: `CreditPurchase` type, `useCreditsHistoryQuery()`, `useVerifyCreditsMutation()` — used by Task 3/4.

- [ ] **Step 1: Write the failing tests**

```tsx
// client/src/lib/queries/credits.test.tsx
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

describe("useCreditsHistoryQuery", () => {
  it("GETs /api/user/credits/history and returns the purchase list", async () => {
    apiFetchMock.mockResolvedValue({
      purchases: [{ id: "p-1", amount: 500, credits_amount: 10, status: "completed", created_at: "2026-01-01T00:00:00Z", paystack_reference: "ref-1" }],
    })
    const { useCreditsHistoryQuery } = await import("./credits")

    const { result } = renderHook(() => useCreditsHistoryQuery(), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(apiFetchMock).toHaveBeenCalledWith("/api/user/credits/history")
    expect(result.current.data?.purchases[0].paystack_reference).toBe("ref-1")
  })
})

describe("useVerifyCreditsMutation", () => {
  it("POSTs /api/user/credits/verify with the given payload and invalidates the dashboard and history queries on success", async () => {
    apiFetchMock.mockResolvedValue({ success: true, credits_added: 10, purchase: { id: "p-1" } })
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const invalidateSpy = vi.spyOn(client, "invalidateQueries")
    const { useVerifyCreditsMutation } = await import("./credits")

    const { result } = renderHook(() => useVerifyCreditsMutation(), {
      wrapper: ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>,
    })
    result.current.mutate({ reference: "ref-1", credits_amount: 10, amount: 500 })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(apiFetchMock).toHaveBeenCalledWith("/api/user/credits/verify", {
      method: "POST",
      body: JSON.stringify({ reference: "ref-1", credits_amount: 10, amount: 500 }),
    })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["user", "dashboard"] })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["user", "credits", "history"] })
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd client && npx vitest run src/lib/queries/credits.test.tsx`
Expected: FAIL — `client/src/lib/queries/credits.ts` doesn't exist yet.

- [ ] **Step 3: Implement the hooks**

```ts
// client/src/lib/queries/credits.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { apiFetch } from "../api"

export type CreditPurchase = {
  id: string
  amount: number
  credits_amount: number
  status: string
  created_at: string
  paystack_reference: string
}

export function useCreditsHistoryQuery() {
  return useQuery({
    queryKey: ["user", "credits", "history"],
    queryFn: () => apiFetch<{ purchases: CreditPurchase[] }>("/api/user/credits/history"),
  })
}

export function useVerifyCreditsMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { reference: string; credits_amount: number; amount: number }) =>
      apiFetch<{ success: boolean; credits_added?: number; purchase?: CreditPurchase; error?: string }>(
        "/api/user/credits/verify",
        {
          method: "POST",
          body: JSON.stringify(input),
        }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user", "dashboard"] })
      queryClient.invalidateQueries({ queryKey: ["user", "credits", "history"] })
    },
  })
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd client && npx vitest run src/lib/queries/credits.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add client/src/lib/queries/credits.ts client/src/lib/queries/credits.test.tsx
git commit -m "feat(client): add credits history query and verify mutation"
```

---

## Task 3: `TopUpCreditsModal` component

**Files:**
- Create: `client/src/pages/freelancer/TopUpCreditsModal.tsx`
- Test: `client/src/pages/freelancer/TopUpCreditsModal.test.tsx`

**Interfaces:**
- Consumes: `useVerifyCreditsMutation` (Task 2, `@/lib/queries/credits`); `Dialog`/`DialogContent`/`DialogHeader`/`DialogTitle`, `Button`, `Input`, `Label` (all already ported).
- Produces: default export `TopUpCreditsModal`, props `{ isOpen: boolean; onClose: () => void; onSuccess: () => void }`. Task 4's `Bizpal.tsx` renders it.

- [ ] **Step 1: Write the failing tests**

```tsx
// client/src/pages/freelancer/TopUpCreditsModal.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

const verifyMutate = vi.fn()
vi.mock("../../lib/queries/credits", () => ({
  useVerifyCreditsMutation: () => ({ mutate: verifyMutate, isPending: false }),
}))

import TopUpCreditsModal from "./TopUpCreditsModal"

function renderModal(props: Partial<React.ComponentProps<typeof TopUpCreditsModal>> = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <TopUpCreditsModal isOpen onClose={vi.fn()} onSuccess={vi.fn()} {...props} />
    </QueryClientProvider>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("TopUpCreditsModal", () => {
  it("shows a validation error when the amount is below the minimum", async () => {
    const user = userEvent.setup()
    renderModal()

    await user.type(screen.getByLabelText(/amount paid/i), "100")
    await user.type(screen.getByLabelText(/payment reference/i), "ref-1")
    await user.click(screen.getByRole("button", { name: /verify payment/i }))

    expect(screen.getByText(/minimum amount is/i)).toBeInTheDocument()
    expect(verifyMutate).not.toHaveBeenCalled()
  })

  it("shows the calculated credit total once a valid amount is entered", async () => {
    const user = userEvent.setup()
    renderModal()

    await user.type(screen.getByLabelText(/amount paid/i), "1000")

    expect(screen.getByText("20 credits")).toBeInTheDocument()
  })

  it("calls the verify mutation with the amount, reference, and calculated credits", async () => {
    const user = userEvent.setup()
    renderModal()

    await user.type(screen.getByLabelText(/amount paid/i), "1000")
    await user.type(screen.getByLabelText(/payment reference/i), "ref-abc")
    await user.click(screen.getByRole("button", { name: /verify payment/i }))

    expect(verifyMutate).toHaveBeenCalledWith(
      { reference: "ref-abc", credits_amount: 20, amount: 1000 },
      expect.objectContaining({ onSuccess: expect.any(Function), onError: expect.any(Function) })
    )
  })

  it("shows the server's error message when verification fails", async () => {
    verifyMutate.mockImplementation((_input, { onSuccess }) => onSuccess({ success: false, error: "This reference has already been used" }))
    const user = userEvent.setup()
    renderModal()

    await user.type(screen.getByLabelText(/amount paid/i), "1000")
    await user.type(screen.getByLabelText(/payment reference/i), "ref-abc")
    await user.click(screen.getByRole("button", { name: /verify payment/i }))

    await waitFor(() => expect(screen.getByText("This reference has already been used")).toBeInTheDocument())
  })

  it("calls onSuccess and onClose after a successful verification", async () => {
    const onSuccess = vi.fn()
    const onClose = vi.fn()
    verifyMutate.mockImplementation((_input, { onSuccess: succeed }) => succeed({ success: true, credits_added: 20 }))
    const user = userEvent.setup()
    renderModal({ onSuccess, onClose })

    await user.type(screen.getByLabelText(/amount paid/i), "1000")
    await user.type(screen.getByLabelText(/payment reference/i), "ref-abc")
    await user.click(screen.getByRole("button", { name: /verify payment/i }))

    await waitFor(() => expect(onSuccess).toHaveBeenCalled())
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd client && npx vitest run src/pages/freelancer/TopUpCreditsModal.test.tsx`
Expected: FAIL — `Cannot find module './TopUpCreditsModal'`

- [ ] **Step 3: Write `client/src/pages/freelancer/TopUpCreditsModal.tsx`**

```tsx
import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2 } from "lucide-react"
import { useVerifyCreditsMutation } from "@/lib/queries/credits"

const CREDITS_RATE = 50 // ₦50 per credit
const MIN_AMOUNT = 500 // ₦500 minimum (10 credits)

export default function TopUpCreditsModal({
  isOpen,
  onClose,
  onSuccess,
}: {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}) {
  const [amountPaid, setAmountPaid] = useState("")
  const [reference, setReference] = useState("")
  const [error, setError] = useState("")
  const verify = useVerifyCreditsMutation()

  const amount = Number.parseFloat(amountPaid) || 0
  const totalCredits = Math.floor(amount / CREDITS_RATE)

  const handleClose = () => {
    if (verify.isPending) return
    setAmountPaid("")
    setReference("")
    setError("")
    onClose()
  }

  const handleVerify = (event: React.FormEvent) => {
    event.preventDefault()
    setError("")

    if (!amount || amount < MIN_AMOUNT) {
      setError(`Minimum amount is ₦${MIN_AMOUNT.toLocaleString()}`)
      return
    }
    if (!reference.trim()) {
      setError("Reference ID is required")
      return
    }

    verify.mutate(
      { reference: reference.trim(), credits_amount: totalCredits, amount },
      {
        onSuccess: (result) => {
          if (!result.success) {
            setError(result.error || "Verification failed")
            return
          }
          onSuccess()
          handleClose()
        },
        onError: () => setError("Failed to verify payment"),
      }
    )
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="w-[95vw] max-w-md sm:max-w-lg mx-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>Top up credits</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleVerify} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="amount-paid">Amount Paid (₦)</Label>
            <Input
              id="amount-paid"
              type="number"
              min={MIN_AMOUNT}
              step="0.01"
              value={amountPaid}
              onChange={(e) => setAmountPaid(e.target.value)}
              placeholder={`Minimum ₦${MIN_AMOUNT.toLocaleString()}`}
              disabled={verify.isPending}
              required
            />
            <p className="text-xs text-muted-foreground">Rate: 10 credits = ₦500 · Minimum: ₦{MIN_AMOUNT.toLocaleString()}</p>
          </div>

          {amount >= MIN_AMOUNT && (
            <div className="p-3 bg-primary/10 rounded-lg border border-border text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Amount Paid:</span>
                <span className="font-medium">₦{amount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between mt-2 pt-2 border-t border-border">
                <span className="font-medium text-primary">Total Credits:</span>
                <span className="font-bold text-primary">{totalCredits} credits</span>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="payment-reference">Payment Reference ID</Label>
            <Input
              id="payment-reference"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Enter your payment reference ID"
              disabled={verify.isPending}
              required
            />
            <p className="text-xs text-muted-foreground">Enter the reference ID from your payment confirmation</p>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" onClick={handleClose} disabled={verify.isPending} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" disabled={verify.isPending} className="flex-1">
              {verify.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verifying...
                </>
              ) : (
                "Verify Payment"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd client && npx vitest run src/pages/freelancer/TopUpCreditsModal.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/freelancer/TopUpCreditsModal.tsx client/src/pages/freelancer/TopUpCreditsModal.test.tsx
git commit -m "Port credits top-up verification modal to client"
```

---

## Task 4: `Bizpal` page

**Files:**
- Create: `client/src/pages/freelancer/Bizpal.tsx`
- Test: `client/src/pages/freelancer/Bizpal.test.tsx`

**Interfaces:**
- Consumes: `useAuth` (`@/contexts/AuthContext`, existing); `useDashboardQuery` (`@/lib/queries/user`, existing, for the credits balance); `useCreditsHistoryQuery` (Task 2, `@/lib/queries/credits`); `TopUpCreditsModal` (Task 3).
- Produces: default export `Bizpal`, mounted at `/freelancer/bizpal` in Task 5's `App.tsx`.

- [ ] **Step 1: Write the failing tests**

```tsx
// client/src/pages/freelancer/Bizpal.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor, fireEvent } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Routes, Route } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

const useAuthMock = vi.fn()
vi.mock("../../contexts/AuthContext", () => ({ useAuth: () => useAuthMock() }))

const useDashboardQueryMock = vi.fn()
vi.mock("../../lib/queries/user", () => ({
  useDashboardQuery: (...args: unknown[]) => useDashboardQueryMock(...args),
}))

const useCreditsHistoryQueryMock = vi.fn()
vi.mock("../../lib/queries/credits", () => ({
  useCreditsHistoryQuery: () => useCreditsHistoryQueryMock(),
}))

import Bizpal from "./Bizpal"

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/freelancer/bizpal"]}>
        <Routes>
          <Route path="/" element={<div>home</div>} />
          <Route path="/freelancer/bizpal" element={<Bizpal />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  useAuthMock.mockReturnValue({ profile: { account_type: "freelancer" } })
  useDashboardQueryMock.mockReturnValue({ isLoading: false, data: { credits: 40 } })
  useCreditsHistoryQueryMock.mockReturnValue({ isLoading: false, data: { purchases: [] } })
})

describe("Bizpal", () => {
  it("redirects home when the signed-in user's account_type isn't freelancer", async () => {
    useAuthMock.mockReturnValue({ profile: { account_type: "agency" } })
    renderPage()
    await waitFor(() => expect(screen.getByText("home")).toBeInTheDocument())
  })

  it("shows a loading skeleton while dashboard or history data is pending", () => {
    useDashboardQueryMock.mockReturnValue({ isLoading: true, data: undefined })
    renderPage()
    expect(screen.getByTestId("bizpal-skeleton")).toBeInTheDocument()
  })

  it("shows the current credits balance", () => {
    renderPage()
    expect(screen.getByText("40")).toBeInTheDocument()
  })

  it("shows the empty state when there is no purchase history", () => {
    renderPage()
    expect(screen.getByText("No credits purchased yet")).toBeInTheDocument()
  })

  it("renders purchase history rows", () => {
    useCreditsHistoryQueryMock.mockReturnValue({
      isLoading: false,
      data: {
        purchases: [
          { id: "p-1", amount: 500, credits_amount: 10, status: "completed", created_at: "2026-01-01T00:00:00Z", paystack_reference: "ref-1" },
        ],
      },
    })
    renderPage()
    expect(screen.getByText("Credits purchase")).toBeInTheDocument()
    expect(screen.getByText("10 credits")).toBeInTheDocument()
  })

  it("filters purchase history by date range", async () => {
    useCreditsHistoryQueryMock.mockReturnValue({
      isLoading: false,
      data: {
        purchases: [
          { id: "p-1", amount: 500, credits_amount: 10, status: "completed", created_at: "2026-01-01T00:00:00Z", paystack_reference: "ref-1" },
          { id: "p-2", amount: 1000, credits_amount: 20, status: "completed", created_at: "2026-03-01T00:00:00Z", paystack_reference: "ref-2" },
        ],
      },
    })
    const user = userEvent.setup()
    renderPage()

    expect(screen.getByText("10 credits")).toBeInTheDocument()
    expect(screen.getByText("20 credits")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: /filter/i }))
    fireEvent.change(screen.getByLabelText(/from date/i), { target: { value: "2026-02-01" } })

    await waitFor(() => {
      expect(screen.queryByText("10 credits")).not.toBeInTheDocument()
      expect(screen.getByText("20 credits")).toBeInTheDocument()
    })
  })

  it("opens the top-up modal when 'Top up credits' is clicked", async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(screen.getByRole("button", { name: /top up credits/i }))

    expect(screen.getByRole("heading", { name: /top up credits/i })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd client && npx vitest run src/pages/freelancer/Bizpal.test.tsx`
Expected: FAIL — `Cannot find module './Bizpal'`

- [ ] **Step 3: Write `client/src/pages/freelancer/Bizpal.tsx`**

```tsx
import { useMemo, useState } from "react"
import { Navigate } from "react-router-dom"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Coins, Filter, X, Mail, ArrowRight, Wallet } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { useDashboardQuery } from "@/lib/queries/user"
import { useCreditsHistoryQuery, type CreditPurchase } from "@/lib/queries/credits"
import TopUpCreditsModal from "./TopUpCreditsModal"

const PAYOUT_STEPS = [
  "An agency funds a job.",
  "You click Verify to verify the payment.",
  "You click Confirm to confirm the job.",
  "You deliver the work successfully.",
  "The agency clicks Job done on their side.",
  "The Payout button becomes visible.",
  "Click Payout, enter your correct bank details, and withdraw.",
]

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", currencyDisplay: "symbol" })
    .format(amount)
    .replace(/NGN/, "₦")
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
}

function statusClass(status: string) {
  if (status === "completed") return "bg-success/10 text-success"
  if (status === "pending") return "bg-warning/10 text-warning"
  return "bg-destructive/10 text-destructive"
}

export default function Bizpal() {
  const { profile } = useAuth()
  const dashboard = useDashboardQuery()
  const history = useCreditsHistoryQuery()
  const [showTopUpModal, setShowTopUpModal] = useState(false)
  const [showDateFilter, setShowDateFilter] = useState(false)
  const [fromDate, setFromDate] = useState("")
  const [toDate, setToDate] = useState("")

  if (profile && profile.account_type !== "freelancer") {
    return <Navigate to="/" replace />
  }

  if (dashboard.isLoading || history.isLoading) {
    return (
      <div data-testid="bizpal-skeleton" className="min-h-screen bg-surface">
        <div className="max-w-6xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-foreground/5 rounded w-1/4" />
            <div className="h-32 bg-card border border-border rounded-xl sm:max-w-sm" />
            <div className="grid lg:grid-cols-2 gap-6">
              <div className="h-64 bg-card border border-border rounded-xl" />
              <div className="h-64 bg-card border border-border rounded-xl" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  const currentCredits = dashboard.data?.credits ?? 0
  const purchases: CreditPurchase[] = history.data?.purchases ?? []

  const filteredPurchases = purchases.filter((purchase) => {
    if (!fromDate && !toDate) return true
    const purchaseDate = new Date(purchase.created_at)
    const from = fromDate ? new Date(fromDate) : null
    const to = toDate ? new Date(toDate) : null
    if (from && to) return purchaseDate >= from && purchaseDate <= to
    if (from) return purchaseDate >= from
    if (to) return purchaseDate <= to
    return true
  })

  const clearDateFilter = () => {
    setFromDate("")
    setToDate("")
    setShowDateFilter(false)
  }

  const handleSubmitQuery = () => {
    window.location.href = "mailto:contact@bizimii.com?subject=Bizpal Query&body=Hello, I have a query regarding..."
  }

  return (
    <div className="min-h-screen bg-surface pb-20">
      <div className="max-w-6xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Wallet</p>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Bizpal</h1>
            <p className="text-sm text-muted-foreground">Manage your payments and credits.</p>
          </div>
          <Button
            onClick={() => window.open("https://paystack.shop/pay/m7uebavu00", "_blank")}
            className="h-10 px-4 rounded-lg shrink-0 w-full sm:w-auto"
          >
            Buy credits
          </Button>
        </header>

        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-aubergine via-ink to-ink p-6 sm:p-8 text-white shadow-lg shadow-aubergine/20 mb-6">
          <div className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 rounded-full bg-primary/30 blur-3xl" aria-hidden />
          <div className="pointer-events-none absolute right-10 -bottom-6 opacity-[0.06]" aria-hidden>
            <Coins className="h-32 w-32" />
          </div>
          <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-white/10 flex items-center justify-center">
                  <Coins className="h-4 w-4 text-primary" />
                </div>
                <p className="text-[11px] font-medium uppercase tracking-[0.15em] text-white/60">Available credits</p>
              </div>
              <p className="mt-3 text-5xl font-semibold tracking-tight tabular-nums">{currentCredits.toLocaleString()}</p>
              <p className="mt-1 text-xs text-white/50">≈ ₦{(currentCredits * 50).toLocaleString()} · ₦50 per credit</p>
            </div>
            <div className="flex flex-col gap-2 sm:items-end">
              <Button onClick={() => setShowTopUpModal(true)} className="bg-primary text-white hover:bg-primary-hover sm:px-8">
                Top up credits
              </Button>
              <p className="text-[11px] text-white/40">Min: 10 credits (₦500)</p>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          <Card className="rounded-xl border border-border bg-card shadow-none">
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle className="flex items-center gap-2 text-base font-semibold">
                  <Coins className="h-5 w-5 text-primary" />
                  Credits Purchase History
                </CardTitle>
                <Button onClick={() => setShowDateFilter(!showDateFilter)} variant="outline" size="sm" className="flex items-center gap-2">
                  <Filter className="h-4 w-4" />
                  Filter
                </Button>
              </div>

              {showDateFilter && (
                <div className="mt-4 p-4 bg-surface-2 rounded-lg border border-border">
                  <div className="flex flex-col sm:flex-row gap-4">
                    <div className="flex-1">
                      <Label htmlFor="fromDate" className="text-sm font-medium">
                        From Date
                      </Label>
                      <Input id="fromDate" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="mt-1" />
                    </div>
                    <div className="flex-1">
                      <Label htmlFor="toDate" className="text-sm font-medium">
                        To Date
                      </Label>
                      <Input id="toDate" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="mt-1" />
                    </div>
                    <div className="flex items-end">
                      <Button onClick={clearDateFilter} variant="outline" size="sm" className="flex items-center gap-2 bg-transparent">
                        <X className="h-4 w-4" />
                        Clear
                      </Button>
                    </div>
                  </div>
                  {(fromDate || toDate) && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Showing {filteredPurchases.length} of {purchases.length} purchases
                    </p>
                  )}
                </div>
              )}
            </CardHeader>
            <CardContent>
              {filteredPurchases.length === 0 ? (
                <div className="text-center py-12">
                  <div className="mx-auto h-11 w-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                    <Coins className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 text-sm font-semibold text-foreground">
                    {purchases.length === 0 ? "No credits purchased yet" : "No purchases found"}
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground max-w-sm mx-auto">
                    {purchases.length === 0
                      ? "Purchase credits to access premium features and services."
                      : "Try adjusting your date filter to see more results."}
                  </p>
                  {purchases.length === 0 && <p className="mt-2 text-xs text-muted-foreground">Rate: 10 credits = ₦500 (₦50 per credit)</p>}
                </div>
              ) : (
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {filteredPurchases.map((purchase) => (
                    <div
                      key={purchase.id}
                      className="flex items-center justify-between gap-3 p-4 border border-border rounded-lg transition-colors hover:bg-surface/60"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-10 w-10 shrink-0 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Coins className="h-5 w-5 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-sm font-medium text-foreground truncate">
                            {purchase.credits_amount > 0 ? "Credits purchase" : "Credits used (job bid)"}
                          </h4>
                          <p className="text-xs text-muted-foreground">{Math.abs(purchase.credits_amount).toLocaleString()} credits</p>
                          <p className="text-xs text-muted-foreground">{formatDate(purchase.created_at)}</p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={`text-sm font-semibold tabular-nums ${purchase.credits_amount > 0 ? "text-foreground" : "text-destructive"}`}>
                          {purchase.credits_amount > 0 ? formatCurrency(purchase.amount) : `${purchase.credits_amount} credits`}
                        </p>
                        <span className={`mt-1 inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${statusClass(purchase.status)}`}>
                          {purchase.status === "completed" ? "Completed" : purchase.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-xl border border-border bg-card shadow-none">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <Wallet className="h-5 w-5 text-primary" />
                How payout works
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <ol className="relative">
                  {PAYOUT_STEPS.map((step, i) => (
                    <li key={i} className="relative flex gap-4 pb-5 last:pb-0">
                      {i < PAYOUT_STEPS.length - 1 && (
                        <span className="absolute left-4 top-8 bottom-0 w-px -translate-x-1/2 bg-border" aria-hidden />
                      )}
                      <span className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary text-xs font-semibold tabular-nums">
                        {i + 1}
                      </span>
                      <p className="pt-1.5 text-sm text-foreground">{step}</p>
                    </li>
                  ))}
                </ol>

                <div className="pt-4 border-t border-border">
                  <p className="text-sm text-muted-foreground mb-4">
                    Have questions about failed transactions or need support? Contact us directly.
                  </p>
                  <Button onClick={handleSubmitQuery} className="w-full gap-2">
                    <Mail className="h-4 w-4" />
                    Submit query
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <TopUpCreditsModal isOpen={showTopUpModal} onClose={() => setShowTopUpModal(false)} onSuccess={() => setShowTopUpModal(false)} />
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd client && npx vitest run src/pages/freelancer/Bizpal.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/freelancer/Bizpal.tsx client/src/pages/freelancer/Bizpal.test.tsx
git commit -m "Port freelancer credits (Bizpal) page to client"
```

---

## Task 5: Wire the route into `App.tsx`

**Files:**
- Modify: `client/src/App.tsx`
- Test: `client/src/App.test.tsx` (extend)

**Interfaces:** none new — this task wires Task 4's page into the existing route table.

- [ ] **Step 1: Write the failing test**

Add to `client/src/App.test.tsx` (a new top-level `describe`, after the existing protected-route describes):

```tsx
describe("bizpal route", () => {
  it("redirects /freelancer/bizpal to /login when signed out", async () => {
    renderAt("/freelancer/bizpal")
    await screen.findByRole("heading", { name: /Continue your work/i })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client && npx vitest run src/App.test.tsx -t "bizpal"`
Expected: FAIL — no route registered for `/freelancer/bizpal`.

- [ ] **Step 3: Update `client/src/App.tsx`**

Read the current file first to find its import block and the other `/freelancer/*` routes, and add both alongside them (before the existing catch-all `<Route path="*">` route). Add the import:

```tsx
import Bizpal from "./pages/freelancer/Bizpal"
```

Add the route, next to the other `/freelancer/*` routes:

```tsx
            <Route
              path="/freelancer/bizpal"
              element={
                <RequireAuth>
                  <Bizpal />
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
git commit -m "Wire freelancer bizpal (credits) route behind RequireAuth"
```

---

## Post-Phase-3a note

This plan covers the credits half of Phase 3 only. Deferred to the next plan: realtime messaging (Supabase Realtime channels re-subscribed in React — dispute chat, agency proposal feeds, freelancer/agency messaging), the second half of Phase 3 per the design spec. Deferred further: the Paystack/credits webhook consolidation the spec's risk section flags (`app/api/paystack/webhook` and `app/api/credits/webhook` both implement signature verification independently) — this plan's verify flow is the existing synchronous client-triggered pattern, not a webhook, so that consolidation is out of scope here and belongs with whichever future phase actually ports a webhook-driven flow (most likely Phase 4's escrow work, which the spec explicitly calls out for this consolidation).
