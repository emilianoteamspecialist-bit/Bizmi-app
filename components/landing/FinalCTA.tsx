import NextLink from "next/link"
import { ArrowRight } from "lucide-react"

export function FinalCTA() {
  return (
    <section className="bg-cream pb-24 md:pb-32">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative bg-white rounded-[2.5rem] md:rounded-[3rem] border border-aubergine/10 overflow-hidden text-center px-6 py-16 md:py-24">
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
