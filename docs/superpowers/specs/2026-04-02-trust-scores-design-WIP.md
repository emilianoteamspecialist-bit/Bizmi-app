# Trust Scores - Phase 1 Design (Work In Progress)

**Status:** Brainstorming — decisions partially made, pending final design approval

**Scope:** Phase 1 covers static verification-based trust scores only. Phase 2 (Performance Scores: ratings, on-time delivery, dispute ratio) will be a separate spec.

---

## Decisions Made

### Freelancer Trust Score

Criteria that contribute to the score:

| Criterion | Decision | Notes |
|---|---|---|
| Profile Completed | Include | Check: full_name, bio, location, skills filled |
| Portfolio Uploaded | Include | No portfolio table exists yet — needs new table |
| BVN & NIN Verification | **Both** — BVN added alongside existing NIN | Existing `Freelancer_identitie` table has NIN; add BVN field. Verifying either/both boosts score |
| Email verified | Use Supabase Auth email confirmation status | Already happens on signup |
| Phone verified | **Skip for now** | Just use email verified status from Supabase Auth |

### Agency Trust Score

Criteria that contribute to the score:

| Criterion | Decision | Notes |
|---|---|---|
| CAC Registration Number | **Admin-reviewed upload** | Agency uploads CAC number + certificate document, admin manually reviews/approves |
| Business Email (optional) | Undecided | — |
| Card/Bank Verification | **Undecided** — last question asked | Options: (A) count "has funded a job via Paystack" as verified, or (B) add separate bank verification step |
| Phone & Email | Email from Supabase Auth; phone TBD | — |

---

## Still To Decide

1. **Agency Card/Bank Verification** — use existing Paystack funding data (option A) vs separate bank verification (option B)?
2. **Agency Business Email** — how to verify? Or skip?
3. **Score calculation** — how to weight each criterion (equal points? tiers?)
4. **Trust badges/labels** — what thresholds map to what labels? (e.g., "Verified", "Fully Verified", "Trusted")
5. **Where scores display** — profile pages, cards, search results?
6. **Admin review UI** — for CAC verification, does the admin dashboard need a new review queue?
7. **Portfolio table** — schema for freelancer portfolio uploads (needed for "Portfolio Uploaded" criterion)

---

## Architecture Notes (Preliminary)

### New Database Tables Needed
- `freelancer_portfolios` — portfolio items (images/links) per freelancer
- `agency_verification` — CAC number, certificate URL, verification status, admin reviewer

### Existing Tables to Modify
- `Freelancer_identitie` — add `bvn_number` column
- `profiles` — possibly add computed `trust_score` field or calculate on-the-fly

### Trust Score Display
- Already partially implemented in `/agency/find-freelancers` (trust badges based on identity verification + jobs completed)
- Will need to expand to include all criteria above

---

## Phase 2 (Future — Separate Spec)

Performance scores requiring a review/rating system:
- **Freelancer:** Projects completed count, client ratings, on-time delivery ratio, dispute ratio
- **Agency:** On-time approvals, dispute rate, freelancer ratings, payment reliability
