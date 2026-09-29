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
| `/freelancer/identity` | — | ⬜ | Not ported. KYC/NIN submission is handled by an **external service** per `CLAUDE.md` — this app only displays status (`getNINVerified`), so porting this page is mostly a display page, not new verification logic. No blocker. |
| `/freelancer/settings` | — | ⬜ | Not ported. No blocker. |
| `/freelancer/tutorial` | — | ⬜ | Not ported. No blocker. |
| — | `/freelancer/marketplace` | ✅ | **New SPA route not in `docs/platform-routes.md`** (doc gap — the browse-jobs flow was ported as its own route during Phase 2, commit `e580583`, but the routes doc was never updated to reflect it). |

## Agency routes

| Route (legacy) | New SPA path | Status | Notes |
|---|---|---|---|
| `/agency/dashboard` | `/agency/dashboard` | ✅ | Includes inline job posting/management (`PostJobModal`, `ProposalsModal`) |
| `/agency/profile` | `/agency/profile` | ✅ | |
| `/agency/find-freelancers` | `/agency/find-freelancers` | ✅ | |
| `/agency/messages` | `/agency/messages` | ✅ | Shared `Messages.tsx` |
| `/agency/wallet` | — | ⛔ | Escrow-gated (Phase 4) |
| `/agency/posts` | — | ⬜ | Not ported. Legacy is a distinct page (`PostsClient.tsx`, separate from the dashboard's inline job list) — confirm during porting whether it's actually redundant with `/agency/dashboard`'s own listing or has distinct content before assuming a 1:1 port. No blocker. |
| `/agency/settings` | — | ⬜ | Not ported. No blocker. |
| `/agency/tutorial` | — | ⬜ | Not ported. No blocker. |

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
| `/admin/analytics` | — | ⬜ | Not ported. Legacy page exists (`AnalyticsClient.tsx`). No blocker, just not yet scheduled — lower priority than the money-adjacent pages. |
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

- **Fully ported and wired:** 23 routes (all public/freelancer/agency/admin/influencer routes with no escrow dependency, except the 7 marked ⬜ below). This includes `/reset-password`, ported but with a known, tracked gap — see its row above; treat it as functionally incomplete until the "request reset" step is also ported.
- **Escrow-gated (⛔), blocked on Phase 4:** `/freelancer/funded-jobs`, `/agency/wallet`, `/workspace/[job_id]`, `/disputes/[id]`, `/admin/transactions`, `/admin/disputes` — 6 routes. None of these can be started until `docs/escrow-production-plan.md`'s own Status line clears "Phase 1 in progress."
- **Not started, no blocker (⬜):** `/freelancer/identity`, `/freelancer/settings`, `/freelancer/tutorial`, `/agency/posts`, `/agency/settings`, `/agency/tutorial`, `/admin/analytics` — 7 routes. These are legitimate escrow-independent work whenever there's capacity for them; none were in any Phase 1-5 sub-plan's scope. Note: `/freelancer/identity`'s legacy source has a real discrepancy from `CLAUDE.md`'s documented architecture — see the `react-node-migration-status` memory before porting it.
- **Doc gaps found:** `docs/platform-routes.md` is missing `/freelancer/marketplace`, `/admin/jobs`, `/admin/audit`, `/admin/influencers`, and the entire Influencer role section. Worth a follow-up pass to update that doc directly so it stays a reliable reference — not done as part of this checklist to avoid conflating "what's ported" with "fixing an unrelated doc."
- **Known path difference to reconcile before cutover:** freelancer dashboard is `/dashboard` in the legacy app, `/freelancer/dashboard` in the new SPA.

## What this checklist does NOT cover

Per the spec, Phase 6 also calls for "add integration tests per vertical as built" — that part has already been satisfied incrementally: every phase in this migration added Vitest/Testing Library coverage as it shipped (see `react-node-migration-status.md` memory for the running tally). This document only covers the route-inventory half of Phase 6.

This is a route-existence comparison, not a pixel/behavior parity audit — a route marked ✅ here has been ported and has passing tests, but visually/behaviorally comparing old vs. new side-by-side (the spec's literal phrase) is still a manual QA pass someone needs to actually do in a browser, which no amount of code review substitutes for.
