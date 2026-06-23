"use client"

import { useState } from "react"
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

interface AnalyticsClientProps {
  initialTopFreelancers: TopFreelancer[]
  initialTopAgencies: TopAgency[]
}

export default function AnalyticsClient({
  initialTopFreelancers,
  initialTopAgencies,
}: AnalyticsClientProps) {
  const [topFreelancers, setTopFreelancers] = useState<TopFreelancer[]>(initialTopFreelancers)
  const [topAgencies, setTopAgencies] = useState<TopAgency[]>(initialTopAgencies)
  const [loading, setLoading] = useState(false)

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-slate-100">
      <AdminSidebar />
      <div className="flex-1 overflow-auto">
        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-primaryxl font-bold text-slate-900">Analytics Dashboard</h1>
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
                  <CardTitle className="text-primary">Top Earning Freelancers</CardTitle>
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
                          <tr key={freelancer.id} className="border-b hover:bg-slate-50">
                            <td className="p-4">
                              <Badge
                                className={`${index < 3 ? "bg-orange-100 text-orange-800" : "bg-slate-100 text-gray-800"}`}
                              >
                                #{index + 1}
                              </Badge>
                            </td>
                            <td className="p-4 font-medium">{freelancer.full_name}</td>
                            <td className="p-4 text-slate-600">{freelancer.email}</td>
                            <td className="p-4 font-semibold text-green-600">
                              ₦ {freelancer.total_earnings.toLocaleString()}
                            </td>
                            <td className="p-4 text-slate-600">{freelancer.completed_jobs}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {topFreelancers.length === 0 && (
                      <div className="text-center py-8 text-slate-500">No freelancer earnings data found</div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="agencies">
              <Card>
                <CardHeader>
                  <CardTitle className="text-primary">Top Agencies by Deposits</CardTitle>
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
                          <tr key={agency.id} className="border-b hover:bg-slate-50">
                            <td className="p-4">
                              <Badge
                                className={`${index < 3 ? "bg-orange-100 text-orange-800" : "bg-slate-100 text-gray-800"}`}
                              >
                                #{index + 1}
                              </Badge>
                            </td>
                            <td className="p-4 font-medium">{agency.full_name}</td>
                            <td className="p-4 text-slate-600">{agency.email}</td>
                            <td className="p-4 font-semibold text-blue-600">
                              ₦ {agency.total_deposits.toLocaleString()}
                            </td>
                            <td className="p-4 text-slate-600">{agency.funded_jobs}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {topAgencies.length === 0 && (
                      <div className="text-center py-8 text-slate-500">No agency deposit data found</div>
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
