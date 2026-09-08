import { Nav } from "@/components/landing/Nav"
import { Hero } from "@/components/landing/Hero"
import { FinalCTA } from "@/components/landing/FinalCTA"
import { LandingFooter } from "@/components/landing/LandingFooter"

export default function Landing() {
  return (
    <div className="min-h-screen bg-cream font-sans selection:bg-primary/20 selection:text-primary">
      <Nav />
      <Hero />
      <FinalCTA />
      <LandingFooter />
    </div>
  )
}
