import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { QueryClientProvider } from "@tanstack/react-query"
import { queryClient } from "./lib/queryClient"
import { AuthProvider } from "./contexts/AuthContext"
import RequireAuth from "./components/RequireAuth"
import Landing from "./pages/Landing"
import Login from "./pages/Login"
import Signup from "./pages/Signup"
import ResetPassword from "./pages/ResetPassword"
import Contact from "./pages/Contact"
import Dashboard from "./pages/freelancer/Dashboard"
import SavedJobs from "./pages/freelancer/SavedJobs"
import Proposals from "./pages/freelancer/Proposals"
import FreelancerProfile from "./pages/freelancer/Profile"
import Identity from "./pages/freelancer/Identity"
import Settings from "./pages/freelancer/Settings"
import Tutorial from "./pages/freelancer/Tutorial"
import SupportContact from "./pages/freelancer/SupportContact"
import Policy from "./pages/freelancer/Policy"
import AgencyDashboard from "./pages/agency/Dashboard"
import Marketplace from "./pages/freelancer/Marketplace"
import AgencyProfile from "./pages/agency/Profile"
import AgencySettings from "./pages/agency/Settings"
import AgencyTutorial from "./pages/agency/Tutorial"
import AgencyPosts from "./pages/agency/Posts"
import FindFreelancers from "./pages/agency/FindFreelancers"
import Bizpal from "./pages/freelancer/Bizpal"
import Messages from "./pages/shared/Messages"
import AdminLogin from "./pages/admin/Login"
import AdminDashboard from "./pages/admin/Dashboard"
import AdminUsers from "./pages/admin/Users"
import AdminJobs from "./pages/admin/Jobs"
import AdminAuditLog from "./pages/admin/AuditLog"
import AdminCredits from "./pages/admin/Credits"
import AdminInfluencers from "./pages/admin/Influencers"
import AdminTransactions from "./pages/admin/Transactions"
import AdminAnalytics from "./pages/admin/Analytics"
import AdminDisputes from "./pages/admin/Disputes"
import FundedJobs from "./pages/freelancer/FundedJobs"
import AgencyWallet from "./pages/agency/Wallet"
import EscrowReturn from "./pages/agency/EscrowReturn"
import Workspace from "./pages/shared/Workspace"
import PortalLayout from "./components/portal/PortalLayout"
import DisputeRoom from "./pages/shared/DisputeRoom"
import InfluencerDashboard from "./pages/influencer/Dashboard"
import InfluencerReferrals from "./pages/influencer/Referrals"
import InfluencerEarnings from "./pages/influencer/Earnings"

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            {/* Legacy recovery-email target; kept so already-sent reset links still land here. */}
            <Route path="/freelancer/reset-password" element={<ResetPassword />} />
            <Route path="/contact" element={<Contact />} />
            {/* /agency/* and /freelancer/*: shared portal shell (sidebar + top bar), auth-guarded once. */}
            <Route element={<PortalLayout />}>
              <Route path="/freelancer/dashboard" element={<Dashboard />} />
              <Route path="/freelancer/marketplace" element={<Marketplace />} />
              <Route path="/freelancer/saved-jobs" element={<SavedJobs />} />
              <Route path="/freelancer/proposals" element={<Proposals />} />
              <Route path="/freelancer/profile" element={<FreelancerProfile />} />
              <Route path="/freelancer/identity" element={<Identity />} />
              <Route path="/freelancer/settings" element={<Settings />} />
              <Route path="/freelancer/tutorial" element={<Tutorial />} />
              <Route path="/freelancer/contact" element={<SupportContact />} />
              <Route path="/freelancer/policy" element={<Policy />} />
              <Route path="/agency/dashboard" element={<AgencyDashboard />} />
              <Route path="/agency/profile" element={<AgencyProfile />} />
              <Route path="/agency/settings" element={<AgencySettings />} />
              <Route path="/agency/tutorial" element={<AgencyTutorial />} />
              <Route path="/agency/posts" element={<AgencyPosts />} />
              <Route path="/agency/find-freelancers" element={<FindFreelancers />} />
              <Route path="/freelancer/bizpal" element={<Bizpal />} />
              <Route path="/freelancer/messages" element={<Messages />} />
              <Route path="/agency/messages" element={<Messages />} />
              <Route path="/freelancer/funded-jobs" element={<FundedJobs />} />
              <Route path="/agency/wallet" element={<AgencyWallet />} />
              <Route path="/agency/escrow/return" element={<EscrowReturn />} />
              <Route path="/agency/contact" element={<SupportContact />} />
            </Route>
            <Route
              path="/influencer/dashboard"
              element={
                <RequireAuth>
                  <InfluencerDashboard />
                </RequireAuth>
              }
            />
            <Route
              path="/influencer/referrals"
              element={
                <RequireAuth>
                  <InfluencerReferrals />
                </RequireAuth>
              }
            />
            <Route
              path="/influencer/earnings"
              element={
                <RequireAuth>
                  <InfluencerEarnings />
                </RequireAuth>
              }
            />
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route
              path="/admin/dashboard"
              element={
                <RequireAuth>
                  <AdminDashboard />
                </RequireAuth>
              }
            />
            <Route
              path="/admin/users"
              element={
                <RequireAuth>
                  <AdminUsers />
                </RequireAuth>
              }
            />
            <Route
              path="/admin/jobs"
              element={
                <RequireAuth>
                  <AdminJobs />
                </RequireAuth>
              }
            />
            <Route
              path="/admin/audit"
              element={
                <RequireAuth>
                  <AdminAuditLog />
                </RequireAuth>
              }
            />
            <Route
              path="/admin/credits"
              element={
                <RequireAuth>
                  <AdminCredits />
                </RequireAuth>
              }
            />
            <Route
              path="/admin/influencers"
              element={
                <RequireAuth>
                  <AdminInfluencers />
                </RequireAuth>
              }
            />
            <Route
              path="/workspace/:jobId"
              element={
                <RequireAuth>
                  <Workspace />
                </RequireAuth>
              }
            />
            <Route
              path="/disputes/:id"
              element={
                <RequireAuth>
                  <DisputeRoom />
                </RequireAuth>
              }
            />
            <Route
              path="/admin/transactions"
              element={
                <RequireAuth>
                  <AdminTransactions />
                </RequireAuth>
              }
            />
            <Route
              path="/admin/analytics"
              element={
                <RequireAuth>
                  <AdminAnalytics />
                </RequireAuth>
              }
            />
            <Route
              path="/admin/disputes"
              element={
                <RequireAuth>
                  <AdminDisputes />
                </RequireAuth>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}
