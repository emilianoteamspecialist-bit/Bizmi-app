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
            <Route
              path="/freelancer/dashboard"
              element={
                <RequireAuth>
                  <Dashboard />
                </RequireAuth>
              }
            />
            <Route path="/freelancer/marketplace" element={<RequireAuth><Marketplace /></RequireAuth>} />
            <Route
              path="/freelancer/saved-jobs"
              element={
                <RequireAuth>
                  <SavedJobs />
                </RequireAuth>
              }
            />
            <Route
              path="/freelancer/proposals"
              element={
                <RequireAuth>
                  <Proposals />
                </RequireAuth>
              }
            />
            <Route
              path="/freelancer/profile"
              element={
                <RequireAuth>
                  <FreelancerProfile />
                </RequireAuth>
              }
            />
            <Route
              path="/freelancer/identity"
              element={
                <RequireAuth>
                  <Identity />
                </RequireAuth>
              }
            />
            <Route
              path="/freelancer/settings"
              element={
                <RequireAuth>
                  <Settings />
                </RequireAuth>
              }
            />
            <Route
              path="/freelancer/tutorial"
              element={
                <RequireAuth>
                  <Tutorial />
                </RequireAuth>
              }
            />
            <Route
              path="/freelancer/contact"
              element={
                <RequireAuth>
                  <SupportContact />
                </RequireAuth>
              }
            />
            <Route
              path="/freelancer/policy"
              element={
                <RequireAuth>
                  <Policy />
                </RequireAuth>
              }
            />
            <Route
              path="/agency/dashboard"
              element={
                <RequireAuth>
                  <AgencyDashboard />
                </RequireAuth>
              }
            />
            <Route
              path="/agency/profile"
              element={
                <RequireAuth>
                  <AgencyProfile />
                </RequireAuth>
              }
            />
            <Route
              path="/agency/settings"
              element={
                <RequireAuth>
                  <AgencySettings />
                </RequireAuth>
              }
            />
            <Route
              path="/agency/tutorial"
              element={
                <RequireAuth>
                  <AgencyTutorial />
                </RequireAuth>
              }
            />
            <Route
              path="/agency/posts"
              element={
                <RequireAuth>
                  <AgencyPosts />
                </RequireAuth>
              }
            />
            <Route
              path="/agency/find-freelancers"
              element={
                <RequireAuth>
                  <FindFreelancers />
                </RequireAuth>
              }
            />
            <Route
              path="/freelancer/bizpal"
              element={
                <RequireAuth>
                  <Bizpal />
                </RequireAuth>
              }
            />
            <Route
              path="/freelancer/messages"
              element={
                <RequireAuth>
                  <Messages />
                </RequireAuth>
              }
            />
            <Route
              path="/agency/messages"
              element={
                <RequireAuth>
                  <Messages />
                </RequireAuth>
              }
            />
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
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}
