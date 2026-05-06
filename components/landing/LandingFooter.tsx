import NextLink from "next/link"
import { Globe, MessageCircle, ArrowUpRight } from "lucide-react"

export function LandingFooter() {
  return (
    <footer className="bg-cream border-t border-aubergine/10 py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-12">
        <div className="col-span-2 space-y-6">
          <NextLink href="/" className="flex items-center space-x-2">
            <div className="w-10 h-10 bg-aubergine rounded-xl flex items-center justify-center shadow-lg shadow-aubergine/20">
              <span className="text-gold font-black text-xl font-heading">B</span>
            </div>
            <span className="text-2xl font-black tracking-tight text-ink font-heading">Bizimi</span>
          </NextLink>
          <p className="text-ink/60 font-medium max-w-xs leading-relaxed">
            Nigeria&apos;s premier marketplace for elite freelancers and forward-thinking agencies.
          </p>
          <div className="flex gap-3">
            <div className="w-11 h-11 rounded-full bg-white border border-aubergine/10 flex items-center justify-center text-ink/60 hover:bg-aubergine hover:text-white hover:border-aubergine transition-all cursor-pointer">
              <Globe className="h-5 w-5" />
            </div>
            <div className="w-11 h-11 rounded-full bg-white border border-aubergine/10 flex items-center justify-center text-ink/60 hover:bg-aubergine hover:text-white hover:border-aubergine transition-all cursor-pointer">
              <MessageCircle className="h-5 w-5" />
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <h4 className="font-black text-ink uppercase tracking-widest text-xs">Categories</h4>
          <div className="space-y-3 font-bold text-sm">
            <NextLink href="#" className="block text-ink/60 hover:text-primary transition-colors">Programming</NextLink>
            <NextLink href="#" className="block text-ink/60 hover:text-primary transition-colors">Design</NextLink>
            <NextLink href="#" className="block text-ink/60 hover:text-primary transition-colors">Writing</NextLink>
            <NextLink href="#" className="block text-ink/60 hover:text-primary transition-colors">Marketing</NextLink>
          </div>
        </div>

        <div className="space-y-6">
          <h4 className="font-black text-ink uppercase tracking-widest text-xs">Company</h4>
          <div className="space-y-3 font-bold text-sm">
            <NextLink href="#" className="block text-ink/60 hover:text-primary transition-colors">About Us</NextLink>
            <NextLink href="#" className="block text-ink/60 hover:text-primary transition-colors">Careers</NextLink>
            <NextLink href="#" className="block text-ink/60 hover:text-primary transition-colors">Terms</NextLink>
            <NextLink href="#" className="block text-ink/60 hover:text-primary transition-colors">Privacy</NextLink>
          </div>
        </div>

        <div className="col-span-2 bg-white p-8 rounded-3xl border border-aubergine/10 space-y-5">
          <h4 className="font-black text-ink uppercase tracking-widest text-xs">Newsletter</h4>
          <p className="text-sm font-medium text-ink/60 leading-relaxed">
            Get the latest project opportunities and platform updates.
          </p>
          <div className="flex gap-2">
            <input
              type="email"
              className="flex-1 bg-cream border-none rounded-xl px-4 text-sm font-bold focus:ring-2 focus:ring-aubergine/20 outline-none h-11"
              placeholder="Email address"
            />
            <button
              type="button"
              className="bg-aubergine text-white rounded-xl px-4 h-11 flex items-center justify-center hover:bg-aubergine/90 transition-colors"
              aria-label="Subscribe"
            >
              <ArrowUpRight className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-16 pt-8 border-t border-aubergine/10 text-center">
        <p className="text-sm font-bold text-ink/50">
          © {new Date().getFullYear()} Bizimi. All rights reserved. Built for the Nigerian creator economy.
        </p>
      </div>
    </footer>
  )
}
