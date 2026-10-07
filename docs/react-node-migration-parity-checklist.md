# React+Node Migration — Route Parity Checklist

Manual old-vs-new comparison, per Phase 6 of `docs/superpowers/specs/2026-09-08-nextjs-to-react-node-migration-design.md` ("manual parity checklist derived from `docs/platform-routes.md`, old-vs-new side-by-side per route"). This is a point-in-time snapshot (originally 2026-09-29 at `d57d685`; last updated 2026-10-03) — re-generate or update after any phase that adds/moves a route.

Legend: ✅ ported and wired in `client/`+`server/` · 🟡 built on escrow v2, awaiting live go-live checks · ⛔ blocked on Phase 4 (escrow) · ⬜ not started, no blocker · 📄 documented in `docs/platform-routes.md` but missing here (doc gap, not a code gap)

## Public routes

| Route (legacy) | New SPA path | Status | Notes |
|---|---|---|---|
| `/` | `/` | ✅ | `Landing`. Phase 0 only ported Nav/Hero/FinalCTA/Footer; the seven middle sections (stats, categories, how it works, featured talent, testimonials, for freelancers, FAQ) and the Sora/Inter/Instrument Serif/Bricolage fonts were added 2026-10-07. |
| `/login` | `/login` | ✅ | `Login` |
| `/signup` | `/signup` | ✅ | `Signup` — also handles `?ref=` capture for the influencer referral program (Phase 5e) |
| `/reset-password` | `/reset-password` | ✅⚠️ | Ported 2026-09-29 (`aaa5a0e`). "Request reset" step ported 2026-10-03: `ForgotPasswordModal` + re-enabled "Forgot?" on `/login`, recovery emails now `redirectTo: ${origin}/reset-password`; legacy `/freelancer/reset-password` kept as a route alias for links already sent. **Remaining (config, not code):** `<SPA origin>/reset-password` (and `/freelancer/reset-password`) must be in Supabase Auth → URL Configuration → Redirect URLs, or Supabase falls back to the Site URL. Not verified from here — confirm in Supabase Studio and test one real recovery email end-to-end before marking ✅. |
| `/contact` | `/contact` | ✅ | Ported 2026-09-29 (`aaa5a0e`), byte-for-byte static content port |

## Freelancer routes

| Route (legacy) | New SPA path | Status | Notes |
|---|---|---|---|
| `/freelancer/dashboard` (legacy `/dashboard` redirects here) | `/freelancer/dashboard` | ✅ | Same path in both apps — the legacy bare `/dashboard` is only a redirect to `/freelancer/dashboard` (corrected 2026-10-03; earlier versions of this checklist called it a path difference). |
| `/freelancer/profile` | `/freelancer/profile` | ✅ | |
| `/freelancer/proposals` | `/freelancer/proposals` | ✅ | |
| `/freelancer/saved-jobs` | `/freelancer/saved-jobs` | ✅ | |
| `/freelancer/messages` | `/freelancer/messages` | ✅ | Shared `Messages.tsx`, also mounted for agency |
| `/freelancer/bizpal` | `/freelancer/bizpal` | ✅ | Credits store — see the credits-verify security fixes (merged 2026-09-29) before treating this area as fully hardened; the RLS migration still needs manual application |
| `/freelancer/funded-jobs` | `/freelancer/funded-jobs` | 🟡 | Phase 4 (2026-10-03), on escrow v2 — see `docs/superpowers/plans/2026-10-03-phase4-escrow-readiness.md` §3–4 for the go-live gates (not yet run against live Supabase/Paystack). Adds payout-account management (legacy had no UI to save bank details). |
| `/freelancer/identity` | `/freelancer/identity` | ✅ | Ported 2026-09-30 (display + submit via `GET/POST /api/user/verification`). KYC/NIN verification is done by an **external service** per `CLAUDE.md`. The legacy 60-second client-side auto-verify timer was a fake-KYC stub that self-set `status='verified'` via a client-writable RLS UPDATE policy — **deliberately not ported, and removed from the legacy page** 2026-10-03; the SPA instead polls status every 30s while pending. Companion migration `supabase/migrations/20261003000000_lock_down_freelancer_verification_writes.sql` closes the self-verify RLS hole — **must be applied manually** (assumes the external service writes with the service-role key). |
| `/freelancer/settings` | `/freelancer/settings` | ✅ | Ported 2026-10-02, near-byte-identical port of the 543-line legacy page (verified via exhaustive full-body diff). Account tab (email/password, real `supabase.auth.updateUser` calls) and Danger Zone (real `DeleteAccountDialog` → `POST /api/user/account`) are fully functional; Notifications/Privacy/Security tabs are faithfully-ported **fake stubs** (no persistence) matching the legacy source exactly — not a regression. |
| `/freelancer/tutorial` | `/freelancer/tutorial` | ✅ | Ported 2026-10-02, fully static content, all 8 sections word-for-word from the legacy source including the real (if inconsistent) `contact@bizimii.com` support address. |
| `/freelancer/marketplace` | `/freelancer/marketplace` | ✅ | Phase 2 (`e580583`). Exists in both apps; now documented in `docs/platform-routes.md`. |
| `/freelancer/contact` | `/freelancer/contact` | ✅ | Ported 2026-10-03 — freelancer support page (navbar Support item), distinct from public `/contact`. Was missing from both this checklist and the routes doc. |
| `/freelancer/policy` | `/freelancer/policy` | ✅ | Ported 2026-10-03 — duplicates & verification policy, static. Was missing from both this checklist and the routes doc. |

## Agency routes

| Route (legacy) | New SPA path | Status | Notes |
|---|---|---|---|
| `/agency/dashboard` | `/agency/dashboard` | ✅ | Includes inline job posting/management (`PostJobModal`, `ProposalsModal`) |
| `/agency/profile` | `/agency/profile` | ✅ | |
| `/agency/find-freelancers` | `/agency/find-freelancers` | ✅ | |
| `/agency/messages` | `/agency/messages` | ✅ | Shared `Messages.tsx` |
| `/agency/wallet` | `/agency/wallet` | 🟡 | Phase 4 (2026-10-03), on escrow v2 — see `docs/superpowers/plans/2026-10-03-phase4-escrow-readiness.md` §3–4 for the go-live gates (not yet run against live Supabase/Paystack). Reads v2 escrows, not `Funded_jobs101`/`agency_fundings`. |
| `/agency/posts` | `/agency/posts` | ✅⚠️ | Slim port 2026-10-03: job-post grid + title/description search (client-side over `useAgencyJobsQuery`, so no pagination) + shared `ProposalsModal`. **Omitted:** legacy "Fund job" (`/api/escrow/initialize`) and "Mark done" (`/api/paystack/mark-complete`) — escrow-gated, add in Phase 4; also the realtime proposal-count refresh and the inline "Message freelancer" box on accepted proposals (`/agency/messages` covers messaging). |
| `/agency/settings` | `/agency/settings` | ✅ | Ported 2026-10-02 — mirrors `/freelancer/settings`; reuses `DeleteAccountDialog` + `POST /api/user/account` (Danger Zone under the Security tab, as in legacy). Notification/privacy saves are still no-op stubs, same as legacy. |
| `/agency/tutorial` | `/agency/tutorial` | ✅ | Ported 2026-10-02, static content port |
| `/agency/contact` | `/agency/contact` | ✅ | Added 2026-10-07 — identical to `/freelancer/contact` (same `SupportContact` page); reached from the portal top bar's Support item. Was missing from the checklist. |

## Shared workspaces & escrow

| Route (legacy) | New SPA path | Status | Notes |
|---|---|---|---|
| `/workspace/[job_id]` | `/workspace/:jobId` | 🟡 | Phase 4 (2026-10-03), on escrow v2 — see `docs/superpowers/plans/2026-10-03-phase4-escrow-readiness.md` §3–4 for the go-live gates (not yet run against live Supabase/Paystack). Approve releases the escrow (funded → released). Identities from the session (legacy API trusted body ids). |
| `/disputes/[id]` | `/disputes/:id` | 🟡 | Phase 4 (2026-10-03), on escrow v2 — see `docs/superpowers/plans/2026-10-03-phase4-escrow-readiness.md` §3–4 for the go-live gates (not yet run against live Supabase/Paystack). Opening a dispute freezes funds (funded → disputed). |

## Admin routes

| Route (legacy) | New SPA path | Status | Notes |
|---|---|---|---|
| `/admin/login` | `/admin/login` | ✅ | |
| `/admin/dashboard` | `/admin/dashboard` | ✅ | |
| `/admin/users` | `/admin/users` | ✅ | |
| `/admin/credits` | `/admin/credits` | ✅ | Phase 5d — read-only oversight of `purchase_credits`/freelancers |
| `/admin/transactions` | `/admin/transactions` | 🟡 | Phase 4 (2026-10-03), on escrow v2 — see `docs/superpowers/plans/2026-10-03-phase4-escrow-readiness.md` §3–4 for the go-live gates (not yet run against live Supabase/Paystack). Read-only v2 ledger + per-escrow event trail; the legacy mark_done/process_payout flag toggles are intentionally not ported. |
| `/admin/disputes` | `/admin/disputes` | 🟡 | Phase 4 (2026-10-03), on escrow v2 — see `docs/superpowers/plans/2026-10-03-phase4-escrow-readiness.md` §3–4 for the go-live gates (not yet run against live Supabase/Paystack). Full release or Paystack refund; partial release returns 422 pending a product decision. |
| `/admin/analytics` | `/admin/analytics` | 🟡 | Phase 4 (2026-10-03), on escrow v2 — see `docs/superpowers/plans/2026-10-03-phase4-escrow-readiness.md` §3–4 for the go-live gates (not yet run against live Supabase/Paystack). Rebuilt on `payouts`/`escrow_deposits` instead of `Funded_jobs101`. |
| `/admin/jobs` | `/admin/jobs` | ✅ | Job moderation queue, Phase 5c. Now documented in `docs/platform-routes.md`. |
| `/admin/audit` | `/admin/audit` | ✅ | Admin audit log, Phase 5c. Now documented in `docs/platform-routes.md`. |
| `/admin/influencers` | `/admin/influencers` | ✅ | Influencer program admin, Phase 5d. Now documented in `docs/platform-routes.md`. |

## Influencer routes

Real, live routes in both the legacy app and the new SPA (documented in `docs/platform-routes.md` as of 2026-10-03):

| Route (legacy) | New SPA path | Status | Notes |
|---|---|---|---|
| `/influencer/dashboard` | `/influencer/dashboard` | ✅ | Phase 5e |
| `/influencer/referrals` | `/influencer/referrals` | ✅ | Phase 5e |
| `/influencer/earnings` | `/influencer/earnings` | ✅ | Phase 5e |

## Summary

- **Portal shell:** until 2026-10-07 the SPA's `/agency/*` and `/freelancer/*` pages had no sidebar or top bar — the Next.js `app/agency/layout.tsx` / `app/freelancer/layout.tsx` (AppSidebar, DashboardTopBar, PageTransition) were never ported. Now `components/portal/PortalLayout` wraps both portals, backed by `GET /api/user/shell`.
- **Fully ported and wired:** 32 routes (all public/freelancer/agency/admin/influencer routes with no escrow dependency). This includes `/reset-password`, ported but with a known, tracked gap — see its row above; the "request reset" step is now ported, but the Supabase redirect-URL allowlist still needs confirming before it can be called complete. And it includes `/agency/posts`, a slim port whose escrow actions (Fund job, Mark done) wait on Phase 4 — see its row above.
- **Built on escrow v2, awaiting go-live checks (🟡):** `/freelancer/funded-jobs`, `/agency/wallet`, `/workspace/[job_id]`, `/disputes/[id]`, `/admin/transactions`, `/admin/disputes`, `/admin/analytics` — 7 routes, plus "Fund job" on accepted proposals and `/agency/escrow/return`. Code and tests are in; what's left is verification against live Supabase and Paystack test mode, and the webhook cutover (readiness doc §4).
- **Not started, no blocker (⬜):** none — every remaining unported route is escrow-gated. (`/admin/analytics` was listed here until 2026-10-03; reclassified ⛔ because it reads only `Funded_jobs101`.)
- **Doc gaps:** resolved 2026-10-03 — `docs/platform-routes.md` now covers `/freelancer/marketplace`, `/freelancer/contact`, `/freelancer/policy`, `/freelancer/reset-password`, `/admin/jobs`, `/admin/audit`, `/admin/influencers`, and the Influencer role.
- **Path differences:** none. (The freelancer dashboard is `/freelancer/dashboard` in both apps; the legacy bare `/dashboard` is just a redirect.)

## What this checklist does NOT cover

Per the spec, Phase 6 also calls for "add integration tests per vertical as built" — that part has already been satisfied incrementally: every phase in this migration added Vitest/Testing Library coverage as it shipped (see `react-node-migration-status.md` memory for the running tally). This document only covers the route-inventory half of Phase 6.

This is a route-existence comparison, not a pixel/behavior parity audit — a route marked ✅ here has been ported and has passing tests, but visually/behaviorally comparing old vs. new side-by-side (the spec's literal phrase) is still a manual QA pass someone needs to actually do in a browser, which no amount of code review substitutes for.
