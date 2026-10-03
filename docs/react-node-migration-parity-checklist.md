# React+Node Migration — Route Parity Checklist

Manual old-vs-new comparison, per Phase 6 of `docs/superpowers/specs/2026-09-08-nextjs-to-react-node-migration-design.md` ("manual parity checklist derived from `docs/platform-routes.md`, old-vs-new side-by-side per route"). This is a point-in-time snapshot (as of 2026-09-29, `main` at `d57d685`) — re-generate or update after any phase that adds/moves a route.

Legend: ✅ ported and wired in `client/`+`server/` · ⛔ blocked on Phase 4 (escrow) · ⬜ not started, no blocker · 📄 documented in `docs/platform-routes.md` but missing here (doc gap, not a code gap)

## Public routes

| Route (legacy) | New SPA path | Status | Notes |
|---|---|---|---|
| `/` | `/` | ✅ | `Landing` |
| `/login` | `/login` | ✅ | `Login` |
| `/signup` | `/signup` | ✅ | `Signup` — also handles `?ref=` capture for the influencer referral program (Phase 5e) |
| `/reset-password` | `/reset-password` | ✅⚠️ | Ported 2026-09-29 (`aaa5a0e`), faithful port with the security property verified end-to-end by final review. **But no real Supabase recovery email actually reaches this page yet** — the legacy "request reset" modal (`components/forgot-password-modal.tsx`) sets `redirectTo: ${origin}/freelancer/reset-password`, a path the new SPA doesn't have; its catch-all route sends that link to `/` instead. Needs a follow-up: port the "request reset" step, settle on one `redirectTo` target, register it in Supabase's allowed redirect URLs. Don't mark this fully parity-complete until that lands. |
| `/contact` | `/contact` | ✅ | Ported 2026-09-29 (`aaa5a0e`), byte-for-byte static content port |

## Freelancer routes

| Route (legacy) | New SPA path | Status | Notes |
|---|---|---|---|
| `/dashboard` | `/freelancer/dashboard` | ✅ | **Path changed** — legacy mounts the freelancer dashboard at the bare `/dashboard`, the new SPA uses `/freelancer/dashboard`. Not a gap, but a real difference to account for at cutover (bookmarks, any hardcoded links to `/dashboard`, `middleware.ts`'s route-protection list). |
| `/freelancer/profile` | `/freelancer/profile` | ✅ | |
| `/freelancer/proposals` | `/freelancer/proposals` | ✅ | |
| `/freelancer/saved-jobs` | `/freelancer/saved-jobs` | ✅ | |
| `/freelancer/messages` | `/freelancer/messages` | ✅ | Shared `Messages.tsx`, also mounted for agency |
| `/freelancer/bizpal` | `/freelancer/bizpal` | ✅ | Credits store — see the credits-verify security fixes (merged 2026-09-29) before treating this area as fully hardened; the RLS migration still needs manual application |
| `/freelancer/funded-jobs` | — | ⛔ | Escrow-gated (Phase 4) |
| `/freelancer/identity` | `/freelancer/identity` | ✅⚠️ | Ported 2026-09-30, display+submit only. KYC/NIN verification itself is handled by an **external service** per `CLAUDE.md` — this app only stores/displays status (`GET/POST /api/user/verification`), so this route is a display+submission page, not new verification logic. **Gap:** the legacy page's 60-second client-side auto-verify timer (a known fake-KYC stub, deliberately preserved as-is on the legacy side) was **not** ported — it needs its own `useEffect` wired to `verification.created_at` plus a status-flip endpoint that doesn't exist yet in this plan's server route. Follow-up work, not a blocker for this route's core display/submit behavior. |
| `/freelancer/settings` | `/freelancer/settings` | ✅ | Ported 2026-10-02, near-byte-identical port of the 543-line legacy page (verified via exhaustive full-body diff). Account tab (email/password, real `supabase.auth.updateUser` calls) and Danger Zone (real `DeleteAccountDialog` → `POST /api/user/account`) are fully functional; Notifications/Privacy/Security tabs are faithfully-ported **fake stubs** (no persistence) matching the legacy source exactly — not a regression. |
| `/freelancer/tutorial` | `/freelancer/tutorial` | ✅ | Ported 2026-10-02, fully static content, all 8 sections word-for-word from the legacy source including the real (if inconsistent) `contact@bizimii.com` support address. |
| — | `/freelancer/marketplace` | ✅ | **New SPA route not in `docs/platform-routes.md`** (doc gap — the browse-jobs flow was ported as its own route during Phase 2, commit `e580583`, but the routes doc was never updated to reflect it). |

## Agency routes

| Route (legacy) | New SPA path | Status | Notes |
|---|---|---|---|
| `/agency/dashboard` | `/agency/dashboard` | ✅ | Includes inline job posting/management (`PostJobModal`, `ProposalsModal`) |
| `/agency/profile` | `/agency/profile` | ✅ | |
| `/agency/find-freelancers` | `/agency/find-freelancers` | ✅ | |
| `/agency/messages` | `/agency/messages` | ✅ | Shared `Messages.tsx` |
| `/agency/wallet` | — | ⛔ | Escrow-gated (Phase 4) |
| `/agency/posts` | `/agency/posts` | ✅⚠️ | Slim port 2026-10-03: job-post grid + title/description search (client-side over `useAgencyJobsQuery`, so no pagination) + shared `ProposalsModal`. **Omitted:** legacy "Fund job" (`/api/escrow/initialize`) and "Mark done" (`/api/paystack/mark-complete`) — escrow-gated, add in Phase 4; also the realtime proposal-count refresh and the inline "Message freelancer" box on accepted proposals (`/agency/messages` covers messaging). |
| `/agency/settings` | `/agency/settings` | ✅ | Ported 2026-10-02 — mirrors `/freelancer/settings`; reuses `DeleteAccountDialog` + `POST /api/user/account` (Danger Zone under the Security tab, as in legacy). Notification/privacy saves are still no-op stubs, same as legacy. |
| `/agency/tutorial` | `/agency/tutorial` | ✅ | Ported 2026-10-02, static content port |

## Shared workspaces & escrow

| Route (legacy) | New SPA path | Status | Notes |
|---|---|---|---|
| `/workspace/[job_id]` | — | ⛔ | Escrow-gated (Phase 4) |
| `/disputes/[id]` | — | ⛔ | Escrow-gated (Phase 4) |

## Admin routes

| Route (legacy) | New SPA path | Status | Notes |
|---|---|---|---|
| `/admin/login` | `/admin/login` | ✅ | |
| `/admin/dashboard` | `/admin/dashboard` | ✅ | |
| `/admin/users` | `/admin/users` | ✅ | |
| `/admin/credits` | `/admin/credits` | ✅ | Phase 5d — read-only oversight of `purchase_credits`/freelancers |
| `/admin/transactions` | — | ⛔ | Escrow-gated (Phase 4) — deliberately excluded from every Phase 5 sub-plan |
| `/admin/disputes` | — | ⛔ | Escrow-gated (Phase 4) — deliberately excluded from every Phase 5 sub-plan |
| `/admin/analytics` | — | ⛔ | Escrow-gated (Phase 4) — reclassified 2026-10-03 from ⬜. Legacy page (`AnalyticsClient.tsx`) is entirely top-20 freelancer payouts / agency deposits aggregated from `Funded_jobs101`, the table `docs/escrow-production-plan.md` removes ("Kill `Funded_jobs101`"). Newer escrow funding writes `escrow_deposits`, so the legacy numbers likely already undercount. Port against `escrow_deposits`/`payouts` after cutover, like `/admin/transactions`. |
| — | `/admin/jobs` | ✅ | **New SPA route not in `docs/platform-routes.md`** (doc gap — job moderation queue, Phase 5c). |
| — | `/admin/audit` | ✅ | **New SPA route not in `docs/platform-routes.md`** (doc gap — admin audit log, Phase 5c). |
| — | `/admin/influencers` | ✅ | **New SPA route not in `docs/platform-routes.md`** (doc gap — influencer program admin, Phase 5d). |

## Influencer routes (entire role missing from `docs/platform-routes.md`)

`docs/platform-routes.md` has no "Influencer" section at all — it predates the influencer referral program entirely. These are real, live routes in both the legacy app and the new SPA:

| Route (legacy) | New SPA path | Status | Notes |
|---|---|---|---|
| `/influencer/dashboard` | `/influencer/dashboard` | ✅ | Phase 5e |
| `/influencer/referrals` | `/influencer/referrals` | ✅ | Phase 5e |
| `/influencer/earnings` | `/influencer/earnings` | ✅ | Phase 5e |

## Summary

- **Fully ported and wired:** 29 routes (all public/freelancer/agency/admin/influencer routes with no escrow dependency). This includes `/reset-password`, ported but with a known, tracked gap — see its row above; treat it as functionally incomplete until the "request reset" step is also ported. It also includes `/freelancer/identity`, ported but with a known, tracked gap — see its row above; the 60-second client-side auto-verify timer was deliberately not ported in this pass. And it includes `/agency/posts`, a slim port whose escrow actions (Fund job, Mark done) wait on Phase 4 — see its row above.
- **Escrow-gated (⛔), blocked on Phase 4:** `/freelancer/funded-jobs`, `/agency/wallet`, `/workspace/[job_id]`, `/disputes/[id]`, `/admin/transactions`, `/admin/disputes`, `/admin/analytics` — 7 routes. None of these can be started until `docs/escrow-production-plan.md`'s own Status line clears "Phase 1 in progress."
- **Not started, no blocker (⬜):** none — every remaining unported route is escrow-gated. (`/admin/analytics` was listed here until 2026-10-03; reclassified ⛔ because it reads only `Funded_jobs101`.)
- **Doc gaps found:** `docs/platform-routes.md` is missing `/freelancer/marketplace`, `/admin/jobs`, `/admin/audit`, `/admin/influencers`, and the entire Influencer role section. Worth a follow-up pass to update that doc directly so it stays a reliable reference — not done as part of this checklist to avoid conflating "what's ported" with "fixing an unrelated doc."
- **Known path difference to reconcile before cutover:** freelancer dashboard is `/dashboard` in the legacy app, `/freelancer/dashboard` in the new SPA.

## What this checklist does NOT cover

Per the spec, Phase 6 also calls for "add integration tests per vertical as built" — that part has already been satisfied incrementally: every phase in this migration added Vitest/Testing Library coverage as it shipped (see `react-node-migration-status.md` memory for the running tally). This document only covers the route-inventory half of Phase 6.

This is a route-existence comparison, not a pixel/behavior parity audit — a route marked ✅ here has been ported and has passing tests, but visually/behaviorally comparing old vs. new side-by-side (the spec's literal phrase) is still a manual QA pass someone needs to actually do in a browser, which no amount of code review substitutes for.
