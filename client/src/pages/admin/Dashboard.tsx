import { useState } from "react"
import { Users, Briefcase, UserPlus, Shield, MoreVertical } from "lucide-react"
import AdminSidebar from "@/components/AdminSidebar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useAdminUsersQuery, type AdminUser } from "@/lib/queries/admin"

export default function AdminDashboard() {
  const usersQuery = useAdminUsersQuery()
  const [allSearchQuery, setAllSearchQuery] = useState("")
  const [agencySearchQuery, setAgencySearchQuery] = useState("")
  const [freelancerSearchQuery, setFreelancerSearchQuery] = useState("")

  const users = usersQuery.data?.users ?? []
  const agencies = users.filter((u) => u.account_type === "agency")
  const freelancers = users.filter((u) => u.account_type === "freelancer")

  const todayString = new Date().toISOString().split("T")[0]
  const newUsersToday = users.filter((u) => u.created_at && new Date(u.created_at).toISOString().split("T")[0] === todayString).length

  const tiles = [
    { label: "Total users", testId: "stat-total-users", value: users.length, icon: Users, tile: "bg-primary/10 text-primary" },
    { label: "New today", testId: "stat-new-today", value: newUsersToday, icon: UserPlus, tile: "bg-jade/10 text-jade" },
    { label: "Agencies", testId: "stat-agencies", value: agencies.length, icon: Briefcase, tile: "bg-info/10 text-info" },
    { label: "Freelancers", testId: "stat-freelancers", value: freelancers.length, icon: Users, tile: "bg-aubergine/10 text-aubergine" },
  ]

  // Legacy stub -- disabling a user from the dashboard is not yet wired to a
  // real mutation there (AdminUsers has the functional version). Preserve as-is.
  const handleDisableUser = (userId: string) => {
    console.log("Disabling user:", userId)
  }

  const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString()

  function UserTable({ users, type, searchQuery }: { users: AdminUser[]; type: string; searchQuery: string }) {
    const filtered = users.filter(
      (user) =>
        user.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.email?.toLowerCase().includes(searchQuery.toLowerCase())
    )

    if (filtered.length === 0) {
      return <div className="rounded-xl border border-border bg-card py-12 text-center text-sm text-muted-foreground">No {type === "all" ? "users" : `${type}s`} found</div>
    }

    return (
      <div className="rounded-xl border border-border bg-card divide-y divide-border overflow-hidden">
        {filtered.map((user) => (
          <div key={user.id} className="flex items-center justify-between gap-3 p-4 transition-colors hover:bg-surface/60">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-9 w-9 shrink-0 rounded-full bg-surface-2 flex items-center justify-center text-sm font-semibold text-foreground">
                {(user.full_name || user.email || "?").charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-medium text-foreground truncate">{user.full_name || "No name"}</h3>
                  <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-primary-soft text-primary capitalize">
                    {user.account_type}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground tabular-nums">
                  Joined {formatDate(user.created_at)}
                  {user.account_type === "agency" && user.wallet_balance != null && ` · Wallet ₦${user.wallet_balance.toLocaleString()}`}
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
                <DropdownMenuItem
                  onClick={() => handleDisableUser(user.id)}
                  className="text-destructive focus:text-destructive focus:bg-destructive/10"
                >
                  Disable user
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ))}
      </div>
    )
  }

  if (usersQuery.isLoading) {
    return (
      <div className="flex h-screen bg-surface">
        <AdminSidebar />
        <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">Loading dashboard…</div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-surface">
      <AdminSidebar />
      <div className="flex-1 overflow-auto">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
          <header className="space-y-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-foreground">
              <Shield className="h-3.5 w-3.5 text-primary" /> Admin console
            </span>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">Dashboard</h1>
              <p className="text-sm text-muted-foreground">Overview of platform activity.</p>
            </div>
          </header>

          <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {tiles.map((t) => (
              <div key={t.label} data-testid={t.testId} className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-muted-foreground">{t.label}</p>
                  <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${t.tile}`}>
                    <t.icon className="h-4 w-4" />
                  </div>
                </div>
                <p className="mt-3 text-3xl font-semibold tracking-tight text-foreground tabular-nums">{t.value}</p>
              </div>
            ))}
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-foreground">User management</h2>
            <Tabs defaultValue="all" className="w-full">
              <TabsList className="grid w-full grid-cols-3 sm:max-w-lg">
                <TabsTrigger value="all">All ({users.length})</TabsTrigger>
                <TabsTrigger value="agencies">Agencies ({agencies.length})</TabsTrigger>
                <TabsTrigger value="freelancers">Freelancers ({freelancers.length})</TabsTrigger>
              </TabsList>

              <TabsContent value="all" className="mt-4 space-y-3">
                <Input
                  placeholder="Search all users by name or email…"
                  value={allSearchQuery}
                  onChange={(e) => setAllSearchQuery(e.target.value)}
                  className="sm:max-w-sm"
                />
                <UserTable users={users} type="all" searchQuery={allSearchQuery} />
              </TabsContent>

              <TabsContent value="agencies" className="mt-4 space-y-3">
                <Input
                  placeholder="Search agencies by name or email…"
                  value={agencySearchQuery}
                  onChange={(e) => setAgencySearchQuery(e.target.value)}
                  className="sm:max-w-sm"
                />
                <UserTable users={agencies} type="agency" searchQuery={agencySearchQuery} />
              </TabsContent>

              <TabsContent value="freelancers" className="mt-4 space-y-3">
                <Input
                  placeholder="Search freelancers by name or email…"
                  value={freelancerSearchQuery}
                  onChange={(e) => setFreelancerSearchQuery(e.target.value)}
                  className="sm:max-w-sm"
                />
                <UserTable users={freelancers} type="freelancer" searchQuery={freelancerSearchQuery} />
              </TabsContent>
            </Tabs>
          </section>
        </div>
      </div>
    </div>
  )
}
