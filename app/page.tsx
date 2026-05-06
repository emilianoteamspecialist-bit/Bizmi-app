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

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-cream font-sans selection:bg-primary/20 selection:text-primary">
      <Nav />
      <Hero />
      <StatsStrip />
      <CategoriesMarquee />
      <HowItWorks />
      <FeaturedTalent />
      <Testimonials />
      <ForFreelancersBlock />
      <LandingFAQ />
      <FinalCTA />
      <LandingFooter />
    </div>
  )
}
