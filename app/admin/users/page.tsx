"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { MoreVertical } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { supabase } from "@/lib/supabase"
import { AdminSidebar } from "@/components/admin-sidebar"

interface User {
  id: string
  email: string
  full_name: string
  account_type: string
  created_at: string
  wallet_balance?: number
}

export default function AdminUsers() {
  const [agencies, setAgencies] = useState<User[]>([])
  const [freelancers, setFreelancers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadUsers()
  }, [])

  const loadUsers = async () => {
    try {
      console.log("Loading users...")

      // Get ALL users from profiles table
      const { data: allUsers, error } = await supabase
        .from("profiles")
        .select("id, email, full_name, account_type, created_at, wallet_balance")
        .order("created_at", { ascending: false })

      console.log("All users from profiles:", allUsers)
      console.log("Users error:", error)

      if (error) {
        console.error("Error fetching users:", error)
        throw error
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

      setAgencies(agencyUsers)
      setFreelancers(freelancerUsers)
    } catch (error) {
      console.error("Error loading users:", error)
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

  const UserTable = ({ users, type }: { users: User[]; type: string }) => (
    <div className="space-y-4">
      {users.map((user) => (
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
      {users.length === 0 && <div className="text-center py-8 text-slate-500">No {type}s found</div>}
    </div>
  )

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <AdminSidebar />
        <div className="lg:pl-64">
          <div className="p-4 lg:p-6">
            <div className="text-lg">Loading users...</div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <AdminSidebar />
      <div className="lg:pl-64">
        <div className="p-4 lg:p-6">
          <div className="mb-6">
            <h1 className="text-2xl lg:text-primaryxl font-bold text-slate-900">User Management</h1>
            <p className="text-slate-600">Manage agencies and freelancers</p>
          </div>

          <Card>
            <CardHeader className="bg-primary/10 border-b">
              <CardTitle className="text-primary">All Users</CardTitle>
            </CardHeader>
            <CardContent className="p-4 lg:p-6">
              <Tabs defaultValue="agencies" className="w-full">
                <TabsList className="grid w-full grid-cols-2 bg-orange-100">
                  <TabsTrigger
                    value="agencies"
                    className="data-[state=active]:bg-primary data-[state=active]:text-white"
                  >
                    Agencies ({agencies.length})
                  </TabsTrigger>
                  <TabsTrigger
                    value="freelancers"
                    className="data-[state=active]:bg-primary data-[state=active]:text-white"
                  >
                    Freelancers ({freelancers.length})
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="agencies" className="mt-6">
                  <UserTable users={agencies} type="agency" />
                </TabsContent>

                <TabsContent value="freelancers" className="mt-6">
                  <UserTable users={freelancers} type="freelancer" />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
