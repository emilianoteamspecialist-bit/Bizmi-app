import { Outlet } from "react-router-dom"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import RequireAuth from "../RequireAuth"
import ReferralSync from "../ReferralSync"
import { AppSidebar } from "./AppSidebar"
import { DashboardTopBar } from "./DashboardTopBar"
import { PageTransition } from "./PageTransition"

// Shell for every /agency/* and /freelancer/* page -- the SPA counterpart of
// the Next.js app's app/agency/layout.tsx and app/freelancer/layout.tsx
// (sidebar + top bar + page fade, and the referral sync). Used as a pathless
// layout route in App.tsx, so the auth guard lives here once.
export default function PortalLayout() {
  return (
    <RequireAuth>
      <SidebarProvider>
        <ReferralSync />
        <AppSidebar />
        <SidebarInset>
          <DashboardTopBar />
          <PageTransition>
            <Outlet />
          </PageTransition>
        </SidebarInset>
      </SidebarProvider>
    </RequireAuth>
  )
}
