"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { CheckCircle, Clock, AlertCircle, Eye, Loader2, X, Briefcase, ShieldAlert, FileText } from "lucide-react"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import PayoutModal from "@/components/payout-modal"
import { useAuth } from "@/contexts/AuthContext"

interface FundedJob {
  id: string
  job_id: string
  agency_id: string
  freelancer_id: string
  agency_name: string
  job_title: string
  amount: number
  reference_id: string
  status: string
  funded_at: string
  created_at: string
  failure_reason?: string
  job_confirmed?: boolean
  job_completed?: boolean
  payout_successful?: boolean
}

export default function FundedJobsPage() {
  const { user: currentUser, loading: authLoading } = useAuth()
  const [fundedJobs, setFundedJobs] = useState<FundedJob[]>([])
  const [loading, setLoading] = useState(true)
  const [verifyingJobs, setVerifyingJobs] = useState<Set<string>>(new Set())
  const [confirmingJobs, setConfirmingJobs] = useState<Set<string>>(new Set())
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    verified: 0,
    failed: 0,
    totalAmount: 0,
  })

  const [showPayoutModal, setShowPayoutModal] = useState(false)
  const [selectedJob, setSelectedJob] = useState<FundedJob | null>(null)
  
  const [showDisputeModal, setShowDisputeModal] = useState(false)
  const [disputeForm, setDisputeForm] = useState({
    type: "client_abandonment",
    description: "",
  })
  const router = useRouter()

  const fetchFundedJobs = async () => {
    try {
      setLoading(true)

      if (!currentUser) {
        setLoading(false)
        return
      }
      const user = currentUser

      // Fetch funded jobs where this freelancer is specifically assigned
      const { data: jobs, error } = await supabase
        .from("Funded_jobs101")
        .select("*")
        .eq("freelancer_id", user.id)
        .order("created_at", { ascending: false })

      if (error) {
        console.error("❌ Error fetching funded jobs:", error)
        toast.error("Error loading funded jobs: " + error.message)
        return
      }

      console.log("📊 Raw funded jobs data:", jobs)
      console.log("📊 Number of jobs found:", jobs?.length || 0)

      setFundedJobs(jobs || [])

      // Calculate stats
      const totalJobs = jobs?.length || 0
      const pendingJobs = jobs?.filter((job) => job.status === "pending_verification").length || 0
      const verifiedJobs = jobs?.filter((job) => job.status === "verified").length || 0
      const failedJobs = jobs?.filter((job) => job.status === "failed").length || 0

      // Calculate total amount - only verified jobs that haven't been paid out
      const totalAmount =
        jobs
          ?.filter((job) => job.status === "verified" && !job.payout_successful)
          .reduce((sum, job) => sum + Number(job.amount), 0) || 0

      setStats({
        total: totalJobs,
        pending: pendingJobs,
        verified: verifiedJobs,
        failed: failedJobs,
        totalAmount,
      })
    } catch (error) {
      console.error("💥 Unexpected error:", error)
      toast.error("Failed to load funded jobs")
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyPayment = async (job: FundedJob) => {
    if (!job.reference_id) {
      toast.error("No reference ID found for this job")
      return
    }

    setVerifyingJobs((prev) => new Set(prev).add(job.id))

    try {
      console.log("🔍 Verifying payment for job:", job.id)

      const response = await fetch(`/api/paystack/verify-payment?reference=${job.reference_id}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      })

      const result = await response.json()

      if (result.success) {
        toast.success("Payment verified successfully!")
        // Refresh the jobs list
        await fetchFundedJobs()
      } else {
        // Update job status to failed with reason
        const failureReason = result.error || "Transaction not found or incorrect reference ID"

        const { error: updateError } = await supabase
          .from("Funded_jobs101")
          .update({
            status: "failed",
            failure_reason: failureReason,
          })
          .eq("id", job.id)

        if (updateError) {
          console.error("❌ Error updating job status:", updateError)
        }

        toast.error("Payment verification failed: " + failureReason)
        await fetchFundedJobs()
      }
    } catch (error) {
      console.error("❌ Error verifying payment:", error)

      // Update job status to failed
      const { error: updateError } = await supabase
        .from("Funded_jobs101")
        .update({
          status: "failed",
          failure_reason: "Network error or service unavailable",
        })
        .eq("id", job.id)

      if (updateError) {
        console.error("❌ Error updating job status:", updateError)
      }

      toast.error("Failed to verify payment")
      await fetchFundedJobs()
    } finally {
      setVerifyingJobs((prev) => {
        const newSet = new Set(prev)
        newSet.delete(job.id)
        return newSet
      })
    }
  }

  const handleConfirmJob = async (job: FundedJob) => {
    setConfirmingJobs((prev) => new Set(prev).add(job.id))

    try {
      const { error } = await supabase
        .from("Funded_jobs101")
        .update({
          job_confirmed: true,
        })
        .eq("id", job.id)

      if (error) {
        console.error("❌ Error confirming job:", error)
        toast.error("Failed to confirm job")
        return
      }

      toast.success("Job confirmed! Agency can now mark it as completed.")
      await fetchFundedJobs()
    } catch (error) {
      console.error("❌ Error confirming job:", error)
      toast.error("Failed to confirm job")
    } finally {
      setConfirmingJobs((prev) => {
        const newSet = new Set(prev)
        newSet.delete(job.id)
        return newSet
      })
    }
  }

  const handlePayout = (job: FundedJob) => {
    setSelectedJob(job)
    setShowPayoutModal(true)
  }

  const handlePayoutSuccess = async () => {
    if (selectedJob) {
      // Update the job to mark payout as successful
      const { error } = await supabase
        .from("Funded_jobs101")
        .update({
          payout_successful: true,
        })
        .eq("id", selectedJob.id)

      if (error) {
        console.error("❌ Error updating payout status:", error)
      }
    }

    setShowPayoutModal(false)
    setSelectedJob(null)
    fetchFundedJobs() // Refresh the jobs list to update balance
  }

  const handleCreateDispute = async () => {
    if (!disputeForm.description.trim()) {
      toast.error("Please provide a description for the dispute.");
      return;
    }
    
    if (!selectedJob) return;

    try {
      const response = await fetch('/api/disputes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job_id: selectedJob.job_id,
          initiator_id: currentUser.id,
          respondent_id: selectedJob.agency_id,
          dispute_type: disputeForm.type,
          description: disputeForm.description,
          amount_disputed: selectedJob.amount,
        })
      });

      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        console.error("Dispute API error:", { status: response.status, body });
        toast.error(body?.details || body?.error || "Failed to create dispute");
        return;
      }

      const { dispute } = body;
      
      setShowDisputeModal(false);
      setDisputeForm({ type: "client_abandonment", description: "" });
      toast.success("Dispute opened successfully");
      
      // Redirect to the dispute room
      router.push(`/disputes/${dispute.id}`);
      
    } catch (error) {
      console.error("Error creating dispute:", error);
      toast.error("An error occurred while opening the dispute.");
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "verified":
        return (
          <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
            <CheckCircle className="w-3 h-3 mr-1" />
            Verified
          </Badge>
        )
      case "pending_verification":
        return (
          <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">
            <Clock className="w-3 h-3 mr-1" />
            Pending
          </Badge>
        )
      case "failed":
        return (
          <Badge className="bg-red-100 text-red-800 hover:bg-red-100">
            <X className="w-3 h-3 mr-1" />
            Failed
          </Badge>
        )
      default:
        return (
          <Badge className="bg-slate-100 text-gray-800 hover:bg-slate-100">
            <AlertCircle className="w-3 h-3 mr-1" />
            {status}
          </Badge>
        )
    }
  }

  useEffect(() => {
    if (authLoading) return
    if (!currentUser?.id) {
      setLoading(false)
      return
    }
    fetchFundedJobs()
  }, [currentUser?.id, authLoading])

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-primaryxl font-bold text-slate-900 mb-2">Funded Jobs</h1>
          <p className="text-slate-600">Track and verify your funded job payments</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <Eye className="h-8 w-8 text-blue-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-slate-600">Total Jobs</p>
                  <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <Clock className="h-8 w-8 text-yellow-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-slate-600">Pending</p>
                  <p className="text-2xl font-bold text-slate-900">{stats.pending}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <CheckCircle className="h-8 w-8 text-green-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-slate-600">Verified</p>
                  <p className="text-2xl font-bold text-slate-900">{stats.verified}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <X className="h-8 w-8 text-red-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-slate-600">Failed</p>
                  <p className="text-2xl font-bold text-slate-900">{stats.failed}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="h-8 w-8 bg-orange-100 rounded-full flex items-center justify-center">
                  <span className="text-primary font-bold">₦</span>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-slate-600">Total Amount</p>
                  <p className="text-2xl font-bold text-slate-900">₦ {stats.totalAmount.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Jobs Table */}
        <Card>
          <CardHeader>
            <CardTitle>Funded Jobs</CardTitle>
          </CardHeader>
          <CardContent>
            {fundedJobs.length === 0 ? (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  No funded jobs found. Jobs will appear here when agencies fund them for you specifically.
                  <br />
                  <span className="text-sm text-slate-500 mt-2 block">
                    Make sure you're logged in with the correct freelancer account.
                  </span>
                </AlertDescription>
              </Alert>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>Agency</TableHead>
                      <TableHead>Job Title</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Reference ID</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Confirmation</TableHead>
                      <TableHead>Note</TableHead>
                      <TableHead>Funded Date</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fundedJobs.map((job, index) => (
                      <TableRow key={job.id}>
                        <TableCell className="font-medium">{index + 1}</TableCell>
                        <TableCell className="font-medium">{job.agency_name}</TableCell>
                        <TableCell>{job.job_title}</TableCell>
                        <TableCell>₦ {Number(job.amount).toLocaleString()}</TableCell>
                        <TableCell className="font-mono text-sm">{job.reference_id}</TableCell>
                        <TableCell>{getStatusBadge(job.status)}</TableCell>
                        <TableCell className="text-sm text-slate-600">
                          {job.status === "failed" && job.failure_reason ? (
                            <span className="text-red-600">{job.failure_reason}</span>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                        <TableCell>
                          {job.status === "verified" && !job.job_confirmed && (
                            <Button
                              size="sm"
                              onClick={() => handleConfirmJob(job)}
                              disabled={confirmingJobs.has(job.id)}
                              className="bg-primary hover:bg-primary-hover"
                            >
                              {confirmingJobs.has(job.id) ? (
                                <>
                                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                  Confirming...
                                </>
                              ) : (
                                <>
                                  <Briefcase className="w-3 h-3 mr-1" />
                                  Biz
                                </>
                              )}
                            </Button>
                          )}
                          {job.job_confirmed && !job.job_completed && (
                            <Badge className="bg-orange-100 text-orange-800">
                              <Briefcase className="w-3 h-3 mr-1" />
                              Confirmed
                            </Badge>
                          )}
                          {job.job_completed && (
                            <Badge className="bg-green-100 text-green-800">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Completed
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          {job.payout_successful ? (
                            <span className="text-green-600 font-medium">
                              Payout request successful! Your account will be credited within 24–48 hours.
                            </span>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                        <TableCell>{new Date(job.funded_at).toLocaleDateString()}</TableCell>
                        <TableCell>
                          {job.status === "pending_verification" && (
                            <Button
                              size="sm"
                              onClick={() => handleVerifyPayment(job)}
                              disabled={verifyingJobs.has(job.id)}
                              className="bg-primary hover:bg-primary-hover"
                            >
                              {verifyingJobs.has(job.id) ? (
                                <>
                                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                  Verifying...
                                </>
                              ) : (
                                <>
                                  <CheckCircle className="w-3 h-3 mr-1" />
                                  Verify
                                </>
                              )}
                            </Button>
                          )}
                          {job.status === "verified" && job.job_completed && !job.payout_successful && (
                            <div className="flex gap-2">
                              <Badge className="bg-green-100 text-green-800">
                                <CheckCircle className="w-3 h-3 mr-1" />
                                Verified
                              </Badge>
                              <Button
                                size="sm"
                                onClick={() => handlePayout(job)}
                                className="bg-primary hover:bg-primary-hover"
                              >
                                Payout
                              </Button>
                            </div>
                          )}
                          {job.status === "verified" && job.payout_successful && (
                            <div className="flex gap-2">
                              <Badge className="bg-green-100 text-green-800">
                                <CheckCircle className="w-3 h-3 mr-1" />
                                Verified
                              </Badge>
                              <Badge className="bg-green-100 text-green-800">
                                <CheckCircle className="w-3 h-3 mr-1" />
                                Successful
                              </Badge>
                            </div>
                          )}
                          {job.status === "verified" && !job.job_completed && (
                            <div className="flex flex-col gap-2">
                              <Badge className="bg-green-100 text-green-800 w-fit">
                                <CheckCircle className="w-3 h-3 mr-1" />
                                Verified
                              </Badge>
                              <Button
                                size="sm"
                                onClick={() => router.push(`/workspace/${job.job_id}`)}
                                className="bg-slate-900 hover:bg-slate-800 text-white"
                              >
                                <FileText className="w-3 h-3 mr-1" />
                                Workspace
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setSelectedJob(job);
                                  setShowDisputeModal(true);
                                }}
                                className="text-red-600 border-red-200 hover:bg-red-50"
                              >
                                <ShieldAlert className="w-3 h-3 mr-1" />
                                Dispute
                              </Button>
                            </div>
                          )}
                          {job.status === "failed" && (
                            <Badge className="bg-red-100 text-red-800">
                              <X className="w-3 h-3 mr-1" />
                              Failed
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payout Modal */}
        {showPayoutModal && selectedJob && (
          <PayoutModal
            isOpen={showPayoutModal}
            onClose={() => {
              setShowPayoutModal(false)
              setSelectedJob(null)
            }}
            jobData={{
              id: selectedJob.id,
              job_title: selectedJob.job_title,
              amount: selectedJob.amount,
              agency_name: selectedJob.agency_name,
            }}
            onSuccess={handlePayoutSuccess}
          />
        )}
        {/* Dispute Modal */}
        {showDisputeModal && selectedJob && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-md">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <ShieldAlert className="text-red-500 h-5 w-5" />
                    Open a Dispute
                  </CardTitle>
                  <Button variant="ghost" size="icon" onClick={() => setShowDisputeModal(false)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="bg-red-50 p-3 rounded-lg border border-red-100">
                    <p className="text-xs text-red-800">
                      Opening a dispute will flag the job <strong>{selectedJob.job_title}</strong>. 
                      You and the client will have 3-7 days to resolve it in the Dispute Room before an admin steps in.
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Reason for Dispute</Label>
                    <Select
                      value={disputeForm.type}
                      onValueChange={(val) => setDisputeForm(prev => ({ ...prev, type: val }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a reason" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="client_abandonment">Client Abandonment - "Client ghosted after submission"</SelectItem>
                        <SelectItem value="extra_work">Scope Creep - "Client is asking for extra work"</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Describe the Issue</Label>
                    <Textarea 
                      rows={4}
                      placeholder="Provide details about the issue. Be clear about what was agreed upon versus what is happening now."
                      value={disputeForm.description}
                      onChange={(e) => setDisputeForm(prev => ({ ...prev, description: e.target.value }))}
                    />
                  </div>

                  <div className="flex space-x-2 pt-2">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => setShowDisputeModal(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      className="flex-1 bg-red-500 hover:bg-red-600 text-white"
                      onClick={handleCreateDispute}
                    >
                      Open Dispute
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}
