"use client"

import { useEffect, useState } from "react"
import NextLink from "next/link"
import { Menu, X } from "lucide-react"

const links = [
  { href: "#how-it-works", label: "Hire talent" },
  { href: "#for-freelancers", label: "Find work" },
  { href: "#how-it-works", label: "How it works" },
]

export function Nav() {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  return (
    <nav
      className={`fixed top-0 w-full z-50 transition-all duration-300 ${
        scrolled || open
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
            {links.map((l) => (
              <a
                key={l.label}
                href={l.href}
                className="text-sm font-bold text-ink/70 hover:text-primary transition-colors"
              >
                {l.label}
              </a>
            ))}
            <NextLink href="/login" className="text-sm font-bold text-ink/70 hover:text-primary transition-colors">
              Sign in
            </NextLink>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <NextLink
            href="/signup"
            className="hidden md:inline-flex bg-aubergine text-white rounded-full px-5 py-2.5 sm:px-6 sm:py-3 font-bold text-sm hover:bg-aubergine/90 transition-colors shadow-lg shadow-aubergine/20"
          >
            Get started →
          </NextLink>

          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label="Toggle menu"
            aria-expanded={open}
            className="md:hidden inline-flex items-center justify-center w-11 h-11 rounded-xl bg-aubergine text-white hover:bg-aubergine/90 transition-colors shadow-lg shadow-aubergine/20"
          >
            {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden mx-4 mt-3 rounded-2xl border border-aubergine/10 bg-cream/95 backdrop-blur-md shadow-lg p-2">
          {links.map((l) => (
            <a
              key={l.label}
              href={l.href}
              onClick={() => setOpen(false)}
              className="block rounded-xl px-4 py-3 text-sm font-bold text-ink/80 hover:bg-aubergine/5 hover:text-primary transition-colors"
            >
              {l.label}
            </a>
          ))}
          <NextLink
            href="/login"
            onClick={() => setOpen(false)}
            className="block rounded-xl px-4 py-3 text-sm font-bold text-ink/80 hover:bg-aubergine/5 hover:text-primary transition-colors"
          >
            Sign in
          </NextLink>
          <NextLink
            href="/signup"
            onClick={() => setOpen(false)}
            className="mt-1 block rounded-xl bg-aubergine px-4 py-3 text-center text-sm font-bold text-white hover:bg-aubergine/90 transition-colors"
          >
            Get started →
          </NextLink>
        </div>
      )}
    </nav>
  )
}
