# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Bizimi is a Nigerian freelancer marketplace connecting agencies with vetted freelancers, with a credit-based application system and escrow-based payments. Roles: **freelancer**, **agency**, **admin**, and **influencer** (referral partners), each with their own portal under `app/`.

Originally scaffolded/synced from v0.app (see README.md); development has since continued directly in this repo.

## Stack

- Next.js 15 (App Router) + React 19 + TypeScript, package manager **pnpm**
- Supabase (Auth, Postgres, Realtime, Storage)
- Tailwind CSS + shadcn/ui (Radix primitives) — see `components.json` for aliases (`@/components`, `@/lib`, `@/components/ui`, `@/hooks`)
- Paystack (primary) and Flutterwave (secondary) for payments
- React Hook Form + Zod for forms/validation
- Resend for transactional email

## Commands

```
pnpm dev      # start dev server (default port 3000)
pnpm build    # production build
pnpm start    # start production server
pnpm lint     # next lint
```

The root Next.js app has no automated test suite. The `test-*.js` files at the repo root are ad hoc, one-off scripts for manually querying Supabase during development (they load `.env.local` directly) — not a real test harness. Don't treat them as CI-relevant, and don't extend the pattern for new tests.

The new `client/` and `server/` apps (see "React + Node migration" below) each have a real Vitest suite and their own `package-lock.json` (npm, not pnpm — run `npm ci` inside each):

```
cd client && npx vitest run && npx tsc --noEmit   # Vite + React SPA
cd server && npx vitest run && npx tsc --noEmit   # Express API (dev server on PORT, default 4000)
```

If client tests fail with `Cannot read properties of null (reading 'useContext')`, `client/node_modules` is missing a declared dependency and Node is resolving the root app's copy (and its React) — run `npm ci` in `client/`.

**Both ESLint and TypeScript errors are ignored during `next build`** (see `next.config.mjs`: `eslint.ignoreDuringBuilds`, `typescript.ignoreBuildErrors`). A green build does not mean the code typechecks — check with `tsc --noEmit` or editor diagnostics separately when it matters.

**Dev server on Windows:** the webpack filesystem cache is disabled in dev (`config.cache = { type: "memory" }` in `next.config.mjs`) because the persistent cache is flaky on Windows and corrupts builds. Do not run two `next dev` instances against this working copy at once — they share `.next` and will corrupt each other's chunks even on different ports; only a separate git worktree isolates a second instance.

## Architecture

### React + Node migration (`client/`, `server/`)

The app is being migrated from this Next.js app to a Vite + React SPA (`client/`) talking to an Express API (`server/`), both in front of the same Supabase project (same tables, same RLS). The root Next.js app is still the live production app; `client/`/`server/` are additive. Route-by-route status is tracked in `docs/react-node-migration-parity-checklist.md` — every unported route depends on escrow and is blocked on the escrow plan's Phase 4.

### Supabase client boundaries (`lib/`)

Three distinct Supabase clients exist and are **not interchangeable**:

- `lib/supabase.ts` — `createClientComponentClient`, for client components (`"use client"`).
- `lib/supabase-server.ts` — `createServerComponentClient` (cookie-aware, async), for server components/actions that need the requesting user's session and RLS.
- `lib/supabase-service.ts` — `createServiceRoleClient`, bypasses RLS with the service-role key. Only for webhooks/cron/admin server routes that must act on behalf of the system — never expose this client to a user-facing code path.

### Auth & authorization

- `contexts/AuthContext.tsx` holds client-side `user`/`profile` state (via `onAuthStateChange`) and is the source of truth for UI-level role checks.
- `middleware.ts` is the actual gate: it protects `/dashboard`, `/agency`, `/freelancer`, `/influencer`, `/admin`, and redirects authenticated users away from `/login`, `/signup`, `/reset-password`. Admin routes additionally check `profiles.role === 'admin' OR profiles.account_type === 'admin'` — the codebase uses these two fields inconsistently, so admin checks anywhere else in the app should accept either, not just one.
- KYC/identity verification (NIN) is performed by an **external service**, out of band. This app only stores and displays the resulting status (`freelancer_verification.status`, read via `getNINVerified` in `app/actions/user.ts`) — there is no in-repo verification logic and no admin "approve/reject KYC" action to build.

### Server actions vs. API routes

- `app/actions/` (`jobs.ts`, `user.ts`, `proposals.ts`, `influencer.ts`) — Next.js Server Actions, the preferred path for database reads/writes from the app itself.
- `app/api/` — route handlers, used specifically for payment provider integration (`paystack/`, `flutterwave/`, `credits/`, `escrow/`) and webhooks, i.e. things that need a real HTTP endpoint external services can call, or that need the service-role client.

### Escrow / payments

This is the highest-stakes part of the codebase — see `docs/escrow-production-plan.md` for the full design doc. Key points:

- The system is mid-migration from a legacy `Funded_jobs101` table to a proper `escrow_deposits` + `escrow_events` (immutable event log) + `payouts` + `webhook_events` schema, with a Postgres-trigger-enforced state machine (`pending → awaiting → funded → released → paid_out`, plus `disputed`/`refunded` branches). Schema/migration SQL lives in `scripts/escrow-00{1,2,3}-*.sql`.
- Money is stored as `bigint` kobo, never floats; convert to naira only at the UI boundary.
- Every webhook handler must verify the provider signature and dedupe via `webhook_events` — there should be no code path that trusts an unverified webhook body.
- Payout amounts are always server-derived from escrow state (`amount_kobo × (1 − platform_fee_pct)`), never taken from the client.
- Check current DB/table names against `docs/escrow-production-plan.md`'s phase before assuming `escrow_deposits` vs `Funded_jobs101` is the live source of truth for a given piece of code — the cutover is incremental.

### Database

- No ORM; raw Supabase queries and Postgres functions/triggers, defined as SQL in two places: ad hoc scripts in `scripts/` (schema changes, RLS policies, backfills, triggers — apply/order matters for the escrow scripts specifically, 001 → 002 → 003) and Supabase-CLI-style `supabase/migrations/` (newer schema/RLS, e.g. the influencer program and the RLS lockdown migrations). Check both for any schema/RLS question. Migrations are applied manually via the Supabase Studio SQL editor — a file existing here does not mean it is live.
- RLS is the primary data-protection mechanism; the service-role client is the deliberate escape hatch for system-level writes.

### Routes

`docs/platform-routes.md` documents the full route map by role (public, freelancer, agency, shared workspace/disputes, admin, influencer) if you need to understand what a given page under `app/` is for.

## Conventions

- Primary brand color `orange-500` (`#f97316`) — see `design-system.md` for the full palette, button/card/badge patterns, and the "10% orange, 90% neutrals" rule.
- Reuse existing `components/ui/` (shadcn) components rather than building new primitives.
- New data models: type in TypeScript, validate with Zod on forms.

## Local dev notes

- When starting a dev server to test changes, use port **3001** (`PORT=3001 pnpm dev`, not `pnpm dev -- -p 3001` — pnpm forwards the literal `--` and breaks `next dev`'s arg parsing). Port 3000 is reserved for the user's own running server; don't start a server on 3000 or kill what's running there without asking. Prefer verifying via typecheck/diagnostics over spinning up a server when possible.
