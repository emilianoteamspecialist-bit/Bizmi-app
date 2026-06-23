"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { MoreVertical } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { AdminSidebar } from "@/components/admin-sidebar"
import Link from "next/link"

interface User {
  id: string
  email: string
  full_name: string
  account_type: string
  created_at: string
  wallet_balance?: number
}

interface UsersClientProps {
  initialAgencies: User[]
  initialFreelancers: User[]
}

export default function UsersClient({ initialAgencies, initialFreelancers }: UsersClientProps) {
  const [agencies, setAgencies] = useState<User[]>(initialAgencies)
  const [freelancers, setFreelancers] = useState<User[]>(initialFreelancers)
  const [loading, setLoading] = useState(false)

  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null)

  const handleSetDisabled = async (userId: string, disabled: boolean) => {
    const action = disabled ? "disable" : "enable"
    if (!confirm(`Are you sure you want to ${action} this user?`)) return

    setUpdatingUserId(userId)
    try {
      const res = await fetch(`/api/admin/users/${userId}/disable`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ disabled }),
      })
      const data = await res.json()
      if (!res.ok) {
        alert(data.error || `Failed to ${action} user`)
        return
      }
      alert(`User ${disabled ? "disabled" : "enabled"} successfully.`)
    } catch (error) {
      console.error(`Error trying to ${action} user:`, error)
      alert(`Failed to ${action} user.`)
    } finally {
      setUpdatingUserId(null)
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
                    <Link
                      href={`/admin/users/${user.id}`}
                      className="font-medium hover:text-primary hover:underline"
                    >
                      {user.full_name || "No name"}
                    </Link>
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
                  <DropdownMenuItem asChild>
                    <Link href={`/admin/users/${user.id}`}>View details</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleSetDisabled(user.id, true)}
                    disabled={updatingUserId === user.id}
                    className="text-red-600"
                  >
                    Disable User
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleSetDisabled(user.id, false)}
                    disabled={updatingUserId === user.id}
                  >
                    Enable User
                  </DropdownMenuItem>
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
