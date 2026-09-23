import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { QueryClientProvider } from "@tanstack/react-query"
import { queryClient } from "./lib/queryClient"
import { AuthProvider } from "./contexts/AuthContext"
import RequireAuth from "./components/RequireAuth"
import Landing from "./pages/Landing"
import Login from "./pages/Login"
import Signup from "./pages/Signup"
import Dashboard from "./pages/freelancer/Dashboard"
import SavedJobs from "./pages/freelancer/SavedJobs"
import Proposals from "./pages/freelancer/Proposals"
import FreelancerProfile from "./pages/freelancer/Profile"
import AgencyDashboard from "./pages/agency/Dashboard"
import Marketplace from "./pages/freelancer/Marketplace"
import AgencyProfile from "./pages/agency/Profile"
import FindFreelancers from "./pages/agency/FindFreelancers"
import Bizpal from "./pages/freelancer/Bizpal"
import Messages from "./pages/shared/Messages"
import AdminLogin from "./pages/admin/Login"

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
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
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}
