# Landing Page Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `app/page.tsx` with an Afro-Modern, conversion-focused landing page composed of 11 sections, using new color tokens and small, focused section components.

**Architecture:** Hero remains in `app/page.tsx`'s render tree, but each major section is extracted to its own file under `components/landing/`. New colors are added as HSL CSS variables in `app/globals.css` and exposed in `tailwind.config.ts` under `theme.extend.colors`. No new runtime deps — `@radix-ui/react-accordion` is already in `package.json` but the shadcn wrapper doesn't exist yet, so it gets created. Static data (talent, testimonials, FAQ items) lives in TypeScript constants colocated with the section that uses it.

**Tech Stack:** Next.js 15 (App Router), React 19, TypeScript, Tailwind 3.4, shadcn/ui, framer-motion, lucide-react, @radix-ui/react-accordion (already installed).

**Spec:** `docs/superpowers/specs/2026-05-05-landing-redesign-design.md`

**Note on testing:** This project has no automated test framework configured (no vitest/jest in `package.json`). Verification at each step is `npx tsc --noEmit` (type safety) plus a visual check in the dev server when a section is wired into the page. The plan doesn't include unit-test steps.

---

## File map

**Modify:**
- `app/globals.css` — add new color tokens
- `tailwind.config.ts` — expose new colors as utilities
- `app/page.tsx` — full rewrite as composition root

**Create:**
- `components/ui/accordion.tsx` — shadcn accordion wrapper
- `components/landing/Nav.tsx`
- `components/landing/AuberginePanel.tsx` — reusable aubergine block with shape decorations
- `components/landing/Hero.tsx`
- `components/landing/StatsStrip.tsx`
- `components/landing/CategoriesMarquee.tsx`
- `components/landing/HowItWorks.tsx`
- `components/landing/FeaturedTalent.tsx`
- `components/landing/Testimonials.tsx`
- `components/landing/ForFreelancersBlock.tsx`
- `components/landing/LandingFAQ.tsx`
- `components/landing/FinalCTA.tsx`
- `components/landing/LandingFooter.tsx`

---

## Task 1: Add new color tokens to globals.css

**Files:**
- Modify: `app/globals.css`

- [ ] **Step 1: Add new HSL variables under `:root`**

In `app/globals.css`, find the `:root` block (starts around line 6) and after the existing `--info: 221 83% 53%;` line, add:

```css
    /* Afro-Modern Landing Tokens */
    --aubergine: 263 53% 12%;     /* #1A0E2E */
    --gold: 43 96% 56%;            /* #FBBF24 */
    --jade: 173 80% 26%;           /* #0F766E */
    --cream: 32 67% 96%;           /* #FDF7F0 */
    --ink: 0 0% 4%;                /* #0A0A0A */
```

These extend the existing palette without touching `--primary` (orange stays as the action color).

- [ ] **Step 2: Verify CSS still parses**

Run: `npx tsc --noEmit`
Expected: no output (success). The CSS file isn't typechecked but this confirms the project still builds typescript-wise — the css will be validated by Tailwind in the next task.

- [ ] **Step 3: Commit**

```bash
git add app/globals.css
git commit -m "feat(landing): add afro-modern color tokens to globals"
```

---

## Task 2: Expose new colors in tailwind.config.ts

**Files:**
- Modify: `tailwind.config.ts`

- [ ] **Step 1: Add the new colors inside `theme.extend.colors`**

Open `tailwind.config.ts`. Find the `colors:` block inside `theme.extend` (starts at line 25). After the closing `}` of `chart: { ... }` and before the closing `}` of `colors`, add:

```ts
        aubergine: "hsl(var(--aubergine))",
        gold: "hsl(var(--gold))",
        jade: "hsl(var(--jade))",
        cream: "hsl(var(--cream))",
        ink: "hsl(var(--ink))",
```

The full edited section will look like (showing context):

```ts
        chart: {
          "1": "hsl(var(--chart-1))",
          "2": "hsl(var(--chart-2))",
          "3": "hsl(var(--chart-3))",
          "4": "hsl(var(--chart-4))",
          "5": "hsl(var(--chart-5))",
        },
        aubergine: "hsl(var(--aubergine))",
        gold: "hsl(var(--gold))",
        jade: "hsl(var(--jade))",
        cream: "hsl(var(--cream))",
        ink: "hsl(var(--ink))",
      },
```

- [ ] **Step 2: Add a marquee keyframe + animation for the categories section**

In the same file, find the `keyframes:` block (starts around line 94). After the closing `}` of `"accordion-up"`, add:

```ts
        marquee: {
          from: { transform: "translateX(0)" },
          to: { transform: "translateX(-50%)" },
        },
```

In the `animation:` block right below it, after the closing `,` of `"accordion-up": "accordion-up 0.2s ease-out"`, add:

```ts
        marquee: "marquee 40s linear infinite",
```

- [ ] **Step 3: Verify the typecheck passes**

Run: `npx tsc --noEmit`
Expected: no output.

- [ ] **Step 4: Verify utilities resolve**

Run: `npx next build --debug 2>&1 | head -50` — wait for "Creating an optimized production build" then cancel with Ctrl+C, OR run the dev server briefly: `npm run dev` and check no Tailwind errors print.

Quick alternative (no server start): create a tiny test by adding `<div className="bg-aubergine">` in `app/page.tsx` temporarily and run `npx tsc --noEmit`. (Skip if step 3 passed cleanly.)

- [ ] **Step 5: Commit**

```bash
git add tailwind.config.ts
git commit -m "feat(landing): expose aubergine/gold/jade/cream/ink + marquee animation"
```

---

## Task 3: Create shadcn accordion primitive

**Files:**
- Create: `components/ui/accordion.tsx`

- [ ] **Step 1: Create the file with the standard shadcn accordion**

Write `components/ui/accordion.tsx`:

```tsx
"use client"

import * as React from "react"
import * as AccordionPrimitive from "@radix-ui/react-accordion"
import { ChevronDown } from "lucide-react"

import { cn } from "@/lib/utils"

const Accordion = AccordionPrimitive.Root

const AccordionItem = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Item>
>(({ className, ...props }, ref) => (
  <AccordionPrimitive.Item
    ref={ref}
    className={cn("border-b border-aubergine/10", className)}
    {...props}
  />
))
AccordionItem.displayName = "AccordionItem"

const AccordionTrigger = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <AccordionPrimitive.Header className="flex">
    <AccordionPrimitive.Trigger
      ref={ref}
      className={cn(
        "flex flex-1 items-center justify-between py-5 text-left font-bold text-base text-ink transition-all hover:text-primary [&[data-state=open]>svg]:rotate-180",
        className
      )}
      {...props}
    >
      {children}
      <ChevronDown className="h-5 w-5 shrink-0 transition-transform duration-200" />
    </AccordionPrimitive.Trigger>
  </AccordionPrimitive.Header>
))
AccordionTrigger.displayName = AccordionPrimitive.Trigger.displayName

const AccordionContent = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <AccordionPrimitive.Content
    ref={ref}
    className="overflow-hidden text-sm data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down"
    {...props}
  >
    <div className={cn("pb-5 pt-0 text-base text-muted-foreground leading-relaxed", className)}>
      {children}
    </div>
  </AccordionPrimitive.Content>
))
AccordionContent.displayName = AccordionPrimitive.Content.displayName

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent }
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/ui/accordion.tsx
git commit -m "feat(ui): add shadcn accordion primitive"
```

---

## Task 4: Create AuberginePanel shared component

**Files:**
- Create: `components/landing/AuberginePanel.tsx`

This is reused in Hero (right column), ForFreelancersBlock, and FinalCTA decorations. It renders a rounded aubergine panel with the signature geometric shapes (gold circle, orange circle, rotated jade square).

- [ ] **Step 1: Create the file**

Write `components/landing/AuberginePanel.tsx`:

```tsx
import * as React from "react"
import { cn } from "@/lib/utils"

interface AuberginePanelProps extends React.HTMLAttributes<HTMLDivElement> {
  shapes?: boolean
  rounded?: "lg" | "xl" | "2xl" | "3xl"
}

const radiusMap = {
  lg: "rounded-[1.25rem]",
  xl: "rounded-[1.5rem]",
  "2xl": "rounded-[2rem]",
  "3xl": "rounded-[3rem]",
} as const

export function AuberginePanel({
  className,
  children,
  shapes = true,
  rounded = "2xl",
  ...props
}: AuberginePanelProps) {
  return (
    <div
      className={cn(
        "relative bg-aubergine text-white overflow-hidden",
        radiusMap[rounded],
        className
      )}
      {...props}
    >
      {shapes && (
        <>
          <div className="pointer-events-none absolute -top-16 -right-12 w-48 h-48 bg-gold rounded-full opacity-95" />
          <div className="pointer-events-none absolute -bottom-10 -left-12 w-36 h-36 bg-primary rounded-full" />
          <div className="pointer-events-none absolute top-[55%] right-8 w-14 h-14 bg-jade rounded-2xl rotate-12" />
        </>
      )}
      <div className="relative z-10 h-full">{children}</div>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/landing/AuberginePanel.tsx
git commit -m "feat(landing): add reusable aubergine panel with shape motif"
```

---

## Task 5: Create Nav component

**Files:**
- Create: `components/landing/Nav.tsx`

- [ ] **Step 1: Create the file**

Write `components/landing/Nav.tsx`:

```tsx
"use client"

import { useEffect, useState } from "react"
import NextLink from "next/link"

export function Nav() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  return (
    <nav
      className={`fixed top-0 w-full z-50 transition-all duration-300 ${
        scrolled
          ? "bg-cream/85 backdrop-blur-md border-b border-aubergine/5 py-3 shadow-sm"
          : "bg-transparent py-5"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
        <div className="flex items-center gap-10">
          <NextLink href="/" className="flex items-center space-x-2 group">
            <div className="w-10 h-10 bg-aubergine rounded-xl flex items-center justify-center shadow-lg shadow-aubergine/20">
              <span className="text-gold font-black text-xl font-heading">B</span>
            </div>
            <span className="text-2xl font-black tracking-tight text-ink font-heading">Bizimi</span>
          </NextLink>

          <div className="hidden md:flex items-center space-x-8">
            <a href="#how-it-works" className="text-sm font-bold text-ink/70 hover:text-primary transition-colors">
              Hire talent
            </a>
            <a href="#for-freelancers" className="text-sm font-bold text-ink/70 hover:text-primary transition-colors">
              Find work
            </a>
            <a href="#how-it-works" className="text-sm font-bold text-ink/70 hover:text-primary transition-colors">
              How it works
            </a>
            <NextLink href="/login" className="text-sm font-bold text-ink/70 hover:text-primary transition-colors">
              Sign in
            </NextLink>
          </div>
        </div>

        <NextLink
          href="/signup"
          className="bg-aubergine text-white rounded-full px-6 py-3 font-bold text-sm hover:bg-aubergine/90 transition-colors shadow-lg shadow-aubergine/20"
        >
          Get started →
        </NextLink>
      </div>
    </nav>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/landing/Nav.tsx
git commit -m "feat(landing): add Nav component with aubergine pill logo"
```

---

## Task 6: Create Hero component

**Files:**
- Create: `components/landing/Hero.tsx`

- [ ] **Step 1: Create the file**

Write `components/landing/Hero.tsx`:

```tsx
"use client"

import NextLink from "next/link"
import Image from "next/image"
import { motion } from "framer-motion"
import { ArrowRight, Lock, BadgeCheck } from "lucide-react"
import { AuberginePanel } from "./AuberginePanel"

export function Hero() {
  return (
    <section className="pt-32 pb-20 md:pt-40 md:pb-24 bg-cream overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-[1.1fr_0.9fr] gap-12 lg:gap-16 items-center">

        {/* Left column */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
          className="space-y-8 text-center lg:text-left"
        >
          <div className="inline-flex items-center gap-2 bg-white border border-aubergine/15 px-4 py-1.5 rounded-full text-sm font-bold">
            <span className="w-2 h-2 bg-jade rounded-full" />
            <span className="text-ink">2,143 pros vetted this month</span>
          </div>

          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black font-heading text-ink leading-[0.95] tracking-[-0.04em]">
            Hire Nigeria's<br />best,{" "}
            <span className="relative inline-block">
              in hours.
              <svg
                className="absolute -bottom-2 left-0 w-full"
                viewBox="0 0 200 12"
                preserveAspectRatio="none"
                aria-hidden
              >
                <path d="M0 8 Q 50 0, 100 6 T 200 6" stroke="hsl(var(--primary))" strokeWidth="6" fill="none" strokeLinecap="round" />
              </svg>
            </span>
          </h1>

          <p className="text-lg sm:text-xl text-ink/70 font-medium leading-relaxed max-w-xl mx-auto lg:mx-0">
            Vetted designers, devs, writers and marketers — ready to start your project today. Payments held in secure escrow. Zero surprises.
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4 justify-center lg:justify-start">
            <NextLink
              href="/signup"
              className="group inline-flex items-center gap-2 bg-ink text-white rounded-2xl px-8 py-5 font-bold text-base hover:bg-aubergine transition-colors"
            >
              Post a project
              <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </NextLink>
            <NextLink
              href="/freelancer/marketplace"
              className="inline-flex items-center gap-2 border-2 border-ink text-ink rounded-2xl px-8 py-5 font-bold text-base hover:bg-ink hover:text-white transition-colors"
            >
              Browse talent
            </NextLink>
          </div>

          <div className="flex items-center gap-4 justify-center lg:justify-start pt-2">
            <div className="flex">
              {["bg-primary", "bg-jade", "bg-gold", "bg-aubergine"].map((c, i) => (
                <div
                  key={i}
                  className={`w-10 h-10 rounded-full border-[3px] border-cream ${c}`}
                  style={{ marginLeft: i === 0 ? 0 : -10 }}
                />
              ))}
            </div>
            <p className="text-sm font-bold text-ink/60">
              <span className="text-gold">★★★★★</span> 4.9 from 1,200+ agencies
            </p>
          </div>
        </motion.div>

        {/* Right column */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="relative hidden lg:block"
        >
          <AuberginePanel className="h-[560px]" rounded="3xl">
            <div className="absolute inset-0 flex items-center justify-center p-8">
              <div className="relative w-[78%] h-[78%] rounded-3xl overflow-hidden bg-gradient-to-b from-[#3a1810] to-aubergine">
                <Image
                  src="/placeholder.svg"
                  alt="Featured Bizimi freelancer"
                  fill
                  className="object-cover opacity-90"
                  priority
                />
              </div>
            </div>
          </AuberginePanel>

          {/* Floating talent card */}
          <div className="absolute -left-6 bottom-10 bg-white rounded-2xl p-4 w-64 shadow-2xl shadow-aubergine/25">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-primary/30" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-extrabold text-ink truncate">Adaeze N.</div>
                <div className="text-xs text-ink/60 truncate">UI/UX Designer · Lagos</div>
              </div>
              <span className="bg-jade text-white text-[10px] px-2 py-0.5 rounded-md font-extrabold flex items-center gap-1">
                <BadgeCheck className="h-3 w-3" /> VERIFIED
              </span>
            </div>
            <div className="flex gap-1.5 mt-3">
              <span className="text-[11px] bg-cream text-aubergine px-2 py-0.5 rounded-md font-bold">Figma</span>
              <span className="text-[11px] bg-cream text-aubergine px-2 py-0.5 rounded-md font-bold">Webflow</span>
            </div>
            <div className="flex justify-between items-center mt-3 pt-3 border-t border-ink/5">
              <div className="text-sm font-black text-ink">₦18k/hr</div>
              <div className="text-[11px] text-jade font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-jade rounded-full" /> Available now
              </div>
            </div>
          </div>

          {/* Floating escrow micro-card */}
          <div className="absolute -right-4 top-12 bg-white rounded-2xl p-4 shadow-2xl shadow-aubergine/25 flex items-center gap-3">
            <div className="w-10 h-10 bg-jade rounded-xl flex items-center justify-center">
              <Lock className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="text-xs font-extrabold text-ink">Escrow secured</div>
              <div className="text-[11px] text-ink/60">₦450,000 held</div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/landing/Hero.tsx
git commit -m "feat(landing): add hero with aubergine panel and floating cards"
```

---

## Task 7: Create StatsStrip component

**Files:**
- Create: `components/landing/StatsStrip.tsx`

- [ ] **Step 1: Create the file**

Write `components/landing/StatsStrip.tsx`:

```tsx
const stats = [
  { value: "2,000+", label: "Vetted pros" },
  { value: "₦4.2B+", label: "Paid out" },
  { value: "98%", label: "On-time delivery" },
  { value: "4.9★", label: "Avg rating" },
]

export function StatsStrip() {
  return (
    <section className="bg-cream pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-3xl border border-aubergine/10 grid grid-cols-2 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-aubergine/10">
          {stats.map((s) => (
            <div key={s.label} className="text-center px-6 py-8">
              <div className="font-heading font-black text-3xl md:text-4xl text-aubergine tracking-tight">
                {s.value}
              </div>
              <div className="text-xs font-bold text-ink/60 mt-2 uppercase tracking-widest">
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Typecheck and commit**

Run: `npx tsc --noEmit` (expect no errors), then:

```bash
git add components/landing/StatsStrip.tsx
git commit -m "feat(landing): add stats strip section"
```

---

## Task 8: Create CategoriesMarquee component

**Files:**
- Create: `components/landing/CategoriesMarquee.tsx`

The marquee uses the `animate-marquee` Tailwind animation added in Task 2. Content is duplicated for a seamless loop.

- [ ] **Step 1: Create the file**

Write `components/landing/CategoriesMarquee.tsx`:

```tsx
"use client"

import { Code2, Palette, PenTool, TrendingUp, ArrowRight } from "lucide-react"
import type { ReactNode } from "react"

interface Category {
  name: string
  icon: ReactNode
  count: string
  skills: string[]
}

const categories: Category[] = [
  { name: "Programming", icon: <Code2 className="h-5 w-5" />, count: "12k+ jobs", skills: ["React", "Node.js", "Python"] },
  { name: "Design", icon: <Palette className="h-5 w-5" />, count: "8k+ jobs", skills: ["Figma", "Adobe", "Canva"] },
  { name: "Writing", icon: <PenTool className="h-5 w-5" />, count: "5k+ jobs", skills: ["Copywriting", "SEO", "Blogs"] },
  { name: "Marketing", icon: <TrendingUp className="h-5 w-5" />, count: "7k+ jobs", skills: ["Ads", "Strategy", "Analysis"] },
]

function CategoryCard({ cat, dark }: { cat: Category; dark: boolean }) {
  return (
    <div
      className={`flex-shrink-0 w-[300px] rounded-3xl p-6 ${
        dark ? "bg-aubergine text-white" : "bg-cream border border-aubergine text-ink"
      }`}
    >
      <div className="flex items-center justify-between mb-4">
        <div
          className={`w-11 h-11 rounded-xl flex items-center justify-center ${
            dark ? "bg-white/10 text-gold" : "bg-aubergine text-gold"
          }`}
        >
          {cat.icon}
        </div>
        <span className={`text-[10px] font-black tracking-widest uppercase ${dark ? "text-gold" : "text-primary"}`}>
          {cat.count}
        </span>
      </div>
      <h3 className="font-heading font-black text-2xl tracking-tight mb-3">{cat.name}</h3>
      <div className="flex flex-wrap gap-1.5 mb-5">
        {cat.skills.map((s) => (
          <span
            key={s}
            className={`text-[11px] font-bold px-2.5 py-1 rounded-md ${
              dark ? "bg-white/10 text-white/85" : "bg-white text-aubergine"
            }`}
          >
            {s}
          </span>
        ))}
      </div>
      <div className={`flex items-center text-sm font-extrabold ${dark ? "text-gold" : "text-primary"}`}>
        Explore jobs <ArrowRight className="ml-1 h-4 w-4" />
      </div>
    </div>
  )
}

export function CategoriesMarquee() {
  // duplicate the list for seamless loop
  const loop = [...categories, ...categories]
  return (
    <section className="bg-cream py-16 md:py-24 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-10">
        <h2 className="font-heading font-black text-3xl md:text-5xl text-ink tracking-tight">
          Find the right fit, fast.
        </h2>
        <p className="text-ink/60 font-medium mt-3 text-lg">Top categories on Bizimi this month.</p>
      </div>
      <div className="relative" aria-hidden={false}>
        <div className="flex gap-4 animate-marquee w-max">
          {loop.map((cat, i) => (
            <CategoryCard key={i} cat={cat} dark={i % 2 === 0} />
          ))}
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Typecheck and commit**

```bash
npx tsc --noEmit
git add components/landing/CategoriesMarquee.tsx
git commit -m "feat(landing): add auto-scrolling categories marquee"
```

---

## Task 9: Create HowItWorks component

**Files:**
- Create: `components/landing/HowItWorks.tsx`

- [ ] **Step 1: Create the file**

Write `components/landing/HowItWorks.tsx`:

```tsx
"use client"

import { motion } from "framer-motion"
import { Lock, FileText, Users } from "lucide-react"
import type { ReactNode } from "react"

interface Step {
  n: number
  title: string
  desc: string
  peek: ReactNode
}

const steps: Step[] = [
  {
    n: 1,
    title: "Post a job",
    desc: "Free, takes 2 minutes.",
    peek: (
      <div className="bg-white rounded-2xl border border-ink/5 p-4 shadow-sm">
        <div className="flex items-center gap-2 text-ink/50 text-xs font-bold mb-2">
          <FileText className="h-4 w-4" /> Job posting
        </div>
        <div className="h-3 bg-cream rounded w-3/4 mb-2" />
        <div className="h-3 bg-cream rounded w-1/2 mb-3" />
        <div className="flex gap-1.5">
          <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-md font-bold">React</span>
          <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-md font-bold">2 weeks</span>
        </div>
      </div>
    ),
  },
  {
    n: 2,
    title: "Get vetted proposals",
    desc: "Only freelancers who pass our identity + skill check.",
    peek: (
      <div className="bg-white rounded-2xl border border-ink/5 p-4 shadow-sm space-y-2.5">
        {[0, 1].map((i) => (
          <div key={i} className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-primary/30" />
            <div className="flex-1">
              <div className="h-2 bg-cream rounded w-16 mb-1" />
              <div className="h-2 bg-cream rounded w-24" />
            </div>
            <Users className="h-4 w-4 text-jade" />
          </div>
        ))}
      </div>
    ),
  },
  {
    n: 3,
    title: "Pay on delivery",
    desc: "Funds released only when you approve. Escrow protected.",
    peek: (
      <div className="bg-white rounded-2xl border border-ink/5 p-4 shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-jade flex items-center justify-center">
            <Lock className="h-4 w-4 text-white" />
          </div>
          <div className="flex-1">
            <div className="text-xs font-extrabold text-ink">Escrow released ✓</div>
            <div className="text-[11px] text-ink/60">₦450,000 sent</div>
          </div>
        </div>
      </div>
    ),
  },
]

export function HowItWorks() {
  return (
    <section id="how-it-works" className="bg-white py-20 md:py-28">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mb-16">
          <span className="inline-block text-xs font-black tracking-widest text-primary uppercase mb-3">
            How it works
          </span>
          <h2 className="font-heading font-black text-3xl md:text-5xl text-ink tracking-tight">
            From post to paid in three steps.
          </h2>
        </div>
        <div className="grid md:grid-cols-3 gap-8 md:gap-10">
          {steps.map((s, i) => (
            <motion.div
              key={s.n}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="space-y-5"
            >
              <div className="w-12 h-12 bg-aubergine rounded-full flex items-center justify-center text-gold font-heading font-black text-lg">
                {s.n}
              </div>
              <h3 className="font-heading font-black text-2xl text-ink tracking-tight">{s.title}</h3>
              <p className="text-ink/65 font-medium leading-relaxed">{s.desc}</p>
              <div className="pt-2">{s.peek}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Typecheck and commit**

```bash
npx tsc --noEmit
git add components/landing/HowItWorks.tsx
git commit -m "feat(landing): add 3-step how-it-works with product peeks"
```

---

## Task 10: Create FeaturedTalent component

**Files:**
- Create: `components/landing/FeaturedTalent.tsx`

- [ ] **Step 1: Create the file**

Write `components/landing/FeaturedTalent.tsx`:

```tsx
import NextLink from "next/link"
import { ArrowRight, BadgeCheck, Star } from "lucide-react"

interface Pro {
  name: string
  role: string
  city: string
  rating: string
  rate: string
  skills: string[]
  swatch: string
}

const pros: Pro[] = [
  { name: "Adaeze N.", role: "UI/UX Designer", city: "Lagos", rating: "4.9", rate: "₦18k/hr", skills: ["Figma", "Webflow", "Brand"], swatch: "bg-primary/30" },
  { name: "Tunde A.", role: "React Engineer", city: "Abuja", rating: "5.0", rate: "₦24k/hr", skills: ["React", "Next.js", "TypeScript"], swatch: "bg-jade/40" },
  { name: "Kemi O.", role: "Brand Strategist", city: "Ibadan", rating: "4.8", rate: "₦15k/hr", skills: ["Copy", "Strategy", "Identity"], swatch: "bg-gold/60" },
]

export function FeaturedTalent() {
  return (
    <section className="bg-cream py-20 md:py-28">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between flex-wrap gap-4 mb-12">
          <div>
            <span className="inline-block text-xs font-black tracking-widest text-primary uppercase mb-3">
              Featured talent
            </span>
            <h2 className="font-heading font-black text-3xl md:text-5xl text-ink tracking-tight max-w-xl">
              Pros our clients keep coming back to.
            </h2>
          </div>
          <NextLink href="/freelancer/marketplace" className="text-sm font-extrabold text-aubergine hover:text-primary inline-flex items-center gap-1">
            Browse all <ArrowRight className="h-4 w-4" />
          </NextLink>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {pros.map((p) => (
            <div
              key={p.name}
              className="bg-white rounded-3xl p-6 border border-aubergine/10 hover:border-aubergine/30 hover:shadow-xl hover:shadow-aubergine/5 transition-all"
            >
              <div className={`w-full aspect-[4/3] rounded-2xl ${p.swatch} mb-5`} />
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <div className="font-heading font-black text-xl text-ink tracking-tight">{p.name}</div>
                  <div className="text-sm text-ink/60 font-medium">{p.role} · {p.city}</div>
                </div>
                <BadgeCheck className="h-5 w-5 text-jade flex-shrink-0" />
              </div>
              <div className="flex items-center gap-1 text-sm font-bold text-ink mb-4">
                <Star className="h-4 w-4 fill-gold text-gold" /> {p.rating}
              </div>
              <div className="flex flex-wrap gap-1.5 mb-5">
                {p.skills.map((s) => (
                  <span key={s} className="text-[11px] font-bold bg-cream text-aubergine px-2.5 py-1 rounded-md">{s}</span>
                ))}
              </div>
              <div className="flex justify-between items-center pt-4 border-t border-aubergine/10">
                <span className="font-heading font-black text-ink">{p.rate}</span>
                <span className="text-xs font-bold text-jade flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-jade rounded-full" /> Available
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Typecheck and commit**

```bash
npx tsc --noEmit
git add components/landing/FeaturedTalent.tsx
git commit -m "feat(landing): add featured talent showcase"
```

---

## Task 11: Create Testimonials component

**Files:**
- Create: `components/landing/Testimonials.tsx`

- [ ] **Step 1: Create the file**

Write `components/landing/Testimonials.tsx`:

```tsx
const testimonials = [
  {
    kind: "agency" as const,
    quote: "Hired a senior dev in 3 hours. Project shipped in a week. The escrow took the awkwardness out of the conversation.",
    name: "Chidi O.",
    role: "Founder, Studio Kola (Lagos)",
  },
  {
    kind: "freelancer" as const,
    quote: "Bizimi paid me ₦2.1M last quarter. The vetting is real — agencies trust the badge. Life-changing.",
    name: "Sade T.",
    role: "Brand Designer (Abuja)",
  },
]

export function Testimonials() {
  return (
    <section className="bg-white py-20 md:py-28">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mb-12">
          <span className="inline-block text-xs font-black tracking-widest text-primary uppercase mb-3">
            Real outcomes
          </span>
          <h2 className="font-heading font-black text-3xl md:text-5xl text-ink tracking-tight">
            Both sides of the marketplace, winning.
          </h2>
        </div>
        <div className="grid md:grid-cols-2 gap-6">
          {testimonials.map((t) => {
            const isAgency = t.kind === "agency"
            return (
              <figure
                key={t.name}
                className={`rounded-3xl p-8 md:p-10 ${
                  isAgency ? "bg-cream border border-aubergine/10" : "bg-aubergine text-white"
                }`}
              >
                <div className={`text-6xl font-heading leading-none mb-4 ${isAgency ? "text-primary" : "text-gold"}`}>
                  &ldquo;
                </div>
                <blockquote className={`text-lg md:text-xl font-medium leading-relaxed ${isAgency ? "text-ink" : "text-white"}`}>
                  {t.quote}
                </blockquote>
                <figcaption className="mt-6">
                  <div className={`font-extrabold ${isAgency ? "text-ink" : "text-gold"}`}>{t.name}</div>
                  <div className={`text-sm ${isAgency ? "text-ink/60" : "text-white/60"}`}>{t.role}</div>
                </figcaption>
              </figure>
            )
          })}
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Typecheck and commit**

```bash
npx tsc --noEmit
git add components/landing/Testimonials.tsx
git commit -m "feat(landing): add two-tone testimonials section"
```

---

## Task 12: Create ForFreelancersBlock component

**Files:**
- Create: `components/landing/ForFreelancersBlock.tsx`

- [ ] **Step 1: Create the file**

Write `components/landing/ForFreelancersBlock.tsx`:

```tsx
"use client"

import NextLink from "next/link"
import { motion } from "framer-motion"
import { ArrowRight, TrendingUp } from "lucide-react"

export function ForFreelancersBlock() {
  return (
    <section id="for-freelancers" className="bg-cream py-20 md:py-28">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative bg-aubergine text-white rounded-[2.5rem] overflow-hidden p-8 md:p-16">
          {/* Shape decorations */}
          <div className="pointer-events-none absolute -top-20 -right-16 w-72 h-72 bg-gold rounded-full opacity-90" />
          <div className="pointer-events-none absolute bottom-10 right-1/4 w-24 h-24 bg-primary rounded-full opacity-95" />
          <div className="pointer-events-none absolute top-1/3 right-12 w-16 h-16 bg-jade rounded-2xl rotate-12" />

          <div className="relative z-10 grid md:grid-cols-2 gap-12 md:gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
            >
              <span className="inline-block text-xs font-black tracking-widest text-gold uppercase mb-4">
                For freelancers
              </span>
              <h2 className="font-heading font-black text-4xl md:text-6xl tracking-tight leading-[0.95]">
                Get paid for the<br />work you <span className="text-gold">love.</span>
              </h2>
              <p className="text-lg text-white/75 font-medium leading-relaxed mt-6 max-w-md">
                Build a profile, get matched with vetted agencies, and get paid in Naira within 24 hours of approval.
              </p>
              <NextLink
                href="/signup"
                className="group inline-flex items-center gap-2 bg-gold text-aubergine rounded-2xl px-7 py-4 font-black text-base hover:bg-white transition-colors mt-8"
              >
                Start earning
                <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </NextLink>
            </motion.div>

            {/* Earnings mock */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.15 }}
              className="hidden md:block"
            >
              <div className="bg-white text-ink rounded-3xl p-6 shadow-2xl shadow-black/30">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-extrabold uppercase tracking-widest text-ink/50">Paid this month</span>
                  <TrendingUp className="h-4 w-4 text-jade" />
                </div>
                <div className="font-heading font-black text-4xl text-ink tracking-tight">₦487,250</div>
                <div className="text-xs font-bold text-jade mt-1">+22% vs last month</div>
                {/* tiny sparkline */}
                <svg viewBox="0 0 200 60" className="w-full h-16 mt-4" aria-hidden>
                  <path
                    d="M0 50 L 25 40 L 50 45 L 75 30 L 100 32 L 125 22 L 150 25 L 175 12 L 200 8"
                    stroke="hsl(var(--jade))"
                    strokeWidth="3"
                    fill="none"
                    strokeLinecap="round"
                  />
                </svg>
                <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-ink/5 text-center">
                  <div>
                    <div className="font-heading font-black text-base text-ink">12</div>
                    <div className="text-[10px] font-bold text-ink/50 uppercase tracking-wider">Jobs</div>
                  </div>
                  <div>
                    <div className="font-heading font-black text-base text-ink">5.0★</div>
                    <div className="text-[10px] font-bold text-ink/50 uppercase tracking-wider">Avg</div>
                  </div>
                  <div>
                    <div className="font-heading font-black text-base text-jade">100%</div>
                    <div className="text-[10px] font-bold text-ink/50 uppercase tracking-wider">On time</div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Typecheck and commit**

```bash
npx tsc --noEmit
git add components/landing/ForFreelancersBlock.tsx
git commit -m "feat(landing): add for-freelancers block with earnings card"
```

---

## Task 13: Create LandingFAQ component

**Files:**
- Create: `components/landing/LandingFAQ.tsx`

- [ ] **Step 1: Create the file**

Write `components/landing/LandingFAQ.tsx`:

```tsx
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"

const faqs = [
  {
    q: "How does escrow work?",
    a: "When you fund a job, your payment is held by Bizimi (not sent to the freelancer). The freelancer can only receive funds after you mark the work as approved. If anything goes wrong, our disputes team reviews both sides before releasing.",
  },
  {
    q: "What are the fees?",
    a: "Posting a job is free. Bizimi takes a small service fee on completed jobs — transparent, shown before you fund. Freelancers see the same breakdown on their side. No surprise charges, no monthly minimums.",
  },
  {
    q: "How are pros vetted?",
    a: "Every freelancer goes through an identity check (government ID + bank account verification) plus a skill review of their portfolio before they can take paid work. The verified badge means we've checked them.",
  },
  {
    q: "What if I'm not satisfied with the work?",
    a: "You don't release the escrow until you're happy. If you and the freelancer can't agree, you can open a dispute and our team reviews the brief, the deliverables, and the chat history before deciding.",
  },
]

export function LandingFAQ() {
  return (
    <section className="bg-white py-20 md:py-28">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <span className="inline-block text-xs font-black tracking-widest text-primary uppercase mb-3">
            Common questions
          </span>
          <h2 className="font-heading font-black text-3xl md:text-5xl text-ink tracking-tight">
            Everything you need to know.
          </h2>
        </div>
        <Accordion type="single" collapsible className="w-full">
          {faqs.map((f, i) => (
            <AccordionItem key={i} value={`item-${i}`}>
              <AccordionTrigger>{f.q}</AccordionTrigger>
              <AccordionContent>{f.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Typecheck and commit**

```bash
npx tsc --noEmit
git add components/landing/LandingFAQ.tsx
git commit -m "feat(landing): add FAQ section with 4 objection-killers"
```

---

## Task 14: Create FinalCTA component

**Files:**
- Create: `components/landing/FinalCTA.tsx`

- [ ] **Step 1: Create the file**

Write `components/landing/FinalCTA.tsx`:

```tsx
import NextLink from "next/link"
import { ArrowRight } from "lucide-react"

export function FinalCTA() {
  return (
    <section className="bg-cream pb-24 md:pb-32">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative bg-white rounded-[2.5rem] md:rounded-[3rem] border border-aubergine/10 overflow-hidden text-center px-6 py-16 md:py-24">
          {/* Decorative shapes */}
          <div className="pointer-events-none absolute -top-10 -left-10 w-32 h-32 bg-gold rounded-full opacity-50" />
          <div className="pointer-events-none absolute -bottom-12 -right-8 w-28 h-28 bg-primary rounded-full opacity-50" />
          <div className="pointer-events-none absolute top-1/3 right-16 w-10 h-10 bg-jade rounded-xl rotate-12 opacity-60" />

          <div className="relative z-10 max-w-2xl mx-auto">
            <h2 className="font-heading font-black text-4xl md:text-6xl text-ink tracking-tight leading-[0.95]">
              Your next great hire is waiting.
            </h2>
            <p className="text-ink/60 font-medium text-lg leading-relaxed mt-6">
              Post a project free. Browse 2,000+ vetted Nigerian pros. Pay only when work ships.
            </p>
            <NextLink
              href="/signup"
              className="group inline-flex items-center gap-2 bg-ink text-white rounded-2xl px-8 py-5 font-black text-base hover:bg-aubergine transition-colors mt-8"
            >
              Get started
              <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </NextLink>
          </div>
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Typecheck and commit**

```bash
npx tsc --noEmit
git add components/landing/FinalCTA.tsx
git commit -m "feat(landing): add final CTA with shape decorations"
```

---

## Task 15: Create LandingFooter component

**Files:**
- Create: `components/landing/LandingFooter.tsx`

This refreshes the existing footer to use cream / aubergine instead of slate / orange-only hovers.

- [ ] **Step 1: Create the file**

Write `components/landing/LandingFooter.tsx`:

```tsx
import NextLink from "next/link"
import { Globe, MessageCircle, ArrowUpRight } from "lucide-react"

export function LandingFooter() {
  return (
    <footer className="bg-cream border-t border-aubergine/10 py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-12">
        <div className="col-span-2 space-y-6">
          <NextLink href="/" className="flex items-center space-x-2">
            <div className="w-10 h-10 bg-aubergine rounded-xl flex items-center justify-center shadow-lg shadow-aubergine/20">
              <span className="text-gold font-black text-xl font-heading">B</span>
            </div>
            <span className="text-2xl font-black tracking-tight text-ink font-heading">Bizimi</span>
          </NextLink>
          <p className="text-ink/60 font-medium max-w-xs leading-relaxed">
            Nigeria's premier marketplace for elite freelancers and forward-thinking agencies.
          </p>
          <div className="flex gap-3">
            <div className="w-11 h-11 rounded-full bg-white border border-aubergine/10 flex items-center justify-center text-ink/60 hover:bg-aubergine hover:text-white hover:border-aubergine transition-all cursor-pointer">
              <Globe className="h-5 w-5" />
            </div>
            <div className="w-11 h-11 rounded-full bg-white border border-aubergine/10 flex items-center justify-center text-ink/60 hover:bg-aubergine hover:text-white hover:border-aubergine transition-all cursor-pointer">
              <MessageCircle className="h-5 w-5" />
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <h4 className="font-black text-ink uppercase tracking-widest text-xs">Categories</h4>
          <div className="space-y-3 font-bold text-sm">
            <NextLink href="#" className="block text-ink/60 hover:text-primary transition-colors">Programming</NextLink>
            <NextLink href="#" className="block text-ink/60 hover:text-primary transition-colors">Design</NextLink>
            <NextLink href="#" className="block text-ink/60 hover:text-primary transition-colors">Writing</NextLink>
            <NextLink href="#" className="block text-ink/60 hover:text-primary transition-colors">Marketing</NextLink>
          </div>
        </div>

        <div className="space-y-6">
          <h4 className="font-black text-ink uppercase tracking-widest text-xs">Company</h4>
          <div className="space-y-3 font-bold text-sm">
            <NextLink href="#" className="block text-ink/60 hover:text-primary transition-colors">About Us</NextLink>
            <NextLink href="#" className="block text-ink/60 hover:text-primary transition-colors">Careers</NextLink>
            <NextLink href="#" className="block text-ink/60 hover:text-primary transition-colors">Terms</NextLink>
            <NextLink href="#" className="block text-ink/60 hover:text-primary transition-colors">Privacy</NextLink>
          </div>
        </div>

        <div className="col-span-2 bg-white p-8 rounded-3xl border border-aubergine/10 space-y-5">
          <h4 className="font-black text-ink uppercase tracking-widest text-xs">Newsletter</h4>
          <p className="text-sm font-medium text-ink/60 leading-relaxed">
            Get the latest project opportunities and platform updates.
          </p>
          <div className="flex gap-2">
            <input
              type="email"
              className="flex-1 bg-cream border-none rounded-xl px-4 text-sm font-bold focus:ring-2 focus:ring-aubergine/20 outline-none h-11"
              placeholder="Email address"
            />
            <button
              type="button"
              className="bg-aubergine text-white rounded-xl px-4 h-11 flex items-center justify-center hover:bg-aubergine/90 transition-colors"
              aria-label="Subscribe"
            >
              <ArrowUpRight className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-16 pt-8 border-t border-aubergine/10 text-center">
        <p className="text-sm font-bold text-ink/50">
          © {new Date().getFullYear()} Bizimi. All rights reserved. Built for the Nigerian creator economy.
        </p>
      </div>
    </footer>
  )
}
```

- [ ] **Step 2: Typecheck and commit**

```bash
npx tsc --noEmit
git add components/landing/LandingFooter.tsx
git commit -m "feat(landing): add cream/aubergine footer"
```

---

## Task 16: Replace app/page.tsx with new composition

**Files:**
- Modify: `app/page.tsx` (full rewrite)

- [ ] **Step 1: Replace the file contents**

Overwrite `app/page.tsx` with:

```tsx
import { Nav } from "@/components/landing/Nav"
import { Hero } from "@/components/landing/Hero"
import { StatsStrip } from "@/components/landing/StatsStrip"
import { CategoriesMarquee } from "@/components/landing/CategoriesMarquee"
import { HowItWorks } from "@/components/landing/HowItWorks"
import { FeaturedTalent } from "@/components/landing/FeaturedTalent"
import { Testimonials } from "@/components/landing/Testimonials"
import { ForFreelancersBlock } from "@/components/landing/ForFreelancersBlock"
import { LandingFAQ } from "@/components/landing/LandingFAQ"
import { FinalCTA } from "@/components/landing/FinalCTA"
import { LandingFooter } from "@/components/landing/LandingFooter"

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-cream font-sans selection:bg-primary/20 selection:text-primary">
      <Nav />
      <Hero />
      <StatsStrip />
      <CategoriesMarquee />
      <HowItWorks />
      <FeaturedTalent />
      <Testimonials />
      <ForFreelancersBlock />
      <LandingFAQ />
      <FinalCTA />
      <LandingFooter />
    </div>
  )
}
```

Note: this drops the previous `"use client"` directive. The page itself is now a server component that renders client components (Nav, Hero, CategoriesMarquee, HowItWorks, ForFreelancersBlock) when needed.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Run dev server and visually verify**

Run: `npm run dev`

Open http://localhost:3000 in a browser. Walk down the page top to bottom and confirm:
1. Nav renders with aubergine logo pill, gold "B"
2. Hero shows headline "Hire Nigeria's best, in hours." with orange underline under "in hours."
3. Aubergine right-side panel renders with shapes and floating talent + escrow cards (lg+ only)
4. Stats strip shows 4 numbers in aubergine
5. Categories marquee auto-scrolls horizontally, dark/light alternating
6. How It Works shows 3 numbered steps with product peek cards
7. Featured Talent shows 3 cards with verified jade badge
8. Testimonials show one cream + one aubergine card
9. For Freelancers block is full aubergine with gold "love." accent + earnings card on right (md+)
10. FAQ accordion expands/collapses on click
11. Final CTA card has shape decorations
12. Footer is cream with aubergine social hover

Stop the dev server with Ctrl+C when done.

- [ ] **Step 4: Commit**

```bash
git add app/page.tsx
git commit -m "feat(landing): rewrite app/page.tsx as composition root"
```

---

## Task 17: Mobile responsive pass

**Files:**
- Modify: any of `components/landing/*.tsx` based on findings

- [ ] **Step 1: Open dev server in mobile-width viewport**

Run: `npm run dev`

In browser dev tools, switch to mobile preview at widths 375px (iPhone SE), 414px (iPhone Plus), and 768px (tablet/iPad portrait).

- [ ] **Step 2: Walk through and check each section at each width**

For each section confirm:
- **Nav:** Logo + "Get started" pill visible at 375px. Nav links collapse (already `hidden md:flex` — verify).
- **Hero:** Right panel (`hidden lg:block`) should be hidden at 375 and 768. Headline still readable. CTAs stack vertically at 375.
- **Stats strip:** 2x2 grid at 375 (already `grid-cols-2 md:grid-cols-4` — verify).
- **Categories marquee:** Continues to scroll. Cards at 300px wide should still fit comfortably.
- **How It Works:** Stacks to 1 column at 375 (already `md:grid-cols-3` — verify).
- **Featured Talent:** Stacks to 1 column at 375.
- **Testimonials:** Stack to 1 column at 375.
- **For Freelancers:** Earnings card hidden at 375 (already `hidden md:block` — verify). Heading readable, gold "love." visible.
- **FAQ:** Accordion full width.
- **Final CTA:** Heading wraps; button still tappable.
- **Footer:** Newsletter card spans 2 cols at 375 (already `col-span-2`).

- [ ] **Step 3: If something breaks, edit the relevant component**

Common fixes if needed:
- Hero h1 too big at 375: change `text-5xl sm:text-6xl lg:text-7xl` to `text-4xl sm:text-6xl lg:text-7xl`.
- ForFreelancers heading too big: change `text-4xl md:text-6xl` to `text-3xl md:text-6xl`.
- Marquee card width too wide: change `w-[300px]` to `w-[260px] md:w-[300px]`.

Make only the edits you actually need; don't change anything that already looks right.

- [ ] **Step 4: Stop dev server and commit any changes**

If you made any edits:

```bash
git add components/landing/
git commit -m "fix(landing): mobile responsive adjustments"
```

If no edits were needed, skip the commit.

---

## Task 18: Final review and cleanup

**Files:**
- Review: all touched files

- [ ] **Step 1: Run full typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: no errors. If lint warns about unused imports in `app/page.tsx` (since we replaced it), they should already be gone — but double-check.

- [ ] **Step 3: Production build smoke test**

Run: `npm run build`
Expected: build completes successfully. Watch for any warnings about hydration mismatches or missing dependencies.

- [ ] **Step 4: Verify git status is clean**

Run: `git status`
Expected: `working tree clean` (everything committed).

- [ ] **Step 5: Push branch (only if you have a remote and the user wants this)**

Stop here unless the user has explicitly asked to push. Report completion in the conversation.

---

## Self-review notes

- **Spec coverage:** All 11 sections have a corresponding task. Palette + typography + motif handled in Tasks 1, 2, 4. Mobile in Task 17.
- **No placeholders:** Every code block is concrete; no "TODO" / "TBD" / "similar to". Static data is inlined where the spec said it would be.
- **Type consistency:** Component prop interfaces (`AuberginePanelProps`, `Category`, `Pro`, `Step`) are local to their files and only used internally — no cross-file type drift to worry about.
- **Footer extracted:** Spec didn't strictly require extracting footer, but a separate component keeps `app/page.tsx` clean as a composition root and matches the pattern of the other sections.
- **Removed `react-scroll`:** Original page imported `Link` from `react-scroll`. The new components use plain `<a href="#anchor">` and `next/link`. No cleanup task needed since the old page contents are fully replaced.
