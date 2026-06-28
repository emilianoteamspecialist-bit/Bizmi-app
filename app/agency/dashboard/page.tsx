"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Reveal } from "@/components/reveal"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Plus,
  MoreHorizontal,
  TrendingUp,
  Eye,
  Calendar,
  FileText,
  Play,
  Pause,
  X,
  Edit,
  MapPin,
  Clock,
  Users,
  CheckCircle,
  XCircle,
  Search,
  ShieldAlert,
  ArrowUpRight,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { toast } from "sonner"
import { getAgencyJobs, updateJobStatus, createJob, updateJob } from "@/app/actions/jobs"
import { getProfile, getAgencyImage, getFreelancerLogos } from "@/app/actions/user"
import { respondToProposal } from "@/app/actions/proposals"
import { ALL_SKILLS } from "@/lib/categories"

// Available skills for selection
const availableSkills = ALL_SKILLS;

export default function AgencyDashboard() {
  const [isDarkMode, setIsDarkMode] = useState(false)
  const [showJobActionModal, setShowJobActionModal] = useState(false)
  const [selectedJob, setSelectedJob] = useState<any>(null)
  const [actionType, setActionType] = useState<"edit" | "pause" | "close" | null>(null)
  const [showPostJobModal, setShowPostJobModal] = useState(false)
  const [postJobStep, setPostJobStep] = useState(1)
  const [selectedSkills, setSelectedSkills] = useState<string[]>([])
  const [agencyJobs, setAgencyJobs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showProposalsModal, setShowProposalsModal] = useState(false)
  const [loadingProposals, setLoadingProposals] = useState(false)
  const [selectedJobProposals, setSelectedJobProposals] = useState<any[]>([])
  // Escrow status (v2) for the currently viewed job. Used to hide "Fund Job"
  // once the job has already been funded — the prior UI showed the button
  // even after a successful payment because nothing fetched escrow state.
  const [selectedJobEscrowStatus, setSelectedJobEscrowStatus] = useState<string | null>(null)
  const [freelancerImages, setFreelancerImages] = useState<{ [key: string]: string }>({})
  const [proposalSearchTerm, setProposalSearchTerm] = useState("")
  const [jobFormData, setJobFormData] = useState({
    title: "",
    description: "",
    budgetMin: "",
    budgetMax: "",
    duration: "",
    location: "",
    jobType: "",
    credits: 5,
    comments: "",
  })
  const router = useRouter()
  const [profileImage, setProfileImage] = useState<string>("")
  const [profile, setProfile] = useState<any>(null)
  const [editingJobId, setEditingJobId] = useState<string | null>(null)
  const [isPosting, setIsPosting] = useState(false)
  // Synchronous lock against double-submit; ref wins the race against React's batched state.
  const isSubmittingRef = useRef(false)
  // Idempotency key for the current Post-a-Job attempt. Kept across retries so
  // a duplicated insert (network retry, refresh-then-resubmit) hits the unique
  // index and is treated as success rather than creating a second row.
  const idempotencyKeyRef = useRef<string | null>(null)
  const [showDisputeModal, setShowDisputeModal] = useState(false)
  const [disputeForm, setDisputeForm] = useState<{ type: string; description: string }>({
    type: "quality",
    description: "",
  })
  const [currentMessageText, setCurrentMessageText] = useState("")
  const [messageInputOpenForProposalId, setMessageInputOpenForProposalId] = useState<string | null>(null)
  const [fundingProposalId, setFundingProposalId] = useState<string | null>(null)

  const handleFundProposal = async (proposalId: string) => {
    if (fundingProposalId) return
    setFundingProposalId(proposalId)
    try {
      const res = await fetch("/api/escrow/initialize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proposalId }),
      })
      const data = await res.json()
      if (!res.ok || !data?.authorization_url) {
        toast.error(data?.error || "Failed to start funding")
        setFundingProposalId(null)
        return
      }
      window.location.href = data.authorization_url
    } catch (err) {
      console.error("fund job error:", err)
      toast.error("Could not reach the payment service. Please try again.")
      setFundingProposalId(null)
    }
  }

  useEffect(() => {
    loadProfileAndJobs()

    const searchParams = new URLSearchParams(window.location.search)
    if (searchParams.get("post") === "true") {
      setShowPostJobModal(true)
      window.history.replaceState({}, "", window.location.pathname)
    }

    // Paystack redirects here after a successful charge. Hit the verify
    // endpoint so the escrow transitions awaiting -> funded even when no
    // webhook can reach us (localhost dev, missed webhook, etc.).
    const fundedId = searchParams.get("escrow_funded")
    if (fundedId) {
      window.history.replaceState({}, "", window.location.pathname)
      ;(async () => {
        try {
          const res = await fetch(
            `/api/escrow/verify?reference=${encodeURIComponent(`escrow_${fundedId}`)}`,
          )
          const data = await res.json()
          if (res.ok && data.success) {
            toast.success(
              data.already_processed
                ? "Funding already confirmed."
                : "Job funded successfully.",
            )
            loadProfileAndJobs()
          } else {
            toast.error(data.error || "Could not confirm payment yet.")
          }
        } catch (err) {
          console.error("escrow verify error:", err)
          toast.error("Could not confirm payment. Please refresh.")
        }
      })()
    }
  }, [])

  // Live proposal counts: subscribe to INSERTs on `proposals`. RLS on the
  // table restricts the realtime stream to rows this agency can read (i.e.
  // proposals on its own jobs), so a single global channel is enough.
  useEffect(() => {
    const channel = supabase
      .channel("agency_dashboard_proposals")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "proposals" },
        () => {
          loadProfileAndJobs()
        },
      )
      .subscribe((status, err) => {
        if (err) console.error("[Realtime] proposals subscription error:", err)
        if (status === "CHANNEL_ERROR") {
          console.warn(
            "[Realtime] proposals channel failed. Ensure proposals is in the supabase_realtime publication (run scripts/enable-realtime-proposals.sql).",
          )
        }
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const loadProfileAndJobs = async () => {
    try {
      setLoading(true)
      const [prof, img, jobs] = await Promise.all([
        getProfile(),
        getAgencyImage(),
        getAgencyJobs()
      ])

      if (prof) setProfile(prof)
      if (img) setProfileImage(img)
      if (jobs) setAgencyJobs(jobs)
    } catch (error) {
      console.error("Error loading profile and jobs:", error)
    } finally {
      setLoading(false)
    }
  }

  const loadFreelancerImages = async (freelancerIds: string[]) => {
    try {
      const images = await getFreelancerLogos(freelancerIds)
      setFreelancerImages(prev => ({ ...prev, ...images }))
    } catch (error) {
      console.error("Error loading freelancer images:", error)
    }
  }

  const handleJobAction = async (job: any, action: "edit" | "pause" | "close") => {
    if (action === "edit") {
      // Populate form with existing job data
      setJobFormData({
        title: job.title,
        description: job.description,
        budgetMin: job.budget_min,
        budgetMax: job.budget_max,
        duration: job.duration,
        location: job.location,
        jobType: job.job_type,
        credits: job.credit_cost,
        comments: job.comments || "",
      })
      setSelectedSkills(job.skills || [])
      setEditingJobId(job.id) // Set the job ID being edited
      setShowPostJobModal(true) // Show the job form instead of action modal
    } else {
      try {
        const newStatus = action === "pause" ? (job.status === "paused" ? "active" : "paused") : "closed"
        await updateJobStatus(job.id, newStatus)
        loadProfileAndJobs()
        alert(`Job ${newStatus === "active" ? "resumed" : newStatus} successfully!`)
      } catch (error) {
        console.error("Error updating job:", error)
        alert("Error updating job. Please try again.")
      }
    }
  }

  const handleCreateDispute = async () => {
    if (!disputeForm.description.trim()) {
      alert("Please provide a description for the dispute.");
      return;
    }

    try {
      // Find the accepted proposal to get the freelancer ID
      const { data: proposal } = await supabase
        .from("proposals")
        .select("freelancer_id")
        .eq("job_id", selectedJob.id)
        .eq("status", "accepted")
        .single();

      if (!proposal) {
        alert("Cannot open a dispute: No accepted freelancer found for this job.");
        return;
      }

      const response = await fetch('/api/disputes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job_id: selectedJob.id,
          initiator_id: profile.id,
          respondent_id: proposal.freelancer_id,
          dispute_type: disputeForm.type,
          description: disputeForm.description,
          amount_disputed: selectedJob.budget_max || 0,
        })
      });

      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        console.error("Dispute API error:", { status: response.status, body });
        alert(body?.details || body?.error || "Failed to create dispute");
        return;
      }

      const { dispute } = body;
      
      setShowDisputeModal(false);
      setDisputeForm({ type: "quality", description: "" });
      
      // Redirect to the dispute room
      router.push(`/disputes/${dispute.id}`);
      
    } catch (error) {
      console.error("Error creating dispute:", error);
      alert("An error occurred while opening the dispute.");
    }
  }

  const handleJobSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()

    // Synchronous double-submit guard. The `disabled` prop on the button is
    // driven by React state (`isPosting`) which can lag a fast second click.
    if (isSubmittingRef.current) return
    isSubmittingRef.current = true

    // Reuse the same key across retries of THIS attempt so the DB unique
    // index collapses duplicates. New attempts (after success or explicit
    // cancel) start from a fresh key — see resetJobForm and the cancel path.
    if (!idempotencyKeyRef.current) {
      idempotencyKeyRef.current = crypto.randomUUID()
    }
    const idempotencyKey = idempotencyKeyRef.current

    try {
      setIsPosting(true)
      const jobInput = {
        title: jobFormData.title,
        description: jobFormData.description,
        skills: selectedSkills,
        budget_min: jobFormData.budgetMin ? Number.parseInt(jobFormData.budgetMin) : null,
        budget_max: jobFormData.budgetMax ? Number.parseInt(jobFormData.budgetMax) : null,
        duration: jobFormData.duration,
        location: jobFormData.location,
        job_type: jobFormData.jobType,
        credit_cost: jobFormData.credits,
      }

      const result = editingJobId
        ? await updateJob(editingJobId, jobInput)
        : await createJob(jobInput, idempotencyKey)

      if (!result.success) {
        const msg = result.error === "Unauthorized"
          ? "You must be signed in to post a job."
          : `Error saving job: ${result.error}`
        alert(msg)
        return
      }

      idempotencyKeyRef.current = null
      setJobFormData({
        title: "",
        description: "",
        budgetMin: "",
        budgetMax: "",
        duration: "",
        location: "",
        jobType: "",
        credits: 5,
        comments: "",
      })
      setSelectedSkills([])
      setEditingJobId(null)
      setShowPostJobModal(false)
      loadProfileAndJobs()
      alert(editingJobId ? "Job updated successfully!" : "Job posted successfully!")
    } catch (error) {
      console.error("Error saving job:", error)
      alert("Error saving job. Please try again.")
    } finally {
      setIsPosting(false)
      isSubmittingRef.current = false
    }
  }

  const handleViewProposals = async (job: any) => {
    setSelectedJob(job)
    setShowProposalsModal(true)
    setLoadingProposals(true)
    setSelectedJobProposals([])
    setSelectedJobEscrowStatus(null)

    // Fire the escrow lookup in parallel — we don't need it to render the
    // proposal list, only to decide which action buttons to show.
    supabase
      .from("escrow_deposits")
      .select("status_v2")
      .eq("job_id", job.id)
      .not("status_v2", "is", null)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) {
          console.error("escrow status lookup error:", error)
          return
        }
        setSelectedJobEscrowStatus(data?.status_v2 ?? null)
      })

    try {
      const { data: proposalsData, error } = await supabase
        .from("proposals")
        .select(`
          id,
          job_id,
          freelancer_id,
          proposal_text,
          budget,
          timeline,
          attachments,
          status,
          created_at,
          updated_at,
          profiles!proposals_freelancer_id_fkey (
            id,
            full_name,
            bio,
            location,
            phone,
            website
          )
        `)
        .eq("job_id", job.id)
        .order("created_at", { ascending: false })

      console.log("[proposals] loaded", { count: proposalsData?.length, error })

      if (error) {
        console.error("Error loading proposals:", error)
        alert(`Error loading proposals: ${error.message}`)
        return
      }

      setSelectedJobProposals(proposalsData || [])

      const freelancerIds = proposalsData?.map((p) => p.freelancer_id) ?? []
      if (freelancerIds.length > 0) {
        // Load images in the background so the proposals list shows immediately.
        // A hang here used to keep the whole modal on the spinner.
        loadFreelancerImages(freelancerIds).catch((err) =>
          console.error("loadFreelancerImages error:", err),
        )
      }
    } catch (error) {
      console.error("Error loading proposals:", error)
      alert("Error loading proposals. Please try again.")
    } finally {
      setLoadingProposals(false)
    }
  }

  const handleProposalAction = async (proposalId: string, action: "accept" | "reject") => {
    try {
      // Server action: verifies this agency owns the job before changing status.
      const result = await respondToProposal(proposalId, action)
      if (!result.success) {
        alert(
          result.error === "Forbidden"
            ? "You can only act on proposals for your own jobs."
            : `Error updating proposal: ${result.error}`,
        )
        return
      }

      // Reload proposals
      handleViewProposals(selectedJob)
      alert(`Proposal ${action}ed successfully!`)
    } catch (error) {
      console.error("Error updating proposal:", error)
      alert("Error updating proposal. Please try again.")
    }
  }

  const handleSendMessage = async (freelancerId: string, agencyId: string, message: string) => {
    if (!message.trim()) {
      alert("Message cannot be empty.")
      return
    }
    try {
      // Check if a conversation already exists
      const { data: existingConversations, error: conversationError } = await supabase
        .from("conversations")
        .select("id")
        .or(
          `and(participant1_id.eq.${agencyId},participant2_id.eq.${freelancerId}),and(participant1_id.eq.${freelancerId},participant2_id.eq.${agencyId})`
        )
        .limit(1)

      if (conversationError) throw conversationError

      let conversationId = existingConversations?.[0]?.id

      if (!conversationId) {
        // No rows found, create a new conversation
        const { data: newConversation, error: newConversationError } = await supabase
          .from("conversations")
          .insert([{ participant1_id: agencyId, participant2_id: freelancerId }])
          .select("id")
          .single()

        if (newConversationError) {
          console.error("Error creating new conversation:", newConversationError)
          alert("Error creating conversation.")
          return
        }
        conversationId = newConversation.id
      }

      // Insert the message
      const { error: messageError } = await supabase.from("messages").insert([
        {
          conversation_id: conversationId,
          sender_id: agencyId,
          receiver_id: freelancerId,
          message_text: message,
        },
      ])

      if (messageError) {
        console.error("Error sending message:", messageError)
        alert("Error sending message.")
        return
      }

      // Update last_message_at for the conversation
      await supabase
        .from("conversations")
        .update({ last_message_at: new Date().toISOString() })
        .eq("id", conversationId)

      alert("Message sent successfully!")
      setCurrentMessageText("")
      setMessageInputOpenForProposalId(null)
    } catch (error) {
      console.error("Error in sending message process:", error)
      alert("Error sending message. Please try again.")
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-800 border-green-200"
      case "paused":
        return "bg-yellow-100 text-yellow-800 border-yellow-200"
      case "closed":
        return "bg-slate-100 text-gray-800 border-slate-200"
      default:
        return "bg-slate-100 text-gray-800 border-slate-200"
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "active":
        return <Play className="h-3 w-3" />
      case "paused":
        return <Pause className="h-3 w-3" />
      case "closed":
        return <X className="h-3 w-3" />
      default:
        return null
    }
  }

  const addSkill = (skill: string) => {
    if (!selectedSkills.includes(skill)) {
      setSelectedSkills([...selectedSkills, skill])
    }
  }

  const removeSkill = (skill: string) => {
    setSelectedSkills(selectedSkills.filter((s) => s !== skill))
  }

  // Calculate metrics
  const activeJobs = agencyJobs.filter((job) => job.status === "active").length
  const pausedJobs = agencyJobs.filter((job) => job.status === "paused").length
  const closedJobs = agencyJobs.filter((job) => job.status === "closed").length
  const totalProposals = agencyJobs.reduce((sum, job) => sum + job.proposals, 0)

  const filteredProposals = selectedJobProposals.filter((proposal) => {
    if (!proposalSearchTerm) return true

    const searchLower = proposalSearchTerm.toLowerCase()
    const freelancerName = proposal.profiles?.full_name?.toLowerCase() || ""
    const freelancerLocation = proposal.profiles?.location?.toLowerCase() || ""
    const freelancerBio = proposal.profiles?.bio?.toLowerCase() || ""
    const proposalText = proposal.proposal_text?.toLowerCase() || ""

    return (
      freelancerName.includes(searchLower) ||
      freelancerLocation.includes(searchLower) ||
      freelancerBio.includes(searchLower) ||
      proposalText.includes(searchLower)
    )
  })

  const resetJobForm = () => {
    setJobFormData({
      title: "", description: "", budgetMin: "", budgetMax: "",
      duration: "", location: "", jobType: "", credits: 5, comments: "",
    })
    setSelectedSkills([])
    setEditingJobId(null)
    idempotencyKeyRef.current = null
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-surface">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-pulse">
          <div className="flex items-end justify-between gap-4">
            <div className="space-y-2">
              <div className="h-3 w-24 bg-foreground/5 rounded" />
              <div className="h-7 w-56 bg-foreground/5 rounded" />
              <div className="h-3 w-72 bg-foreground/5 rounded" />
            </div>
            <div className="h-10 w-28 bg-foreground/5 rounded-lg" />
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 bg-card border border-border rounded-xl" />
            ))}
          </div>
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-card border border-border rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  const agencyName = profile?.company_name || profile?.full_name || "Your"

  return (
    <div className="min-h-screen bg-surface pb-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8 space-y-8">

        {/* Toolbar header */}
        <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div className="space-y-1 min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Hiring desk</p>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground truncate">
              {agencyName === "Your" ? "Your hiring desk" : agencyName}
            </h1>
            <p className="text-sm text-muted-foreground">Compose briefs, weigh proposals, hire decisively.</p>
          </div>
          <Button
            onClick={() => { resetJobForm(); setShowPostJobModal(true) }}
            className="h-10 px-4 rounded-lg gap-2 shrink-0 w-full sm:w-auto justify-center"
          >
            <Plus className="h-4 w-4" /> Post a job
          </Button>
        </header>

        {/* Metric tiles */}
        <Reveal>
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: "Active", value: activeJobs, icon: Play, tone: "text-success", accent: false },
            { label: "Paused", value: pausedJobs, icon: Pause, tone: "text-warning", accent: false },
            { label: "Closed", value: closedJobs, icon: X, tone: "text-muted-foreground", accent: false },
            { label: "Proposals", value: totalProposals, icon: Users, tone: "text-primary", accent: true },
          ].map((stat) => (
            <div
              key={stat.label}
              className={`rounded-xl border bg-card p-4 ${stat.accent ? "border-primary/30" : "border-border"}`}
            >
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground">{stat.label}</p>
                <stat.icon className={`h-3.5 w-3.5 ${stat.tone}`} />
              </div>
              <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground tabular-nums">{stat.value}</p>
            </div>
          ))}
        </section>
        </Reveal>

        {/* Jobs */}
        <Reveal delay={0.08}>
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground">
            Your jobs <span className="font-normal text-muted-foreground">· {agencyJobs.length}</span>
          </h2>

          {agencyJobs.length === 0 ? (
            <div className="rounded-xl border border-border bg-card py-16 px-6 text-center">
              <div className="mx-auto h-11 w-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <FileText className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-sm font-semibold text-foreground">No jobs yet</h3>
              <p className="mt-1 text-sm text-muted-foreground max-w-sm mx-auto">
                Post your first opportunity and we&apos;ll bring qualified freelancers to your door.
              </p>
              <Button className="mt-5 gap-2" onClick={() => { resetJobForm(); setShowPostJobModal(true) }}>
                <Plus className="h-4 w-4" /> Post a job
              </Button>
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-card divide-y divide-border overflow-hidden">
              {agencyJobs.map((job) => {
                const proposalCount = job.proposals ?? 0
                return (
                  <div key={job.id} className="p-4 sm:p-5 transition-colors hover:bg-surface/60">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <div className="flex items-center gap-2.5">
                          <h3 className="text-sm font-semibold text-foreground truncate">{job.title}</h3>
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border ${getStatusColor(job.status)}`}>
                            {getStatusIcon(job.status)}
                            {job.status}
                          </span>
                        </div>
                        {job.description && (
                          <p className="text-sm text-muted-foreground line-clamp-1 max-w-2xl">{job.description}</p>
                        )}
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          <span className="font-medium text-foreground tabular-nums">
                            ₦{job.budget_min?.toLocaleString() ?? "—"} – ₦{job.budget_max?.toLocaleString() ?? "—"}
                          </span>
                          <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{job.duration || "Flexible"}</span>
                          <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{job.location || "Remote"}</span>
                          <span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" />{new Date(job.created_at).toLocaleDateString("en-NG", { day: "numeric", month: "short" })}</span>
                          <span className="font-medium text-primary">{proposalCount} {proposalCount === 1 ? "proposal" : "proposals"}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Button variant="outline" size="sm" onClick={() => handleViewProposals(job)}>Review bids</Button>
                        {(job.status === "active" || job.status === "closed") && (
                          <Button variant="ghost" size="sm" onClick={() => router.push(`/workspace/${job.id}`)}>Workspace</Button>
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-52">
                            <DropdownMenuItem className="cursor-pointer" onClick={() => handleJobAction(job, "edit")}>
                              <Edit className="mr-2 h-4 w-4 text-muted-foreground" /> Edit brief
                            </DropdownMenuItem>
                            <DropdownMenuItem className="cursor-pointer" onClick={() => handleJobAction(job, "pause")}>
                              <Pause className="mr-2 h-4 w-4 text-muted-foreground" /> {job.status === "paused" ? "Resume hiring" : "Pause hiring"}
                            </DropdownMenuItem>
                            <DropdownMenuItem className="cursor-pointer" onClick={() => { setSelectedJob(job); setShowDisputeModal(true) }}>
                              <ShieldAlert className="mr-2 h-4 w-4 text-primary" /> Open dispute
                            </DropdownMenuItem>
                            <DropdownMenuItem className="cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/5" onClick={() => handleJobAction(job, "close")}>
                              <X className="mr-2 h-4 w-4" /> Close listing
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                    {!!job.skills?.length && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {job.skills.slice(0, 6).map((sk: string) => (
                          <span key={sk} className="px-2 py-0.5 rounded-md bg-surface-2 text-muted-foreground text-[11px]">{sk}</span>
                        ))}
                        {job.skills.length > 6 && (
                          <span className="px-2 py-0.5 text-[11px] text-muted-foreground">+{job.skills.length - 6}</span>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </section>
        </Reveal>
      </div>

      {/* Proposals Modal */}
      {showProposalsModal && selectedJob && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-full sm:max-w-lg md:max-w-2xl lg:max-w-4xl max-h-[90vh] overflow-y-auto rounded-lg">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl">Proposals for "{selectedJob.title}"</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    {selectedJobProposals.length} proposal{selectedJobProposals.length !== 1 ? "s" : ""} received
                    {proposalSearchTerm && <span> • {filteredProposals.length} matching</span>}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setShowProposalsModal(false)
                    setProposalSearchTerm("")
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="mt-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search freelancers by name, location, bio, or proposal..."
                    value={proposalSearchTerm}
                    onChange={(e) => setProposalSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loadingProposals ? (
                <div className="text-center py-8">
                  <div className="animate-spin inline-block w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
                  <p className="text-muted-foreground mt-4">Loading proposals...</p>
                </div>
              ) : selectedJobProposals.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-semibold mb-2">No Proposals Yet</h3>
                  <p className="text-muted-foreground">Freelancers haven't submitted any proposals for this job yet.</p>
                </div>
              ) : filteredProposals.length === 0 ? (
                <div className="text-center py-8">
                  <Search className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-semibold mb-2">No Matching Proposals</h3>
                  <p className="text-muted-foreground">
                    No proposals match your search criteria. Try different keywords.
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {filteredProposals.map((proposal) => (
                    <div key={proposal.id} className="border border-slate-200 dark:border-gray-700 rounded-lg p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center space-x-3">
                          <Avatar className="h-12 w-12">
                            <AvatarImage
                              src={freelancerImages[proposal.freelancer_id] || "/placeholder.svg?height=48&width=48"}
                              alt="Freelancer"
                            />
                            <AvatarFallback>{proposal.profiles?.full_name?.charAt(0) || "F"}</AvatarFallback>
                          </Avatar>
                          <div>
                            <h4 className="font-semibold">{proposal.profiles?.full_name || "Unknown Freelancer"}</h4>
                            <p className="text-sm text-muted-foreground">
                              {proposal.profiles?.location || "Location not specified"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Submitted {new Date(proposal.created_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Badge
                            className={`${
                              proposal.status === "accepted"
                                ? "bg-green-100 text-green-800"
                                : proposal.status === "rejected"
                                  ? "bg-red-100 text-red-800"
                                  : "bg-yellow-100 text-yellow-800"
                            }`}
                          >
                            {proposal.status.charAt(0).toUpperCase() + proposal.status.slice(1)}
                          </Badge>
                        </div>
                      </div>
                      <div className="space-y-3">
                        <div>
                          <h5 className="font-medium mb-2">Proposal</h5>
                          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{proposal.proposal_text}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <h5 className="font-medium mb-1">Timeline</h5>
                            <p className="text-sm text-muted-foreground">{proposal.timeline || "Not specified"}</p>
                          </div>
                          <div>
                            <h5 className="font-medium mb-1">Budget</h5>
                            <p className="text-sm font-semibold text-primary">
                              {proposal.budget || "Not specified"}
                            </p>
                          </div>
                        </div>
                        {proposal.profiles?.bio && (
                          <div>
                            <h5 className="font-medium mb-1">About Freelancer</h5>
                            <p className="text-sm text-muted-foreground">{proposal.profiles.bio}</p>
                          </div>
                        )}
                        {/* Action buttons based on proposal status */}
                        {proposal.status === "pending" && (
                          <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2 pt-4">
                            <Button
                              variant="outline"
                              className="flex-1 bg-transparent border-red-500 text-red-500 hover:bg-red-50"
                              onClick={() => handleProposalAction(proposal.id, "reject")}
                            >
                              <XCircle className="h-4 w-4 mr-2" />
                              Reject
                            </Button>
                            <Button
                              className="flex-1 bg-green-500 hover:bg-green-600"
                              onClick={() => handleProposalAction(proposal.id, "accept")}
                            >
                              <CheckCircle className="h-4 w-4 mr-2" />
                              Accept
                            </Button>
                          </div>
                        )}
                        {proposal.status === "accepted" && (
                          <div className="pt-4">
                            {!messageInputOpenForProposalId || messageInputOpenForProposalId !== proposal.id ? (
                              <div className="flex flex-col sm:flex-row gap-2">
                                <Button
                                  className="flex-1 bg-primary hover:bg-primary-hover"
                                  onClick={() => {
                                    setMessageInputOpenForProposalId(proposal.id)
                                    setCurrentMessageText("")
                                  }}
                                >
                                  Message Freelancer
                                </Button>
                                {selectedJobEscrowStatus &&
                                ["funded", "released", "paid_out"].includes(selectedJobEscrowStatus) ? (
                                  <Button
                                    className="flex-1"
                                    variant="outline"
                                    disabled
                                  >
                                    <CheckCircle className="h-4 w-4 mr-2" />
                                    {selectedJobEscrowStatus === "funded"
                                      ? "Funded"
                                      : selectedJobEscrowStatus === "released"
                                        ? "Released"
                                        : "Paid out"}
                                  </Button>
                                ) : (
                                  <Button
                                    className="flex-1 bg-primary hover:bg-primary-hover"
                                    onClick={() => handleFundProposal(proposal.id)}
                                    disabled={fundingProposalId === proposal.id}
                                  >
                                    {fundingProposalId === proposal.id ? "Starting…" : "Fund Job"}
                                  </Button>
                                )}
                              </div>
                            ) : (
                              <div className="space-y-3">
                                <Textarea
                                  placeholder={`Send a message to ${proposal.profiles?.full_name || "this freelancer"}...`}
                                  value={currentMessageText}
                                  onChange={(e) => setCurrentMessageText(e.target.value)}
                                  rows={4}
                                />
                                <div className="flex justify-end space-x-2">
                                  <Button
                                    variant="outline"
                                    onClick={() => {
                                      setMessageInputOpenForProposalId(null)
                                      setCurrentMessageText("")
                                    }}
                                  >
                                    Cancel
                                  </Button>
                                  <Button
                                    className="bg-primary hover:bg-primary-hover"
                                    onClick={() =>
                                      handleSendMessage(proposal.freelancer_id, profile?.id, currentMessageText)
                                    }
                                  >
                                    Send Message
                                  </Button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}


      {/* Post Job Modal */}
      {showPostJobModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50">
          <div className="fixed right-0 top-0 h-full w-full max-w-sm sm:max-w-md lg:max-w-2xl bg-white dark:bg-slate-800 shadow-xl transform transition-transform duration-300 ease-in-out">
            <div className="h-full flex flex-col">
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-gray-700">
                <div>
                  <h3 className="text-xl font-semibold text-slate-900 dark:text-white">
                    {editingJobId ? "Edit Job Post" : "Post a Job"}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Step {postJobStep} of 4 -{" "}
                    {postJobStep === 1
                      ? "Job Details"
                      : postJobStep === 2
                        ? "Skills & Credits"
                        : postJobStep === 3
                          ? "Job Type & Budget"
                          : "Review & Post"}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setShowPostJobModal(false)
                    setPostJobStep(1)
                    setSelectedSkills([])
                    setJobFormData({
                      title: "",
                      description: "",
                      budgetMin: "",
                      budgetMax: "",
                      duration: "",
                      location: "",
                      jobType: "",
                      credits: 5,
                      comments: "",
                    })
                    setEditingJobId(null)
                    idempotencyKeyRef.current = null
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              {/* Progress Bar */}
              <div className="px-6 py-3 border-b border-slate-200 dark:border-gray-700">
                <div className="flex items-center space-x-2">
                  {[1, 2, 3, 4].map((step) => (
                    <div key={step} className="flex items-center">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                          step <= postJobStep
                            ? "bg-primary text-white"
                            : "bg-slate-200 dark:bg-gray-600 text-slate-500 dark:text-slate-400"
                        }`}
                      >
                        {step}
                      </div>
                      {step < 4 && (
                        <div
                          className={`w-12 h-1 mx-2 ${
                            step < postJobStep ? "bg-primary" : "bg-slate-200 dark:bg-gray-600"
                          }`}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
              {/* Scrollable Content */}
              <div className="flex-1 overflow-y-auto p-6">
                {/* Step 1: Job Details */}
                {postJobStep === 1 && (
                  <div className="space-y-6">
                    <div>
                      <Label className="text-sm font-medium mb-3 block text-slate-900 dark:text-white">
                        Job Title *
                      </Label>
                      <Input
                        type="text"
                        placeholder="e.g. Full-Stack Developer for E-commerce Platform"
                        className="w-full"
                        value={jobFormData.title}
                        onChange={(e) => setJobFormData({ ...jobFormData, title: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label className="text-sm font-medium mb-3 block text-slate-900 dark:text-white">
                        Job Description *
                      </Label>
                      <Textarea
                        rows={8}
                        placeholder="Describe your project in detail. Include requirements, expectations, deliverables, and any specific instructions for freelancers..."
                        className="w-full resize-none"
                        value={jobFormData.description}
                        onChange={(e) => setJobFormData({ ...jobFormData, description: e.target.value })}
                      />
                      <p className="text-xs text-muted-foreground mt-2">
                        {jobFormData.description.length}/2000 characters
                      </p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium mb-3 block text-slate-900 dark:text-white">Duration *</Label>
                      <Input
                        type="text"
                        placeholder="e.g. 2 weeks, 1 month, 3 months"
                        className="w-full"
                        value={jobFormData.duration}
                        onChange={(e) => setJobFormData({ ...jobFormData, duration: e.target.value })}
                      />
                    </div>
                  </div>
                )}
                {/* Step 2: Skills & Credits */}
                {postJobStep === 2 && (
                  <div className="space-y-6">
                    <div>
                      <Label className="text-sm font-medium mb-3 block text-slate-900 dark:text-white">
                        Required Skills *
                      </Label>
                      <div className="border border-slate-300 dark:border-gray-600 rounded-lg p-4 max-h-80 overflow-y-auto bg-white dark:bg-gray-700">
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                          {availableSkills.map((skill) => (
                            <label
                              key={skill}
                              className="flex items-center space-x-2 cursor-pointer p-2 rounded hover:bg-slate-50 dark:hover:bg-gray-600"
                            >
                              <input
                                type="checkbox"
                                checked={selectedSkills.includes(skill)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    addSkill(skill)
                                  } else {
                                    removeSkill(skill)
                                  }
                                }}
                                className="rounded border-slate-300 text-primary focus:ring-primary"
                              />
                              <span className="text-sm text-slate-900 dark:text-white">{skill}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>
                    {selectedSkills.length > 0 && (
                      <div className="mt-4">
                        <p className="text-sm font-medium mb-3 text-slate-900 dark:text-white">
                          Selected Skills ({selectedSkills.length}):
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {selectedSkills.map((skill) => (
                            <Badge
                              key={skill}
                              variant="secondary"
                              className="bg-orange-100 text-primary dark:bg-orange-900/20 dark:text-orange-300"
                            >
                              {skill}
                              <button
                                onClick={() => removeSkill(skill)}
                                className="ml-2 hover:text-orange-900 dark:hover:text-orange-100"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    <div>
                      <Label className="text-sm font-medium mb-3 block text-slate-900 dark:text-white">
                        Credits Required *
                      </Label>
                      <Select
                        value={jobFormData.credits.toString()}
                        onValueChange={(value) => setJobFormData({ ...jobFormData, credits: Number.parseInt(value) })}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select credits" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="5">5 Credits</SelectItem>
                          <SelectItem value="10">10 Credits</SelectItem>
                          <SelectItem value="15">15 Credits</SelectItem>
                          <SelectItem value="20">20 Credits (Maximum)</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground mt-2">
                        Higher credits attract more qualified freelancers
                      </p>
                    </div>
                  </div>
                )}
                {/* Step 3: Job Type & Budget */}
                {postJobStep === 3 && (
                  <div className="space-y-6">
                    <div>
                      <Label className="text-sm font-medium mb-3 block text-slate-900 dark:text-white">Job Type *</Label>
                      <Select
                        value={jobFormData.jobType}
                        onValueChange={(value) => setJobFormData({ ...jobFormData, jobType: value })}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select job type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Remote">Remote</SelectItem>
                          <SelectItem value="Hybrid">Hybrid</SelectItem>
                          <SelectItem value="On-site">On-site</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-sm font-medium mb-3 block text-slate-900 dark:text-white">Location *</Label>
                      <Input
                        type="text"
                        placeholder="e.g. Lagos, Nigeria"
                        className="w-full"
                        value={jobFormData.location}
                        onChange={(e) => setJobFormData({ ...jobFormData, location: e.target.value })}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-sm font-medium mb-3 block text-slate-900 dark:text-white">
                          Min Budget (₦) *
                        </Label>
                        <Input
                          type="number"
                          placeholder="100000"
                          className="w-full"
                          value={jobFormData.budgetMin}
                          onChange={(e) => setJobFormData({ ...jobFormData, budgetMin: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label className="text-sm font-medium mb-3 block text-slate-900 dark:text-white">
                          Max Budget (₦) *
                        </Label>
                        <Input
                          type="number"
                          placeholder="500000"
                          className="w-full"
                          value={jobFormData.budgetMax}
                          onChange={(e) => setJobFormData({ ...jobFormData, budgetMax: e.target.value })}
                        />
                      </div>
                    </div>
                    <div>
                      <Label className="text-sm font-medium mb-3 block text-slate-900 dark:text-white">
                        Additional Comments (Optional)
                      </Label>
                      <Textarea
                        rows={6}
                        placeholder="Add any additional requirements, preferences, or information that would help freelancers understand your project better..."
                        className="w-full resize-none"
                        value={jobFormData.comments}
                        onChange={(e) => setJobFormData({ ...jobFormData, comments: e.target.value })}
                      />
                    </div>
                  </div>
                )}
                {/* Step 4: Review */}
                {postJobStep === 4 && (
                  <div className="space-y-6">
                    <div className="bg-slate-50 dark:bg-slate-800 p-6 rounded-lg border border-slate-200 dark:border-gray-700">
                      <h4 className="font-semibold mb-4 text-slate-900 dark:text-white">Job Preview</h4>
                      <div className="space-y-4">
                        <div>
                          <p className="text-sm font-medium text-muted-foreground mb-1">Title</p>
                          <p className="font-semibold text-slate-900 dark:text-white">{jobFormData.title}</p>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-muted-foreground mb-1">Description</p>
                          <p className="text-sm text-slate-900 dark:text-white whitespace-pre-wrap">
                            {jobFormData.description}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-muted-foreground mb-2">
                            Required Skills ({selectedSkills.length})
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {selectedSkills.map((skill) => (
                              <Badge key={skill} variant="outline" className="text-xs">
                                {skill}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-sm font-medium text-muted-foreground mb-1">Budget Range</p>
                            <p className="font-semibold text-slate-900 dark:text-white">
                              ₦ {Number.parseInt(jobFormData.budgetMin || "0").toLocaleString()} - ₦ {Number.parseInt(jobFormData.budgetMax || "0").toLocaleString()}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-muted-foreground mb-1">Duration</p>
                            <p className="font-semibold text-slate-900 dark:text-white">{jobFormData.duration}</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-sm font-medium text-muted-foreground mb-1">Job Type</p>
                            <p className="font-semibold text-slate-900 dark:text-white">{jobFormData.jobType}</p>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-muted-foreground mb-1">Location</p>
                            <p className="font-semibold text-slate-900 dark:text-white">{jobFormData.location}</p>
                          </div>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-muted-foreground mb-1">Credits Required</p>
                          <p className="font-semibold flex items-center text-slate-900 dark:text-white">
                            <span className="w-2 h-2 bg-primary rounded-full mr-2"></span>
                            {jobFormData.credits} Credits
                          </p>
                        </div>
                        {jobFormData.comments && (
                          <div>
                            <p className="text-sm font-medium text-muted-foreground mb-1">Additional Comments</p>
                            <p className="text-sm text-slate-900 dark:text-white whitespace-pre-wrap">
                              {jobFormData.comments}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="bg-primary/10 dark:bg-orange-900/20 p-4 rounded-lg border border-orange-200 dark:border-orange-800">
                      <div className="flex items-start space-x-3">
                        <div className="bg-orange-100 dark:bg-orange-900/40 p-2 rounded-full">
                          <Eye className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <h5 className="font-medium text-orange-800 dark:text-orange-200">Ready to Post?</h5>
                          <p className="text-sm text-primary dark:text-orange-300 mt-1">
                            Your job will be visible to all freelancers on the platform. You'll start receiving
                            proposals shortly after posting.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              {/* Footer */}
              <div className="border-t border-slate-200 dark:border-gray-700 p-6">
                <div className="flex justify-between">
                  <Button
                    variant="outline"
                    onClick={() => {
                      if (postJobStep > 1) {
                        setPostJobStep(postJobStep - 1)
                      } else {
                        setShowPostJobModal(false)
                        setPostJobStep(1)
                        setSelectedSkills([])
                        setJobFormData({
                          title: "",
                          description: "",
                          budgetMin: "",
                          budgetMax: "",
                          duration: "",
                          location: "",
                          jobType: "",
                          credits: 5,
                          comments: "",
                        })
                        setEditingJobId(null)
                        idempotencyKeyRef.current = null
                      }
                    }}
                    className="bg-transparent"
                  >
                    {postJobStep === 1 ? "Cancel" : "Back"}
                  </Button>
                  <Button
                    className="bg-primary hover:bg-primary-hover"
                    onClick={() => {
                      if (postJobStep < 4) {
                        setPostJobStep(postJobStep + 1)
                      } else {
                        handleJobSubmit()
                      }
                    }}
                    disabled={
                      isPosting ||
                      (postJobStep === 1 &&
                        (!jobFormData.title || !jobFormData.description || !jobFormData.duration)) ||
                      (postJobStep === 2 && (selectedSkills.length === 0 || !jobFormData.credits)) ||
                      (postJobStep === 3 &&
                        (!jobFormData.jobType ||
                          !jobFormData.location ||
                          !jobFormData.budgetMin ||
                          !jobFormData.budgetMax))
                    }
                  >
                    {postJobStep === 4 ? (isPosting ? "Posting..." : "Post Job") : "Next"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Job Action Modal */}
      {showJobActionModal && selectedJob && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">
                  {actionType === "edit" && "Edit Job"}
                  {actionType === "pause" && (selectedJob.status === "paused" ? "Resume Job" : "Pause Job")}
                  {actionType === "close" && "Close Job"}
                </CardTitle>
                <Button variant="ghost" size="icon" onClick={() => setShowJobActionModal(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-lg">
                  <h4 className="font-semibold text-sm mb-1">{selectedJob.title}</h4>
                  <p className="text-xs text-muted-foreground">{selectedJob.proposals} proposals received</p>
                </div>
                <p className="text-sm text-muted-foreground">
                  {actionType === "edit" && "Edit functionality will be available soon."}
                  {actionType === "pause" &&
                    selectedJob.status === "paused" &&
                    "Resume this job to start receiving new proposals again."}
                  {actionType === "pause" &&
                    selectedJob.status !== "paused" &&
                    "Pause this job to temporarily stop receiving new proposals."}
                  {actionType === "close" && "Close this job permanently. This action cannot be undone."}
                </p>
                <div className="flex space-x-2 pt-4">
                  <Button
                    variant="outline"
                    className="flex-1 bg-transparent"
                    onClick={() => setShowJobActionModal(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    className={`flex-1 ${
                      actionType === "close" ? "bg-red-500 hover:bg-red-600" : "bg-primary hover:bg-primary-hover"
                    }`}
                    onClick={() => {
                      if (actionType === "edit") {
                        alert("Edit functionality coming soon!")
                      } else {
                        actionType && handleJobAction(selectedJob, actionType)
                      }
                      setShowJobActionModal(false)
                    }}
                  >
                    {actionType === "edit" && "Edit Job"}
                    {actionType === "pause" && (selectedJob.status === "paused" ? "Resume" : "Pause")}
                    {actionType === "close" && "Close Job"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
      {/* Dispute Modal */}
      {showDisputeModal && selectedJob && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <ShieldAlert className="text-primary h-5 w-5" />
                  Open a Dispute
                </CardTitle>
                <Button variant="ghost" size="icon" onClick={() => setShowDisputeModal(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="bg-primary/10 p-3 rounded-lg border border-orange-100">
                  <p className="text-xs text-orange-800">
                    Opening a dispute will freeze the escrow funds for <strong>{selectedJob.title}</strong>. 
                    You and the freelancer will have 3-7 days to resolve it in the Dispute Room before an admin steps in.
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
                      <SelectItem value="quality">Quality Issue - "This isn't what I asked for"</SelectItem>
                      <SelectItem value="non_delivery">Non-delivery - "Freelancer disappeared"</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Describe the Issue</Label>
                  <Textarea 
                    rows={4}
                    placeholder="Provide details about what went wrong. This will be visible to the freelancer and admins."
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
                    className="flex-1 bg-primary hover:bg-primary-hover"
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
  )
}
