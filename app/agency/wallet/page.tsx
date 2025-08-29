"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Wallet, TrendingUp, Clock, Trash2, CheckCircle, X, Mail, Plus } from "lucide-react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import AgencyNavbar from "@/components/agency-navbar"

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

export default function AgencyWalletPage() {
  const [walletBalance, setWalletBalance] = useState(0)
  const [transactions, setTransactions] = useState<WalletTransaction[]>([])
  const [fundedJobs, setFundedJobs] = useState<FundedJob[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingJobs, setDeletingJobs] = useState<Set<string>>(new Set())
  const [completingJobs, setCompletingJobs] = useState<Set<string>>(new Set())
  const [currentUser, setCurrentUser] = useState<any>(null)
  const router = useRouter()

  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 25

  useEffect(() => {
    loadWalletData()
  }, [])

  const loadWalletData = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user) {
        setCurrentUser(user)
        console.log("Current user ID:", user.id)

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
      <div className="min-h-screen bg-gray-50">
        <AgencyNavbar />
        <div className="max-w-7xl mx-auto py-8 px-4">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-300 rounded w-1/4 mb-6"></div>
            <div className="space-y-4">
              <div className="h-32 bg-gray-300 rounded"></div>
              <div className="h-20 bg-gray-300 rounded"></div>
              <div className="h-20 bg-gray-300 rounded"></div>
            </div>
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
    <div className="min-h-screen bg-gray-50">
      <AgencyNavbar />

      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Agency Wallet</h1>
          <p className="text-gray-600 mt-2">Manage your wallet balance and fund freelancer jobs</p>
        </div>

        {/* Wallet Balance Card */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Contact Us Card */}
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Wallet className="h-5 w-5 mr-2 text-orange-500" />
                Need Help?
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <p className="text-lg font-medium text-gray-900">Contact Support</p>
                  <p className="text-gray-600 mt-1">Get help with your wallet or transactions</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button
                    onClick={() =>
                      window.open("mailto:Bizimisocials12@gmail.com?subject=Wallet Support Request", "_blank")
                    }
                    className="bg-orange-500 hover:bg-orange-600 text-white"
                  >
                    <Mail className="h-4 w-4 mr-2" />
                    Contact Us
                  </Button>
                  <Button
                    onClick={handleDepositClick}
                    variant="outline"
                    className="border-orange-500 text-orange-500 hover:bg-orange-50 bg-transparent"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Make a Deposit
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <TrendingUp className="h-5 w-5 mr-2 text-orange-500" />
                Quick Stats
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-gray-600">Total Funded Jobs</p>
                  <p className="text-2xl font-bold text-gray-900">{fundedJobs.length}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Pending Verification</p>
                  <p className="text-2xl font-bold text-yellow-600">
                    {fundedJobs.filter((job) => job.status === "pending_verification").length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Funded Jobs Section */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-xl text-gray-900">Funded Jobs</CardTitle>
            <p className="text-gray-600">Jobs you have funded for freelancers</p>
          </CardHeader>
          <CardContent>
            {fundedJobs.length === 0 ? (
              <div className="text-center py-8">
                <Clock className="h-16 w-16 mx-auto mb-4 text-gray-400" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Funded Jobs Yet</h3>
                <p className="text-gray-500">Jobs you fund will appear here</p>
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
                        <TableCell className="font-semibold text-orange-600">{formatCurrency(job.amount)}</TableCell>
                        <TableCell className="font-mono text-sm">{job.reference_id}</TableCell>
                        <TableCell>{getStatusBadge(job.status)}</TableCell>
                        <TableCell className="text-sm text-gray-600">
                          {job.status === "failed" && job.failure_reason ? (
                            <span className="text-red-600">{job.failure_reason}</span>
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
                              onClick={() => handleCompleteJob(job)}
                              disabled={completingJobs.has(job.id)}
                              className="bg-green-500 hover:bg-green-600"
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
                            <Badge className="bg-gray-100 text-gray-800">
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
                            className="bg-red-500 hover:bg-red-600"
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
                <Button
                  onClick={() => setCurrentPage((prev) => prev + 1)}
                  className="bg-orange-500 hover:bg-orange-600 text-white"
                >
                  Load More
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
