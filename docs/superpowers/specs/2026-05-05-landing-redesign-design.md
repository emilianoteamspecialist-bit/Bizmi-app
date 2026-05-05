# Landing Page Redesign — Design Spec

**Date:** 2026-05-05
**Target file:** `app/page.tsx`
**Stack:** Next.js 15 App Router, React 19, Tailwind, shadcn/ui, framer-motion (already in deps)

---

## 1. Goals

Two compatible goals drove this redesign:

1. **Reposition the brand** — move from generic orange/slate "global marketplace" aesthetic to a confident, Nigeria-coded "Afro-Modern" identity that the global product can still wear.
2. **Conversion focus** — restructure the page for trust-and-proof-heavy conversion, with sequential dual-audience treatment (agencies primary, freelancers in their own dedicated block).

Non-goals: changing routes, auth flows, signup forms, or the role-based dashboards. This spec is scoped to `app/page.tsx` and the small components it composes.

## 2. Audience strategy

Sequential, not split. Hiring side (agencies) gets the hero, the trust signals, the talent showcase, and most testimonials — they pay, so they get the focus. Freelancers get a single full-width "For Freelancers" block deeper down with its own hero treatment and CTA. No top-of-page toggle, no split hero.

## 3. Visual system

### Palette

The orange brand token stays as the primary CTA color (preserves existing `--primary` in `app/globals.css`). New accents extend the personality:

| Token | Hex | Use |
|---|---|---|
| Aubergine | `#1A0E2E` | Hero panel, dark blocks, "For Freelancers" section, primary nav button |
| Orange | `#F97316` | Primary action (existing brand) |
| Gold | `#FBBF24` | Accents, highlights, contrast on aubergine |
| Jade | `#0F766E` | Trust/verified states, "online" indicators |
| Cream | `#FDF7F0` | Section backgrounds, soft cards |
| Ink | `#0A0A0A` | Body text |

These extend the existing CSS-variable system in `app/globals.css` rather than replacing it. The dark mode tokens already in `globals.css` are not in scope for this spec.

### Typography

No new fonts. Sora (already loaded in `app/layout.tsx`) for display headlines at heavy weights (800–900) and tight tracking (`-2px` to `-3px` letter-spacing on hero h1). Inter for body at weight 500 (slightly heavier than default for confidence).

### Signature motif

Geometric shapes — overlapping circles + rotated rounded squares — recur as the brand language. Used in: hero right panel, "For Freelancers" block, final CTA. Always intentional, never decorative filler. Two shape-color combinations:

- On aubergine: gold + orange + jade
- On cream: gold + orange (lower opacity)

### Section radii

Continue the existing rounded-3xl pattern from current page (`rounded-[3rem]`, `rounded-[3.5rem]`). The aubergine hero panel gets `rounded-[2rem]`. Cards stay at `rounded-2xl` / `rounded-[1.25rem]`.

## 4. Page structure

### Section 1 — Navigation

Same fixed/scroll-aware behavior as current. Logo block updates: aubergine pill with gold "B" instead of orange-on-white. Nav links: "Hire talent / Find work / How it works / Sign in". Primary CTA pill: aubergine background, white text, "Get started →".

### Section 2 — Hero (above fold)

Two-column on `lg:` and up; stacked on mobile. Cream page background.

**Left column:**
- Pill badge with jade dot: "2,143 pros vetted this month" (static copy — not pulled from DB)
- H1: "Hire Nigeria's best, in hours." with hand-drawn-style underline SVG under "in hours." in orange
- Subhead: "Vetted designers, devs, writers and marketers — ready to start your project today. Payments held in secure escrow. Zero surprises."
- Two CTAs side by side: ink-on-white "Post a project →" (primary), outlined "Browse talent" (secondary)
- Avatar stack (4 colored circles, no photos for MVP) + "★★★★★ 4.9 from 1,200+ agencies"

**Right column:**
- Aubergine rounded panel (`rounded-[2rem]`), 520px tall. Contains:
  - Decorative shapes: gold circle top-right (-50px / -40px offsets, 200×200), orange circle bottom-left, rotated jade square mid-right
  - Single freelancer portrait centered, gradient brown-to-aubergine placeholder until real photo is sourced (use `/placeholder.svg` with a `next/image` swap target)
- Floating talent card overlapping the panel bottom-left: avatar, name "Adaeze N.", "UI/UX Designer · Lagos", verified badge (jade), skill chips, "₦18k/hr", jade "Available now"
- Floating escrow micro-card overlapping the panel top-right: jade lock tile, "Escrow secured", "₦450,000 held"

Currency is ₦ Naira throughout.

Motion: existing framer-motion fade-in pattern preserved (left x-offset, right scale).

### Section 3 — Stats strip

Cream background panel, 4 columns:
- "2,000+" Vetted pros
- "₦4.2B+" Paid out
- "98%" On-time delivery
- "4.9★" Avg rating

Numbers in Sora 900, aubergine. Labels in slate-500, weight 700, small caps tracking. Above-fold trust hit in case the user scrolls fast.

### Section 4 — Categories marquee

Replaces the current static 4-card grid. Auto-scrolling horizontal marquee (CSS animation, pauses on hover). Cards alternate aubergine ↔ cream-with-aubergine-border. Same 4 categories as current (Programming / Design / Writing / Marketing) but the marquee feel signals scale and continuity. Each card: job count chip (gold-on-aubergine or orange-on-cream), category name, three skill tags, arrow CTA.

Implementation note: marquee using CSS `@keyframes` translateX, content duplicated for seamless loop. No new dep.

### Section 5 — How it works

3 columns, each with:
- Numbered circle (aubergine bg, gold number)
- Step title + one-line description
- Small product UI peek below — fades in on scroll (`whileInView` from framer-motion)

Steps:
1. **Post a job** — "Free, takes 2 minutes." Peek: simplified job-post form card.
2. **Get proposals from vetted pros** — "Only freelancers who pass our identity + skill check." Peek: a proposal list card with 2 mini proposal rows.
3. **Pay on delivery, escrow protected** — "Funds released only when you approve." Peek: escrow status card with jade lock and "Released ✓" state.

### Section 6 — Featured talent

3-card grid, real freelancer profiles (names, portraits, ratings, top categories, hourly rate in ₦). Cream bg cards. Click → `/freelancer/profile/[id]`. Real data wiring is out of scope for this spec — start with a hand-curated static array of 3 profiles in the page file or a small component, with images placed in `public/talent/`.

### Section 7 — Testimonials

Two-card row:
- Left: cream bg, agency quote ("Hired a dev in 3 hours. Project shipped in a week. — Chidi, agency owner")
- Right: aubergine bg, white text with gold quote-mark, freelancer success story ("Bizimi paid me ₦2M last quarter. Life-changing. — Sade, freelancer")

Two-tone signals both audiences.

### Section 8 — For Freelancers block

Full-width aubergine band (breaks out of max-w container). Geometric shapes on right. Two-column:

- Left: small label "FOR FREELANCERS" in gold, H2 "Get paid for the work you love.", subhead about earnings + fast payouts, CTA pill "Start earning →" in gold-on-aubergine.
- Right: floating earnings card mockup (₦ amount, "Paid out this month" label, sparkline) + a payout method card.

This is the freelancer side getting first-class treatment without splitting the hero.

### Section 9 — FAQ

Accordion of 4 objection-killers:
- How does escrow work?
- What are the fees?
- How are pros vetted?
- What if I'm not satisfied?

Use the existing shadcn `accordion` primitive in `components/ui/`. Cream section background. Headlines in Sora 800, body in Inter 500.

### Section 10 — Final CTA

Cream rounded panel (`rounded-[3rem]`) with shape decorations top-left and bottom-right (low opacity). Single H2: "Your next great hire is waiting." Single ink-bg pill button: "Get started →" → `/signup`.

### Section 11 — Footer

Keep the current footer structure (4-column grid + newsletter signup + social icons). Color updates only:
- Replace slate-50 background with cream
- Newsletter card: white bg with thin aubergine border instead of slate
- Social icon hover: aubergine instead of orange (orange reserved for primary CTAs only in the new system)

## 5. Component changes

New small components in `components/landing/`:
- `StatsStrip.tsx` — section 3
- `CategoriesMarquee.tsx` — section 4 (CSS-only auto-scroll)
- `HowItWorks.tsx` — section 5 with step + product-peek subcomponent
- `FeaturedTalent.tsx` — section 6 (takes a static array prop for now)
- `Testimonials.tsx` — section 7
- `ForFreelancersBlock.tsx` — section 8
- `LandingFAQ.tsx` — section 9 (wraps shadcn accordion)
- `FinalCTA.tsx` — section 10

Keeping each section in its own file makes the page composable and avoids `app/page.tsx` ballooning. The page file itself becomes the composition root + nav + hero.

CSS variables for the new tokens (aubergine, gold, jade, cream, ink) added to `app/globals.css` `:root`. Tailwind config extended with the matching named colors so utilities like `bg-aubergine` work.

## 6. Motion

Reuse the framer-motion patterns already in the page. Add `whileInView` triggers for Section 4 onward so each section animates in once on scroll. Marquee in Section 4 is CSS-only (cheaper than framer for continuous animation).

## 7. Mobile

- Hero collapses to single column. Right panel hidden below `lg:` (current pattern).
- Stats strip: 2×2 grid on mobile.
- Categories marquee continues to scroll (touch-scrollable, also auto-scrolls).
- How it works: vertical stack with connecting line between numbers.
- Featured talent: 1-column.
- Testimonials: stack.
- For Freelancers block: stacked, shapes scaled down.

## 8. Out of scope

- Real CMS / DB-backed talent or testimonials (use static arrays for now)
- Auth/role redirect changes
- Real freelancer photography (use placeholders, swap later)
- Localization / Yoruba / Igbo / Hausa copy variants
- Dark mode tuning
- Analytics events (separate ticket)

## 9. Risks

- **Marquee on mobile** — auto-scrolling marquees can fight with touch scroll. Mitigation: pause auto-scroll while user is interacting; fall back to native horizontal scroll on touch devices.
- **Hero panel height on mobile** — the floating cards don't translate well to single-column. Mitigation: hide the floating cards below `lg:`, show only the freelancer portrait inside a smaller aubergine panel.
- **Color token name collisions** — adding `aubergine` to Tailwind config alongside existing tokens. Mitigation: prefix with `bz-` if a clash appears (e.g., `bg-bz-aubergine`), but try unprefixed first.

## 10. Build sequence (preview, not the implementation plan)

A separate `writing-plans` pass will produce the actual ordered implementation plan. The expected shape:

1. Extend `globals.css` + `tailwind.config` with new tokens
2. Build hero (highest visual risk — get it right first)
3. Build supporting sections in order: stats → categories marquee → how it works → featured talent → testimonials → for freelancers → FAQ → final CTA
4. Wire the new sections into `app/page.tsx`, replacing existing JSX
5. Footer color refresh
6. Mobile pass (responsive review on each section)
