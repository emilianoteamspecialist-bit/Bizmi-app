# Next.js → React + Node.js Migration — Design

**Date:** 2026-09-08
**Status:** Design approved (brainstorming complete) — ready for implementation plan
**Author:** Claude + Etti

---

## 1. Summary

Re-platform Bizimi from Next.js (App Router) to a decoupled **React SPA (Vite) + Node.js (Express) API**, while keeping **Supabase unchanged** (same Postgres, same RLS, same Auth, same Realtime, same Storage). The existing Next.js app is **not touched or removed** — the new stack is built from scratch in two new, self-contained, root-level folders (`client/`, `server/`) and the two apps coexist until the new one reaches full feature parity, at which point cutover is a deliberate deploy/DNS switch.

Alongside the migration, the UI/UX is modernized with marketplace-standard patterns (search-first navigation, trust signals, card-driven browsing, split-pane messaging) — informed by, not copied from, Upwork/Fiverr/Freelancer — while keeping the existing brand identity (`#f97316` orange, "10% orange / 90% neutral" rule, Sora/Inter type pairing).

### Decisions locked during brainstorming

| Decision | Choice |
|---|---|
| Migration driver | Team/architecture preference — conventional decoupled SPA + REST API |
| Supabase | **Kept as-is** — Node API sits in front of it; no DB/auth/realtime replacement |
| SEO/SSR | **Not needed** — pure client-side SPA everywhere, including public pages |
| Cutover shape | **Parallel build in new folders**, Next.js app untouched throughout; no in-place strangler/reverse-proxy routing |
| Team/timeline | Solo, time-boxed — today's session covers plan + scaffold + first vertical slice only; full migration spans subsequent sessions |
| Backend framework | **Node.js + Express** + TypeScript |
| Frontend framework | **Vite + React 19 + React Router**, TypeScript, TanStack Query added for data fetching/caching (replaces Next server-component fetching) |
| Auth model | **Bearer-token** JWT (Supabase session token) over CORS, not cookies — per-request RLS-scoped Supabase client on the API, mirroring today's `supabase-server.ts` pattern |
| New folder names | `client/` (Vite React app) and `server/` (Express API), both root-level, fully self-contained (own `package.json`) |
| Ratings/reviews | **No system exists today** — out of scope; "trust signals" in the redesign use only what already exists (KYC-verified badge, escrow-derived completion count) |
| Escrow sequencing | **Finish the Supabase-side escrow v2 migration first** (see `docs/escrow-production-plan.md`) before building the Node API's escrow/payment routes against it |

---

## 2. Goals / Non-goals

**Goals**
- Full feature parity with the current Next.js app across all 46 pages / 5 portals (public, freelancer, agency, admin, influencer) and shared workspaces (delivery room, disputes) — nothing removed, simplified, or changed without explicit approval.
- Same Supabase project, same RLS enforcement, same business-logic RPCs (`place_bid`, `get_jobs_with_details`, `get_freelancer_dashboard`) reused unchanged.
- A modernized UI/UX applied per vertical as it's ported (not a separate redesign pass), keeping brand identity.
- Zero risk to the running Next.js app during the build — it stays deployed and functional the entire time, and is the rollback path until the new stack is proven.

**Non-goals (for now)**
- No SSR/SEO for the new frontend (explicitly ruled out).
- No replacement of Supabase, RLS, or the existing DB schema.
- No new ratings/reviews system (not in scope of this migration).
- No escrow/payment routes in the new backend until the Supabase-side escrow v2 migration (`docs/escrow-production-plan.md`) is finished — the new Node app targets a stable schema, not a moving one.
- No automated in-place traffic-splitting/reverse-proxy cutover — cutover is a discrete switch after parity sign-off.

---

## 3. Existing system context

Summarized from a full codebase inventory (routes, API handlers, server actions, DB schema, Next.js-specific mechanisms, integrations, dependencies — see research notes folded into this doc; not separately filed).

- **Stack:** Next.js 15 (App Router) + React 19 + TypeScript, pnpm, Supabase (Auth/Postgres/Realtime/Storage), Tailwind + shadcn/ui, Paystack (primary) + Flutterwave (secondary), Resend email, Meta Pixel. No test framework. Deployed on Vercel.
- **Scale:** 46 pages across freelancer/agency/admin/influencer portals + public + shared workspace/disputes routes; 39 `app/api/**/route.ts` handlers; 4 server-action files (`app/actions/jobs.ts`, `user.ts`, `proposals.ts`, `influencer.ts`); ~40 SQL scripts in `scripts/`, no ORM.
- **Already SPA-shaped:** 82 files are `"use client"`; nearly every page is a thin server wrapper around a co-located `*Client.tsx`. `next/image`, `revalidatePath`/`revalidateTag`, `generateMetadata`, and Next Image Optimization are **not used anywhere** — nothing to replace there.
- **Genuinely Next-coupled surface (must be replaced):**
  | Item | Where | Replacement |
  |---|---|---|
  | `@supabase/auth-helpers-nextjs` cookie/session model | `lib/supabase.ts`, `lib/supabase-server.ts`, `middleware.ts` | Bearer-token auth; per-request JWT-scoped Supabase client on Express |
  | `"use server"` actions | `app/actions/*.ts` | Express route handlers, near 1:1 |
  | `next/font/google` | `app/layout.tsx` | Self-hosted fonts / `<link>` tags |
  | `next/script` (Meta Pixel, Paystack inline widget) | `app/layout.tsx` | Plain `<script>` tags — Paystack script must stay lazily loaded (it was moved to `next/script` specifically to avoid a React 19 unmount crash; preserve that load-order behavior) |
  | `middleware.ts` route/admin gating | root | Client-side route guards + Express auth-check middleware |
  | Dynamic `metadata` export (OG/Twitter/robots) | `app/layout.tsx` | Static `<meta>` in `index.html` — accepted loss per the SEO/SSR decision above |
- **Portable as-is:** all Radix/shadcn components, react-hook-form + Zod, Framer Motion, Recharts, Paystack/Flutterwave axios calls, Resend email, Supabase Realtime subscriptions (5 confirmed channels: dispute chat, agency proposal feeds ×2, freelancer/agency messaging), and the three Postgres RPCs carrying real business logic.
- **Authorization model:** RLS (`auth.uid() = owner` / participant-pair policies) is the actual data-protection layer, not app code. The Node backend must preserve this by using per-request JWT-scoped Supabase clients for user paths and reserving the service-role client for the same narrow system paths it's used for today (webhooks, admin routes, cron) — using service-role broadly would silently bypass RLS.
- **Escrow (moving target):** legacy `Funded_jobs101` still actively synced-to (`lib/funded-jobs-sync.ts`) alongside a new `escrow_deposits` v2 schema + `escrow_events` immutable log + `payouts` + `webhook_events`, trigger-enforced state machine. Full plan in `docs/escrow-production-plan.md` (~3 month scope on its own). Per the locked decision above, this finishes on the Supabase side before the Node API's escrow routes are built.
- **Duplication flagged during research:** `app/api/paystack/webhook` and `app/api/credits/webhook` both implement signature verification independently — worth consolidating during the port rather than carrying the duplication into Express.
- **Dependency note:** `"crypto": "latest"` in `package.json` is a no-op (Node builtin, not a real package) — drop it when scaffolding; several other deps are pinned to `"latest"` and should get real versions in the new project.

---

## 4. Target architecture

- **`client/`** — Vite + React 19 + TypeScript + React Router (SPA, no SSR) + TanStack Query (new — replaces Next's server-component fetching) + Tailwind + shadcn/ui (ported) + react-hook-form + Zod + Framer Motion + Recharts. Supabase JS client handles session/token refresh directly.
- **`server/`** — Node.js + Express + TypeScript. Per-request Supabase client constructed from the incoming `Authorization: Bearer <token>` header (mirrors today's `supabase-server.ts` semantics, so RLS applies exactly as it does now). Service-role client reserved for webhooks/admin/cron only, matching the existing boundary rule in `CLAUDE.md`.
- **CORS:** `client/` and `server/` are different origins — Express configured with `credentials: true` and an explicit allowed-origin list (dev + eventual staging/prod).
- **DB:** unchanged. Same Supabase project, same RLS, same RPCs. (A separate Supabase branch/dev project for the new app's development is worth considering so early testing doesn't touch production data — flagged as an open implementation-time decision, not blocking this design.)
- **Both new folders are fully self-contained** (own `package.json`, own `node_modules`, own `.env`) and sit beside the existing root-level Next.js files without modifying them.

---

## 5. Migration approach

**Vertical-slice-first**, new UI applied as each vertical is built (not a separate redesign pass):

1. Build one full vertical end-to-end first — public/landing + auth (login/signup) — to prove the whole stack (Vite ↔ Express ↔ Supabase, Bearer-token auth, CORS, RLS) works.
2. Repeat the pattern per vertical, roughly in this order: freelancer marketplace/jobs/proposals → agency dashboard/jobs/find-freelancers → credits + Paystack widget → realtime messaging → workspace/submissions/disputes → escrow/payments (gated on the Supabase-side v2 migration finishing) → admin portal → influencer portal.

Rejected alternatives: **foundation-first** (build all shared infra before any page — nothing demoable for a while) and **parity-clone-then-redesign** (port pages as visual clones first, redesign later — doubles UI work). Vertical-slice avoids both problems.

---

## 6. UI/UX direction

Keeping brand identity (`#f97316`, "10% orange / 90% neutral", Sora/Inter), tightening marketplace fundamentals:

- **Search-first navigation** — persistent, prominent job/talent search in the header, not browse-only.
- **Trust signals** — KYC-verified badges, escrow-derived job-completion counts. No ratings/reviews (none exist today; out of scope per locked decision).
- **Card-driven browsing** — job/profile cards with budget/rate prominent, skill tags, proposal counts, posted-time, replacing denser table-style views where present.
- **Messaging** — split-pane thread list + conversation, backed by existing Supabase Realtime channels.
- **Dashboards** — stat-tile overview + activity feed + quick actions; mobile-first layout (current sidebar-heavy dashboards need a bottom-nav/drawer pattern on small screens).
- Detailed mockups are deferred to implementation time (per-vertical, ideally with visual iteration) rather than specified in prose here.

---

## 7. Phased plan

| Phase | Scope | Gate |
|---|---|---|
| 0 | This design + scaffold `client/` and `server/` (tooling, CORS, Bearer-token auth wired end-to-end) + first vertical slice: landing + login/signup in the new UI direction | Today |
| 1 | Backend foundation — auth middleware, RLS-scoped client helper, admin-role middleware, base error/response conventions; port `app/actions/jobs.ts` `user.ts` `proposals.ts` → Express (no money involved) | |
| 2 | Freelancer + agency core — marketplace, jobs, proposals, saved jobs, profiles, find-freelancers | |
| 3 | Credits & realtime messaging — credit purchase flow, Paystack widget, Realtime re-subscribed in React | |
| 4 | Escrow & payments — **gated on the Supabase-side escrow v2 migration being finished**; funding, submissions/approval, payouts, webhook signature verification + idempotency (consolidating the paystack/credits webhook duplication noted above) | Blocked until Supabase escrow v2 done |
| 5 | Admin, disputes, influencer portals | |
| 6 | Testing & regression prevention — add integration tests per vertical as built (Vitest + Testing Library client-side, Vitest/supertest API-side); manual parity checklist derived from `docs/platform-routes.md`, old-vs-new side-by-side per route | |
| 7 | Deployment & cutover — `client/` deployed static, `server/` deployed as a Node service, both to a staging subdomain; Next.js app stays live as rollback throughout; cutover is a deliberate deploy/DNS switch after parity sign-off, with a soak period before decommissioning Next.js | |

---

## 8. Risks

- Auth model change (cookie → Bearer) touches every RLS-protected query path — needs thorough per-route testing, not just at the auth layer.
- Escrow schema is being finished concurrently on the Supabase side (Phase 4 gate) — coordination risk if that work slips.
- No existing test suite — regression risk is manual/QA-driven unless tests are added as each vertical ports (per Phase 6).
- Must keep `VITE_*` (public) vs. server-only env vars (`SUPABASE_SERVICE_ROLE_KEY`, `PAYSTACK_SECRET_KEY`, `RESEND_API_KEY`) strictly separated between `client/` and `server/` — no secret key should ever reach the Vite bundle.
- Paystack inline widget load-order (lazy, post-interactive) must be preserved when ported to a plain `<script>` tag, or the React 19 unmount crash it was originally worked around for could resurface.

---

## 9. Open items for implementation time (non-blocking)

- Whether the new app's early development targets a separate Supabase branch/dev project vs. the same production project.
- Deployment targets for `client/` and `server/` once each is ready for staging (not decided yet, doesn't block scaffolding).
