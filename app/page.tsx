import { Nav } from "@/components/landing/Nav"
import { Hero } from "@/components/landing/Hero"
import { StatsStrip } from "@/components/landing/StatsStrip"
import { CategoriesMarquee } from "@/components/landing/CategoriesMarquee"
import { HowItWorks } from "@/components/landing/HowItWorks"
import { FeaturedTalent } from "@/components/landing/FeaturedTalent"
import { Testimonials } from "@/components/landing/Testimonials"
import { ForFreelancersBlock } from "@/components/landing/ForFreelancersBlock"
import { LandingFAQ } from "@/components/landing/LandingFAQ"
import { FinalCTA } from "@/components/landing/FinalCTA"
import { LandingFooter } from "@/components/landing/LandingFooter"
import { Reveal } from "@/components/reveal"

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-cream font-sans selection:bg-primary/20 selection:text-primary">
      <Nav />
      <Hero />
      <Reveal repeat><StatsStrip /></Reveal>
      <Reveal repeat><CategoriesMarquee /></Reveal>
      <Reveal repeat><HowItWorks /></Reveal>
      <Reveal repeat><FeaturedTalent /></Reveal>
      <Reveal repeat><Testimonials /></Reveal>
      <Reveal repeat><ForFreelancersBlock /></Reveal>
      <Reveal repeat><LandingFAQ /></Reveal>
      <Reveal repeat><FinalCTA /></Reveal>
      <LandingFooter />
    </div>
  )
}
