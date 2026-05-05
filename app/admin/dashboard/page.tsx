"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, Briefcase } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { AdminSidebar } from "@/components/admin-sidebar"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { MoreVertical } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"

interface DashboardStats {
  totalUsers: number
  newUsersToday: number
  totalAgencies: number
  totalFreelancers: number
}

interface User {
  id: string
  email: string
  full_name: string
  account_type: string
  created_at: string
  wallet_balance?: number
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    newUsersToday: 0,
    totalAgencies: 0,
    totalFreelancers: 0,
  })
  const [agencies, setAgencies] = useState<User[]>([])
  const [freelancers, setFreelancers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [agencySearchQuery, setAgencySearchQuery] = useState("")
  const [freelancerSearchQuery, setFreelancerSearchQuery] = useState("")

  useEffect(() => {
    loadDashboardData()
  }, [])

  const loadDashboardData = async () => {
    try {
      console.log("Loading dashboard data...")

      // Get ALL users from profiles table
      const { data: allUsers, error: usersError } = await supabase
        .from("profiles")
        .select("id, email, full_name, account_type, created_at, wallet_balance")

      console.log("All users from profiles:", allUsers)
      console.log("Users error:", usersError)

      if (usersError) {
        console.error("Error fetching users:", usersError)
        throw usersError
      }

      const users = allUsers || []
      console.log("Total users found:", users.length)

      // Log all unique account_types to see what we have
      const uniqueAccountTypes = [...new Set(users.map((user) => user.account_type))]
      console.log("Unique account types found:", uniqueAccountTypes)

      // Filter agencies and freelancers based on account_type
      const agencyUsers = users.filter((user) => user.account_type === "agency")
      const freelancerUsers = users.filter((user) => user.account_type === "freelancer")

      console.log("Agencies found:", agencyUsers.length, agencyUsers)
      console.log("Freelancers found:", freelancerUsers.length, freelancerUsers)

      // Get new users today
      const today = new Date()
      const todayString = today.toISOString().split("T")[0]
      console.log("Today's date:", todayString)

      const newUsersToday = users.filter((user) => {
        if (!user.created_at) return false
        const userDate = new Date(user.created_at).toISOString().split("T")[0]
        return userDate === todayString
      }).length

      console.log("New users today:", newUsersToday)

      // Update stats
      const newStats = {
        totalUsers: users.length,
        newUsersToday,
        totalAgencies: agencyUsers.length,
        totalFreelancers: freelancerUsers.length,
      }

      console.log("Setting stats:", newStats)
      setStats(newStats)
      setAgencies(agencyUsers)
      setFreelancers(freelancerUsers)
    } catch (error) {
      console.error("Error loading dashboard data:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleDisableUser = async (userId: string) => {
    try {
      console.log("Disabling user:", userId)
      // Add actual disable functionality later
    } catch (error) {
      console.error("Error disabling user:", error)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString()
  }

  const UserTable = ({ users, type, searchQuery }: { users: User[]; type: string; searchQuery: string }) => {
    const filteredUsers = users.filter(
      (user) =>
        user.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.email.toLowerCase().includes(searchQuery.toLowerCase()),
    )
    return (
      <div className="space-y-4">
        {filteredUsers.map((user) => (
          <Card key={user.id}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <div>
                      <h3 className="font-medium">{user.full_name || "No name"}</h3>
                      <p className="text-sm text-slate-600">{user.email}</p>
                    </div>
                    <Badge variant="outline" className="border-orange-200 text-primary">
                      {user.account_type}
                    </Badge>
                  </div>
                  <div className="mt-2 text-sm text-slate-500">
                    Joined: {formatDate(user.created_at)}
                    {type === "agency" && user.wallet_balance !== undefined && (
                      <span className="ml-4">Wallet: ₦ {user.wallet_balance.toLocaleString()}</span>
                    )}
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleDisableUser(user.id)}>Disable User</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </CardContent>
          </Card>
        ))}
        {filteredUsers.length === 0 && <div className="text-center py-8 text-slate-500">No {type}s found</div>}
      </div>
    )
  }

  if (loading) {
    return (
      <SidebarProvider>
        <AdminSidebar />
        <SidebarInset>
          <div className="p-4 lg:p-6">
            <div className="text-lg">Loading dashboard...</div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    )
  }

  return (
    <SidebarProvider>
      <AdminSidebar />
      <SidebarInset>
        <div className="p-4 lg:p-6">
          <div className="mb-6">
            <h1 className="text-2xl lg:text-primaryxl font-bold text-slate-900">Admin Dashboard</h1>
            <p className="text-slate-600">Overview of platform activity</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mb-6 lg:mb-8">
            <Card className="border-l-4 border-l-orange-500">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-slate-600">Total Users</CardTitle>
                <Users className="h-5 w-5 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-primary">{stats.totalUsers}</div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-green-500">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-slate-600">New Users Today</CardTitle>
                <Users className="h-5 w-5 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{stats.newUsersToday}</div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-blue-500">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-slate-600">Total Agencies</CardTitle>
                <Briefcase className="h-5 w-5 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">{stats.totalAgencies}</div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-purple-500">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-slate-600">Total Freelancers</CardTitle>
                <Users className="h-5 w-5 text-purple-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-purple-600">{stats.totalFreelancers}</div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="bg-primary/10 border-b">
              <CardTitle className="text-primary">User Management</CardTitle>
            </CardHeader>
            <CardContent className="p-4 lg:p-6 max-h-[60vh] overflow-y-auto">
              <Tabs defaultValue="agencies" className="w-full">
                <TabsList className="grid w-full grid-cols-2 bg-orange-100">
                  <TabsTrigger
                    value="agencies"
                    className="data-[state=active]:bg-primary data-[state=active]:text-white"
                  >
                    Agencies ({stats.totalAgencies})
                  </TabsTrigger>
                  <TabsTrigger
                    value="freelancers"
                    className="data-[state=active]:bg-primary data-[state=active]:text-white"
                  >
                    Freelancers ({stats.totalFreelancers})
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="agencies" className="mt-6">
                  <div className="mb-4">
                    <Input
                      placeholder="Search agencies by name or email..."
                      value={agencySearchQuery}
                      onChange={(e) => setAgencySearchQuery(e.target.value)}
                    />
                  </div>
                  <UserTable users={agencies} type="agency" searchQuery={agencySearchQuery} />
                </TabsContent>

                <TabsContent value="freelancers" className="mt-6">
                  <div className="mb-4">
                    <Input
                      placeholder="Search freelancers by name or email..."
                      value={freelancerSearchQuery}
                      onChange={(e) => setFreelancerSearchQuery(e.target.value)}
                    />
                  </div>
                  <UserTable users={freelancers} type="freelancer" searchQuery={freelancerSearchQuery} />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
