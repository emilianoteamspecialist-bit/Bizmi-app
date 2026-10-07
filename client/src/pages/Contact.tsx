import { Link } from "react-router-dom"
import { Mail, MessageCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { AuthLogo } from "@/components/marketplace/AuthShell"
import { PageContainer, Panel } from "@/components/marketplace/primitives"

const getWhatsAppHref = (phoneNumber: string, name: string) => {
  const message = encodeURIComponent(`Hello ${name}, I need assistance with Bizimi platform.`)
  return `https://wa.me/${phoneNumber}?text=${message}`
}

const CHANNELS = [
  {
    icon: Mail,
    title: "Email support",
    desc: "We reply within 24 hours.",
    href: "mailto:bizimi@gmail.com",
    action: "Email us",
    meta: "bizimi@gmail.com",
  },
  {
    icon: MessageCircle,
    title: "WhatsApp: Mubarack",
    desc: "General help and account questions.",
    href: getWhatsAppHref("2347052345295", "Mubarack"),
    action: "Chat with Mubarack",
    meta: "+234 705 234 5295",
  },
  {
    icon: MessageCircle,
    title: "WhatsApp: Emiliano",
    desc: "Technical support.",
    href: getWhatsAppHref("2347052345296", "Emiliano"),
    action: "Chat with Emiliano",
    meta: "+234 705 234 5296",
  },
]

const HELP = {
  "For freelancers": ["Account setup and identity verification", "Sending bids", "Payments and payouts", "Making your profile stand out"],
  "For agencies": ["Posting a job", "Choosing a freelancer", "Funding a job through escrow", "Getting around the platform"],
}

export default function Contact() {
  return (
    <div className="min-h-screen bg-surface">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <AuthLogo />
          <Link to="/login" className="text-sm font-medium text-primary hover:underline">
            Sign in
          </Link>
        </div>
      </header>

      <PageContainer>
        <div className="max-w-2xl">
          <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Contact us</h1>
          <p className="mt-2 text-sm text-muted-foreground sm:text-base">Questions about an account, a job or a payment? Reach us on any of these.</p>
        </div>

        <ul className="mt-8 grid gap-4 md:grid-cols-3">
          {CHANNELS.map((c) => (
            <li key={c.title} className="flex flex-col rounded-lg border border-border bg-card p-5">
              <span className="flex h-9 w-9 items-center justify-center rounded-md bg-surface-2 text-foreground">
                <c.icon className="h-4 w-4" aria-hidden />
              </span>
              <h2 className="mt-3 text-sm font-semibold text-foreground">{c.title}</h2>
              <p className="mt-0.5 flex-1 text-sm text-muted-foreground">{c.desc}</p>
              <p className="mt-3 text-sm tabular-nums text-foreground">{c.meta}</p>
              <Button asChild variant="outline" className="mt-3 w-full">
                <a href={c.href} target="_blank" rel="noopener noreferrer">
                  <c.icon /> {c.action}
                </a>
              </Button>
            </li>
          ))}
        </ul>

        <Panel title="What we can help with" className="mt-6">
          <div className="grid gap-6 sm:grid-cols-2">
            {Object.entries(HELP).map(([group, items]) => (
              <div key={group}>
                <h3 className="text-sm font-semibold text-foreground">{group}</h3>
                <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
                  {items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Panel>

        <p className="mt-6 text-sm text-muted-foreground">Email replies within 24 hours. WhatsApp replies within 2 hours during business hours.</p>
      </PageContainer>
    </div>
  )
}
