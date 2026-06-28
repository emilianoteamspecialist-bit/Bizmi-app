"use client"

import { Button } from "@/components/ui/button"
import { Reveal } from "@/components/reveal"
import {
  Rocket,
  ShieldCheck,
  Search,
  Send,
  Briefcase,
  Wallet,
  Coins,
  ShieldAlert,
  Mail,
} from "lucide-react"

const sections = [
  {
    id: "getting-started",
    icon: Rocket,
    title: "Getting started",
    body: "Bizimi connects you with vetted Nigerian agencies. Payments are held in secure escrow, so you get paid for work you deliver. Start by making your profile something agencies want to hire.",
    steps: [
      "Open Profile from the sidebar and add your bio, skills, location, hourly rate and experience.",
      "Verify your identity (NIN) so you can place bids.",
      "Buy a few credits in Bizpal — each proposal costs credits to submit.",
    ],
  },
  {
    id: "get-verified",
    icon: ShieldCheck,
    title: "Get verified",
    body: "A verified badge builds trust and is required before you can bid on jobs.",
    steps: [
      "Open Identity verification from your account menu.",
      "Enter your 11-digit National Identity Number (NIN).",
      "Submit — once verified, a badge shows on your profile and the bid gate is unlocked.",
    ],
  },
  {
    id: "find-work",
    icon: Search,
    title: "Find work",
    body: "Browse open briefs from agencies and zero in on the ones that fit your stack.",
    steps: [
      "Go to Marketplace to see all open projects, or check the Dashboard for briefs matched to your skills.",
      "Use search and filters (category, budget, job type) to narrow things down.",
      "Try Smart Match to surface projects based on your skills.",
      "Bookmark anything interesting — it lands in Saved jobs for later.",
    ],
  },
  {
    id: "submit-proposal",
    icon: Send,
    title: "Submit a proposal",
    body: "Each proposal costs credits, so make it count — be specific about how you'll deliver.",
    steps: [
      "On a job, click Quick apply (or Place bid from Saved jobs).",
      "Write a clear pitch, your timeline and your price.",
      "Submit — the credit cost is deducted and the agency can review your bid.",
      "Track every application and its status under Proposals.",
    ],
  },
  {
    id: "start-work",
    icon: Briefcase,
    title: "Win & start work",
    body: "When an agency accepts your proposal and funds the job into escrow, you're cleared to begin.",
    steps: [
      "The agency accepts your proposal and funds the job.",
      "From Proposals (or Funded jobs), click Verify to confirm the payment, then Confirm the job.",
      "Open the Workspace to collaborate and deliver the work.",
    ],
  },
  {
    id: "get-paid",
    icon: Wallet,
    title: "Get paid",
    body: "Once the work is approved, the escrow is released to you.",
    steps: [
      "You deliver the work and the agency marks it Job done.",
      "Click Complete work / Payout, then enter your correct bank details.",
      "Your payout is initiated — funds usually arrive within 24–48 hours.",
    ],
  },
  {
    id: "credits",
    icon: Coins,
    title: "Credits & Bizpal",
    body: "Credits let you submit proposals. Manage and top them up in Bizpal.",
    steps: [
      "Open Bizpal to see your available credits and purchase history.",
      "Click Top up credits or Buy credits to add more (₦50 per credit).",
      "Each proposal you submit deducts the job's credit cost.",
    ],
  },
  {
    id: "disputes",
    icon: ShieldAlert,
    title: "Raise a dispute",
    body: "If a client abandons the job or pushes work beyond what was agreed, you can open a dispute.",
    steps: [
      "On a funded job, choose Dispute.",
      "Pick a reason (e.g. client abandonment or scope creep) and describe the issue.",
      "You'll have a few days to resolve it in the Dispute Room before an admin steps in.",
    ],
  },
]

export default function FreelancerTutorial() {
  return (
    <div className="min-h-screen bg-surface pb-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <header className="space-y-1 mb-8">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Documentation</p>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">How to use Bizimi</h1>
          <p className="text-sm text-muted-foreground max-w-2xl">
            A step-by-step guide to freelancing on Bizimi — from finding work to getting paid.
          </p>
        </header>

        <div className="grid lg:grid-cols-[220px_1fr] gap-8">
          {/* Table of contents */}
          <aside className="hidden lg:block">
            <nav className="sticky top-20">
              <p className="px-3 mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">On this page</p>
              <ul className="space-y-0.5">
                {sections.map((s) => (
                  <li key={s.id}>
                    <a
                      href={`#${s.id}`}
                      className="block rounded-lg px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-surface-2 transition-colors"
                    >
                      {s.title}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          </aside>

          {/* Content */}
          <div className="space-y-6 min-w-0">
            {sections.map((s, i) => (
              <Reveal key={s.id} delay={i * 0.04}>
                <section id={s.id} className="scroll-mt-20 rounded-xl border border-border bg-card p-6">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 shrink-0 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                    <s.icon className="h-5 w-5" />
                  </div>
                  <h2 className="text-base font-semibold text-foreground">{s.title}</h2>
                </div>
                <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{s.body}</p>
                <ol className="mt-4 space-y-2.5">
                  {s.steps.map((step, i) => (
                    <li key={i} className="flex gap-3 text-sm">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-surface-2 text-[11px] font-semibold tabular-nums text-foreground">
                        {i + 1}
                      </span>
                      <span className="text-muted-foreground leading-relaxed">{step}</span>
                    </li>
                  ))}
                </ol>
                </section>
              </Reveal>
            ))}

            {/* Support */}
            <Reveal>
            <div className="rounded-xl border border-border bg-card p-6 text-center">
              <h2 className="text-base font-semibold text-foreground">Still need help?</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Can&apos;t find what you&apos;re looking for? Our support team is here to help.
              </p>
              <Button
                onClick={() => window.open("mailto:contact@bizimii.com", "_blank")}
                variant="outline"
                className="mt-4 gap-2"
              >
                <Mail className="h-4 w-4" />
                Contact support
              </Button>
            </div>
            </Reveal>
          </div>
        </div>
      </div>
    </div>
  )
}
