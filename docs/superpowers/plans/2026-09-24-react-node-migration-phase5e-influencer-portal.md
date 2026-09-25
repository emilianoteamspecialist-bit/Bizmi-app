# Phase 5e: Influencer Self-Service Portal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the influencer role's own self-service pages (dashboard, referrals, earnings) from the legacy Next.js app (`app/influencer/*`, `lib/influencer.ts`, `lib/influencer-sync.ts`) to the new `client/`+`server/` stack — completing Phase 5's escrow-independent slice.

**Architecture:** One new Express route, `GET /api/influencer/me`, folds together the legacy read (`lib/influencer.ts`'s `getInfluencerData`) and the legacy idempotent first-load sync (`lib/influencer-sync.ts`'s `runReferralSync`) into a single handler that runs on every call: it uses the service-role client for the two system writes (ensure the influencer's own profile+referral code exist; attribute a referral from a signup's stashed `ref_code` once), then reads the influencer's own data back through the request-scoped, RLS-bound client as defense-in-depth (real RLS on `influencer_profiles`/`referrals`/`influencer_payouts` already restricts each to the caller's own rows — see `supabase/migrations/20260628000000_influencer_referral_program.sql`). Three client pages (`/influencer/dashboard`, `/influencer/referrals`, `/influencer/earnings`) share one `useInfluencerMeQuery()` hook and a ported `InfluencerSidebar`, each gating on `profile.account_type !== "influencer"` inline (no wrapper component), matching the Phase 5a admin-portal convention already established in this migration.

**Tech Stack:** Express 5 + TypeScript (server), Vite + React 19 + TanStack Query + React Router (client), Supabase (Postgres/Auth/RLS), Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-09-08-nextjs-to-react-node-migration-design.md`. Legacy source being ported: `app/influencer/layout.tsx`, `app/influencer/dashboard/{page,InfluencerDashboardClient}.tsx`, `app/influencer/referrals/page.tsx`, `app/influencer/earnings/page.tsx`, `lib/influencer.ts`, `lib/influencer-sync.ts`, `lib/referral-code.ts`, `components/influencer-sidebar.tsx`.

## Global Constraints

- Money is stored as `bigint` kobo in Postgres; this route follows the legacy `getInfluencerData()`'s own precedent of converting to naira (`earnedNaira`/`unpaidNaira`) before it leaves the server, since this is a read-only display value (not a payment-processing calculation) — do not "fix" this to return kobo, it would just move the same conversion into the client for no benefit and diverge from the already-reviewed Phase 5d admin-influencers response shape (`AdminInfluencerRow.earnedNaira`/`unpaidNaira`), which uses the identical convention.
- All writes in the sync step (`influencer_profiles` insert, `referrals` insert, `profiles.referred_by` update, `influencer_profiles.total_referrals` update) MUST use `createServiceClient()` — per `supabase/migrations/20260628000000_influencer_referral_program.sql`, there are no client INSERT/UPDATE policies on these tables at all, so a request-scoped client would fail these writes outright, not just violate the boundary convention.
- The final read of the influencer's own data (profile counters, referrals, payouts) MUST use `req.supabase!` (the request-scoped, RLS-bound client), not the service client — this is deliberate defense-in-depth alongside the `.eq()` filters already in the query, matching this migration's established convention (see the Phase 3b IDOR note: "when the codebase has an established defense-in-depth convention, fix explicitly anyway; don't rely on RLS alone to justify skipping it" — the same logic applies in reverse here: don't reach for the service client just because it's already open in the same handler).
- Role-gating on each of the 3 pages is an inline check (`if (profile && profile.account_type !== "influencer") return <Navigate to="/" replace />`), copied verbatim in shape from `client/src/pages/freelancer/Dashboard.tsx:101-103` — no new wrapper/layout component, matching the Phase 5a Global Constraint that established this convention for the admin portal.
- Any test that renders `InfluencerSidebar` (directly, or via a page that includes it) MUST mock `../../contexts/AuthContext` with `vi.mock("../../contexts/AuthContext", () => ({ useAuth: () => ({ signOut: vi.fn() }) }))` (or, for a page that also reads `profile`, extend the returned object with a `profile` field) — `AuthContext.tsx` imports the real `lib/supabase.ts` at module scope, which throws under Vitest with no env vars, so mocking the whole module is required, not optional (confirmed hard requirement across every admin-page test in Phase 5a-5d).
- `InfluencerSidebar` must NOT read `profile.full_name` or render an avatar/dropdown — mirror `client/src/components/AdminSidebar.tsx`'s already-reviewed simplification (nav list + a plain logout button, nothing else), not the legacy `components/influencer-sidebar.tsx`'s heavier `SidebarProvider`-based version with an avatar dropdown menu.
- Any `useState` whose initial value should reflect data from a query must not be seeded directly from that query's data at the top of a component that renders during `isLoading` — this exact bug shipped twice in this migration already (Phase 2d profile forms, Phase 5d `AdminInfluencers` settings form) and was only caught at final review both times. None of this phase's state is query-seeded (`copied`/`isMobileMenuOpen` are pure UI toggles), but re-verify this explicitly before merging if any task deviates from the code given below.

## Review Focus

- A non-influencer (or an influencer who hasn't been assigned a `referral_code` yet) opens `/influencer/dashboard` directly — must redirect via the inline `account_type` check, and if they somehow pass that (e.g. `account_type` is `"influencer"` but `influencer_profiles` row creation is still pending), the dashboard must render the "referral link is being set up" placeholder rather than crash on `referralCode: null`.
- The referral-code insert retry loop exhausts all 5 attempts on repeated unique-violation collisions — must not throw an unhandled error or crash the request; the route should still return a valid (if code-less) response.
- A user signs up via a referral link but is the same person as the referring influencer (self-referral, `influencerId === userId`) — must not create a `referrals` row or credit anyone.
- `GET /api/influencer/me` is called twice in a row for a user who already has an attributed referral — the second call must not insert a duplicate `referrals` row (blocked by the `already` check) nor double-increment the influencer's `total_referrals`.
- An invalid or stale `ref_code` in `user_metadata` (no `influencer_profiles` row has that code) — must be silently ignored, not throw, and not attribute to a wrong influencer.

---

### Task 1: Server — `user_metadata` on `req.user`, ported referral-code generator, `GET /api/influencer/me`

**Files:**
- Modify: `server/src/types/express.d.ts`
- Modify: `server/src/middleware/auth.ts`
- Modify: `server/src/middleware/auth.test.ts`
- Create: `server/src/lib/referralCode.ts`
- Create: `server/src/lib/referralCode.test.ts`
- Create: `server/src/routes/influencer.ts`
- Create: `server/src/routes/influencer.test.ts`
- Modify: `server/src/app.ts`

**Interfaces:**
- Consumes: `createServiceClient()` from `server/src/lib/supabase.ts` (existing); `asyncHandler` from `server/src/lib/http.ts` (existing); `requireAuth` from `server/src/middleware/auth.ts` (existing, modified by this task).
- Produces: `req.user!.user_metadata: Record<string, unknown>` (always present, defaults to `{}`) — consumed by no other route in this phase, but available to any future route; `generateReferralCode(length = 10): string` from `server/src/lib/referralCode.ts`; the mounted route `GET /api/influencer/me` returning:
  ```ts
  {
    referralCode: string | null
    displayName: string | null
    socialHandle: string | null
    totals: { referred: number; qualified: number; pending: number; earnedNaira: number; unpaidNaira: number }
    referrals: Array<{ id: string; referred_account_type: string | null; status: string; commission_kobo: number | null; created_at: string; qualified_at: string | null }>
    payouts: Array<{ id: string; amount_kobo: number; status: string; processed_at: string | null; note: string | null }>
  }
  ```
  Tasks 2-4 consume this exact shape via `useInfluencerMeQuery()`.

- [ ] **Step 1: Extend the `req.user` type to carry `user_metadata`**

Edit `server/src/types/express.d.ts`:

```ts
import type { SupabaseClient } from "@supabase/supabase-js"

declare global {
  namespace Express {
    interface Request {
      user?: { id: string; email?: string; user_metadata?: Record<string, unknown> }
      supabase?: SupabaseClient
    }
  }
}

export {}
```

- [ ] **Step 2: Write the failing test for `requireAuth` attaching `user_metadata`**

Edit `server/src/middleware/auth.test.ts` — replace the existing "attaches req.user and req.supabase" test and add one more:

```ts
  it("attaches req.user (including user_metadata) and req.supabase and calls next() on success", async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: "user-1", email: "a@b.com" } },
      error: null,
    })
    const { requireAuth } = await import("./auth.js")
    const req = { headers: { authorization: "Bearer good-token" } } as Request
    const res = mockRes()
    const next = vi.fn()

    await requireAuth(req, res, next)

    expect(req.user).toEqual({ id: "user-1", email: "a@b.com", user_metadata: {} })
    expect(req.supabase).toBeDefined()
    expect(next).toHaveBeenCalledOnce()
  })

  it("carries through a real user_metadata object when Supabase returns one", async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: "user-2", email: "c@d.com", user_metadata: { ref_code: "abc123", full_name: "Jane Doe" } } },
      error: null,
    })
    const { requireAuth } = await import("./auth.js")
    const req = { headers: { authorization: "Bearer good-token" } } as Request
    const res = mockRes()
    const next = vi.fn()

    await requireAuth(req, res, next)

    expect(req.user?.user_metadata).toEqual({ ref_code: "abc123", full_name: "Jane Doe" })
  })
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter server test -- auth.test.ts`
Expected: FAIL — `req.user` does not yet include `user_metadata`.

- [ ] **Step 4: Update `requireAuth` to attach `user_metadata`**

Edit `server/src/middleware/auth.ts`:

```ts
  req.user = { id: data.user.id, email: data.user.email, user_metadata: data.user.user_metadata ?? {} }
  req.supabase = supabase
  next()
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter server test -- auth.test.ts`
Expected: PASS (all 4 tests, including the two pre-existing ones).

- [ ] **Step 6: Commit**

```bash
git add server/src/types/express.d.ts server/src/middleware/auth.ts server/src/middleware/auth.test.ts
git commit -m "feat(server): carry user_metadata on req.user"
```

- [ ] **Step 7: Write the failing test for the referral-code generator**

Create `server/src/lib/referralCode.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import { generateReferralCode } from "./referralCode.js"

describe("generateReferralCode", () => {
  it("generates a code of the requested length using only unambiguous lowercase/digit characters", () => {
    const code = generateReferralCode(10)
    expect(code).toHaveLength(10)
    expect(code).toMatch(/^[abcdefghjkmnpqrstuvwxyz23456789]+$/)
  })

  it("defaults to length 10 when no length is given", () => {
    expect(generateReferralCode()).toHaveLength(10)
  })

  it("generates different codes across calls", () => {
    const codes = new Set(Array.from({ length: 20 }, () => generateReferralCode()))
    expect(codes.size).toBe(20)
  })
})
```

- [ ] **Step 8: Run test to verify it fails**

Run: `pnpm --filter server test -- referralCode.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 9: Port the referral-code generator**

Create `server/src/lib/referralCode.ts` (verbatim port of `lib/referral-code.ts`):

```ts
import { randomBytes } from "crypto"

// Short, URL-friendly referral code. Avoids ambiguous characters (0/o, 1/l/i)
// so codes are easy to read and share. Uniqueness is enforced by the
// influencer_profiles.referral_code UNIQUE constraint -- the caller retries on
// the rare collision.
//
// Uses a CSPRNG with rejection sampling so codes are unguessable and unbiased
// across the alphabet (no modulo bias).
const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789" // 31 chars
const MAX_UNBIASED = Math.floor(256 / ALPHABET.length) * ALPHABET.length // 248

export function generateReferralCode(length = 10): string {
  let code = ""
  while (code.length < length) {
    const bytes = randomBytes(length - code.length + 4)
    for (let i = 0; i < bytes.length && code.length < length; i++) {
      const b = bytes[i]
      if (b < MAX_UNBIASED) code += ALPHABET[b % ALPHABET.length]
    }
  }
  return code
}
```

- [ ] **Step 10: Run test to verify it passes**

Run: `pnpm --filter server test -- referralCode.test.ts`
Expected: PASS (3/3).

- [ ] **Step 11: Commit**

```bash
git add server/src/lib/referralCode.ts server/src/lib/referralCode.test.ts
git commit -m "feat(server): port generateReferralCode"
```

- [ ] **Step 12: Write the failing tests for `GET /api/influencer/me`**

Create `server/src/routes/influencer.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest"
import request from "supertest"
import express from "express"

const fakeService = { from: vi.fn() }
vi.mock("../lib/supabase.js", () => ({ createServiceClient: () => fakeService }))
vi.mock("../lib/referralCode.js", () => ({ generateReferralCode: () => "newcode123" }))

function appWith(user: { id: string; user_metadata?: Record<string, unknown> }, supabase: any) {
  const app = express()
  app.use(express.json())
  app.use((req: any, _res, next) => {
    req.user = user
    req.supabase = supabase
    next()
  })
  app.use("/", (async () => (await import("./influencer.js")).default)())
  return app
}

// Builds a chainable query-builder stub: .select().eq().maybeSingle() /
// .order() etc. all resolve to the given result.
function builder(result: { data: any; error: any } = { data: null, error: null }) {
  const b: any = {}
  const chain = () => b
  b.select = vi.fn(chain)
  b.eq = vi.fn(chain)
  b.in = vi.fn(chain)
  b.order = vi.fn(() => Promise.resolve(result))
  b.maybeSingle = vi.fn(() => Promise.resolve(result))
  b.insert = vi.fn(() => Promise.resolve(result))
  b.update = vi.fn(chain)
  return b
}

function readSupabase({ profile = null, referrals = [], payouts = [] }: { profile?: any; referrals?: any[]; payouts?: any[] } = {}) {
  return {
    from: vi.fn((table: string) => {
      if (table === "influencer_profiles") return builder({ data: profile, error: null })
      if (table === "referrals") return builder({ data: referrals, error: null })
      if (table === "influencer_payouts") return builder({ data: payouts, error: null })
      throw new Error(`unexpected read table ${table}`)
    }),
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("GET /me", () => {
  it("creates a new influencer profile + referral code on first load when none exists, and returns zeroed totals", async () => {
    const tables: Record<string, any> = {
      profiles: builder({ data: { account_type: "influencer" }, error: null }),
      influencer_profiles: builder({ data: null, error: null }), // no existing row
    }
    fakeService.from.mockImplementation((table: string) => {
      if (tables[table]) return tables[table]
      throw new Error(`unexpected service table ${table}`)
    })
    const supabase = readSupabase({ profile: null, referrals: [], payouts: [] })

    const res = await request(appWith({ id: "user-1", user_metadata: {} }, supabase)).get("/me")

    expect(res.status).toBe(200)
    expect(tables.influencer_profiles.insert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: "user-1", referral_code: "newcode123" })
    )
    expect(res.body).toEqual({
      referralCode: null,
      displayName: null,
      socialHandle: null,
      totals: { referred: 0, qualified: 0, pending: 0, earnedNaira: 0, unpaidNaira: 0 },
      referrals: [],
      payouts: [],
    })
  })

  it("skips profile creation and returns real data when an influencer_profiles row already exists", async () => {
    const tables: Record<string, any> = {
      profiles: builder({ data: { account_type: "influencer" }, error: null }),
      influencer_profiles: builder({ data: { user_id: "user-1" }, error: null }), // existing row
    }
    fakeService.from.mockImplementation((table: string) => {
      if (tables[table]) return tables[table]
      throw new Error(`unexpected service table ${table}`)
    })
    const supabase = readSupabase({
      profile: { referral_code: "abc123", display_name: "Jane", social_handle: null, total_referrals: 2, total_qualified: 1, total_earned_kobo: 5000, balance_unpaid_kobo: 2000 },
      referrals: [{ id: "r-1", referred_account_type: "freelancer", status: "qualified", commission_kobo: 5000, created_at: "2026-01-01T00:00:00Z", qualified_at: "2026-01-02T00:00:00Z" }],
      payouts: [],
    })

    const res = await request(appWith({ id: "user-1", user_metadata: {} }, supabase)).get("/me")

    expect(res.status).toBe(200)
    expect(tables.influencer_profiles.insert).not.toHaveBeenCalled()
    expect(res.body).toEqual({
      referralCode: "abc123",
      displayName: "Jane",
      socialHandle: null,
      totals: { referred: 2, qualified: 1, pending: 0, earnedNaira: 50, unpaidNaira: 20 },
      referrals: [{ id: "r-1", referred_account_type: "freelancer", status: "qualified", commission_kobo: 5000, created_at: "2026-01-01T00:00:00Z", qualified_at: "2026-01-02T00:00:00Z" }],
      payouts: [],
    })
  })

  it("attributes a referral from a valid, unclaimed ref_code exactly once", async () => {
    const influencerProfilesBuilder = builder({ data: null, error: null })
    const referralsBuilder = builder({ data: null, error: null }) // "already" check -> not found
    referralsBuilder.insert = vi.fn(() => Promise.resolve({ data: {}, error: null }))
    const profilesBuilder = builder({ data: { account_type: "freelancer" }, error: null })
    profilesBuilder.update = vi.fn(chainReturnsEq)

    function chainReturnsEq() {
      return { eq: vi.fn(() => Promise.resolve({ data: null, error: null })) }
    }

    // influencer_profiles is queried twice with different intents in the service
    // client: once for "does referred_by-referral_code exist" (keyed by
    // referral_code) -- give it a match -- and never for "own profile exists"
    // since accountType isn't "influencer" here.
    const influencerLookup = builder({ data: { user_id: "influencer-1", total_referrals: 3 }, error: null })

    fakeService.from.mockImplementation((table: string) => {
      if (table === "profiles") return profilesBuilder
      if (table === "influencer_profiles") return influencerLookup
      if (table === "referrals") return referralsBuilder
      throw new Error(`unexpected service table ${table}`)
    })
    const supabase = readSupabase({ profile: null, referrals: [], payouts: [] })

    const res = await request(
      appWith({ id: "user-2", user_metadata: { ref_code: "abc123" } }, supabase)
    ).get("/me")

    expect(res.status).toBe(200)
    expect(referralsBuilder.insert).toHaveBeenCalledWith({
      influencer_id: "influencer-1",
      referred_user_id: "user-2",
      referred_account_type: "freelancer",
      status: "pending",
    })
    expect(profilesBuilder.update).toHaveBeenCalledWith({ referred_by: "influencer-1" })
    expect(influencerLookup.update).toHaveBeenCalledWith({ total_referrals: 4 })
  })

  it("does not attribute a referral when the user already has one recorded", async () => {
    const tables: Record<string, any> = {
      profiles: builder({ data: { account_type: "freelancer" }, error: null }),
      influencer_profiles: builder({ data: null, error: null }),
      referrals: builder({ data: { id: "existing-referral" }, error: null }), // "already" check -> found
    }
    fakeService.from.mockImplementation((table: string) => {
      if (tables[table]) return tables[table]
      throw new Error(`unexpected service table ${table}`)
    })
    const supabase = readSupabase({ profile: null, referrals: [], payouts: [] })

    const res = await request(
      appWith({ id: "user-3", user_metadata: { ref_code: "abc123" } }, supabase)
    ).get("/me")

    expect(res.status).toBe(200)
    expect(tables.referrals.insert).not.toHaveBeenCalled()
  })

  it("does not attribute a self-referral", async () => {
    const tables: Record<string, any> = {
      profiles: builder({ data: { account_type: "influencer" }, error: null }),
      influencer_profiles: builder({ data: { user_id: "user-4", total_referrals: 1 }, error: null }),
      referrals: builder({ data: null, error: null }),
    }
    fakeService.from.mockImplementation((table: string) => {
      if (tables[table]) return tables[table]
      throw new Error(`unexpected service table ${table}`)
    })
    const supabase = readSupabase({ profile: null, referrals: [], payouts: [] })

    const res = await request(
      appWith({ id: "user-4", user_metadata: { ref_code: "own-code" } }, supabase)
    ).get("/me")

    expect(res.status).toBe(200)
    expect(tables.referrals.insert).not.toHaveBeenCalled()
  })

  it("does not crash when the referral-code insert collides on every retry attempt", async () => {
    const tables: Record<string, any> = {
      profiles: builder({ data: { account_type: "influencer" }, error: null }),
      influencer_profiles: builder({ data: null, error: null }),
    }
    tables.influencer_profiles.insert = vi.fn(() => Promise.resolve({ data: null, error: { code: "23505" } }))
    fakeService.from.mockImplementation((table: string) => {
      if (tables[table]) return tables[table]
      throw new Error(`unexpected service table ${table}`)
    })
    const supabase = readSupabase({ profile: null, referrals: [], payouts: [] })

    const res = await request(appWith({ id: "user-5", user_metadata: {} }, supabase)).get("/me")

    expect(res.status).toBe(200)
    expect(tables.influencer_profiles.insert).toHaveBeenCalledTimes(5)
    expect(res.body.referralCode).toBeNull()
  })

  it("silently ignores an invalid ref_code with no matching influencer", async () => {
    const tables: Record<string, any> = {
      profiles: builder({ data: { account_type: "freelancer" }, error: null }),
      influencer_profiles: builder({ data: null, error: null }), // no influencer matches this code
      referrals: builder({ data: null, error: null }),
    }
    fakeService.from.mockImplementation((table: string) => {
      if (tables[table]) return tables[table]
      throw new Error(`unexpected service table ${table}`)
    })
    const supabase = readSupabase({ profile: null, referrals: [], payouts: [] })

    const res = await request(
      appWith({ id: "user-6", user_metadata: { ref_code: "does-not-exist" } }, supabase)
    ).get("/me")

    expect(res.status).toBe(200)
    expect(tables.referrals.insert).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 13: Run test to verify it fails**

Run: `pnpm --filter server test -- influencer.test.ts`
Expected: FAIL — `./influencer.js` does not exist.

- [ ] **Step 14: Implement the route**

Create `server/src/routes/influencer.ts`:

```ts
import { Router } from "express"
import { asyncHandler } from "../lib/http.js"
import { createServiceClient } from "../lib/supabase.js"
import { generateReferralCode } from "../lib/referralCode.js"

const influencerRouter = Router()

const toNaira = (kobo?: number | null) => Number(kobo || 0) / 100

type ReferralRow = {
  id: string
  referred_account_type: string | null
  status: string
  commission_kobo: number | null
  created_at: string
  qualified_at: string | null
}

type PayoutRow = {
  id: string
  amount_kobo: number
  status: string
  processed_at: string | null
  note: string | null
}

influencerRouter.get(
  "/me",
  asyncHandler(async (req, res) => {
    const userId = req.user!.id
    const service = createServiceClient()
    const meta = (req.user!.user_metadata ?? {}) as Record<string, unknown>

    const { data: profileRow } = await service.from("profiles").select("account_type").eq("id", userId).maybeSingle()
    const accountType = (profileRow as { account_type?: string } | null)?.account_type ?? null

    // 1. Ensure the influencer's own profile + referral code exist.
    if (accountType === "influencer") {
      const { data: existing } = await service
        .from("influencer_profiles")
        .select("user_id")
        .eq("user_id", userId)
        .maybeSingle()

      if (!existing) {
        for (let attempt = 0; attempt < 5; attempt++) {
          const { error } = await service.from("influencer_profiles").insert({
            user_id: userId,
            referral_code: generateReferralCode(),
            display_name: typeof meta.full_name === "string" ? meta.full_name : null,
            social_handle: typeof meta.social_handle === "string" ? meta.social_handle : null,
          })
          if (!error) break
          // 23505 = unique violation (code collision) -> retry; anything else -> stop.
          if ((error as { code?: string }).code !== "23505") {
            console.error("[influencer] create profile failed:", error)
            break
          }
        }
      }
    }

    // 2. Attribute the referral, once.
    const refCode = typeof meta.ref_code === "string" ? meta.ref_code.trim() : ""
    if (refCode) {
      const { data: already } = await service.from("referrals").select("id").eq("referred_user_id", userId).maybeSingle()

      if (!already) {
        const { data: influencer } = await service
          .from("influencer_profiles")
          .select("user_id, total_referrals")
          .eq("referral_code", refCode)
          .maybeSingle()
        const influencerRow = influencer as { user_id?: string; total_referrals?: number } | null
        const influencerId = influencerRow?.user_id

        if (influencerId && influencerId !== userId) {
          const { error: insertError } = await service.from("referrals").insert({
            influencer_id: influencerId,
            referred_user_id: userId,
            referred_account_type: accountType,
            status: "pending",
          })
          if (!insertError) {
            await service.from("profiles").update({ referred_by: influencerId }).eq("id", userId)
            await service
              .from("influencer_profiles")
              .update({ total_referrals: (influencerRow?.total_referrals ?? 0) + 1 })
              .eq("user_id", influencerId)
          } else if ((insertError as { code?: string }).code !== "23505") {
            // Unique violation = a concurrent call already attributed -- safe to ignore.
            console.error("[influencer] attribute failed:", insertError)
          }
        }
      }
    }

    // 3. Read the influencer's own data back through the request-scoped, RLS-
    // bound client -- defense-in-depth alongside the .eq() filters, matching
    // this migration's established convention (see the plan's Global
    // Constraints). RLS on these three tables already restricts SELECT to the
    // caller's own rows.
    const { data: myProfile } = await req.supabase!
      .from("influencer_profiles")
      .select("referral_code, display_name, social_handle, total_referrals, total_qualified, total_earned_kobo, balance_unpaid_kobo")
      .eq("user_id", userId)
      .maybeSingle()

    const { data: referralRows } = await req.supabase!
      .from("referrals")
      .select("id, referred_account_type, status, commission_kobo, created_at, qualified_at")
      .eq("influencer_id", userId)
      .order("created_at", { ascending: false })

    const { data: payoutRows } = await req.supabase!
      .from("influencer_payouts")
      .select("id, amount_kobo, status, processed_at, note")
      .eq("influencer_id", userId)
      .order("processed_at", { ascending: false })

    const referrals = (referralRows as ReferralRow[] | null) ?? []
    const payouts = (payoutRows as PayoutRow[] | null) ?? []
    const pending = referrals.filter((r) => r.status === "pending").length
    const qualified = referrals.filter((r) => r.status === "qualified" || r.status === "paid").length

    const p = myProfile as {
      referral_code?: string
      display_name?: string
      social_handle?: string
      total_referrals?: number
      total_qualified?: number
      total_earned_kobo?: number
      balance_unpaid_kobo?: number
    } | null

    res.json({
      referralCode: p?.referral_code ?? null,
      displayName: p?.display_name ?? null,
      socialHandle: p?.social_handle ?? null,
      totals: {
        referred: p?.total_referrals ?? referrals.length,
        qualified: p?.total_qualified ?? qualified,
        pending,
        earnedNaira: toNaira(p?.total_earned_kobo),
        unpaidNaira: toNaira(p?.balance_unpaid_kobo),
      },
      referrals,
      payouts,
    })
  })
)

export default influencerRouter
```

- [ ] **Step 15: Run test to verify it passes**

Run: `pnpm --filter server test -- influencer.test.ts`
Expected: PASS (7/7).

- [ ] **Step 16: Mount the route**

Edit `server/src/app.ts`:

```ts
import influencerRouter from "./routes/influencer.js"
```

(add alongside the other route imports), and:

```ts
  app.use("/api/influencer", requireAuth, influencerRouter)
```

(add alongside the other `app.use("/api/...", requireAuth, ...)` lines, before the 404 handler).

- [ ] **Step 17: Run the full server test suite and typecheck**

Run: `pnpm --filter server test` and `pnpm --filter server exec tsc --noEmit`
Expected: all tests pass, no type errors.

- [ ] **Step 18: Commit**

```bash
git add server/src/routes/influencer.ts server/src/routes/influencer.test.ts server/src/app.ts
git commit -m "feat(server): add GET /api/influencer/me (referral sync + self-service read)"
```

---

### Task 2: Client — `InfluencerSidebar` component + `useInfluencerMeQuery` hook

**Files:**
- Create: `client/src/components/InfluencerSidebar.tsx`
- Create: `client/src/components/InfluencerSidebar.test.tsx`
- Create: `client/src/lib/queries/influencer.ts`
- Create: `client/src/lib/queries/influencer.test.tsx`

**Interfaces:**
- Consumes: `useAuth()` from `client/src/contexts/AuthContext.tsx` (existing, `signOut` only); `apiFetch` from `client/src/lib/api.ts` (existing).
- Produces: `InfluencerSidebar` (default export, no props) — consumed by Tasks 3-4; `useInfluencerMeQuery()` returning `UseQueryResult<InfluencerMeData>` where `InfluencerMeData` matches Task 1's exact response shape — consumed by Tasks 3-4.

- [ ] **Step 1: Write the failing test for `InfluencerSidebar`**

Create `client/src/components/InfluencerSidebar.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"

const signOutMock = vi.fn()
const navigateMock = vi.fn()
vi.mock("../contexts/AuthContext", () => ({ useAuth: () => ({ signOut: signOutMock }) }))
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom")
  return { ...actual, useNavigate: () => navigateMock }
})

import InfluencerSidebar from "./InfluencerSidebar"

beforeEach(() => {
  vi.clearAllMocks()
})

function renderSidebar() {
  return render(
    <MemoryRouter initialEntries={["/influencer/dashboard"]}>
      <InfluencerSidebar />
    </MemoryRouter>
  )
}

describe("InfluencerSidebar", () => {
  it("renders links to all three influencer pages", () => {
    renderSidebar()
    expect(screen.getByRole("link", { name: /dashboard/i })).toHaveAttribute("href", "/influencer/dashboard")
    expect(screen.getByRole("link", { name: /referrals/i })).toHaveAttribute("href", "/influencer/referrals")
    expect(screen.getByRole("link", { name: /earnings/i })).toHaveAttribute("href", "/influencer/earnings")
  })

  it("signs out and navigates to /login when Logout is clicked", async () => {
    const user = userEvent.setup()
    renderSidebar()
    await user.click(screen.getByRole("button", { name: /logout/i }))
    expect(signOutMock).toHaveBeenCalledOnce()
    expect(navigateMock).toHaveBeenCalledWith("/login")
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter client test -- InfluencerSidebar.test.tsx`
Expected: FAIL — `./InfluencerSidebar` does not exist.

- [ ] **Step 3: Implement `InfluencerSidebar`**

Create `client/src/components/InfluencerSidebar.tsx`:

```tsx
import { useState } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import { LayoutDashboard, Users, Wallet, LogOut, Menu, X } from "lucide-react"
import { useAuth } from "../contexts/AuthContext"

const navigation = [
  { name: "Dashboard", href: "/influencer/dashboard", icon: LayoutDashboard },
  { name: "Referrals", href: "/influencer/referrals", icon: Users },
  { name: "Earnings", href: "/influencer/earnings", icon: Wallet },
]

export default function InfluencerSidebar() {
  const location = useLocation()
  const navigate = useNavigate()
  const { signOut } = useAuth()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  const handleLogout = async () => {
    await signOut()
    navigate("/login")
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
              <Users className="h-4 w-4 text-white" />
            </div>
            <div className="leading-tight">
              <p className="text-sm font-semibold">Influencer</p>
              <p className="text-[10px] text-white/50">Bizimi program</p>
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
                    ${isActive ? "bg-primary text-white shadow-sm shadow-primary/30" : "text-white/70 hover:bg-white/10 hover:text-white"}
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

      {isMobileMenuOpen && <div className="fixed inset-0 z-30 bg-black bg-opacity-50 lg:hidden" onClick={() => setIsMobileMenuOpen(false)} />}
    </>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter client test -- InfluencerSidebar.test.tsx`
Expected: PASS (2/2).

- [ ] **Step 5: Commit**

```bash
git add client/src/components/InfluencerSidebar.tsx client/src/components/InfluencerSidebar.test.tsx
git commit -m "feat(client): port InfluencerSidebar"
```

- [ ] **Step 6: Write the failing test for `useInfluencerMeQuery`**

Create `client/src/lib/queries/influencer.test.tsx`:

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

describe("useInfluencerMeQuery", () => {
  it("GETs /api/influencer/me and returns the influencer's data", async () => {
    apiFetchMock.mockResolvedValue({
      referralCode: "abc123",
      displayName: "Jane",
      socialHandle: null,
      totals: { referred: 2, qualified: 1, pending: 1, earnedNaira: 50, unpaidNaira: 20 },
      referrals: [],
      payouts: [],
    })
    const { useInfluencerMeQuery } = await import("./influencer")

    const { result } = renderHook(() => useInfluencerMeQuery(), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(apiFetchMock).toHaveBeenCalledWith("/api/influencer/me")
    expect(result.current.data?.referralCode).toBe("abc123")
    expect(result.current.data?.totals.unpaidNaira).toBe(20)
  })
})
```

- [ ] **Step 7: Run test to verify it fails**

Run: `pnpm --filter client test -- lib/queries/influencer.test.tsx`
Expected: FAIL — `./influencer` does not exist.

- [ ] **Step 8: Implement `useInfluencerMeQuery`**

Create `client/src/lib/queries/influencer.ts`:

```ts
import { useQuery } from "@tanstack/react-query"
import { apiFetch } from "../api"

export type InfluencerReferral = {
  id: string
  referred_account_type: string | null
  status: string
  commission_kobo: number | null
  created_at: string
  qualified_at: string | null
}

export type InfluencerPayout = {
  id: string
  amount_kobo: number
  status: string
  processed_at: string | null
  note: string | null
}

export type InfluencerMeData = {
  referralCode: string | null
  displayName: string | null
  socialHandle: string | null
  totals: {
    referred: number
    qualified: number
    pending: number
    earnedNaira: number
    unpaidNaira: number
  }
  referrals: InfluencerReferral[]
  payouts: InfluencerPayout[]
}

export function useInfluencerMeQuery() {
  return useQuery({
    queryKey: ["influencer", "me"],
    queryFn: () => apiFetch<InfluencerMeData>("/api/influencer/me"),
  })
}
```

- [ ] **Step 9: Run test to verify it passes**

Run: `pnpm --filter client test -- lib/queries/influencer.test.tsx`
Expected: PASS (1/1).

- [ ] **Step 10: Commit**

```bash
git add client/src/lib/queries/influencer.ts client/src/lib/queries/influencer.test.tsx
git commit -m "feat(client): add useInfluencerMeQuery"
```

---

### Task 3: Client — `/influencer/dashboard` page

**Files:**
- Create: `client/src/pages/influencer/Dashboard.tsx`
- Create: `client/src/pages/influencer/Dashboard.test.tsx`

**Interfaces:**
- Consumes: `InfluencerSidebar` (Task 2), `useInfluencerMeQuery` + `InfluencerMeData` (Task 2), `useAuth()` from `client/src/contexts/AuthContext.tsx` (existing, `profile` field).
- Produces: `InfluencerDashboard` default export — wired into `App.tsx` in Task 4.

- [ ] **Step 1: Write the failing tests**

Create `client/src/pages/influencer/Dashboard.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Routes, Route } from "react-router-dom"

const useInfluencerMeQueryMock = vi.fn()
vi.mock("../../lib/queries/influencer", () => ({ useInfluencerMeQuery: () => useInfluencerMeQueryMock() }))

let authValue: any = { profile: { account_type: "influencer" }, signOut: vi.fn() }
vi.mock("../../contexts/AuthContext", () => ({ useAuth: () => authValue }))

import InfluencerDashboard from "./Dashboard"

const writeText = vi.fn().mockResolvedValue(undefined)
Object.assign(navigator, { clipboard: { writeText } })

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/influencer/dashboard"]}>
      <Routes>
        <Route path="/influencer/dashboard" element={<InfluencerDashboard />} />
        <Route path="/" element={<div>Landing</div>} />
      </Routes>
    </MemoryRouter>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  writeText.mockClear()
  authValue = { profile: { account_type: "influencer" }, signOut: vi.fn() }
})

describe("InfluencerDashboard", () => {
  it("shows a loading state while the query is pending", () => {
    useInfluencerMeQueryMock.mockReturnValue({ isLoading: true, isError: false, data: undefined })
    renderPage()
    expect(screen.getByText(/loading/i)).toBeInTheDocument()
  })

  it("shows an error state when the query fails", () => {
    useInfluencerMeQueryMock.mockReturnValue({ isLoading: false, isError: true, data: undefined })
    renderPage()
    expect(screen.getByText(/couldn't load your dashboard/i)).toBeInTheDocument()
  })

  it("redirects a non-influencer away", () => {
    authValue = { profile: { account_type: "freelancer" }, signOut: vi.fn() }
    useInfluencerMeQueryMock.mockReturnValue({
      isLoading: false,
      isError: false,
      data: { referralCode: "abc123", displayName: null, socialHandle: null, totals: { referred: 0, qualified: 0, pending: 0, earnedNaira: 0, unpaidNaira: 0 }, referrals: [], payouts: [] },
    })
    renderPage()
    expect(screen.getByText("Landing")).toBeInTheDocument()
  })

  it("shows the referral link and copies it on click", async () => {
    const user = userEvent.setup()
    useInfluencerMeQueryMock.mockReturnValue({
      isLoading: false,
      isError: false,
      data: { referralCode: "abc123", displayName: null, socialHandle: null, totals: { referred: 3, qualified: 1, pending: 2, earnedNaira: 50, unpaidNaira: 20 }, referrals: [], payouts: [] },
    })
    renderPage()

    expect(screen.getByText(/\/signup\?ref=abc123/)).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: /copy link/i }))
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining("/signup?ref=abc123"))
    expect(await screen.findByRole("button", { name: /copied/i })).toBeInTheDocument()
  })

  it("shows the 'being set up' placeholder when there is no referral code yet", () => {
    useInfluencerMeQueryMock.mockReturnValue({
      isLoading: false,
      isError: false,
      data: { referralCode: null, displayName: null, socialHandle: null, totals: { referred: 0, qualified: 0, pending: 0, earnedNaira: 0, unpaidNaira: 0 }, referrals: [], payouts: [] },
    })
    renderPage()
    expect(screen.getByText(/being set up/i)).toBeInTheDocument()
  })

  it("shows recent referrals when present, and an empty state when there are none", () => {
    useInfluencerMeQueryMock.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        referralCode: "abc123",
        displayName: null,
        socialHandle: null,
        totals: { referred: 1, qualified: 0, pending: 1, earnedNaira: 0, unpaidNaira: 0 },
        referrals: [{ id: "r-1", referred_account_type: "freelancer", status: "pending", commission_kobo: null, created_at: "2026-01-01T00:00:00Z", qualified_at: null }],
        payouts: [],
      },
    })
    renderPage()
    expect(screen.getByText("freelancer")).toBeInTheDocument()
    expect(screen.getByText("pending")).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter client test -- pages/influencer/Dashboard.test.tsx`
Expected: FAIL — `./Dashboard` does not exist.

- [ ] **Step 3: Implement the page**

Create `client/src/pages/influencer/Dashboard.tsx`:

```tsx
import { useState } from "react"
import { Navigate } from "react-router-dom"
import { Users, BadgeCheck, Clock, Coins, Link2, Check, Copy, Share2 } from "lucide-react"
import InfluencerSidebar from "../../components/InfluencerSidebar"
import { Button } from "../../components/ui/button"
import { useAuth } from "../../contexts/AuthContext"
import { useInfluencerMeQuery } from "../../lib/queries/influencer"

const naira = (n: number) => `₦${Number(n || 0).toLocaleString()}`
const fmtDate = (d: string) => new Date(d).toLocaleDateString()

function statusPill(status: string) {
  const base = "inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium capitalize"
  if (status === "qualified") return `${base} bg-success/10 text-success`
  if (status === "paid") return `${base} bg-info/10 text-info`
  return `${base} bg-warning/10 text-warning`
}

export default function InfluencerDashboard() {
  const { profile } = useAuth()
  const meQuery = useInfluencerMeQuery()
  const [copied, setCopied] = useState(false)

  if (profile && profile.account_type !== "influencer") {
    return <Navigate to="/" replace />
  }

  if (meQuery.isLoading) {
    return (
      <div className="flex h-screen bg-surface">
        <InfluencerSidebar />
        <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">Loading…</div>
      </div>
    )
  }

  if (meQuery.isError || !meQuery.data) {
    return (
      <div className="flex h-screen bg-surface">
        <InfluencerSidebar />
        <div className="flex-1 flex items-center justify-center text-center px-6">
          <div className="space-y-2">
            <p className="text-sm font-semibold text-foreground">Couldn't load your dashboard</p>
            <p className="text-sm text-muted-foreground">Please try refreshing the page.</p>
          </div>
        </div>
      </div>
    )
  }

  const { totals, referrals, referralCode } = meQuery.data
  const referralLink = referralCode ? `${window.location.origin}/signup?ref=${referralCode}` : null

  const copy = async () => {
    if (!referralLink) return
    try {
      await navigator.clipboard.writeText(referralLink)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      /* clipboard unavailable */
    }
  }

  const share = async () => {
    if (!referralLink) return
    if (typeof navigator !== "undefined" && (navigator as any).share) {
      try {
        await (navigator as any).share({ title: "Join me on Bizimi", url: referralLink })
        return
      } catch {
        /* fall back to copy */
      }
    }
    copy()
  }

  const tiles = [
    { label: "People referred", value: totals.referred, icon: Users, tile: "bg-primary/10 text-primary" },
    { label: "Qualified", value: totals.qualified, icon: BadgeCheck, tile: "bg-jade/10 text-jade" },
    { label: "Pending", value: totals.pending, icon: Clock, tile: "bg-warning/10 text-warning" },
    { label: "Total earned", value: naira(totals.earnedNaira), icon: Coins, tile: "bg-info/10 text-info" },
  ]

  return (
    <div className="flex h-screen bg-surface">
      <InfluencerSidebar />
      <div className="flex-1 overflow-auto">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
          <header className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Influencer</p>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Dashboard</h1>
            <p className="text-sm text-muted-foreground">Share your link, refer new users, and earn when they complete their first transaction.</p>
          </header>

          <section className="rounded-2xl border border-border bg-card p-6">
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                <Link2 className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-foreground">Your referral link</h2>
                <p className="text-xs text-muted-foreground">Anyone who signs up through this link is attributed to you.</p>
              </div>
            </div>

            {referralLink ? (
              <div className="mt-4 flex flex-col sm:flex-row gap-2">
                <div className="flex-1 min-w-0 flex items-center rounded-xl border border-border bg-surface-2 px-3 h-11">
                  <span className="truncate text-sm text-foreground font-mono">{referralLink}</span>
                </div>
                <div className="flex gap-2">
                  <Button onClick={copy} className="gap-2 h-11">
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    {copied ? "Copied" : "Copy link"}
                  </Button>
                  <Button onClick={share} variant="outline" className="gap-2 h-11">
                    <Share2 className="h-4 w-4" />
                    Share
                  </Button>
                </div>
              </div>
            ) : (
              <div className="mt-4 rounded-xl border border-dashed border-border bg-surface-2 px-4 py-5 text-sm text-muted-foreground">
                Your referral link is being set up. Once your influencer profile is ready, your unique link will appear here.
              </div>
            )}
          </section>

          <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {tiles.map((t) => (
              <div key={t.label} className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-muted-foreground">{t.label}</p>
                  <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${t.tile}`}>
                    <t.icon className="h-4 w-4" />
                  </div>
                </div>
                <p className="mt-3 text-2xl font-semibold tracking-tight text-foreground tabular-nums">{t.value}</p>
              </div>
            ))}
          </section>

          <div className="grid lg:grid-cols-3 gap-6 items-start">
            <div className="rounded-2xl border border-primary/30 bg-card p-5 lg:col-span-1">
              <p className="text-xs font-medium text-muted-foreground">Unpaid balance</p>
              <p className="mt-1 text-3xl font-semibold tracking-tight text-foreground tabular-nums">{naira(totals.unpaidNaira)}</p>
              <p className="mt-3 text-xs text-muted-foreground leading-relaxed">Earnings you've made that haven't been paid out yet. Payouts are processed manually by the Bizimi team.</p>
            </div>

            <div className="rounded-2xl border border-border bg-card overflow-hidden lg:col-span-2">
              <div className="px-5 py-4 border-b border-border">
                <h2 className="text-base font-semibold text-foreground">Recent referrals</h2>
              </div>
              {referrals.length === 0 ? (
                <div className="px-5 py-12 text-center">
                  <div className="mx-auto h-11 w-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                    <Users className="h-5 w-5" />
                  </div>
                  <p className="mt-4 text-sm font-medium text-foreground">No referrals yet</p>
                  <p className="mt-1 text-sm text-muted-foreground">Share your link to start referring new users.</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {referrals.slice(0, 6).map((r) => (
                    <div key={r.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground capitalize">{r.referred_account_type || "New user"}</p>
                        <p className="text-[11px] text-muted-foreground tabular-nums">Joined {fmtDate(r.created_at)}</p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        {r.commission_kobo ? <span className="text-sm font-semibold text-foreground tabular-nums">{naira(r.commission_kobo / 100)}</span> : null}
                        <span className={statusPill(r.status)}>{r.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter client test -- pages/influencer/Dashboard.test.tsx`
Expected: PASS (6/6).

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/influencer/Dashboard.tsx client/src/pages/influencer/Dashboard.test.tsx
git commit -m "feat(client): port /influencer/dashboard"
```

---

### Task 4: Client — `/influencer/referrals`, `/influencer/earnings` pages + route wiring

**Files:**
- Create: `client/src/pages/influencer/Referrals.tsx`
- Create: `client/src/pages/influencer/Referrals.test.tsx`
- Create: `client/src/pages/influencer/Earnings.tsx`
- Create: `client/src/pages/influencer/Earnings.test.tsx`
- Modify: `client/src/App.tsx`

**Interfaces:**
- Consumes: `InfluencerSidebar`, `useInfluencerMeQuery` (Task 2), `useAuth()` (existing), `InfluencerDashboard` (Task 3, for `App.tsx` wiring).
- Produces: `InfluencerReferrals`, `InfluencerEarnings` default exports; three new routes in `App.tsx`.

- [ ] **Step 1: Write the failing tests for `Referrals`**

Create `client/src/pages/influencer/Referrals.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { MemoryRouter, Routes, Route } from "react-router-dom"

const useInfluencerMeQueryMock = vi.fn()
vi.mock("../../lib/queries/influencer", () => ({ useInfluencerMeQuery: () => useInfluencerMeQueryMock() }))

let authValue: any = { profile: { account_type: "influencer" }, signOut: vi.fn() }
vi.mock("../../contexts/AuthContext", () => ({ useAuth: () => authValue }))

import InfluencerReferrals from "./Referrals"

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/influencer/referrals"]}>
      <Routes>
        <Route path="/influencer/referrals" element={<InfluencerReferrals />} />
        <Route path="/" element={<div>Landing</div>} />
      </Routes>
    </MemoryRouter>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  authValue = { profile: { account_type: "influencer" }, signOut: vi.fn() }
})

describe("InfluencerReferrals", () => {
  it("redirects a non-influencer away", () => {
    authValue = { profile: { account_type: "agency" }, signOut: vi.fn() }
    useInfluencerMeQueryMock.mockReturnValue({ isLoading: false, isError: false, data: { referrals: [] } })
    renderPage()
    expect(screen.getByText("Landing")).toBeInTheDocument()
  })

  it("shows an empty state when there are no referrals", () => {
    useInfluencerMeQueryMock.mockReturnValue({ isLoading: false, isError: false, data: { referrals: [] } })
    renderPage()
    expect(screen.getByText(/no referrals yet/i)).toBeInTheDocument()
  })

  it("lists every referral with its status, commission, and dates", () => {
    useInfluencerMeQueryMock.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        referrals: [
          { id: "r-1", referred_account_type: "agency", status: "paid", commission_kobo: 3000, created_at: "2026-01-01T00:00:00Z", qualified_at: "2026-01-05T00:00:00Z" },
          { id: "r-2", referred_account_type: null, status: "pending", commission_kobo: null, created_at: "2026-01-02T00:00:00Z", qualified_at: null },
        ],
      },
    })
    renderPage()
    expect(screen.getByText("All referrals (2)")).toBeInTheDocument()
    expect(screen.getByText("agency")).toBeInTheDocument()
    expect(screen.getByText("New user")).toBeInTheDocument()
    expect(screen.getByText("₦30")).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter client test -- pages/influencer/Referrals.test.tsx`
Expected: FAIL — `./Referrals` does not exist.

- [ ] **Step 3: Implement `Referrals`**

Create `client/src/pages/influencer/Referrals.tsx`:

```tsx
import { Navigate } from "react-router-dom"
import InfluencerSidebar from "../../components/InfluencerSidebar"
import { useAuth } from "../../contexts/AuthContext"
import { useInfluencerMeQuery } from "../../lib/queries/influencer"

const naira = (n: number) => `₦${Number(n || 0).toLocaleString()}`
const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString() : "—")

function statusPill(status: string) {
  const base = "inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium capitalize"
  if (status === "qualified") return `${base} bg-success/10 text-success`
  if (status === "paid") return `${base} bg-info/10 text-info`
  return `${base} bg-warning/10 text-warning`
}

export default function InfluencerReferrals() {
  const { profile } = useAuth()
  const meQuery = useInfluencerMeQuery()

  if (profile && profile.account_type !== "influencer") {
    return <Navigate to="/" replace />
  }

  if (meQuery.isLoading) {
    return (
      <div className="flex h-screen bg-surface">
        <InfluencerSidebar />
        <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">Loading…</div>
      </div>
    )
  }

  if (meQuery.isError || !meQuery.data) {
    return (
      <div className="flex h-screen bg-surface">
        <InfluencerSidebar />
        <div className="flex-1 flex items-center justify-center text-center px-6">
          <div className="space-y-2">
            <p className="text-sm font-semibold text-foreground">Couldn't load your referrals</p>
            <p className="text-sm text-muted-foreground">Please try refreshing the page.</p>
          </div>
        </div>
      </div>
    )
  }

  const { referrals } = meQuery.data

  return (
    <div className="flex h-screen bg-surface">
      <InfluencerSidebar />
      <div className="flex-1 overflow-auto">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
          <header className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Influencer</p>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Referrals</h1>
            <p className="text-sm text-muted-foreground">Everyone who signed up through your link, and where they stand.</p>
          </header>

          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <h2 className="text-base font-semibold text-foreground">All referrals ({referrals.length})</h2>
            </div>
            {referrals.length === 0 ? (
              <div className="px-5 py-12 text-center text-sm text-muted-foreground">No referrals yet. Share your link from the dashboard to get started.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-surface-2 text-[11px] uppercase tracking-wide font-medium text-muted-foreground border-b border-border">
                    <tr>
                      <th className="px-5 py-3">User type</th>
                      <th className="px-5 py-3">Status</th>
                      <th className="px-5 py-3">Commission</th>
                      <th className="px-5 py-3">Joined</th>
                      <th className="px-5 py-3">Qualified</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {referrals.map((r) => (
                      <tr key={r.id} className="hover:bg-surface/60 transition-colors">
                        <td className="px-5 py-4 font-medium text-foreground capitalize">{r.referred_account_type || "New user"}</td>
                        <td className="px-5 py-4"><span className={statusPill(r.status)}>{r.status}</span></td>
                        <td className="px-5 py-4 text-foreground tabular-nums">{r.commission_kobo ? naira(r.commission_kobo / 100) : "—"}</td>
                        <td className="px-5 py-4 text-muted-foreground tabular-nums">{fmtDate(r.created_at)}</td>
                        <td className="px-5 py-4 text-muted-foreground tabular-nums">{fmtDate(r.qualified_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter client test -- pages/influencer/Referrals.test.tsx`
Expected: PASS (3/3).

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/influencer/Referrals.tsx client/src/pages/influencer/Referrals.test.tsx
git commit -m "feat(client): port /influencer/referrals"
```

- [ ] **Step 6: Write the failing tests for `Earnings`**

Create `client/src/pages/influencer/Earnings.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { MemoryRouter, Routes, Route } from "react-router-dom"

const useInfluencerMeQueryMock = vi.fn()
vi.mock("../../lib/queries/influencer", () => ({ useInfluencerMeQuery: () => useInfluencerMeQueryMock() }))

let authValue: any = { profile: { account_type: "influencer" }, signOut: vi.fn() }
vi.mock("../../contexts/AuthContext", () => ({ useAuth: () => authValue }))

import InfluencerEarnings from "./Earnings"

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/influencer/earnings"]}>
      <Routes>
        <Route path="/influencer/earnings" element={<InfluencerEarnings />} />
        <Route path="/" element={<div>Landing</div>} />
      </Routes>
    </MemoryRouter>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  authValue = { profile: { account_type: "influencer" }, signOut: vi.fn() }
})

describe("InfluencerEarnings", () => {
  it("redirects a non-influencer away", () => {
    authValue = { profile: { account_type: "freelancer" }, signOut: vi.fn() }
    useInfluencerMeQueryMock.mockReturnValue({ isLoading: false, isError: false, data: { totals: { earnedNaira: 0, unpaidNaira: 0 }, payouts: [] } })
    renderPage()
    expect(screen.getByText("Landing")).toBeInTheDocument()
  })

  it("shows total earned, unpaid balance, and paid-out totals", () => {
    useInfluencerMeQueryMock.mockReturnValue({
      isLoading: false,
      isError: false,
      data: { totals: { earnedNaira: 500, unpaidNaira: 200, referred: 0, qualified: 0, pending: 0 }, payouts: [] },
    })
    renderPage()
    expect(screen.getByText("₦500")).toBeInTheDocument()
    expect(screen.getByText("₦200")).toBeInTheDocument()
    expect(screen.getByText("₦300")).toBeInTheDocument()
  })

  it("shows an empty state with no payouts, and lists payouts when present", () => {
    useInfluencerMeQueryMock.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        totals: { earnedNaira: 500, unpaidNaira: 0, referred: 0, qualified: 0, pending: 0 },
        payouts: [{ id: "p-1", amount_kobo: 50000, status: "paid", processed_at: "2026-01-10T00:00:00Z", note: "Manual payout" }],
      },
    })
    renderPage()
    expect(screen.getByText("₦500")).toBeInTheDocument()
    expect(screen.getByText("Manual payout")).toBeInTheDocument()
  })
})
```

- [ ] **Step 7: Run test to verify it fails**

Run: `pnpm --filter client test -- pages/influencer/Earnings.test.tsx`
Expected: FAIL — `./Earnings` does not exist.

- [ ] **Step 8: Implement `Earnings`**

Create `client/src/pages/influencer/Earnings.tsx`:

```tsx
import { Navigate } from "react-router-dom"
import InfluencerSidebar from "../../components/InfluencerSidebar"
import { useAuth } from "../../contexts/AuthContext"
import { useInfluencerMeQuery } from "../../lib/queries/influencer"

const naira = (n: number) => `₦${Number(n || 0).toLocaleString()}`
const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString() : "—")

export default function InfluencerEarnings() {
  const { profile } = useAuth()
  const meQuery = useInfluencerMeQuery()

  if (profile && profile.account_type !== "influencer") {
    return <Navigate to="/" replace />
  }

  if (meQuery.isLoading) {
    return (
      <div className="flex h-screen bg-surface">
        <InfluencerSidebar />
        <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">Loading…</div>
      </div>
    )
  }

  if (meQuery.isError || !meQuery.data) {
    return (
      <div className="flex h-screen bg-surface">
        <InfluencerSidebar />
        <div className="flex-1 flex items-center justify-center text-center px-6">
          <div className="space-y-2">
            <p className="text-sm font-semibold text-foreground">Couldn't load your earnings</p>
            <p className="text-sm text-muted-foreground">Please try refreshing the page.</p>
          </div>
        </div>
      </div>
    )
  }

  const { totals, payouts } = meQuery.data

  const cards = [
    { label: "Total earned", value: naira(totals.earnedNaira), accent: "border-border" },
    { label: "Unpaid balance", value: naira(totals.unpaidNaira), accent: "border-primary/30" },
    { label: "Paid out", value: naira(Math.max(totals.earnedNaira - totals.unpaidNaira, 0)), accent: "border-border" },
  ]

  return (
    <div className="flex h-screen bg-surface">
      <InfluencerSidebar />
      <div className="flex-1 overflow-auto">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
          <header className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Influencer</p>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Earnings</h1>
            <p className="text-sm text-muted-foreground">Your commission earnings and payout history. Payouts are processed by the Bizimi team.</p>
          </header>

          <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {cards.map((c) => (
              <div key={c.label} className={`rounded-xl border bg-card p-4 ${c.accent}`}>
                <p className="text-xs font-medium text-muted-foreground">{c.label}</p>
                <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground tabular-nums">{c.value}</p>
              </div>
            ))}
          </section>

          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <h2 className="text-base font-semibold text-foreground">Payout history</h2>
            </div>
            {payouts.length === 0 ? (
              <div className="px-5 py-12 text-center text-sm text-muted-foreground">No payouts yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-surface-2 text-[11px] uppercase tracking-wide font-medium text-muted-foreground border-b border-border">
                    <tr>
                      <th className="px-5 py-3">Amount</th>
                      <th className="px-5 py-3">Status</th>
                      <th className="px-5 py-3">Date</th>
                      <th className="px-5 py-3">Note</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {payouts.map((p) => (
                      <tr key={p.id} className="hover:bg-surface/60 transition-colors">
                        <td className="px-5 py-4 font-semibold text-foreground tabular-nums">{naira(p.amount_kobo / 100)}</td>
                        <td className="px-5 py-4"><span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-success/10 text-success capitalize">{p.status}</span></td>
                        <td className="px-5 py-4 text-muted-foreground tabular-nums">{fmtDate(p.processed_at)}</td>
                        <td className="px-5 py-4 text-muted-foreground">{p.note || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 9: Run test to verify it passes**

Run: `pnpm --filter client test -- pages/influencer/Earnings.test.tsx`
Expected: PASS (3/3).

- [ ] **Step 10: Commit**

```bash
git add client/src/pages/influencer/Earnings.tsx client/src/pages/influencer/Earnings.test.tsx
git commit -m "feat(client): port /influencer/earnings"
```

- [ ] **Step 11: Wire the three routes into `App.tsx`**

Edit `client/src/App.tsx` — add imports near the other page imports:

```ts
import InfluencerDashboard from "./pages/influencer/Dashboard"
import InfluencerReferrals from "./pages/influencer/Referrals"
import InfluencerEarnings from "./pages/influencer/Earnings"
```

and add routes before the `<Route path="/admin/login" ...>` line (or anywhere before the catch-all `*` route):

```tsx
            <Route
              path="/influencer/dashboard"
              element={
                <RequireAuth>
                  <InfluencerDashboard />
                </RequireAuth>
              }
            />
            <Route
              path="/influencer/referrals"
              element={
                <RequireAuth>
                  <InfluencerReferrals />
                </RequireAuth>
              }
            />
            <Route
              path="/influencer/earnings"
              element={
                <RequireAuth>
                  <InfluencerEarnings />
                </RequireAuth>
              }
            />
```

- [ ] **Step 12: Run the full client test suite and typecheck**

Run: `pnpm --filter client test` and `pnpm --filter client exec tsc --noEmit`
Expected: all tests pass, no type errors.

- [ ] **Step 13: Commit**

```bash
git add client/src/App.tsx
git commit -m "feat(client): wire /influencer/* routes"
```
