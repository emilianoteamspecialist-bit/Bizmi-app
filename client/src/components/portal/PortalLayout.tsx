import { Outlet } from "react-router-dom"
import RequireAuth from "../RequireAuth"
import ReferralSync from "../ReferralSync"
import { MarketplaceHeader } from "../marketplace/MarketplaceHeader"
import { PageTransition } from "./PageTransition"

// Shell for every /agency/* and /freelancer/* page: the sticky marketplace
// header, a page fade, and the referral sync. Used as a pathless layout route
// in App.tsx, so the auth guard lives here once.
export default function PortalLayout() {
  return (
    <RequireAuth>
      <ReferralSync />
      <div className="min-h-screen bg-surface">
        <MarketplaceHeader />
        <main id="main">
          <PageTransition>
            <Outlet />
          </PageTransition>
        </main>
      </div>
    </RequireAuth>
  )
}
