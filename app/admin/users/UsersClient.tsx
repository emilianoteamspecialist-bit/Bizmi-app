"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
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
  const [agencies] = useState<User[]>(initialAgencies)
  const [freelancers] = useState<User[]>(initialFreelancers)
  const [loading] = useState(false)
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null)

  const allUsers = [...agencies, ...freelancers].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  )

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

  const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString()

  const UserTable = ({ users, type }: { users: User[]; type: string }) => {
    if (users.length === 0) {
      return (
        <div className="rounded-xl border border-border bg-card py-12 text-center text-sm text-muted-foreground">
          No {type === "all" ? "users" : `${type}s`} found
        </div>
      )
    }
    return (
      <div className="rounded-xl border border-border bg-card divide-y divide-border overflow-hidden">
        {users.map((user) => (
          <div key={user.id} className="flex items-center justify-between gap-3 p-4 transition-colors hover:bg-surface/60">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-9 w-9 shrink-0 rounded-full bg-surface-2 flex items-center justify-center text-sm font-semibold text-foreground">
                {(user.full_name || user.email || "?").charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Link
                    href={`/admin/users/${user.id}`}
                    className="text-sm font-medium text-foreground truncate hover:text-primary hover:underline"
                  >
                    {user.full_name || "No name"}
                  </Link>
                  <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-primary-soft text-primary capitalize">
                    {user.account_type}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground tabular-nums">
                  Joined {formatDate(user.created_at)}
                  {user.account_type === "agency" && user.wallet_balance !== undefined && ` · Wallet ₦${user.wallet_balance.toLocaleString()}`}
                </p>
              </div>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
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
                  className="text-destructive focus:text-destructive focus:bg-destructive/10"
                >
                  Disable user
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleSetDisabled(user.id, false)}
                  disabled={updatingUserId === user.id}
                >
                  Enable user
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ))}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex h-screen bg-surface">
        <AdminSidebar />
        <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">Loading users…</div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-surface">
      <AdminSidebar />
      <div className="flex-1 overflow-auto">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
          {/* Header */}
          <header className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Admin</p>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">User management</h1>
            <p className="text-sm text-muted-foreground">Manage agencies and freelancers.</p>
          </header>

          <Tabs defaultValue="all" className="w-full">
            <TabsList className="grid w-full grid-cols-3 sm:max-w-lg">
              <TabsTrigger value="all">All ({allUsers.length})</TabsTrigger>
              <TabsTrigger value="agencies">Agencies ({agencies.length})</TabsTrigger>
              <TabsTrigger value="freelancers">Freelancers ({freelancers.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="mt-4">
              <UserTable users={allUsers} type="all" />
            </TabsContent>
            <TabsContent value="agencies" className="mt-4">
              <UserTable users={agencies} type="agency" />
            </TabsContent>
            <TabsContent value="freelancers" className="mt-4">
              <UserTable users={freelancers} type="freelancer" />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}
