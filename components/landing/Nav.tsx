"use client"

import { useEffect, useState } from "react"
import NextLink from "next/link"

export function Nav() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  return (
    <nav
      className={`fixed top-0 w-full z-50 transition-all duration-300 ${
        scrolled
          ? "bg-cream/85 backdrop-blur-md border-b border-aubergine/5 py-3 shadow-sm"
          : "bg-transparent py-5"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
        <div className="flex items-center gap-10">
          <NextLink href="/" className="flex items-center space-x-2 group">
            <div className="w-10 h-10 bg-aubergine rounded-xl flex items-center justify-center shadow-lg shadow-aubergine/20">
              <span className="text-gold font-black text-xl font-heading">B</span>
            </div>
            <span className="text-2xl font-black tracking-tight text-ink font-heading">Bizimi</span>
          </NextLink>

          <div className="hidden md:flex items-center space-x-8">
            <a href="#how-it-works" className="text-sm font-bold text-ink/70 hover:text-primary transition-colors">
              Hire talent
            </a>
            <a href="#for-freelancers" className="text-sm font-bold text-ink/70 hover:text-primary transition-colors">
              Find work
            </a>
            <a href="#how-it-works" className="text-sm font-bold text-ink/70 hover:text-primary transition-colors">
              How it works
            </a>
            <NextLink href="/login" className="text-sm font-bold text-ink/70 hover:text-primary transition-colors">
              Sign in
            </NextLink>
          </div>
        </div>

        <NextLink
          href="/signup"
          className="bg-aubergine text-white rounded-full px-6 py-3 font-bold text-sm hover:bg-aubergine/90 transition-colors shadow-lg shadow-aubergine/20"
        >
          Get started →
        </NextLink>
      </div>
    </nav>
  )
}
