"use client"

import { useState, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Loader2, Search, Coins, Users, Calendar, Hash, ArrowUpRight } from "lucide-react"
import AdminSidebar from "@/components/admin-sidebar"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

interface CreditPurchase {
  id: string
  freelancer_id?: string
  credits_amount: number
  paystack_reference: string
  status: string
  created_at: string
  updated_at: string
  profiles?: {
    full_name: string
  }
}

interface FreelancerProfile {
  id: string
  full_name: string
  created_at: string
  updated_at: string
  account_type: string
}

interface AdminCreditsClientProps {
  initialCreditPurchases: CreditPurchase[]
  initialFreelancers: FreelancerProfile[]
  initialTotalCredits: number
}

export default function AdminCreditsClient({
  initialCreditPurchases,
  initialFreelancers,
  initialTotalCredits,
}: AdminCreditsClientProps) {
  const [creditPurchases, setCreditPurchases] = useState<CreditPurchase[]>(initialCreditPurchases)
  const [freelancers, setFreelancers] = useState<FreelancerProfile[]>(initialFreelancers)
  const [filteredPurchases, setFilteredPurchases] = useState<CreditPurchase[]>(initialCreditPurchases)
  const [loading, setLoading] = useState(false)
  const [totalCredits, setTotalCredits] = useState(initialTotalCredits)
  const [searchTerm, setSearchTerm] = useState("")

  useEffect(() => {
    if (searchTerm.trim() === "") {
      setFilteredPurchases(creditPurchases)
    } else {
      const filtered = creditPurchases.filter(
        (purchase) =>
          purchase.paystack_reference.toLowerCase().includes(searchTerm.toLowerCase()) ||
          purchase.status.toLowerCase().includes(searchTerm.toLowerCase()) ||
          purchase.profiles?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()),
      )
      setFilteredPurchases(filtered)
    }
  }, [searchTerm, creditPurchases])

  const badge = "inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium"
  const getStatusBadge = (status: string) => {
    switch (status?.toLowerCase()) {
      case "success":
      case "completed":
        return <span className={`${badge} bg-success/10 text-success`}>Success</span>
      case "pending":
        return <span className={`${badge} bg-warning/10 text-warning`}>Pending</span>
      case "failed":
        return <span className={`${badge} bg-destructive/10 text-destructive`}>Failed</span>
      default:
        return <span className={`${badge} bg-surface-2 text-muted-foreground capitalize`}>{status}</span>
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-surface">
        <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
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
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Credits &amp; users</h1>
            <p className="text-sm text-muted-foreground">Manage platform credits and registered freelancers.</p>
          </header>

          {/* Metrics */}
          <section className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground">Total credits purchased</p>
                <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                  <Coins className="h-4 w-4" />
                </div>
              </div>
              <p className="mt-3 text-3xl font-semibold tracking-tight text-foreground tabular-nums">{totalCredits.toLocaleString()}</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground">Total freelancers</p>
                <div className="h-9 w-9 rounded-lg bg-info/10 text-info flex items-center justify-center">
                  <Users className="h-4 w-4" />
                </div>
              </div>
              <p className="mt-3 text-3xl font-semibold tracking-tight text-foreground tabular-nums">{freelancers.length}</p>
            </div>
          </section>

          {/* Credit Purchases Table */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                  <ArrowUpRight className="h-5 w-5 text-primary" /> Recent transactions
                </h2>
                <div className="relative w-full md:w-72">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input
                    placeholder="Search transactions…"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-surface-2 text-[11px] uppercase tracking-wide font-medium text-muted-foreground border-b border-border">
                  <tr>
                    <th className="px-5 py-3">Freelancer</th>
                    <th className="px-5 py-3">Amount</th>
                    <th className="px-5 py-3">Reference ID</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredPurchases.map((purchase) => (
                    <tr key={purchase.id} className="hover:bg-surface/60 transition-colors">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9 rounded-full">
                            <AvatarFallback className="bg-surface-2 text-foreground text-sm font-semibold">
                              {purchase.profiles?.full_name?.charAt(0)?.toUpperCase() || "?"}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium text-foreground">{purchase.profiles?.full_name || "Unknown"}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className="inline-flex items-center rounded-md bg-surface-2 px-2 py-1 text-sm font-semibold text-foreground tabular-nums">
                          {purchase.credits_amount?.toLocaleString()} <span className="ml-1 text-[11px] font-medium text-muted-foreground">CR</span>
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1.5 text-muted-foreground font-mono text-xs bg-surface-2 px-2 py-1 rounded-md border border-border w-fit">
                          <Hash className="h-3 w-3" />
                          {purchase.paystack_reference}
                        </div>
                      </td>
                      <td className="px-5 py-4">{getStatusBadge(purchase.status)}</td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1.5 text-muted-foreground tabular-nums">
                          <Calendar className="h-4 w-4" />
                          {new Date(purchase.created_at).toLocaleDateString()}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredPurchases.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-5 py-12 text-center text-sm text-muted-foreground">
                        {searchTerm ? "No transactions matching your search." : "No transactions found."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Registered Freelancers Table */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                <Users className="h-5 w-5 text-info" /> Registered freelancers
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-surface-2 text-[11px] uppercase tracking-wide font-medium text-muted-foreground border-b border-border">
                  <tr>
                    <th className="px-5 py-3">Name</th>
                    <th className="px-5 py-3">Account type</th>
                    <th className="px-5 py-3">Registration date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {freelancers.map((freelancer) => (
                    <tr key={freelancer.id} className="hover:bg-surface/60 transition-colors">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9 rounded-full">
                            <AvatarFallback className="bg-surface-2 text-foreground text-sm font-semibold">
                              {freelancer.full_name?.charAt(0)?.toUpperCase() || "?"}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium text-foreground">{freelancer.full_name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-primary-soft text-primary capitalize">
                          {freelancer.account_type}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1.5 text-muted-foreground tabular-nums">
                          <Calendar className="h-4 w-4" />
                          {new Date(freelancer.created_at).toLocaleDateString()}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {freelancers.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-5 py-12 text-center text-sm text-muted-foreground">
                        No freelancers registered yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
