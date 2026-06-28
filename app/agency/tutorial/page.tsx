"use client"

import { Button } from "@/components/ui/button"
import { Reveal } from "@/components/reveal"
import {
  Rocket,
  Plus,
  Inbox,
  ShieldCheck,
  MessageSquare,
  CheckCircle,
  Wallet,
  ShieldAlert,
  Mail,
} from "lucide-react"

const sections = [
  {
    id: "getting-started",
    icon: Rocket,
    title: "Getting started",
    body: "Bizimi connects your agency with vetted Nigerian freelancers. Payments are held in secure escrow, so work and money stay protected until you're satisfied. Begin by completing your agency profile so freelancers know who they're working with.",
    steps: [
      "Open Profile from the sidebar and add your company name, logo, location and a short bio.",
      "Top up your wallet so you're ready to fund a job once you hire.",
      "Post your first job from the dashboard.",
    ],
  },
  {
    id: "post-a-job",
    icon: Plus,
    title: "Post a job",
    body: "A clear brief tells freelancers exactly what you need and attracts stronger proposals.",
    steps: [
      "From the Dashboard, click Post a job.",
      "Enter a clear title, description and expected duration.",
      "Select the required skills and the credits to spend.",
      "Set the job type, location and budget range.",
      "Review and publish — your post appears in the marketplace and freelancers can start applying.",
    ],
  },
  {
    id: "review-proposals",
    icon: Inbox,
    title: "Review proposals",
    body: "As freelancers apply, their proposals collect under each job for you to compare.",
    steps: [
      "Go to the Dashboard or My Posts and click Review bids on a job.",
      "Read each proposal's pitch, timeline and budget, and open the freelancer's profile.",
      "Accept the proposal you want, or reject the ones you don't.",
      "Use the search box to filter proposals by name, location or keyword.",
    ],
  },
  {
    id: "fund-job",
    icon: ShieldCheck,
    title: "Fund the job (escrow)",
    body: "After accepting a proposal, fund the job to move money into escrow. The freelancer is paid only after you confirm the work is done.",
    steps: [
      "On the accepted proposal, click Fund job.",
      "Complete payment securely via Paystack.",
      "Once funded, the proposal shows Funded and the freelancer can begin work.",
    ],
  },
  {
    id: "messaging",
    icon: MessageSquare,
    title: "Message & collaborate",
    body: "Stay in touch with your freelancer throughout the project.",
    steps: [
      "Open Messages from the sidebar, or click Message freelancer on an accepted proposal.",
      "Share files, references and feedback directly in the chat.",
    ],
  },
  {
    id: "complete-job",
    icon: CheckCircle,
    title: "Complete & release payment",
    body: "When the work meets your brief, mark the job done to release the escrow to the freelancer.",
    steps: [
      "Open the job and click Mark done.",
      "The freelancer can then request their payout.",
      "The job status updates to Completed.",
    ],
  },
  {
    id: "wallet",
    icon: Wallet,
    title: "Wallet & deposits",
    body: "Your wallet shows the jobs you've funded and lets you add funds at any time.",
    steps: [
      "Open Wallet from the sidebar.",
      "Click Make a deposit to top up.",
      "Track every funded job, with its status and amount.",
    ],
  },
  {
    id: "disputes",
    icon: ShieldAlert,
    title: "Raise a dispute",
    body: "If something goes wrong, you can freeze the escrow and work towards a resolution.",
    steps: [
      "On a job, open the menu and choose Open dispute.",
      "Describe the issue — the freelancer and an admin can see it.",
      "You'll have a few days to resolve it in the Dispute Room before an admin steps in.",
    ],
  },
]

export default function AgencyTutorial() {
  return (
    <div className="min-h-screen bg-surface pb-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <header className="space-y-1 mb-8">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Documentation</p>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">How to use Bizimi</h1>
          <p className="text-sm text-muted-foreground max-w-2xl">
            A step-by-step guide to hiring on Bizimi as an agency — from posting a job to releasing payment.
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
