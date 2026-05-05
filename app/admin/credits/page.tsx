"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
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
          purchase.status.toLowerCase().includes(searchTerm.toLowerCase()) ||
          purchase.profiles?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()),
      )
      setFilteredPurchases(filtered)
    }
  }, [searchTerm, creditPurchases])

  const loadData = async () => {
    try {
      setLoading(true)

      const [purchasesResult, freelancersResult] = await Promise.all([
        supabase.from("purchase_credits").select("*, profiles(full_name)").order("created_at", { ascending: false }),
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
      case "completed":
        return <Badge className="bg-green-100 text-green-800 border-none font-bold px-3 py-1 text-xs">Success</Badge>
      case "pending":
        return <Badge className="bg-yellow-100 text-yellow-800 border-none font-bold px-3 py-1 text-xs">Pending</Badge>
      case "failed":
        return <Badge className="bg-red-100 text-red-800 border-none font-bold px-3 py-1 text-xs">Failed</Badge>
      default:
        return <Badge className="bg-slate-100 text-slate-800 border-none font-bold px-3 py-1 text-xs capitalize">{status}</Badge>
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-slate-50 font-sans selection:bg-orange-100 selection:text-orange-900">
      <AdminSidebar />
      <div className="flex-1 overflow-auto">
        <div className="p-8 max-w-7xl mx-auto space-y-8">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-primaryxl font-black text-slate-900 tracking-tight">Credits & Users</h1>
              <p className="text-slate-500 font-medium mt-1">Manage platform credits and registered freelancers.</p>
            </div>
          </div>

          {/* Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="border-none shadow-xl shadow-slate-200/50 rounded-[2rem] bg-white group hover:border-primary/50 border transition-all">
              <CardContent className="p-8 flex items-center justify-between">
                <div>
                  <p className="text-slate-500 font-bold text-xs uppercase tracking-widest mb-1">Total Credits Purchased</p>
                  <h3 className="text-4xl font-black text-slate-900">{totalCredits.toLocaleString()}</h3>
                </div>
                <div className="p-4 bg-primary/10 rounded-2xl">
                  <Coins className="h-8 w-8 text-primary" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-xl shadow-slate-200/50 rounded-[2rem] bg-white group hover:border-blue-500/50 border transition-all">
              <CardContent className="p-8 flex items-center justify-between">
                <div>
                  <p className="text-slate-500 font-bold text-xs uppercase tracking-widest mb-1">Total Freelancers</p>
                  <h3 className="text-4xl font-black text-slate-900">{freelancers.length}</h3>
                </div>
                <div className="p-4 bg-blue-50 rounded-2xl">
                  <Users className="h-8 w-8 text-blue-500" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Credit Purchases Table */}
          <Card className="border-none shadow-xl shadow-slate-200/50 rounded-[2rem] bg-white overflow-hidden">
            <CardHeader className="px-8 pt-8 pb-6 border-b border-slate-100 bg-white">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <CardTitle className="text-xl font-black text-slate-900 flex items-center gap-2">
                  <ArrowUpRight className="h-5 w-5 text-primary" /> Recent Transactions
                </CardTitle>
                <div className="relative w-full md:w-80">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
                  <Input
                    placeholder="Search transactions..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 h-11 rounded-xl bg-slate-50 border-slate-200 focus:bg-white focus:ring-primary focus:border-primary"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50/50 text-xs uppercase tracking-widest font-black text-slate-500 border-b border-slate-100">
                    <tr>
                      <th className="px-8 py-5">Freelancer</th>
                      <th className="px-8 py-5">Amount</th>
                      <th className="px-8 py-5">Reference ID</th>
                      <th className="px-8 py-5">Status</th>
                      <th className="px-8 py-5">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredPurchases.map((purchase) => (
                      <tr key={purchase.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-8 py-5">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-10 w-10 rounded-xl border border-slate-200">
                              <AvatarFallback className="bg-orange-100 text-primary font-bold">
                                {purchase.profiles?.full_name?.charAt(0) || "?"}
                              </AvatarFallback>
                            </Avatar>
                            <span className="font-bold text-slate-900">{purchase.profiles?.full_name || "Unknown"}</span>
                          </div>
                        </td>
                        <td className="px-8 py-5">
                          <span className="font-black text-slate-900 bg-slate-100 px-3 py-1 rounded-lg">
                            {purchase.credits_amount?.toLocaleString()} <span className="text-slate-400 font-bold text-xs ml-1">CR</span>
                          </span>
                        </td>
                        <td className="px-8 py-5">
                          <div className="flex items-center gap-2 text-slate-500 font-mono text-xs bg-slate-50 px-2 py-1 rounded border border-slate-200 w-fit">
                            <Hash className="h-3 w-3" />
                            {purchase.paystack_reference}
                          </div>
                        </td>
                        <td className="px-8 py-5">{getStatusBadge(purchase.status)}</td>
                        <td className="px-8 py-5">
                          <div className="flex items-center gap-2 text-slate-500 font-medium">
                            <Calendar className="h-4 w-4 text-slate-400" />
                            {new Date(purchase.created_at).toLocaleDateString()}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredPurchases.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-8 py-12 text-center text-slate-500 font-medium">
                          {searchTerm ? "No transactions matching your search." : "No transactions found."}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Registered Freelancers Table */}
          <Card className="border-none shadow-xl shadow-slate-200/50 rounded-[2rem] bg-white overflow-hidden">
            <CardHeader className="px-8 pt-8 pb-6 border-b border-slate-100 bg-white">
              <CardTitle className="text-xl font-black text-slate-900 flex items-center gap-2">
                 <Users className="h-5 w-5 text-blue-500" /> Registered Freelancers
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50/50 text-xs uppercase tracking-widest font-black text-slate-500 border-b border-slate-100">
                    <tr>
                      <th className="px-8 py-5">Name</th>
                      <th className="px-8 py-5">Account Type</th>
                      <th className="px-8 py-5">Registration Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {freelancers.map((freelancer) => (
                      <tr key={freelancer.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-8 py-5">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-10 w-10 rounded-xl border border-slate-200">
                              <AvatarFallback className="bg-blue-100 text-blue-700 font-bold">
                                {freelancer.full_name?.charAt(0) || "?"}
                              </AvatarFallback>
                            </Avatar>
                            <span className="font-bold text-slate-900">{freelancer.full_name}</span>
                          </div>
                        </td>
                        <td className="px-8 py-5">
                          <Badge className="bg-blue-50 text-blue-700 border-blue-200 uppercase tracking-widest text-[10px] font-black px-2 py-1">
                            {freelancer.account_type}
                          </Badge>
                        </td>
                        <td className="px-8 py-5">
                          <div className="flex items-center gap-2 text-slate-500 font-medium">
                            <Calendar className="h-4 w-4 text-slate-400" />
                            {new Date(freelancer.created_at).toLocaleDateString()}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {freelancers.length === 0 && (
                      <tr>
                        <td colSpan={3} className="px-8 py-12 text-center text-slate-500 font-medium">
                          No freelancers registered yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
