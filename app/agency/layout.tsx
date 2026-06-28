import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { DashboardTopBar } from "@/components/dashboard-topbar"
import { PageTransition } from "@/components/page-transition"

export default function AgencyLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <DashboardTopBar />
        <PageTransition>{children}</PageTransition>
      </SidebarInset>
    </SidebarProvider>
  )
}
