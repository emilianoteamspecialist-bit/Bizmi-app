import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { DashboardTopBar } from "@/components/dashboard-topbar"
import { PageTransition } from "@/components/page-transition"
import { ReferralSync } from "@/components/referral-sync"

export default function FreelancerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <SidebarProvider>
      <ReferralSync />
      <AppSidebar />
      <SidebarInset>
        <DashboardTopBar />
        <PageTransition>{children}</PageTransition>
      </SidebarInset>
    </SidebarProvider>
  )
}
