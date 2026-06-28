"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CheckCircle, Clock, AlertCircle, Eye, Loader2, X, Briefcase, ShieldAlert, FileText, Wallet } from "lucide-react"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
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

  const badgeClass = "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap"
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "verified":
        return <span className={`${badgeClass} bg-success/10 text-success`}><CheckCircle className="w-3 h-3" /> Verified</span>
      case "pending_verification":
        return <span className={`${badgeClass} bg-warning/10 text-warning`}><Clock className="w-3 h-3" /> Pending</span>
      case "failed":
        return <span className={`${badgeClass} bg-destructive/10 text-destructive`}><X className="w-3 h-3" /> Failed</span>
      default:
        return <span className={`${badgeClass} bg-surface-2 text-muted-foreground`}><AlertCircle className="w-3 h-3" /> {status}</span>
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
      <div className="min-h-screen bg-surface">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface pb-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Header */}
        <header className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Earnings</p>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Funded jobs</h1>
          <p className="text-sm text-muted-foreground">Track and verify the payments agencies have funded for your work.</p>
        </header>

        {/* Metric tiles */}
        <section className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {[
            { label: "Total jobs", value: stats.total, icon: Eye, tone: "text-muted-foreground", accent: false },
            { label: "Pending", value: stats.pending, icon: Clock, tone: "text-warning", accent: false },
            { label: "Verified", value: stats.verified, icon: CheckCircle, tone: "text-success", accent: false },
            { label: "Failed", value: stats.failed, icon: X, tone: "text-destructive", accent: false },
            { label: "Available", value: `₦${stats.totalAmount.toLocaleString()}`, icon: Wallet, tone: "text-primary", accent: true },
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

        {/* Jobs Table */}
        <Card className="rounded-xl border border-border bg-card shadow-none">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-foreground">Funded jobs</CardTitle>
          </CardHeader>
          <CardContent>
            {fundedJobs.length === 0 ? (
              <div className="py-16 px-6 text-center">
                <div className="mx-auto h-11 w-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <Briefcase className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-sm font-semibold text-foreground">No funded jobs yet</h3>
                <p className="mt-1 text-sm text-muted-foreground max-w-sm mx-auto">
                  Jobs appear here once an agency funds them for you. Make sure you&apos;re signed in with the right account.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {fundedJobs.map((job) => (
                  <div key={job.id} className="py-4 first:pt-0 last:pb-0">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-sm font-semibold text-foreground">{job.job_title}</h3>
                          {getStatusBadge(job.status)}
                          {job.job_confirmed && !job.job_completed && (
                            <span className={`${badgeClass} bg-primary-soft text-primary`}>
                              <Briefcase className="w-3 h-3" /> Confirmed
                            </span>
                          )}
                          {job.job_completed && (
                            <span className={`${badgeClass} bg-success/10 text-success`}>
                              <CheckCircle className="w-3 h-3" /> Completed
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          <span>{job.agency_name}</span>
                          <span className="font-medium text-foreground tabular-nums">₦{Number(job.amount).toLocaleString()}</span>
                          <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{new Date(job.funded_at).toLocaleDateString()}</span>
                          <span className="font-mono text-[11px] truncate max-w-[12rem]">{job.reference_id}</span>
                        </div>
                        {job.status === "failed" && job.failure_reason && (
                          <p className="text-xs text-destructive">{job.failure_reason}</p>
                        )}
                        {job.payout_successful && (
                          <p className="text-xs text-success">Payout request successful — your account will be credited within 24–48 hours.</p>
                        )}
                        {job.status === "verified" && job.job_completed && !job.payout_successful && (
                          <p className="text-xs text-muted-foreground">Withdraw from the job in your Proposals once work is approved.</p>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        {job.status === "pending_verification" && (
                          <Button size="sm" className="gap-1.5" onClick={() => handleVerifyPayment(job)} disabled={verifyingJobs.has(job.id)}>
                            {verifyingJobs.has(job.id) ? (
                              <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Verifying…</>
                            ) : (
                              <><CheckCircle className="w-3.5 h-3.5" /> Verify</>
                            )}
                          </Button>
                        )}
                        {job.status === "verified" && !job.job_confirmed && (
                          <Button size="sm" className="gap-1.5" onClick={() => handleConfirmJob(job)} disabled={confirmingJobs.has(job.id)}>
                            {confirmingJobs.has(job.id) ? (
                              <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Confirming…</>
                            ) : (
                              <><Briefcase className="w-3.5 h-3.5" /> Confirm</>
                            )}
                          </Button>
                        )}
                        {job.status === "verified" && !job.job_completed && (
                          <>
                            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => router.push(`/workspace/${job.job_id}`)}>
                              <FileText className="w-3.5 h-3.5" /> Workspace
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10"
                              onClick={() => {
                                setSelectedJob(job)
                                setShowDisputeModal(true)
                              }}
                            >
                              <ShieldAlert className="w-3.5 h-3.5" /> Dispute
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Dispute Modal */}
        {showDisputeModal && selectedJob && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-md">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <ShieldAlert className="text-destructive h-5 w-5" />
                    Open a dispute
                  </CardTitle>
                  <Button variant="ghost" size="icon" onClick={() => setShowDisputeModal(false)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="bg-destructive/10 p-3 rounded-lg border border-destructive/20">
                    <p className="text-xs text-destructive">
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
                      variant="destructive"
                      className="flex-1"
                      onClick={handleCreateDispute}
                    >
                      Open dispute
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
