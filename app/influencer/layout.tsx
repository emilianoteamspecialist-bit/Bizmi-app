import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/auth"
import { createClient } from "@/lib/supabase-server"
import { runReferralSync } from "@/lib/influencer-sync"
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import { InfluencerSidebar } from "@/components/influencer-sidebar"
import { PageTransition } from "@/components/page-transition"

export default async function InfluencerLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()
  if (!user) redirect("/login")

  // Keep the area for influencers; send other known roles to their own home.
  const supabase = await createClient()
  const { data: profile } = await supabase.from("profiles").select("account_type").eq("id", user.id).maybeSingle()
  const type = (profile as any)?.account_type
  if (type && type !== "influencer") {
    redirect(type === "agency" ? "/agency/dashboard" : type === "admin" ? "/admin/dashboard" : "/freelancer/dashboard")
  }

  // Ensure the influencer profile + referral code exist (and attribute any
  // referral) before the page renders, so the dashboard shows the link first paint.
  await runReferralSync()

  return (
    <SidebarProvider>
      <InfluencerSidebar />
      <SidebarInset>
        <header className="sticky top-0 z-30 h-16 bg-card border-b border-border flex items-center gap-3 px-4 sm:px-6">
          <SidebarTrigger className="-ml-1 text-muted-foreground hover:text-foreground" />
          <span className="text-sm font-semibold text-foreground">Influencer program</span>
        </header>
        <PageTransition>{children}</PageTransition>
      </SidebarInset>
    </SidebarProvider>
  )
}
