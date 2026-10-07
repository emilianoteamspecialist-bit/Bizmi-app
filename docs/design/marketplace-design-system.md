# Bizimi marketplace design system (client/)

The foundation for the marketplace redesign brief (`ui-restructure.txt`), applied to the new React app in `client/`. Every redesigned page should use these rules and the shared components below instead of inventing its own.

The guiding test, from the brief: *would this help someone decide who to hire, which job to apply for, whether to trust the other person, or what to do next?* If not, leave it out.

## Color

| Token | Value | Use |
|---|---|---|
| `primary` | `#EA580C` (`hsl(20.5 90.2% 48.2%)`) | Primary CTAs, the active nav item, selected filters, key links. Nothing else. |
| `primary-hover` | `#C2410C` | Hover/pressed state of primary. |
| `primary-soft` | `#FFF7ED` | Background of a selected row/filter (mobile menu active item). |
| `foreground` | ≈ `#0F172A` | Body text, names, titles. |
| `muted-foreground` | ≈ `#64748B` | Secondary text and meta. |
| `border` | ≈ `#E2E8F0` | All dividers and card outlines. |
| `surface` | ≈ `#F8FAFC` | Page background behind white cards. |
| `card` | `#FFFFFF` | Cards, the header, panels. |
| `success` | green | Verified and funded states only. |

Orange is scarce on purpose: if a screen has more than one or two orange elements outside the header, something is mis-weighted.

## Shape and depth

- Radii: `sm` 4px, `md` 6px (default: buttons, inputs, cards), `lg` 8px, `xl` 10px, `2xl` 12px. Large surfaces don't need a larger radius.
- Separate things with 1px `border` lines, not shadows. Shadows are reserved for floating layers (menus, popovers, sheets).
- No gradients, glass or decorative blobs inside the logged-in app.

## Type

- **Sora** (`font-heading`) for page titles, card titles and people's names; **Inter** for everything else.
- Base text 14px (`text-sm`); meta 12–13px. Page titles `text-xl`–`text-2xl` semibold, never display-size.
- Money, counts and dates use `tabular-nums`.
- Sentence case everywhere. No all-caps eyebrow labels above headings.

## Controls

- One height for inputs, selects and default buttons: **40px** (`h-10`). Small buttons 32px (`size="sm"`). The header uses 36px controls.
- Primary button = orange; secondary = `outline` (white with border); quiet actions = `ghost`.
- Every control has a visible focus ring (`ring` = brand orange).

## Navigation

`components/marketplace/MarketplaceHeader` is the only navigation in the agency and freelancer portals (no sidebar):

- Sticky, 56px, white with a bottom border; content max-width 1280px.
- Links are role-specific and only point at real pages. Freelancer: Find Work, My Jobs, Proposals, Messages. Agency: Find Talent, My Jobs, Payments, Messages. The active link gets an orange 2px underline.
- Search is role-scoped (jobs for freelancers, freelancers for agencies) and hands off with `?q=`, which the results pages read on load.
- Right side: notifications (unread messages), saved jobs (freelancer), account menu, and the role's primary action: **Post a Job** (agency) or the **credit balance** (freelancer).
- Below `lg`, the nav moves into a left sheet; below `md`, search becomes an icon that opens a full-width search row.

## Trust signals

Only show signals backed by real data. Bizimi has **no ratings or reviews system**, so ratings, review counts, hire rate, response time and client spend are not shown anywhere. Layouts may leave room for them, but must not fake them.

Hierarchy, strongest first:

1. **Identity verified**: NIN verified by the external KYC service (`freelancer_verification.status = 'verified'`). Green check + label.
2. **Payment secured**: the job's escrow is funded (`escrow_deposits.status_v2` in funded/released/paid_out). Shown on contracts and jobs.
3. **Track record**: completed (paid-out) jobs and jobs posted, as plain text counts.
4. **Member since**: plain text.

Show at most the top one or two as badges; the rest are plain meta text.

## States

Every data view handles loading (skeletons shaped like the content), empty (says what to do next), error (says what failed and how to retry), and missing fields (fall back gracefully — never print "undefined" or a broken image).

## Shared components (client/src/components/marketplace)

Reuse these before writing page-specific UI:

| Component | Use |
|---|---|
| `MarketplaceHeader` | The only portal navigation (in `components/portal/PortalLayout`). |
| `primitives`: `PageContainer`, `PageHeader`, `Panel`, `FactList`, `SkillTag`/`SkillList`, `TrustBadge`, `EmptyState`, `ErrorState`, `SkeletonBlock` | Page frame, titled panels, label/value lists, skills, trust signals and every loading/empty/error state. |
| `JobCard` (+ `JobCardSkeleton`) | Any list of marketplace jobs. The whole card opens the job; save and apply are separate controls. |
| `JobDetailsSheet` | Job details as a slide-over: brief on the left, budget/apply/client on the right. |
| `useJobApplication` | The single apply flow (eligibility, proposal form, double-submit guard, optimistic "Applied"). Find Work, Saved jobs and the dashboard all use it. |
| `FilterGroup` | Radio filter groups for sidebars (and the mobile filter sheet). |
| `FreelancerCard` (+ skeleton, `FreelancerAvatar`, `isIdentityVerified`) | Talent search results and profile panels. |
| `ProfileCompleteness` + `freelancerCompleteness` | The profile-strength checklist (profile page and dashboard). |
| `components/shared/EscrowStatusBadge` | Escrow state everywhere money is shown. |
| `AuthShell` (+ `AuthLogo`, `FormMessage`) | Frame for signed-out pages (sign in, sign up, password reset, admin sign in) and inline form errors/confirmations. No browser `alert()`s anywhere. |
| `components/console/ConsoleHeader` | Top bar for the admin console and influencer program: logo, area label, sections as a sideways-scrolling tab row. Used via `AdminSidebar` / `InfluencerSidebar` (names kept for their importers). |
| Server `lib/trustSignals` | Identity-verified and jobs-completed for any set of freelancers; shared by talent search and Review bids so both always agree. |

Formatting lives in `lib/format.ts` (`formatNaira`, `formatBudgetRange`, `formatTimeAgo`, `formatMemberSince`); escrow amounts (kobo) use `formatKobo` from `lib/queries/escrow`.

## What the redesign deliberately does not show

Features in the brief that have no data or backend behind them are left out rather than faked: ratings and reviews, client spend and hire rate, response time, experience level and fixed/hourly on jobs, a professional headline, portfolio/work history/education/certifications, an "Interviewing" proposal stage, milestones, saving freelancers, and invite-to-job. Each needs a real feature first; the layouts leave room for them.
