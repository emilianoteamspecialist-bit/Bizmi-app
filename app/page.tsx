"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { 
  ArrowRight, 
  Users, 
  Briefcase, 
  Star, 
  Shield, 
  Zap, 
  Globe, 
  MessageCircle, 
  Menu, 
  X,
  Code2,
  Palette,
  PenTool,
  Search,
  CheckCircle2,
  TrendingUp,
  Award
} from "lucide-react"
import Link from "next/link"
import { useState, useEffect } from "react"

export default function LandingPage() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  const categories = [
    { name: "Programming", icon: <Code2 className="h-5 w-5" />, count: "12k+ Jobs" },
    { name: "Design", icon: <Palette className="h-5 w-5" />, count: "8k+ Jobs" },
    { name: "Writing", icon: <PenTool className="h-5 w-5" />, count: "5k+ Jobs" },
    { name: "Marketing", icon: <TrendingUp className="h-5 w-5" />, count: "7k+ Jobs" },
  ]

  const features = [
    {
      icon: <Users className="h-10 w-10 text-orange-500" />,
      title: "Find Top Talent",
      description: "Connect with the top 3% of Nigerian and global freelancers, vetted for absolute quality.",
    },
    {
      icon: <Shield className="h-10 w-10 text-orange-500" />,
      title: "Secure Escrow",
      description: "Our milestone-based escrow system ensures you only pay for work you've approved.",
    },
    {
      icon: <Zap className="h-10 w-10 text-orange-500" />,
      title: "Fast Matching",
      description: "Our AI-powered matching algorithm connects you with the right talent in minutes, not days.",
    },
  ]

  return (
    <div className="min-h-screen bg-slate-50 selection:bg-orange-100 selection:text-orange-900">
      {/* Navigation */}
      <nav className={`fixed top-0 z-50 w-full transition-all duration-300 ${
        scrolled ? "bg-white/80 backdrop-blur-md shadow-sm border-b" : "bg-transparent"
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            {/* Logo */}
            <Link href="/" className="flex items-center space-x-2 group">
              <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center shadow-lg shadow-orange-500/20">
                <span className="text-white font-bold text-xl">B</span>
              </div>
              <span className="text-2xl font-black tracking-tight text-slate-900">Bizimi</span>
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-10">
              <Link href="#features" className="text-sm font-medium text-slate-600 hover:text-orange-500 transition-colors">Features</Link>
              <Link href="#how-it-works" className="text-sm font-medium text-slate-600 hover:text-orange-500 transition-colors">Marketplace</Link>
              <div className="h-6 w-px bg-slate-200"></div>
              <Link href="/login" className="text-sm font-medium text-slate-600 hover:text-orange-500 transition-colors">Sign In</Link>
              <Link href="/signup">
                <Button className="bg-orange-500 hover:bg-orange-600 shadow-lg shadow-orange-500/25 px-6 rounded-full font-bold">
                  Start Hiring
                </Button>
              </Link>
            </div>

            {/* Mobile menu button */}
            <div className="md:hidden">
              <Button variant="ghost" size="icon" onClick={() => setIsMenuOpen(!isMenuOpen)}>
                {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </Button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation */}
        <div className={`md:hidden absolute w-full bg-white border-b transition-all duration-300 ${
          isMenuOpen ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4 pointer-events-none"
        }`}>
          <div className="px-4 py-6 space-y-4">
            <Link href="#features" className="block text-lg font-medium text-slate-600">Features</Link>
            <Link href="#how-it-works" className="block text-lg font-medium text-slate-600">How it Works</Link>
            <div className="pt-4 border-t flex flex-col gap-3">
              <Link href="/login" className="text-center py-2 font-medium">Sign In</Link>
              <Link href="/signup">
                <Button className="bg-orange-500 hover:bg-orange-600 w-full py-6 text-lg">Get Started</Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 sm:pt-48 sm:pb-32 overflow-hidden">
        {/* Background blobs */}
        <div className="absolute top-0 -left-4 w-72 h-72 bg-orange-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
        <div className="absolute top-0 -right-4 w-72 h-72 bg-purple-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>
        <div className="absolute -bottom-8 left-20 w-72 h-72 bg-pink-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-4000"></div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <Badge className="mb-6 py-1.5 px-4 bg-orange-50 text-orange-600 border-orange-100 hover:bg-orange-100 transition-colors uppercase tracking-wider font-bold text-[10px]">
            The #1 Marketplace for Nigerian Talent
          </Badge>
          <h1 className="text-5xl sm:text-7xl font-black text-slate-900 mb-8 leading-[1.1] tracking-tight">
            The world's <span className="text-orange-500 relative inline-block">
              best work
              <svg className="absolute -bottom-2 left-0 w-full" height="10" viewBox="0 0 100 10" preserveAspectRatio="none">
                <path d="M0 5 Q 25 0, 50 5 T 100 5" fill="none" stroke="#f97316" strokeWidth="4" />
              </svg>
            </span> happens here
          </h1>
          <p className="text-xl text-slate-600 mb-12 max-w-3xl mx-auto leading-relaxed">
            Connect with vetted freelancers who specialize in building the future. 
            From smart contracts to brand identity, we've got you covered.
          </p>
          <div className="flex flex-col sm:flex-row gap-5 justify-center">
            <Link href="/signup">
              <Button size="lg" className="bg-orange-500 hover:bg-orange-600 text-lg px-10 py-7 rounded-full shadow-2xl shadow-orange-500/40 group">
                Hire Talent
                <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
            <Button size="lg" variant="outline" className="text-lg px-10 py-7 rounded-full border-slate-200 bg-white hover:bg-slate-50">
              Apply as Freelancer
            </Button>
          </div>

          {/* Categories Quick Links */}
          <div className="mt-20 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
            {categories.map((cat, i) => (
              <div key={i} className="bg-white/50 backdrop-blur-sm p-4 rounded-2xl border border-slate-200 hover:border-orange-500/50 hover:bg-white transition-all cursor-pointer group shadow-sm">
                <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center mb-3 group-hover:bg-orange-500 group-hover:text-white transition-colors">
                  {cat.icon}
                </div>
                <h3 className="font-bold text-slate-900">{cat.name}</h3>
                <p className="text-xs text-slate-500">{cat.count}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust Section */}
      <section className="py-12 bg-white border-y border-slate-100 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-center text-xs font-bold uppercase tracking-[0.2em] text-slate-400 mb-8">Powering local & international brands</p>
          <div className="flex flex-wrap justify-center items-center gap-12 opacity-50 grayscale hover:grayscale-0 transition-all duration-500">
             <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-orange-600 rounded flex items-center justify-center text-white font-bold">1</div>
                <span className="text-2xl font-bold tracking-tighter">1APP</span>
             </div>
             <div className="text-2xl font-bold italic tracking-tighter text-slate-900">Flutterwave</div>
             <div className="text-2xl font-bold tracking-tighter text-slate-900">PAYSTACK</div>
             <div className="text-2xl font-black tracking-tighter text-slate-900 uppercase">Interswitch</div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 sm:py-32 bg-slate-900 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-orange-500/10 to-transparent"></div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="max-w-2xl mb-20">
            <h2 className="text-orange-500 font-bold uppercase tracking-widest text-sm mb-4">The Bizimi Advantage</h2>
            <h3 className="text-4xl sm:text-5xl font-black mb-6">Built for speed, <br/>secured by escrow.</h3>
            <p className="text-slate-400 text-lg">We've removed the friction from freelancing. No more ghosting, no more payment disputes.</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {features.map((f, i) => (
              <div key={i} className="group p-8 rounded-3xl bg-slate-800/50 border border-slate-700 hover:border-orange-500/50 transition-all">
                <div className="mb-6 p-4 bg-slate-700 rounded-2xl inline-block group-hover:bg-orange-500 transition-colors">
                  {f.icon}
                </div>
                <h4 className="text-xl font-bold mb-4">{f.title}</h4>
                <p className="text-slate-400 leading-relaxed">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 mb-8 bg-slate-50 px-4 py-2 rounded-full border">
             <div className="flex -space-x-2">
                {[1,2,3,4].map(i => (
                  <div key={i} className="w-8 h-8 rounded-full border-2 border-white bg-slate-200"></div>
                ))}
             </div>
             <span className="text-sm font-bold text-slate-700">Join 50k+ Happy Users</span>
          </div>
          <h2 className="text-4xl sm:text-5xl font-black text-slate-900 mb-16 italic tracking-tight">
            "Bizimi is the first platform that truly understands <br className="hidden md:block" /> the African creative ecosystem."
          </h2>
          <div className="flex items-center justify-center gap-4">
             <div className="text-left">
                <p className="font-black text-slate-900 text-lg">Tunde Mason</p>
                <p className="text-slate-500 text-sm">Product Manager at 1App</p>
             </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto rounded-[3rem] bg-orange-500 p-12 sm:p-24 text-center text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
          <div className="relative z-10">
            <h2 className="text-4xl sm:text-6xl font-black mb-6 leading-tight">Ready to hire the <br/> future of Nigeria?</h2>
            <p className="text-orange-100 text-xl mb-12 max-w-2xl mx-auto">Join the most secure marketplace for high-impact projects.</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" className="bg-white text-orange-600 hover:bg-orange-50 text-lg px-12 py-8 rounded-full font-black shadow-xl">
                Get Started
              </Button>
              <Button size="lg" variant="outline" className="text-white border-white/50 hover:bg-white/10 text-lg px-12 py-8 rounded-full font-black bg-transparent">
                Contact Sales
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white py-20 border-t border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-12">
          <div className="col-span-2">
            <Link href="/" className="flex items-center space-x-2 mb-6">
              <div className="w-8 h-8 bg-orange-500 rounded flex items-center justify-center">
                <span className="text-white font-bold">B</span>
              </div>
              <span className="text-xl font-bold tracking-tight">Bizimi</span>
            </Link>
            <p className="text-slate-500 text-sm max-w-xs leading-relaxed">
              The premier marketplace connecting high-impact Nigerian talent with global opportunities. 
              Secure, fast, and professional.
            </p>
          </div>
          <div className="space-y-4 text-sm font-medium">
            <h4 className="text-slate-900 font-bold">Marketplace</h4>
            <Link href="#" className="block text-slate-500 hover:text-orange-500">Programming</Link>
            <Link href="#" className="block text-slate-500 hover:text-orange-500">Design</Link>
            <Link href="#" className="block text-slate-500 hover:text-orange-500">Writing</Link>
          </div>
          <div className="space-y-4 text-sm font-medium">
            <h4 className="text-slate-900 font-bold">Company</h4>
            <Link href="#" className="block text-slate-500 hover:text-orange-500">About</Link>
            <Link href="#" className="block text-slate-500 hover:text-orange-500">Careers</Link>
            <Link href="#" className="block text-slate-500 hover:text-orange-500">Privacy</Link>
          </div>
          <div className="col-span-2 flex flex-col items-start md:items-end">
            <p className="text-sm font-bold text-slate-900 mb-4">Nigeria's Talent Engine</p>
            <div className="flex gap-4">
               <div className="w-10 h-10 rounded-full bg-slate-50 border flex items-center justify-center text-slate-600 hover:bg-orange-500 hover:text-white transition-colors cursor-pointer"><Globe className="h-5 w-5"/></div>
               <div className="w-10 h-10 rounded-full bg-slate-50 border flex items-center justify-center text-slate-600 hover:bg-orange-500 hover:text-white transition-colors cursor-pointer"><MessageCircle className="h-5 w-5"/></div>
            </div>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-20 pt-8 border-t border-slate-50 text-center text-slate-400 text-xs font-medium">
          &copy; 2026 Bizimi. All rights reserved. Registered in Nigeria.
        </div>
      </footer>
    </div>
  )
}
