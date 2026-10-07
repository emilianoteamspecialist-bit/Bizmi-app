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
