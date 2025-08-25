"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Loader2, Search, AlertCircle } from "lucide-react"
import AdminSidebar from "@/components/admin-sidebar"

interface CreditPurchase {
  id: string
  credits_amount: number
  paystack_reference: string
  status: string
  created_at: string
  updated_at: string
}

interface FreelancerProfile {
  id: string
  full_name: string
  created_at: string
  updated_at: string
  account_type: string
}

export default function AdminCreditsPage() {
  const [creditPurchases, setCreditPurchases] = useState<CreditPurchase[]>([])
  const [freelancers, setFreelancers] = useState<FreelancerProfile[]>([])
  const [filteredPurchases, setFilteredPurchases] = useState<CreditPurchase[]>([])
  const [loading, setLoading] = useState(true)
  const [totalCredits, setTotalCredits] = useState(0)
  const [searchTerm, setSearchTerm] = useState("")

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    if (searchTerm.trim() === "") {
      setFilteredPurchases(creditPurchases)
    } else {
      const filtered = creditPurchases.filter(
        (purchase) =>
          purchase.paystack_reference.toLowerCase().includes(searchTerm.toLowerCase()) ||
          purchase.status.toLowerCase().includes(searchTerm.toLowerCase()),
      )
      setFilteredPurchases(filtered)
    }
  }, [searchTerm, creditPurchases])

  const loadData = async () => {
    try {
      setLoading(true)

      const [purchasesResult, freelancersResult] = await Promise.all([
        supabase.from("purchase_credits").select("*").order("created_at", { ascending: false }),
        supabase
          .from("profiles")
          .select("id, full_name, created_at, updated_at, account_type")
          .eq("account_type", "freelancer")
          .order("created_at", { ascending: false }),
      ])

      if (purchasesResult.error) throw purchasesResult.error
      if (freelancersResult.error) throw freelancersResult.error

      setCreditPurchases(purchasesResult.data || [])
      setFilteredPurchases(purchasesResult.data || [])
      setFreelancers(freelancersResult.data || [])

      const total = purchasesResult.data?.reduce((sum, purchase) => sum + (purchase.credits_amount || 0), 0) || 0
      setTotalCredits(total)
    } catch (error) {
      console.error("Error loading data:", error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status?.toLowerCase()) {
      case "success":
        return <Badge className="bg-green-100 text-green-800">Success</Badge>
      case "pending":
        return <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>
      case "failed":
        return <Badge className="bg-red-100 text-red-800">Failed</Badge>
      default:
        return <Badge className="bg-gray-100 text-gray-800">{status}</Badge>
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
            <h1 className="text-3xl font-bold text-gray-900">Credits Management</h1>
          </div>

          <Card className="border-orange-200 bg-orange-50">
            <CardContent className="pt-6">
              <div className="flex items-center space-x-2 text-orange-800">
                <AlertCircle className="h-5 w-5" />
                <p className="font-medium">
                  Note: Credit purchases and freelancer profiles are shown separately as there's no linking column
                  between the tables. To link purchases to specific freelancers, add a user_id column to the
                  purchase_credits table.
                </p>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-orange-600">Total Credits Purchased</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-orange-500">{totalCredits.toLocaleString()} Credits</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-orange-600">Total Freelancers</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-orange-500">{freelancers.length}</div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Credit Purchases</CardTitle>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search by reference ID or status..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-4 font-semibold">Credits Amount</th>
                      <th className="text-left p-4 font-semibold">Reference ID</th>
                      <th className="text-left p-4 font-semibold">Status</th>
                      <th className="text-left p-4 font-semibold">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPurchases.map((purchase) => (
                      <tr key={purchase.id} className="border-b hover:bg-gray-50">
                        <td className="p-4 font-semibold text-orange-600">
                          {purchase.credits_amount?.toLocaleString()} Credits
                        </td>
                        <td className="p-4 text-sm text-gray-600">{purchase.paystack_reference}</td>
                        <td className="p-4">{getStatusBadge(purchase.status)}</td>
                        <td className="p-4 text-sm text-gray-600">
                          {new Date(purchase.created_at).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filteredPurchases.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    {searchTerm ? "No credit purchases found matching your search" : "No credit purchases found"}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Registered Freelancers</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-4 font-semibold">Name</th>
                      <th className="text-left p-4 font-semibold">Account Type</th>
                      <th className="text-left p-4 font-semibold">Registration Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {freelancers.map((freelancer) => (
                      <tr key={freelancer.id} className="border-b hover:bg-gray-50">
                        <td className="p-4 font-medium">{freelancer.full_name}</td>
                        <td className="p-4">
                          <Badge className="bg-blue-100 text-blue-800 capitalize">{freelancer.account_type}</Badge>
                        </td>
                        <td className="p-4 text-sm text-gray-600">
                          {new Date(freelancer.created_at).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {freelancers.length === 0 && <div className="text-center py-8 text-gray-500">No freelancers found</div>}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
