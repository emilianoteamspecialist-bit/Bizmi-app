"use client"

import NextLink from "next/link"
import Image from "next/image"
import { motion } from "framer-motion"
import { ArrowRight, Lock, BadgeCheck } from "lucide-react"

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
            Hire Nigeria&apos;s<br />best,{" "}
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
              {[1, 2, 3, 4].map((n, i) => (
                <Image
                  key={n}
                  src={`/images/avatars/avatar-${n}.jpg`}
                  alt={`Bizimi member ${n}`}
                  width={40}
                  height={40}
                  className="w-10 h-10 rounded-full border-[3px] border-cream object-cover bg-cream"
                  style={{ marginLeft: i === 0 ? 0 : -10, zIndex: 4 - i }}
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
          <div className="relative h-[560px]">
            <div className="pointer-events-none absolute -top-10 -right-8 w-44 h-44 bg-gold rounded-full opacity-95" />
            <div className="pointer-events-none absolute -bottom-6 -left-8 w-40 h-40 bg-primary rounded-full" />
            <div className="pointer-events-none absolute top-[40%] right-[30%] w-20 h-20 bg-jade rounded-2xl rotate-12" />
            <div className="absolute inset-0 z-10 flex items-end justify-center -translate-y-8">
              <Image
                src="/images/user.png"
                alt="Featured Bizimi freelancer"
                fill
                className="object-contain object-bottom scale-[1.3]"
                style={{
                  maskImage:
                    "linear-gradient(to bottom, black 78%, transparent 100%)",
                  WebkitMaskImage:
                    "linear-gradient(to bottom, black 78%, transparent 100%)",
                }}
                priority
              />
            </div>
          </div>

          {/* Floating talent card */}
          <motion.div
            animate={{ y: [0, -12, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            className="absolute -left-8 -bottom-4 z-20 bg-white rounded-2xl p-4 w-[18rem] shadow-2xl shadow-aubergine/25"
          >
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-primary/30 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-extrabold text-ink">Emeka O.</span>
                  <BadgeCheck className="h-4 w-4 text-jade flex-shrink-0" />
                </div>
                <div className="text-xs text-ink/60 truncate">UI/UX Designer · Lagos</div>
              </div>
            </div>
            <div className="flex gap-1.5 mt-3">
              <span className="text-[11px] bg-cream text-aubergine px-2 py-0.5 rounded-md font-bold">Figma</span>
              <span className="text-[11px] bg-cream text-aubergine px-2 py-0.5 rounded-md font-bold">Webflow</span>
              <span className="text-[11px] bg-cream text-aubergine px-2 py-0.5 rounded-md font-bold">Brand</span>
            </div>
            <div className="flex justify-between items-center mt-3 pt-3 border-t border-ink/5">
              <div className="text-sm font-black text-ink">₦18k/hr</div>
              <div className="text-[11px] text-jade font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-jade rounded-full" /> Available now
              </div>
            </div>
          </motion.div>

          {/* Floating escrow micro-card */}
          <motion.div
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut", delay: 0.8 }}
            className="absolute -right-4 top-12 z-20 bg-white rounded-2xl p-4 shadow-2xl shadow-aubergine/25 flex items-center gap-3"
          >
            <div className="w-10 h-10 bg-jade rounded-xl flex items-center justify-center">
              <Lock className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="text-xs font-extrabold text-ink">Escrow secured</div>
              <div className="text-[11px] text-ink/60">₦450,000 held</div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  )
}
