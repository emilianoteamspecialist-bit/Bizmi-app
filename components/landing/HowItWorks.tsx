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
