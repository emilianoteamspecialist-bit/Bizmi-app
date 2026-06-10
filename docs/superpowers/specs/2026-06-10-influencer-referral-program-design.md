# Influencer Referral Program — Design

**Date:** 2026-06-10
**Status:** Design approved (brainstorming complete) — ready for implementation plan
**Author:** Claude + Kene

---

## 1. Summary

Add an **Influencer** program to Bizimi. Influencers promote the platform externally
(their own social channels) using a **unique referral link**. When a user who signed up
through that link completes their **first successful transaction** (first escrow release),
the influencer earns a commission equal to **10% of Bizimi's platform fee** on that
transaction (rate admin-configurable). Earnings accrue to a separate balance that an
**admin pays out manually**.

Influencer is a **third account type** alongside Freelancer and Agency.

### Decisions locked during brainstorming

| Decision | Choice |
|---|---|
| How influencers join | **Third account type** at sign-up (Freelancer / Agency / Influencer) |
| Promotion mechanism | **External only** — share referral link; no in-app content feed |
| Commission base | **% of Bizimi's platform fee** (freelancer/agency payouts untouched) |
| Commission rate | **10%** default, **admin-configurable** |
| Earning duration | **First transaction only** (one-time per referred user) |
| Qualifying event | Referred user's **first escrow release** |
| Payout method | **Separate balance, admin-triggered payout** |
| Qualifying logic placement | **Application code** in the escrow-release path (not a DB trigger) |

---

## 2. Goals / Non-goals

**Goals**
- Influencers get a unique, shareable referral link.
- Sign-up attributes new users to an influencer when they arrive via `?ref=CODE`.
- First escrow release of a referred user pays the influencer 10% of the platform fee, once.
- Influencer dashboard: referral link, # referred, qualified vs pending, total earned, unpaid balance.
- Admin: view influencers, user acquisition by influencer, earnings, trigger payouts, set the rate.

**Non-goals (YAGNI)**
- No in-app content/post creation for influencers.
- No recurring/lifetime commissions, no multi-tier (sub-affiliate) referrals.
- No automated influencer payouts (admin does it manually for now).
- No influencer-of-influencer referrals.

---

## 3. Existing system context

- **Stack:** Next.js (App Router) + React, Supabase (auth/db), Tailwind + shadcn/Radix.
- **Account type** is stored at sign-up; today `account_type` is `'freelancer' | 'agency'`
  (`app/signup/page.tsx`, used across `middleware.ts`, `contexts/AuthContext.tsx`, navbars).
- **Escrow** lives in `escrow_deposits` with `status_v2` transitioning
  `awaiting → funded → released → paid_out`; columns include
  `amount_kobo, agency_id, freelancer_id, job_id, paystack_reference`
  (`app/api/escrow/*`, legacy mirror `Funded_jobs101` synced by `lib/funded-jobs-sync.ts`).
- **Release** happens via the escrow verify/webhook path and the submissions-approve path
  (`app/api/submissions/[id]/approve/route.ts`).
- **Admin** area is `app/admin/*` (dashboard, users, transactions, credits, disputes, analytics).
- **Platform fee:** there is no explicit platform-fee column in `escrow_deposits` today. The
  commission base must be defined — see §5 "Platform fee resolution".

---

## 4. Data model (Supabase)

### 4.1 `account_type` value
Add `'influencer'` to the accepted set. Wherever `account_type` is read/guarded
(`middleware.ts`, `AuthContext`, layouts), add the influencer branch.

### 4.2 New tables

**`influencer_profiles`**
| column | type | notes |
|---|---|---|
| `user_id` | uuid (PK, FK → auth user) | one row per influencer |
| `referral_code` | text, unique | short slug used in the link |
| `display_name` | text | |
| `social_handle` | text, nullable | optional |
| `total_referrals` | int, default 0 | denormalised counter |
| `total_qualified` | int, default 0 | denormalised counter |
| `total_earned_kobo` | bigint, default 0 | lifetime commission earned |
| `balance_unpaid_kobo` | bigint, default 0 | owed but not yet paid out |
| `created_at` | timestamptz | |

**`referrals`**
| column | type | notes |
|---|---|---|
| `id` | uuid (PK) | |
| `influencer_id` | uuid (FK → influencer_profiles.user_id) | |
| `referred_user_id` | uuid (FK → user), unique | a user can be referred only once |
| `referred_account_type` | text | `freelancer` / `agency` |
| `status` | text | `pending → qualified → paid` |
| `qualifying_job_id` | uuid, nullable | set when qualified |
| `commission_kobo` | bigint, nullable | set when qualified |
| `qualified_at` | timestamptz, nullable | |
| `created_at` | timestamptz | set at sign-up |

**`influencer_payouts`**
| column | type | notes |
|---|---|---|
| `id` | uuid (PK) | |
| `influencer_id` | uuid (FK) | |
| `amount_kobo` | bigint | |
| `status` | text | `paid` (manual record) — extensible |
| `processed_by` | uuid (admin) | |
| `processed_at` | timestamptz | |
| `note` | text, nullable | reference / method |

### 4.3 New column on the user/profile row
`referred_by` (uuid, nullable, FK → influencer_profiles.user_id) — fast lookup of a user's
referrer; the authoritative record is the `referrals` row.

### 4.4 Config
`influencer_commission_pct` stored in the app's settings store (number, default `10`).
If no settings table exists yet, create `app_settings(key text pk, value jsonb)`.

### 4.5 RLS
- An influencer can read only their own `influencer_profiles`, `referrals`, `influencer_payouts`.
- `referrals` writes (insert at sign-up, qualify on release) go through the **service-role
  client** in server code, never the browser.
- Admin reads via service role in admin routes.

---

## 5. Flows

### 5.1 Attribution (sign-up)
1. Influencer's link: `https://<host>/signup?ref=<referral_code>`.
2. `app/signup/page.tsx` reads `ref` from the query string and keeps it through the steps
   (persist to `sessionStorage` so it survives multi-step navigation).
3. On successful account creation (for a Freelancer or Agency), server code:
   - resolves `referral_code → influencer_id`;
   - rejects if the code is invalid, the new user **is** that influencer (self-referral),
     or the user already has a `referrals` row;
   - inserts a `referrals` row (`status = pending`), sets `referred_by`, and increments
     `influencer_profiles.total_referrals`.
4. Users without `?ref` sign up exactly as today.

Attribution writes happen in the existing sign-up server path (`app/actions/user.ts` /
signup handler), using the service-role client.

### 5.2 Qualifying event (first escrow release) — **option A: application code**
In the escrow-release path (where `status_v2` becomes `released` — the escrow
verify/webhook handler and `app/api/submissions/[id]/approve/route.ts`), after a successful
release, run a single idempotent helper, e.g. `lib/influencer-referrals.ts → qualifyReferralOnRelease(service, escrow)`:

1. Collect the two parties on the job: `escrow.freelancer_id` and `escrow.agency_id`.
2. For each, look for a `referrals` row with `status = 'pending'`.
3. For each pending referral found:
   - compute `platform_fee_kobo` (see "Platform fee resolution" below);
   - `commission_kobo = round(platform_fee_kobo × influencer_commission_pct / 100)`;
   - set referral `status = 'qualified'`, `qualifying_job_id`, `commission_kobo`, `qualified_at`;
   - increment the influencer's `total_qualified`, `total_earned_kobo`, `balance_unpaid_kobo`.
4. **Idempotency & one-time guarantee:** the qualify step only acts on `status = 'pending'`
   rows, so repeated release callbacks (webhook + manual verify) are safe, and a referred
   user only ever qualifies once (their first release).

**Platform fee resolution.** Commission is a % of Bizimi's platform fee on the transaction.
Since `escrow_deposits` has no explicit fee column today, the implementation plan must pick
one of:
- (a) read an existing platform-fee value if one is computed elsewhere at release time; or
- (b) define platform fee as a configured `platform_fee_pct` of `amount_kobo` and compute it
  at qualify time.

This spec assumes **(b)** with `platform_fee_pct` in `app_settings` unless the plan phase finds
an existing fee figure to reuse. The influencer commission is always derived from the platform
fee, never from the freelancer's or agency's funds.

### 5.3 Payout (admin)
- Admin sees each influencer's `balance_unpaid_kobo`.
- Admin records a payout: insert `influencer_payouts` (`amount_kobo`, `processed_by`,
  `processed_at`), then decrement `balance_unpaid_kobo` by that amount and flip the covered
  `referrals` rows `qualified → paid`.
- Reuses the manual/admin payout style already used for disputes/admin actions, **not** the
  automated Paystack freelancer payout.

---

## 6. New surfaces

### 6.1 Influencer area — `app/influencer/*`
Mirrors the freelancer/agency layout with its own `components/influencer-navbar.tsx` and
`app/influencer/layout.tsx`.
- **Dashboard** — referral link with copy button, totals: # referred, # qualified, # pending,
  total earned, unpaid balance.
- **Referrals** — list of referred users (limited PII: handle/initials, account type, status,
  date, commission when qualified).
- **Earnings / Payouts** — qualified earnings + payout history.
- **Profile / Settings** — basic profile, social handle, password reset.

### 6.2 Sign-up — `app/signup/page.tsx`
- Add the **Influencer** account-type card (third option).
- Influencer sign-up generates a `referral_code` and creates the `influencer_profiles` row.
- Capture `?ref=` for **all** account types (freelancer/agency) per §5.1.

### 6.3 Admin — `app/admin/influencers`
- List influencers with referral counts, qualified counts, total earned, unpaid balance.
- **User acquisition** view: how many sign-ups came via referral, grouped by influencer
  (and overall referred vs organic), surfaced on the admin dashboard/analytics.
- Action to **record a payout** (§5.3).
- Setting to edit `influencer_commission_pct` (and `platform_fee_pct` if (b) is used).

### 6.4 Routing / guards
- `middleware.ts` and `contexts/AuthContext.tsx`: add `influencer` to account-type guarding so
  influencer routes are protected and other types are redirected appropriately.

---

## 7. Business rules

1. An influencer's referral link carries their unique `referral_code`.
2. Attribution is set **once**, at sign-up; a user already attributed cannot be re-attributed.
3. Self-referral is rejected (an influencer cannot refer themselves).
4. A referred user qualifies the influencer **once**, on the user's **first escrow release**.
5. Commission = `influencer_commission_pct` of Bizimi's platform fee on that transaction;
   it never reduces the freelancer's or agency's funds.
6. The commission rate is admin-configurable; changes apply to **future** qualifying events only.
7. Influencer earnings accrue to an unpaid balance; payouts are recorded manually by an admin.
8. Influencers themselves do not transact via escrow and do not earn from their own activity.

---

## 8. Testing

- **Attribution:** valid ref → pending referral + `referred_by` set; invalid ref → normal signup;
  self-referral rejected; already-referred user not duplicated.
- **Qualify:** first release of a referred freelancer pays the influencer the correct amount;
  first release of a referred agency does the same; second release of the same user pays nothing;
  duplicate release callbacks (webhook + verify) pay only once (idempotent).
- **Rate change:** changing the rate affects only subsequent qualifying events.
- **Payout:** recording a payout zeroes the covered balance and flips referrals to `paid`.
- **Guards:** influencer routes require an influencer account; other types are redirected.

---

## 9. Open items for the plan phase
- Confirm the **platform fee** source (§5.2 option a vs b).
- Confirm exact insertion point(s) for `qualifyReferralOnRelease` across the verify, webhook,
  and submissions-approve release paths so it's invoked exactly where `status_v2 → released`.
- Referral-code format/generation (length, collision handling).
