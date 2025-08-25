"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
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

export default function AdminAnalyticsPage() {
  const [topFreelancers, setTopFreelancers] = useState<TopFreelancer[]>([])
  const [topAgencies, setTopAgencies] = useState<TopAgency[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadAnalytics()
  }, [])

  const loadAnalytics = async () => {
    try {
      setLoading(true)

      // Get all transactions from Funded_jobs101
      const { data: transactions, error: transactionsError } = await supabase.from("Funded_jobs101").select("*")

      if (transactionsError) throw transactionsError

      const { data: profiles, error: profilesError } = await supabase.from("profiles").select("id, full_name, email")

      if (profilesError) throw profilesError

      // Create profile lookup map
      const profileMap = new Map()
      profiles?.forEach((profile) => {
        profileMap.set(profile.id, profile)
      })

      // Calculate freelancer earnings (from payout_successful transactions)
      const freelancerEarnings = new Map()
      transactions?.forEach((transaction) => {
        if (transaction.payout_successful && transaction.freelancer_id) {
          const current = freelancerEarnings.get(transaction.freelancer_id) || { total: 0, jobs: 0 }
          freelancerEarnings.set(transaction.freelancer_id, {
            total: current.total + (transaction.amount || 0),
            jobs: current.jobs + 1,
          })
        }
      })

      // Calculate agency deposits (from successful transactions)
      const agencyDeposits = new Map()
      transactions?.forEach((transaction) => {
        if (transaction.job_confirmed && transaction.agency_id) {
          const current = agencyDeposits.get(transaction.agency_id) || { total: 0, jobs: 0 }
          agencyDeposits.set(transaction.agency_id, {
            total: current.total + (transaction.amount || 0),
            jobs: current.jobs + 1,
          })
        }
      })

      const freelancersList: TopFreelancer[] = []
      freelancerEarnings.forEach((earnings, freelancerId) => {
        const profile = profileMap.get(freelancerId)
        if (profile) {
          freelancersList.push({
            id: freelancerId,
            full_name: profile.full_name || "Unknown",
            email: profile.email || "Unknown",
            total_earnings: earnings.total,
            completed_jobs: earnings.jobs,
          })
        }
      })

      // Build top agencies list
      const agenciesList: TopAgency[] = []
      agencyDeposits.forEach((deposits, agencyId) => {
        const profile = profileMap.get(agencyId)
        if (profile) {
          agenciesList.push({
            id: agencyId,
            full_name: profile.full_name || "Unknown",
            email: profile.email || "Unknown",
            total_deposits: deposits.total,
            funded_jobs: deposits.jobs,
          })
        }
      })

      // Sort by earnings/deposits (highest first)
      freelancersList.sort((a, b) => b.total_earnings - a.total_earnings)
      agenciesList.sort((a, b) => b.total_deposits - a.total_deposits)

      setTopFreelancers(freelancersList.slice(0, 20)) // Top 20
      setTopAgencies(agenciesList.slice(0, 20)) // Top 20
    } catch (error) {
      console.error("Error loading analytics:", error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-gray-100">
      <AdminSidebar />
      <div className="flex-1 overflow-auto">
        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold text-gray-900">Analytics Dashboard</h1>
          </div>

          <Tabs defaultValue="freelancers" className="space-y-6">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="freelancers" className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Top Earning Freelancers
              </TabsTrigger>
              <TabsTrigger value="agencies" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Top Agencies
              </TabsTrigger>
            </TabsList>

            <TabsContent value="freelancers">
              <Card>
                <CardHeader>
                  <CardTitle className="text-orange-600">Top Earning Freelancers</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-4 font-semibold">Rank</th>
                          <th className="text-left p-4 font-semibold">Freelancer</th>
                          <th className="text-left p-4 font-semibold">Email</th>
                          <th className="text-left p-4 font-semibold">Total Earnings</th>
                          <th className="text-left p-4 font-semibold">Completed Jobs</th>
                        </tr>
                      </thead>
                      <tbody>
                        {topFreelancers.map((freelancer, index) => (
                          <tr key={freelancer.id} className="border-b hover:bg-gray-50">
                            <td className="p-4">
                              <Badge
                                className={`${index < 3 ? "bg-orange-100 text-orange-800" : "bg-gray-100 text-gray-800"}`}
                              >
                                #{index + 1}
                              </Badge>
                            </td>
                            <td className="p-4 font-medium">{freelancer.full_name}</td>
                            <td className="p-4 text-gray-600">{freelancer.email}</td>
                            <td className="p-4 font-semibold text-green-600">
                              ₦{freelancer.total_earnings.toLocaleString()}
                            </td>
                            <td className="p-4 text-gray-600">{freelancer.completed_jobs}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {topFreelancers.length === 0 && (
                      <div className="text-center py-8 text-gray-500">No freelancer earnings data found</div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="agencies">
              <Card>
                <CardHeader>
                  <CardTitle className="text-orange-600">Top Agencies by Deposits</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-4 font-semibold">Rank</th>
                          <th className="text-left p-4 font-semibold">Agency</th>
                          <th className="text-left p-4 font-semibold">Email</th>
                          <th className="text-left p-4 font-semibold">Total Deposits</th>
                          <th className="text-left p-4 font-semibold">Funded Jobs</th>
                        </tr>
                      </thead>
                      <tbody>
                        {topAgencies.map((agency, index) => (
                          <tr key={agency.id} className="border-b hover:bg-gray-50">
                            <td className="p-4">
                              <Badge
                                className={`${index < 3 ? "bg-orange-100 text-orange-800" : "bg-gray-100 text-gray-800"}`}
                              >
                                #{index + 1}
                              </Badge>
                            </td>
                            <td className="p-4 font-medium">{agency.full_name}</td>
                            <td className="p-4 text-gray-600">{agency.email}</td>
                            <td className="p-4 font-semibold text-blue-600">
                              ₦{agency.total_deposits.toLocaleString()}
                            </td>
                            <td className="p-4 text-gray-600">{agency.funded_jobs}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {topAgencies.length === 0 && (
                      <div className="text-center py-8 text-gray-500">No agency deposit data found</div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}
