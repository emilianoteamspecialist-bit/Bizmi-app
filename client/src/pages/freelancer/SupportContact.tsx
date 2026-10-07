import { Mail, MessageCircle, Instagram, Facebook } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PageContainer } from "@/components/marketplace/primitives"

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
    <PageContainer>
      <div className="space-y-6">
        {/* Header */}
        <header className="space-y-1">
          <h1 className="font-heading text-xl font-semibold tracking-tight text-foreground sm:text-2xl">Contact &amp; support</h1>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Questions about your account, a job or a payment? Reach us on any of these.
          </p>
        </header>

        {/* Contact channels */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {channels.map((c) => (
            <div key={c.title} className="flex flex-col rounded-lg border border-border bg-card p-5">
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-surface-2 text-foreground">
                <c.icon className="h-4 w-4" />
              </div>
              <h3 className="mt-3 text-sm font-semibold text-foreground">{c.title}</h3>
              <p className="mt-0.5 flex-1 text-sm text-muted-foreground">{c.desc}</p>
              <Button onClick={c.onClick} variant="outline" className="mt-4 w-full">
                <c.icon className="h-4 w-4" />
                {c.action}
              </Button>
              <p className="mt-2 text-xs text-muted-foreground">{c.meta}</p>
            </div>
          ))}
        </section>

        {/* Social */}
        <div className="rounded-lg border border-border bg-card p-5">
          <h2 className="text-sm font-semibold text-foreground">Follow us</h2>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
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

        {/* How we can help */}
        <div className="rounded-lg border border-border bg-card p-5">
          <h2 className="text-sm font-semibold text-foreground">How we can help</h2>
          <div className="mt-5 grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="mb-2 text-sm font-medium text-foreground">For freelancers</h3>
              <ul className="text-sm text-muted-foreground space-y-1.5 list-disc pl-5 marker:text-border">
                <li>Account setup and verification</li>
                <li>Proposal submission help</li>
                <li>Payment and payout assistance</li>
                <li>Profile optimization tips</li>
              </ul>
            </div>
            <div>
              <h3 className="mb-2 text-sm font-medium text-foreground">For agencies</h3>
              <ul className="text-sm text-muted-foreground space-y-1.5 list-disc pl-5 marker:text-border">
                <li>Job posting guidance</li>
                <li>Freelancer selection process</li>
                <li>Payment and funding support</li>
                <li>Platform feature tutorials</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Response time */}
        <p className="text-sm text-muted-foreground">
          <strong className="font-medium text-foreground">Response times:</strong> Email within 24 hours · WhatsApp within 2 hours during business hours
        </p>
      </div>
    </PageContainer>
  )
}
