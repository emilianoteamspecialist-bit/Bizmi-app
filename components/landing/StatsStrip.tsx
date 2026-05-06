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
