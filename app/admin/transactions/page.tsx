"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { supabase } from "@/lib/supabase"
import { AdminSidebar } from "@/components/admin-sidebar"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"

interface Transaction {
  id: string
  agency_id: string
  job_id: string
  amount: number
  reference_id: string
  status: string
  created_at: string
  agency_name?: string
  freelancer_name?: string
  payout_successful?: boolean
  job_confirmed?: boolean
  job_completed?: boolean
  failure_reason?: string
}

interface GroupedTransactions {
  [key: string]: {
    user_name: string
    user_id: string
    transactions: Transaction[]
    total_amount: number
  }
}

export default function AdminTransactions() {
  const [agencyTransactions, setAgencyTransactions] = useState<GroupedTransactions>({})
  const [freelancerTransactions, setFreelancerTransactions] = useState<GroupedTransactions>({})
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")

  useEffect(() => {
    loadTransactions()
  }, [])

  const loadTransactions = async () => {
    try {
      const { data: transactionsData, error: transactionsError } = await supabase
        .from("Funded_jobs101")
        .select("*")
        .order("created_at", { ascending: false })

      if (transactionsError) throw transactionsError

      const transactions = transactionsData || []

      const agencyIds = [...new Set(transactions.map((t) => t.agency_id).filter(Boolean))]
      const freelancerIds = [...new Set(transactions.map((t) => t.freelancer_id).filter(Boolean))]

      const { data: agencyProfiles } = await supabase.from("profiles").select("id, full_name").in("id", agencyIds)
      const { data: freelancerProfiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", freelancerIds)

      const agencyMap = new Map(agencyProfiles?.map((p) => [p.id, p]) || [])
      const freelancerMap = new Map(freelancerProfiles?.map((p) => [p.id, p]) || [])

      const groupedAgencies: GroupedTransactions = {}
      const groupedFreelancers: GroupedTransactions = {}

      transactions.forEach((transaction) => {
        if (transaction.agency_id) {
          const agency = agencyMap.get(transaction.agency_id)
          const agencyId = transaction.agency_id
          if (!groupedAgencies[agencyId]) {
            groupedAgencies[agencyId] = {
              user_name: agency?.full_name || "Unknown Agency",
              user_id: agencyId,
              transactions: [],
              total_amount: 0,
            }
          }
          groupedAgencies[agencyId].transactions.push({
            ...transaction,
            agency_name: agency?.full_name,
          })
          groupedAgencies[agencyId].total_amount += transaction.amount || 0
        }

        if (transaction.freelancer_id) {
          const freelancer = freelancerMap.get(transaction.freelancer_id)
          const freelancerId = transaction.freelancer_id
          if (!groupedFreelancers[freelancerId]) {
            groupedFreelancers[freelancerId] = {
              user_name: freelancer?.full_name || "Unknown Freelancer",
              user_id: freelancerId,
              transactions: [],
              total_amount: 0,
            }
          }
          groupedFreelancers[freelancerId].transactions.push({
            ...transaction,
            freelancer_name: freelancer?.full_name,
          })
          groupedFreelancers[freelancerId].total_amount += transaction.amount || 0
        }
      })

      setAgencyTransactions(groupedAgencies)
      setFreelancerTransactions(groupedFreelancers)
    } catch (error) {
      console.error("Error loading transactions:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleJobDone = async (transactionId: string) => {
    try {
      const { error } = await supabase
        .from("Funded_jobs101")
        .update({
          job_confirmed: true,
          job_completed: true,
        })
        .eq("id", transactionId)

      if (error) throw error

      loadTransactions()
    } catch (error) {
      console.error("Error marking job as done:", error)
    }
  }

  const handlePayout = async (transactionId: string) => {
    try {
      const { error } = await supabase
        .from("Funded_jobs101")
        .update({ payout_successful: true })
        .eq("id", transactionId)

      if (error) throw error

      loadTransactions()
    } catch (error) {
      console.error("Error processing payout:", error)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "verified":
        return "bg-green-100 text-green-800"
      case "pending":
        return "bg-yellow-100 text-yellow-800"
      case "failed":
        return "bg-red-100 text-red-800"
      default:
        return "bg-slate-100 text-gray-800"
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString()
  }

  const TransactionGroup = ({
    groupedData,
    type,
  }: {
    groupedData: GroupedTransactions
    type: "agency" | "freelancer"
  }) => (
    <div className="space-y-6">
      {Object.values(groupedData).map((group) => (
        <Card key={group.user_id}>
          <CardHeader className="bg-primary/10 border-b">
            <CardTitle className="text-primary flex items-center justify-between">
              <span>{group.user_name}</span>
              <Badge variant="outline" className="border-orange-200 text-primary">
                Total: ₦ {group.total_amount.toLocaleString()}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="space-y-3">
              {group.transactions.map((transaction) => (
                <div key={transaction.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <div>
                        <h4 className="font-medium">₦{transaction.amount.toLocaleString()}</h4>
                        <p className="text-sm text-slate-600">
                          Job ID: {transaction.job_id} • Ref: {transaction.reference_id}
                        </p>
                      </div>
                      <Badge className={getStatusColor(transaction.status)}>{transaction.status}</Badge>
                      {transaction.job_completed && (
                        <Badge variant="outline" className="bg-green-50 text-green-700">
                          Job Done
                        </Badge>
                      )}
                      {transaction.payout_successful && (
                        <Badge variant="outline" className="bg-blue-50 text-blue-700">
                          Paid Out
                        </Badge>
                      )}
                    </div>
                    <div className="mt-1 text-sm text-slate-500">
                      {formatDate(transaction.created_at)}
                      {transaction.failure_reason && (
                        <span className="ml-2 text-red-600">• {transaction.failure_reason}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {type === "agency" && transaction.status === "verified" && !transaction.job_completed && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-primary text-primary hover:bg-primary/10 bg-transparent"
                        onClick={() => handleJobDone(transaction.id)}
                      >
                        Mark Job Done
                      </Button>
                    )}
                    {type === "freelancer" && transaction.job_completed && !transaction.payout_successful && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-green-500 text-green-600 hover:bg-green-50 bg-transparent"
                        onClick={() => handlePayout(transaction.id)}
                      >
                        Process Payout
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
      {Object.keys(groupedData).length === 0 && (
        <div className="text-center py-8 text-slate-500">No {type} transactions found</div>
      )}
    </div>
  )

  const filterTransactions = (groupedData: GroupedTransactions, type: "agency" | "freelancer") => {
    if (!searchTerm.trim()) return groupedData

    const filtered: GroupedTransactions = {}

    Object.entries(groupedData).forEach(([userId, group]) => {
      const matchingTransactions = group.transactions.filter((transaction) => {
        const searchLower = searchTerm.toLowerCase()

        const matchesRefId = transaction.reference_id?.toLowerCase().includes(searchLower)
        const matchesJobId = transaction.job_id?.toLowerCase().includes(searchLower)

        const matchesUserName =
          type === "agency"
            ? transaction.agency_name?.toLowerCase().includes(searchLower)
            : transaction.freelancer_name?.toLowerCase().includes(searchLower)

        return matchesRefId || matchesJobId || matchesUserName
      })

      const userNameMatches = group.user_name.toLowerCase().includes(searchTerm.toLowerCase())

      if (matchingTransactions.length > 0 || userNameMatches) {
        filtered[userId] = {
          ...group,
          transactions: userNameMatches ? group.transactions : matchingTransactions,
          total_amount: userNameMatches
            ? group.total_amount
            : matchingTransactions.reduce((sum, t) => sum + (t.amount || 0), 0),
        }
      }
    })

    return filtered
  }

  if (loading) {
    return (
      <SidebarProvider>
        <AdminSidebar />
        <SidebarInset>
          <div className="p-4 lg:p-6">
            <div className="text-lg">Loading transactions...</div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    )
  }

  return (
    <SidebarProvider>
      <AdminSidebar />
      <SidebarInset>
        <div className="p-4 lg:p-6">
          <div className="mb-6">
            <h1 className="text-2xl lg:text-primaryxl font-bold text-slate-900">Transactions</h1>
            <p className="text-slate-600">Monitor and manage all platform transactions</p>
          </div>

          <div className="mb-6">
            <Input
              placeholder="Search by reference ID, job ID, or user name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-md border-orange-200 focus:border-primary focus:ring-primary"
            />
          </div>

          <Tabs defaultValue="agencies" className="w-full">
            <TabsList className="grid w-full grid-cols-2 bg-orange-100">
              <TabsTrigger
                value="agencies"
                className="data-[state=active]:bg-primary data-[state=active]:text-white"
              >
                Agencies ({Object.keys(filterTransactions(agencyTransactions, "agency")).length})
              </TabsTrigger>
              <TabsTrigger
                value="freelancers"
                className="data-[state=active]:bg-primary data-[state=active]:text-white"
              >
                Freelancers ({Object.keys(filterTransactions(freelancerTransactions, "freelancer")).length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="agencies" className="mt-6">
              <TransactionGroup groupedData={filterTransactions(agencyTransactions, "agency")} type="agency" />
            </TabsContent>

            <TabsContent value="freelancers" className="mt-6">
              <TransactionGroup
                groupedData={filterTransactions(freelancerTransactions, "freelancer")}
                type="freelancer"
              />
            </TabsContent>
          </Tabs>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
