import { Router } from "express"
import { asyncHandler } from "../lib/http.js"
import { notifyAgencyNewProposal, notifyFreelancerProposalDecision } from "../lib/notifications.js"

const proposalsRouter = Router()

proposalsRouter.post(
  "/:proposalId/respond",
  asyncHandler(async (req, res) => {
    const { proposalId } = req.params
    const action = req.body?.action

    if (action !== "accept" && action !== "reject") {
      res.json({ success: false, error: "action must be 'accept' or 'reject'" })
      return
    }

    const supabase = req.supabase!
    const { data: proposal, error: lookupError } = await supabase
      .from("proposals")
      .select("id, jobs!inner(agency_id)")
      .eq("id", proposalId)
      .maybeSingle()

    if (lookupError) {
      res.json({ success: false, error: lookupError.message })
      return
    }
    if (!proposal) {
      res.json({ success: false, error: "Proposal not found" })
      return
    }
    if ((proposal as any).jobs?.agency_id !== req.user!.id) {
      res.json({ success: false, error: "Forbidden" })
      return
    }

    const { error } = await supabase
      .from("proposals")
      .update({ status: action === "accept" ? "accepted" : "rejected", updated_at: new Date().toISOString() })
      .eq("id", proposalId)

    if (error) {
      res.json({ success: false, error: error.message })
      return
    }

    await notifyFreelancerProposalDecision(proposalId, action)

    res.json({ success: true })
  })
)

proposalsRouter.post(
  "/jobs/:jobId",
  asyncHandler(async (req, res) => {
    const { jobId } = req.params
    const { proposal_text, timeline, budget, attachments, creditCost } = req.body ?? {}
    const supabase = req.supabase!
    const user = req.user!

    const parsedBudget = Number(budget)
    if (!Number.isFinite(parsedBudget) || parsedBudget <= 0) {
      res.json({ success: false, error: "Please enter a valid budget.", code: "invalid_budget" })
      return
    }

    const { data, error } = await supabase.rpc("place_bid", {
      p_job_id: jobId,
      p_proposal_text: proposal_text,
      p_timeline: timeline,
      p_budget: parsedBudget,
      p_credit_cost: creditCost,
      p_attachments: attachments ?? null,
    })

    if (error) {
      console.error("place_bid RPC error:", error)
      res.json({ success: false, error: error.message, code: error.code })
      return
    }

    const result = (data ?? {}) as { ok?: boolean; code?: string }

    if (result.ok) {
      if (result.code !== "already_submitted") {
        const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle()
        await notifyAgencyNewProposal(jobId, profile?.full_name)
      }
      res.json({ success: true, alreadySubmitted: result.code === "already_submitted" })
      return
    }

    switch (result.code) {
      case "insufficient_credits":
        res.json({ success: false, error: "Insufficient credits to place this bid.", code: result.code })
        return
      case "unauthorized":
        res.json({ success: false, error: "Unauthorized", code: result.code })
        return
      default:
        res.json({ success: false, error: "Could not submit proposal. Please try again.", code: result.code })
    }
  })
)

proposalsRouter.get(
  "/mine",
  asyncHandler(async (req, res) => {
    const supabase = req.supabase!
    const user = req.user!
    const limit = Number(req.query.limit ?? 15)
    const offset = Number(req.query.offset ?? 0)
    const searchTerm = typeof req.query.searchTerm === "string" ? req.query.searchTerm.trim() : undefined

    let jobIdsToFilter: string[] | undefined
    if (searchTerm) {
      const { data: searchedJobs, error: searchError } = await supabase
        .from("jobs")
        .select("id")
        .or(`title.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`)
      if (searchError) {
        console.error("Error searching jobs:", searchError)
        res.json({ proposals: [], hasMore: false })
        return
      }
      jobIdsToFilter = (searchedJobs || []).map((j: any) => j.id)
      if (jobIdsToFilter.length === 0) {
        res.json({ proposals: [], hasMore: false })
        return
      }
    }

    let proposalsQuery = supabase
      .from("proposals")
      .select("*")
      .eq("freelancer_id", user.id)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1)
    if (jobIdsToFilter !== undefined) {
      proposalsQuery = proposalsQuery.in("job_id", jobIdsToFilter)
    }

    const { data: proposalsData, error: proposalsError } = await proposalsQuery
    if (proposalsError || !proposalsData || proposalsData.length === 0) {
      if (proposalsError) console.error("Error loading proposals:", proposalsError.message)
      res.json({ proposals: [], hasMore: false })
      return
    }

    const jobIds = Array.from(new Set(proposalsData.map((p: any) => p.job_id).filter(Boolean)))
    const proposalIds = proposalsData.map((p: any) => p.id).filter(Boolean)

    const [jobsRes, fundingRes, statusRes] = await Promise.all([
      jobIds.length
        ? supabase
            .from("jobs")
            .select("id, title, description, budget_min, budget_max, job_type, duration, location, skills, agency_id")
            .in("id", jobIds)
        : Promise.resolve({ data: [] as any[] }),
      jobIds.length
        ? supabase.from("job_funding_status").select("job_id, funding_status, job_status").in("job_id", jobIds)
        : Promise.resolve({ data: [] as any[] }),
      proposalIds.length
        ? supabase.from("freelancer_proposal_status").select("proposal_id, freelancer_status").in("proposal_id", proposalIds)
        : Promise.resolve({ data: [] as any[] }),
    ])

    const jobById: Record<string, any> = {}
    for (const j of (jobsRes.data as any[]) || []) jobById[j.id] = j
    const fundingByJobId: Record<string, any> = {}
    for (const f of (fundingRes.data as any[]) || []) fundingByJobId[f.job_id] = f
    const statusByProposalId: Record<string, any> = {}
    for (const s of (statusRes.data as any[]) || []) statusByProposalId[s.proposal_id] = s

    const agencyIds = Array.from(new Set(Object.values(jobById).map((j: any) => j?.agency_id).filter(Boolean)))
    const agencyById: Record<string, any> = {}
    if (agencyIds.length > 0) {
      const { data: agencies } = await supabase.from("profiles").select("id, full_name, company_name").in("id", agencyIds)
      for (const a of (agencies as any[]) || []) agencyById[a.id] = a
    }

    const proposals = proposalsData.map((proposal: any) => {
      const job = jobById[proposal.job_id]
      const agency = job ? agencyById[job.agency_id] : null
      const funding = fundingByJobId[proposal.job_id]
      const fStatus = statusByProposalId[proposal.id]
      return {
        ...proposal,
        job_title: job?.title || "Unknown Job",
        job_description: job?.description || "No description available",
        job_budget_min: job?.budget_min || 0,
        job_budget_max: job?.budget_max || 0,
        job_type: job?.job_type || "Not specified",
        job_duration: job?.duration || "Not specified",
        job_location: job?.location || "Not specified",
        skills: job?.skills || [],
        agency_name: agency?.company_name || agency?.full_name || "Unknown Agency",
        funding_status: funding?.funding_status || "pending",
        job_status: funding?.job_status || "open",
        freelancer_status: fStatus?.freelancer_status || "pending",
      }
    })

    res.json({ proposals, hasMore: proposalsData.length === limit })
  })
)

export default proposalsRouter
