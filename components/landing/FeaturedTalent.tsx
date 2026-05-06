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
