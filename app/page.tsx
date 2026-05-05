"use client"

import { useState, useEffect } from "react"
import Link from "react-scroll"
import NextLink from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { StatBadge } from "@/components/shared/stat-badge"
import { 
  Code2, 
  Palette, 
  PenTool, 
  TrendingUp, 
  ArrowRight, 
  CheckCircle2, 
  Users, 
  Shield, 
  Zap, 
  Globe, 
  MessageCircle, 
  ArrowUpRight,
  ShieldCheck
} from "lucide-react"
import { motion } from "framer-motion"
import Image from "next/image"
import { Section } from "@/components/ui/section"
import { Card } from "@/components/ui/card"

export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  const categories = [
// ... rest of categories
    { 
      name: "Programming", 
      icon: <Code2 className="h-6 w-6" />, 
      count: "12k+ Jobs",
      description: "Software, Web & Mobile app development.",
      skills: ["React", "Node.js", "Python"]
    },
    { 
      name: "Design", 
      icon: <Palette className="h-6 w-6" />, 
      count: "8k+ Jobs",
      description: "UI/UX, Graphics & Brand identity.",
      skills: ["Figma", "Adobe", "Canva"]
    },
    { 
      name: "Writing", 
      icon: <PenTool className="h-6 w-6" />, 
      count: "5k+ Jobs",
      description: "Content, Technical & Creative writing.",
      skills: ["Copywriting", "SEO", "Blogs"]
    },
    { 
      name: "Marketing", 
      icon: <TrendingUp className="h-6 w-6" />, 
      count: "7k+ Jobs",
      description: "Digital, Social & Growth marketing.",
      skills: ["Ads", "Strategy", "Analysis"]
    },
  ]

  const features = [
    {
      title: "Vetted Talent",
      description: "Every freelancer undergoes a rigorous identity and skill verification process.",
      icon: <Users className="h-10 w-10 text-primary" />,
    },
    {
      title: "Secure Escrow",
      description: "Payments are held safely in escrow and only released when you approve the work.",
      icon: <Shield className="h-10 w-10 text-primary" />,
    },
    {
      title: "Fast Delivery",
      description: "Connect with professionals who can start on your project within hours, not days.",
      icon: <Zap className="h-10 w-10 text-primary" />,
    },
  ]

  return (
    <div className="min-h-screen bg-white font-sans selection:bg-primary/20 selection:text-primary">
      {/* Navigation */}
      <nav className={`fixed top-0 w-full z-50 transition-all duration-300 ${scrolled ? "bg-white/80 backdrop-blur-md border-b border-slate-100 py-3 shadow-sm" : "bg-transparent py-5"}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
          <div className="flex items-center gap-10">
            <NextLink href="/" className="flex items-center space-x-2 group">
              <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/20">
                <span className="text-white font-black text-xl">B</span>
              </div>
              <span className="text-2xl font-black tracking-tight text-slate-900">Bizimi</span>
            </NextLink>
            
            <div className="hidden md:flex items-center space-x-8">
              <NextLink href="#features" className="text-sm font-bold text-slate-600 hover:text-primary transition-colors">Features</NextLink>
              <NextLink href="#how-it-works" className="text-sm font-bold text-slate-600 hover:text-primary transition-colors">Marketplace</NextLink>
              <NextLink href="/login" className="text-sm font-bold text-slate-600 hover:text-primary transition-colors">Sign In</NextLink>
            </div>
          </div>
          
          <NextLink href="/signup">
            <Button className="rounded-full px-8 font-black shadow-primary/25">
              Join Bizimi
            </Button>
          </NextLink>
        </div>
      </nav>

      {/* Hero Section */}
      <Section className="pt-32 pb-20 md:pt-48 md:pb-32 overflow-hidden">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
            className="space-y-8 text-center lg:text-left"
          >
            <StatBadge variant="default" className="px-4 py-1.5">
              Nigeria's #1 Freelance Marketplace
            </StatBadge>
            <h1 className="text-5xl sm:text-7xl font-bold font-heading text-slate-900 leading-[1.1] tracking-tight">
              The world's <span className="text-primary relative inline-block">
                best talent
                <svg className="absolute -bottom-2 left-0 w-full" viewBox="0 0 100 10" preserveAspectRatio="none">
                  <path d="M0 5 Q 25 0, 50 5 T 100 5" fill="none" stroke="currentColor" strokeWidth="4" />
                </svg>
              </span> is right here.
            </h1>
            <p className="text-xl text-muted-foreground font-medium max-w-xl leading-relaxed mx-auto lg:mx-0">
              Connect with top-tier Nigerian professionals. Secure payments, vetted experts, and seamless collaboration all in one place.
            </p>
            <div className="flex flex-col sm:flex-row items-center gap-4 pt-4 justify-center lg:justify-start">
              <NextLink href="/signup">
                <Button size="lg" className="px-12 h-16 text-lg group">
                  Start Hiring
                  <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </Button>
              </NextLink>
              <NextLink href="/login">
                <Button variant="outline" size="lg" className="px-12 h-16 text-lg">
                  Browse Projects
                </Button>
              </NextLink>
            </div>
            
            <div className="flex items-center gap-6 pt-8 justify-center lg:justify-start">
              <div className="flex -space-x-3">
                {[1,2,3,4].map(i => (
                  <div key={i} className="w-12 h-12 rounded-full border-4 border-white bg-slate-200" />
                ))}
              </div>
              <p className="text-sm font-bold text-slate-500">
                Joined by <span className="text-slate-900 font-black">2,000+</span> professionals
              </p>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="relative hidden lg:block"
          >
            <div className="relative z-10 rounded-[3rem] overflow-hidden shadow-2xl border-8 border-white">
              <Image src="/placeholder.svg" alt="Hero" width={800} height={1000} className="w-full aspect-[4/5] object-cover bg-slate-100" />
            </div>
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-primary/20 rounded-full blur-3xl animate-pulse" />
            <div className="absolute -bottom-10 -left-10 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl" />
          </motion.div>
        </div>

        {/* Categories Grid */}
        <div className="mt-32 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {categories.map((cat, i) => (
            <motion.div 
              key={i}
              whileHover={{ y: -10 }}
            >
              <Card className="p-8 h-full border-border hover:border-primary/50 hover:shadow-xl hover:shadow-primary/5 transition-all cursor-pointer group flex flex-col">
                <div className="w-16 h-16 bg-surface rounded-md flex items-center justify-center mb-8 group-hover:bg-primary group-hover:text-white transition-all transform group-hover:rotate-6">
                  {cat.icon}
                </div>
                <div className="flex justify-between items-start mb-3">
                  <h3 className="text-2xl font-bold font-heading text-foreground tracking-tight">{cat.name}</h3>
                  <StatBadge variant="default">
                    {cat.count}
                  </StatBadge>
                </div>
                <p className="text-muted-foreground text-sm font-medium leading-relaxed mb-8">
                  {cat.description}
                </p>
                <div className="flex flex-wrap gap-2 mb-10 mt-auto">
                  {cat.skills.map((skill, idx) => (
                    <StatBadge key={idx} variant="muted">
                      {skill}
                    </StatBadge>
                  ))}
                </div>
                <div className="flex items-center text-primary font-bold text-sm group/link">
                  Explore Jobs
                  <ArrowRight className="ml-2 h-4 w-4 group-hover/link:translate-x-2 transition-transform" />
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      </Section>

      {/* Features Section */}
      <Section id="features" variant="muted">
        <div className="text-center max-w-3xl mx-auto mb-20 space-y-4">
          <Badge variant="secondary" className="bg-primary/10 text-primary border-none">
            The Bizimi Advantage
          </Badge>
          <h2 className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tight">
            Why businesses choose us
          </h2>
          <p className="text-lg text-slate-500 font-bold leading-relaxed">
            We've built a platform that prioritizes trust, quality, and speed for both agencies and freelancers.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {features.map((feature, i) => (
            <div key={i} className="group p-10 rounded-[2.5rem] bg-white border border-slate-100 hover:border-primary/50 hover:shadow-xl transition-all">
              <div className="mb-8 p-5 bg-slate-50 rounded-2xl inline-block group-hover:bg-primary group-hover:text-white transition-all transform group-hover:-translate-y-2">
                {feature.icon}
              </div>
              <h3 className="text-2xl font-black text-slate-900 mb-4">{feature.title}</h3>
              <p className="text-slate-500 font-bold leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </Section>

      {/* CTA Section */}
      <Section className="pb-32">
        <div className="max-w-7xl mx-auto rounded-[3.5rem] bg-slate-900 p-12 sm:p-24 text-center text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-primary/20 to-transparent"></div>
          <div className="relative z-10 space-y-8">
            <h2 className="text-4xl sm:text-6xl font-black leading-tight tracking-tight max-w-4xl mx-auto">
              Ready to find the perfect professional?
            </h2>
            <p className="text-xl text-slate-400 font-bold max-w-2xl mx-auto leading-relaxed">
              Join thousands of businesses already scaling their teams with Bizimi's vetted talent network.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-6 pt-4">
              <NextLink href="/signup">
                <Button size="lg" className="rounded-full px-12 h-16 text-lg shadow-xl shadow-primary/25">
                  Get Started Now
                </Button>
              </NextLink>
              <NextLink href="/contact">
                <Button variant="outline" size="lg" className="rounded-full px-12 h-16 text-lg border-slate-700 bg-transparent text-white hover:bg-slate-800">
                  Contact Sales
                </Button>
              </NextLink>
            </div>
          </div>
        </div>
      </Section>

      {/* Footer */}
      <footer className="bg-slate-50 border-t border-slate-100 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-12">
          <div className="col-span-2 space-y-6">
            <NextLink href="/" className="flex items-center space-x-2">
              <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/20">
                <span className="text-white font-black text-xl">B</span>
              </div>
              <span className="text-2xl font-black tracking-tight">Bizimi</span>
            </NextLink>
            <p className="text-slate-500 font-bold max-w-xs leading-relaxed">
              Nigeria's premier marketplace for elite freelancers and forward-thinking agencies.
            </p>
            <div className="flex gap-4">
               <div className="w-12 h-12 rounded-full bg-white border border-slate-100 flex items-center justify-center text-slate-600 hover:bg-primary hover:text-white transition-all cursor-pointer hover:shadow-lg"><Globe className="h-5 w-5"/></div>
               <div className="w-12 h-12 rounded-full bg-white border border-slate-100 flex items-center justify-center text-slate-600 hover:bg-primary hover:text-white transition-all cursor-pointer hover:shadow-lg"><MessageCircle className="h-5 w-5"/></div>
            </div>
          </div>
          
          <div className="space-y-6">
            <h4 className="font-black text-slate-900 uppercase tracking-widest text-xs">Categories</h4>
            <div className="space-y-4 font-bold text-sm">
              <NextLink href="#" className="block text-slate-500 hover:text-primary transition-colors">Programming</NextLink>
              <NextLink href="#" className="block text-slate-500 hover:text-primary transition-colors">Design</NextLink>
              <NextLink href="#" className="block text-slate-500 hover:text-primary transition-colors">Writing</NextLink>
              <NextLink href="#" className="block text-slate-500 hover:text-primary transition-colors">Marketing</NextLink>
            </div>
          </div>

          <div className="space-y-6">
            <h4 className="font-black text-slate-900 uppercase tracking-widest text-xs">Company</h4>
            <div className="space-y-4 font-bold text-sm">
              <NextLink href="#" className="block text-slate-500 hover:text-primary transition-colors">About Us</NextLink>
              <NextLink href="#" className="block text-slate-500 hover:text-primary transition-colors">Careers</NextLink>
              <NextLink href="#" className="block text-slate-500 hover:text-primary transition-colors">Terms</NextLink>
              <NextLink href="#" className="block text-slate-500 hover:text-primary transition-colors">Privacy</NextLink>
            </div>
          </div>

          <div className="col-span-2 bg-white p-8 rounded-[2rem] border border-slate-100 space-y-6">
             <h4 className="font-black text-slate-900 uppercase tracking-widest text-xs">Newsletter</h4>
             <p className="text-sm font-bold text-slate-500 leading-relaxed">
               Get the latest project opportunities and platform updates.
             </p>
             <div className="flex gap-2">
                <input className="flex-1 bg-slate-50 border-none rounded-xl px-4 text-sm font-bold focus:ring-2 focus:ring-primary/20 outline-none" placeholder="Email address" />
                <Button className="rounded-xl px-4 h-11"><ArrowUpRight className="h-5 w-5"/></Button>
             </div>
          </div>
        </div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-20 pt-8 border-t border-slate-100 text-center">
          <p className="text-sm font-bold text-slate-400">
            © {new Date().getFullYear()} Bizimi. All rights reserved. Built for the Nigerian creator economy.
          </p>
        </div>
      </footer>
    </div>
  )
}
