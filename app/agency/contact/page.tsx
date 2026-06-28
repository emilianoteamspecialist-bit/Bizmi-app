"use client"

import { Mail, MessageCircle, Instagram, Facebook } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Reveal } from "@/components/reveal"

export default function FreelancerContactPage() {
  const handleEmailClick = () => {
    window.open("mailto:contact@bizimii.com", "_blank")
  }

  const handleWhatsAppClick = (phoneNumber: string, name: string) => {
    const message = encodeURIComponent(`Hello ${name}, I need assistance with Bizimi platform.`)
    window.open(`https://wa.me/${phoneNumber}?text=${message}`, "_blank")
  }

  const handleSocialClick = (url: string) => {
    window.open(url, "_blank")
  }

  const channels = [
    {
      icon: Mail,
      title: "Email support",
      desc: "Send us an email and we'll get back within 24 hours.",
      action: "Email us",
      onClick: handleEmailClick,
      meta: "contact@bizimii.com",
    },
    {
      icon: MessageCircle,
      title: "WhatsApp support",
      desc: "Chat with us for immediate assistance.",
      action: "Chat with us",
      onClick: () => handleWhatsAppClick("+2347026875518", "Support"),
      meta: "+234 702 687 5518",
    },
    {
      icon: MessageCircle,
      title: "Join community",
      desc: "Connect with other freelancers and agencies.",
      action: "Join community",
      onClick: () => handleSocialClick("https://chat.whatsapp.com/H5yku22xKV35cAFDyinj6y?mode=ems_share_c"),
      meta: "WhatsApp group",
    },
  ]

  return (
    <div className="min-h-screen bg-surface pb-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Header */}
        <header className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Support</p>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Contact &amp; support</h1>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Need help or have questions? Reach us through any of the channels below — we&apos;re happy to assist.
          </p>
        </header>

        {/* Contact channels */}
        <Reveal>
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {channels.map((c) => (
            <div key={c.title} className="rounded-xl border border-border bg-card p-6 text-center">
              <div className="mx-auto h-12 w-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <c.icon className="h-6 w-6" />
              </div>
              <h3 className="mt-4 text-sm font-semibold text-foreground">{c.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{c.desc}</p>
              <Button onClick={c.onClick} className="w-full gap-2 mt-4">
                <c.icon className="h-4 w-4" />
                {c.action}
              </Button>
              <p className="mt-2 text-xs text-muted-foreground">{c.meta}</p>
            </div>
          ))}
        </section>
        </Reveal>

        {/* Social */}
        <Reveal>
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-base font-semibold text-foreground text-center">Follow us on social media</h2>
          <div className="mt-5 flex flex-col sm:flex-row justify-center gap-3">
            <Button
              variant="outline"
              className="gap-2 w-full sm:w-auto"
              onClick={() => handleSocialClick("https://www.instagram.com/bizimisocials12?igsh=cDNsNzNwd3h0ejI5")}
            >
              <Instagram className="h-4 w-4" />
              Instagram
            </Button>
            <Button
              variant="outline"
              className="gap-2 w-full sm:w-auto"
              onClick={() => handleSocialClick("https://www.facebook.com/share/15CBRyPXjGf/")}
            >
              <Facebook className="h-4 w-4" />
              Facebook
            </Button>
            <Button
              variant="outline"
              className="gap-2 w-full sm:w-auto"
              onClick={() => handleSocialClick("https://www.tiktok.com/@bizimi0?_t=ZM-8zAXJDSR2d3&_r=1")}
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
              </svg>
              TikTok
            </Button>
          </div>
        </div>
        </Reveal>

        {/* How we can help */}
        <Reveal>
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-base font-semibold text-foreground text-center">How we can help</h2>
          <div className="mt-5 grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-semibold text-primary mb-2">For freelancers</h3>
              <ul className="text-sm text-muted-foreground space-y-1.5 list-disc pl-5 marker:text-border">
                <li>Account setup and verification</li>
                <li>Proposal submission help</li>
                <li>Payment and payout assistance</li>
                <li>Profile optimization tips</li>
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-primary mb-2">For agencies</h3>
              <ul className="text-sm text-muted-foreground space-y-1.5 list-disc pl-5 marker:text-border">
                <li>Job posting guidance</li>
                <li>Freelancer selection process</li>
                <li>Payment and funding support</li>
                <li>Platform feature tutorials</li>
              </ul>
            </div>
          </div>
        </div>
        </Reveal>

        {/* Response time */}
        <p className="text-center text-sm text-muted-foreground">
          <strong className="font-medium text-foreground">Response times:</strong> Email within 24 hours · WhatsApp within 2 hours during business hours
        </p>
      </div>
    </div>
  )
}
