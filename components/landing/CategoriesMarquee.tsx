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
  const loop = [...categories, ...categories]
  return (
    <section className="bg-cream py-16 md:py-24 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-10">
        <h2 className="font-heading font-black text-3xl md:text-5xl text-ink tracking-tight">
          Find the right fit, fast.
        </h2>
        <p className="text-ink/60 font-medium mt-3 text-lg">Top categories on Bizimi this month.</p>
      </div>
      <div className="relative">
        <div className="flex gap-4 animate-marquee w-max">
          {loop.map((cat, i) => (
            <CategoryCard key={i} cat={cat} dark={i % 2 === 0} />
          ))}
        </div>
      </div>
    </section>
  )
}
