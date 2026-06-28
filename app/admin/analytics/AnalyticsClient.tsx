"use client"

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Loader2, TrendingUp, Users } from "lucide-react"
import AdminSidebar from "@/components/admin-sidebar"

interface TopFreelancer {
  id: string
  full_name: string
  email: string
  total_earnings: number
  completed_jobs: number
}

interface TopAgency {
  id: string
  full_name: string
  email: string
  total_deposits: number
  funded_jobs: number
}

interface AnalyticsClientProps {
  initialTopFreelancers: TopFreelancer[]
  initialTopAgencies: TopAgency[]
}

export default function AnalyticsClient({ initialTopFreelancers, initialTopAgencies }: AnalyticsClientProps) {
  const [topFreelancers] = useState<TopFreelancer[]>(initialTopFreelancers)
  const [topAgencies] = useState<TopAgency[]>(initialTopAgencies)
  const [loading] = useState(false)

  const rankBadge = (index: number) =>
    `inline-flex items-center justify-center min-w-[2rem] px-2 py-0.5 rounded-full text-[11px] font-semibold tabular-nums ${
      index < 3 ? "bg-primary-soft text-primary" : "bg-surface-2 text-muted-foreground"
    }`

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-surface">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
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
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Analytics</h1>
            <p className="text-sm text-muted-foreground">Top performers across the platform.</p>
          </header>

          <Tabs defaultValue="freelancers" className="space-y-4">
            <TabsList className="grid w-full grid-cols-2 sm:max-w-md">
              <TabsTrigger value="freelancers" className="gap-2">
                <TrendingUp className="h-4 w-4" />
                Top freelancers
              </TabsTrigger>
              <TabsTrigger value="agencies" className="gap-2">
                <Users className="h-4 w-4" />
                Top agencies
              </TabsTrigger>
            </TabsList>

            <TabsContent value="freelancers">
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="px-5 py-4 border-b border-border">
                  <h2 className="text-base font-semibold text-foreground">Top earning freelancers</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-surface-2 text-[11px] uppercase tracking-wide font-medium text-muted-foreground border-b border-border">
                      <tr>
                        <th className="px-5 py-3">Rank</th>
                        <th className="px-5 py-3">Freelancer</th>
                        <th className="px-5 py-3">Email</th>
                        <th className="px-5 py-3">Total earnings</th>
                        <th className="px-5 py-3">Completed jobs</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {topFreelancers.map((freelancer, index) => (
                        <tr key={freelancer.id} className="hover:bg-surface/60 transition-colors">
                          <td className="px-5 py-4">
                            <span className={rankBadge(index)}>#{index + 1}</span>
                          </td>
                          <td className="px-5 py-4 font-medium text-foreground">{freelancer.full_name}</td>
                          <td className="px-5 py-4 text-muted-foreground">{freelancer.email}</td>
                          <td className="px-5 py-4 font-semibold text-success tabular-nums">
                            ₦{freelancer.total_earnings.toLocaleString()}
                          </td>
                          <td className="px-5 py-4 text-muted-foreground tabular-nums">{freelancer.completed_jobs}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {topFreelancers.length === 0 && (
                    <div className="py-12 text-center text-sm text-muted-foreground">No freelancer earnings data found</div>
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="agencies">
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="px-5 py-4 border-b border-border">
                  <h2 className="text-base font-semibold text-foreground">Top agencies by deposits</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-surface-2 text-[11px] uppercase tracking-wide font-medium text-muted-foreground border-b border-border">
                      <tr>
                        <th className="px-5 py-3">Rank</th>
                        <th className="px-5 py-3">Agency</th>
                        <th className="px-5 py-3">Email</th>
                        <th className="px-5 py-3">Total deposits</th>
                        <th className="px-5 py-3">Funded jobs</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {topAgencies.map((agency, index) => (
                        <tr key={agency.id} className="hover:bg-surface/60 transition-colors">
                          <td className="px-5 py-4">
                            <span className={rankBadge(index)}>#{index + 1}</span>
                          </td>
                          <td className="px-5 py-4 font-medium text-foreground">{agency.full_name}</td>
                          <td className="px-5 py-4 text-muted-foreground">{agency.email}</td>
                          <td className="px-5 py-4 font-semibold text-info tabular-nums">
                            ₦{agency.total_deposits.toLocaleString()}
                          </td>
                          <td className="px-5 py-4 text-muted-foreground tabular-nums">{agency.funded_jobs}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {topAgencies.length === 0 && (
                    <div className="py-12 text-center text-sm text-muted-foreground">No agency deposit data found</div>
                  )}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}
