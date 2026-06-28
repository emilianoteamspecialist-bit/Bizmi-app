"use client"

import { useState } from "react"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Wallet, TrendingUp, Clock, Trash2, CheckCircle, X, Mail, Plus } from "lucide-react"
import { toast } from "sonner"
import { useAuth } from "@/contexts/AuthContext"

interface WalletTransaction {
  id: string
  amount: number
  status: string
  flutterwave_ref: string
  created_at: string
}

interface FundedJob {
  id: string
  job_title: string
  freelancer_id: string
  amount: number
  status: string
  reference_id: string
  funded_at: string
  agency_name: string
  failure_reason?: string
  job_confirmed?: boolean
  job_completed?: boolean
}

interface WalletClientProps {
  initialWalletBalance: number
  initialTransactions: WalletTransaction[]
  initialFundedJobs: FundedJob[]
}

export default function WalletClient({
  initialWalletBalance,
  initialTransactions,
  initialFundedJobs,
}: WalletClientProps) {
  const { user: currentUser } = useAuth()
  const [walletBalance, setWalletBalance] = useState(initialWalletBalance)
  const [transactions, setTransactions] = useState<WalletTransaction[]>(initialTransactions)
  const [fundedJobs, setFundedJobs] = useState<FundedJob[]>(initialFundedJobs)
  const [loading, setLoading] = useState(false)
  const [deletingJobs, setDeletingJobs] = useState<Set<string>>(new Set())
  const [completingJobs, setCompletingJobs] = useState<Set<string>>(new Set())

  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 25

  const loadWalletData = async () => {
    try {
      const user = currentUser
      if (user) {

        // Load wallet balance from profiles
        const { data: profile } = await supabase.from("profiles").select("wallet_balance").eq("id", user.id).single()

        if (profile) {
          setWalletBalance(profile.wallet_balance || 0)
        }

        // Load wallet transactions from agency_fundings
        const { data: transactionData } = await supabase
          .from("agency_fundings")
          .select("*")
          .eq("agency_id", user.id)
          .order("created_at", { ascending: false })
          .limit(10)

        if (transactionData) {
          setTransactions(transactionData)
        }

        // Load funded jobs from Funded_jobs101
        const { data: fundedJobsData } = await supabase
          .from("Funded_jobs101")
          .select("*")
          .eq("agency_id", user.id)
          .order("funded_at", { ascending: false })

        if (fundedJobsData) {
          setFundedJobs(fundedJobsData)
        }
      }
    } catch (error) {
      console.error("Error loading wallet data:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleDepositClick = () => {
    // Open Paystack hosted page in new tab
    window.open("https://paystack.shop/pay/m7uebavu00", "_blank")
  }

  const handleDeleteJob = async (jobId: string) => {
    if (!confirm("Are you sure you want to delete this funded job?")) {
      return
    }

    setDeletingJobs((prev) => new Set(prev).add(jobId))

    try {
      const { error } = await supabase.from("Funded_jobs101").delete().eq("id", jobId)

      if (error) {
        console.error("Error deleting job:", error)
        toast.error("Failed to delete job")
        return
      }

      toast.success("Job deleted successfully")
      await loadWalletData() // Refresh the data
    } catch (error) {
      console.error("Error deleting job:", error)
      toast.error("Failed to delete job")
    } finally {
      setDeletingJobs((prev) => {
        const newSet = new Set(prev)
        newSet.delete(jobId)
        return newSet
      })
    }
  }

  const handleCompleteJob = async (job: FundedJob) => {
    setCompletingJobs((prev) => new Set(prev).add(job.id))

    try {
      const { error } = await supabase
        .from("Funded_jobs101")
        .update({
          job_completed: true,
        })
        .eq("id", job.id)

      if (error) {
        console.error("❌ Error completing job:", error)
        toast.error("Failed to mark job as completed")
        return
      }

      toast.success("Job marked as completed! Freelancer can now request payout.")
      await loadWalletData()
    } catch (error) {
      console.error("❌ Error completing job:", error)
      toast.error("Failed to mark job as completed")
    } finally {
      setCompletingJobs((prev) => {
        const newSet = new Set(prev)
        newSet.delete(job.id)
        return newSet
      })
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "successful":
      case "verified":
        return (
          <Badge className="bg-green-100 text-green-800">
            <CheckCircle className="w-3 h-3 mr-1" />
            {status === "verified" ? "Verified" : "Successful"}
          </Badge>
        )
      case "pending":
      case "pending_verification":
        return (
          <Badge className="bg-yellow-100 text-yellow-800">
            <Clock className="w-3 h-3 mr-1" />
            Pending
          </Badge>
        )
      case "failed":
        return (
          <Badge className="bg-red-100 text-red-800">
            <X className="w-3 h-3 mr-1" />
            Failed
          </Badge>
        )
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-surface">
        <div className="max-w-6xl mx-auto py-8 px-4">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-foreground/5 rounded w-1/4 mb-6"></div>
            <div className="h-32 bg-foreground/5 rounded"></div>
            <div className="h-20 bg-foreground/5 rounded"></div>
            <div className="h-20 bg-foreground/5 rounded"></div>
          </div>
        </div>
      </div>
    )
  }

  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedJobs = fundedJobs.slice(startIndex, endIndex)
  const hasMore = endIndex < fundedJobs.length

  return (
    <div className="min-h-screen bg-surface pb-20">
      <div className="max-w-6xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-8">
        {/* Toolbar header */}
        <header className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Wallet</p>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Agency wallet</h1>
          <p className="text-sm text-muted-foreground">Manage funding and review the jobs you&apos;ve funded for freelancers.</p>
        </header>

        {/* Metric tiles */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { label: "Wallet balance", value: formatCurrency(walletBalance), icon: Wallet, tone: "text-primary", accent: true },
            { label: "Funded jobs", value: fundedJobs.length, icon: TrendingUp, tone: "text-foreground", accent: false },
            {
              label: "Pending verification",
              value: fundedJobs.filter((job) => job.status === "pending_verification").length,
              icon: Clock,
              tone: "text-warning",
              accent: false,
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className={`rounded-xl border bg-card p-4 ${stat.accent ? "border-primary/30" : "border-border"}`}
            >
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground">{stat.label}</p>
                <stat.icon className={`h-3.5 w-3.5 ${stat.tone}`} />
              </div>
              <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground tabular-nums">{stat.value}</p>
            </div>
          ))}
        </section>

        {/* Help / Deposit */}
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-foreground">Need help, or want to add funds?</p>
              <p className="text-sm text-muted-foreground mt-0.5">Reach support or make a deposit to fund jobs.</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                onClick={() =>
                  window.open("mailto:contact@bizimii.com?subject=Wallet Support Request", "_blank")
                }
                variant="outline"
                className="gap-2"
              >
                <Mail className="h-4 w-4" />
                Contact us
              </Button>
              <Button onClick={handleDepositClick} className="gap-2">
                <Plus className="h-4 w-4" />
                Make a deposit
              </Button>
            </div>
          </div>
        </div>

        {/* Funded Jobs Section */}
        <Card className="rounded-xl border border-border bg-card shadow-none">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-foreground">Funded jobs</CardTitle>
            <p className="text-sm text-muted-foreground">Jobs you have funded for freelancers.</p>
          </CardHeader>
          <CardContent>
            {fundedJobs.length === 0 ? (
              <div className="py-16 px-6 text-center">
                <div className="mx-auto h-11 w-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <Clock className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-sm font-semibold text-foreground">No funded jobs yet</h3>
                <p className="mt-1 text-sm text-muted-foreground">Jobs you fund will appear here.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>Job Title</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Reference ID</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Job Status</TableHead>
                      <TableHead>Funded Date</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedJobs.map((job, index) => (
                      <TableRow key={job.id}>
                        <TableCell>{startIndex + index + 1}</TableCell>
                        <TableCell className="font-medium">{job.job_title}</TableCell>
                        <TableCell className="font-semibold text-primary">{formatCurrency(job.amount)}</TableCell>
                        <TableCell className="font-mono text-sm">{job.reference_id}</TableCell>
                        <TableCell>{getStatusBadge(job.status)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {job.status === "failed" && job.failure_reason ? (
                            <span className="text-destructive">{job.failure_reason}</span>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                        <TableCell>
                          {job.job_confirmed && job.job_completed && (
                            <Badge className="bg-green-100 text-green-800">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Completed
                            </Badge>
                          )}
                          {job.job_confirmed && !job.job_completed && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleCompleteJob(job)}
                              disabled={completingJobs.has(job.id)}
                              className="gap-1.5 text-success border-success/30 hover:bg-success/10"
                            >
                              {completingJobs.has(job.id) ? (
                                <>
                                  <Clock className="w-3 h-3 mr-1 animate-spin" />
                                  Completing...
                                </>
                              ) : (
                                <>
                                  <CheckCircle className="w-3 h-3 mr-1" />
                                  Job Done
                                </>
                              )}
                            </Button>
                          )}
                          {!job.job_confirmed && (
                            <Badge className="bg-surface-2 text-muted-foreground">
                              <Clock className="w-3 h-3 mr-1" />
                              Waiting
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>{formatDate(job.funded_at)}</TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleDeleteJob(job.id)}
                            disabled={deletingJobs.has(job.id)}
                          >
                            {deletingJobs.has(job.id) ? (
                              <Clock className="w-3 h-3 animate-spin" />
                            ) : (
                              <Trash2 className="w-3 h-3" />
                            )}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            {hasMore && (
              <div className="flex justify-center mt-4">
                <Button variant="outline" onClick={() => setCurrentPage((prev) => prev + 1)}>
                  Load more
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
