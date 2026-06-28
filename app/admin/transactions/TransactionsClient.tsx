"use client"

import { useState } from "react"
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

interface TransactionsClientProps {
  initialAgencyTransactions: GroupedTransactions
  initialFreelancerTransactions: GroupedTransactions
}

export default function TransactionsClient({
  initialAgencyTransactions,
  initialFreelancerTransactions,
}: TransactionsClientProps) {
  const [agencyTransactions, setAgencyTransactions] = useState<GroupedTransactions>(initialAgencyTransactions)
  const [freelancerTransactions, setFreelancerTransactions] =
    useState<GroupedTransactions>(initialFreelancerTransactions)
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  // Initial grouped transactions come from the server (source of truth);
  // loadTransactions remains for refetches after Mark Job Done / Process Payout.

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

  // Both actions go through an admin-only server endpoint that authorises the
  // caller and records the action in the audit log. The client no longer writes
  // to Funded_jobs101 directly.
  const runTransactionAction = async (transactionId: string, action: "mark_done" | "process_payout") => {
    try {
      const res = await fetch(`/api/admin/transactions/${transactionId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      })
      const data = await res.json()
      if (!res.ok) {
        alert(data.error || "Action failed")
        return
      }
      loadTransactions()
    } catch (error) {
      console.error(`Error running ${action}:`, error)
      alert("Something went wrong.")
    }
  }

  const handleJobDone = (transactionId: string) => runTransactionAction(transactionId, "mark_done")
  const handlePayout = (transactionId: string) => runTransactionAction(transactionId, "process_payout")

  const getStatusColor = (status: string) => {
    switch (status) {
      case "verified":
        return "bg-success/10 text-success"
      case "pending":
        return "bg-warning/10 text-warning"
      case "failed":
        return "bg-destructive/10 text-destructive"
      default:
        return "bg-surface-2 text-muted-foreground"
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
    <div className="space-y-4">
      {Object.values(groupedData).map((group) => (
        <div key={group.user_id} className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-border bg-surface-2">
            <span className="text-sm font-semibold text-foreground truncate">{group.user_name}</span>
            <span className="shrink-0 inline-flex items-center rounded-full bg-primary-soft px-2.5 py-0.5 text-xs font-medium text-primary tabular-nums">
              Total ₦{group.total_amount.toLocaleString()}
            </span>
          </div>
          <div className="divide-y divide-border">
            {group.transactions.map((transaction) => (
              <div key={transaction.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-sm font-semibold text-foreground tabular-nums">₦{transaction.amount.toLocaleString()}</h4>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium capitalize ${getStatusColor(transaction.status)}`}>
                      {transaction.status}
                    </span>
                    {transaction.job_completed && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-success/10 text-success">Job done</span>
                    )}
                    {transaction.payout_successful && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-info/10 text-info">Paid out</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    Job {transaction.job_id} · Ref {transaction.reference_id}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {formatDate(transaction.created_at)}
                    {transaction.failure_reason && <span className="text-destructive"> · {transaction.failure_reason}</span>}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  {type === "agency" && transaction.status === "verified" && !transaction.job_completed && (
                    <Button variant="outline" size="sm" onClick={() => handleJobDone(transaction.id)}>
                      Mark job done
                    </Button>
                  )}
                  {type === "freelancer" && transaction.job_completed && !transaction.payout_successful && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-success border-success/30 hover:bg-success/10"
                      onClick={() => handlePayout(transaction.id)}
                    >
                      Process payout
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
      {Object.keys(groupedData).length === 0 && (
        <div className="rounded-xl border border-border bg-card py-12 text-center text-sm text-muted-foreground">
          No {type} transactions found
        </div>
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
          <div className="min-h-svh bg-surface flex items-center justify-center text-sm text-muted-foreground">
            Loading transactions…
          </div>
        </SidebarInset>
      </SidebarProvider>
    )
  }

  return (
    <SidebarProvider>
      <AdminSidebar />
      <SidebarInset>
        <div className="min-h-svh bg-surface">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
            <header className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Admin</p>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">Transactions</h1>
              <p className="text-sm text-muted-foreground">Monitor and manage all platform transactions.</p>
            </header>

            <Input
              placeholder="Search by reference ID, job ID, or user name…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="sm:max-w-md"
            />

            <Tabs defaultValue="agencies" className="w-full">
              <TabsList className="grid w-full grid-cols-2 sm:max-w-md">
                <TabsTrigger value="agencies">
                  Agencies ({Object.keys(filterTransactions(agencyTransactions, "agency")).length})
                </TabsTrigger>
                <TabsTrigger value="freelancers">
                  Freelancers ({Object.keys(filterTransactions(freelancerTransactions, "freelancer")).length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="agencies" className="mt-4">
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
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
