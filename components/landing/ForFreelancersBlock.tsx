"use client"

import NextLink from "next/link"
import { motion } from "framer-motion"
import { ArrowRight, TrendingUp } from "lucide-react"

export function ForFreelancersBlock() {
  return (
    <section id="for-freelancers" className="bg-cream py-20 md:py-28">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative bg-aubergine text-white rounded-[2.5rem] overflow-hidden p-8 md:p-16">
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
