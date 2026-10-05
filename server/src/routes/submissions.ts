import { Router } from "express"
import { asyncHandler } from "../lib/http.js"
import { createServiceClient } from "../lib/supabase.js"
import { transitionEscrow } from "../lib/escrow.js"

const submissionsRouter = Router()

// Workspace delivery room (/workspace/:jobId). Identities always come from the
// session and the job's escrow -- the legacy Next.js routes took
// freelancer_id/agency_id/sender_id from the request body.

const SUBMISSION_TYPES = ["tech", "design", "writing", "general"] as const

async function loadEscrowForJob(jobId: string) {
  const { data, error } = await createServiceClient()
    .from("escrow_deposits")
    .select("id, job_id, agency_id, freelancer_id, amount_kobo, status_v2")
    .eq("job_id", jobId)
    .not("status_v2", "is", null)
    .maybeSingle()
  if (error) throw error
  return data
}

// GET /api/submissions?jobId= -- the job's submission, its escrow state and
// the caller's role. Only the escrow's agency/freelancer may open a workspace.
submissionsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const userId = req.user!.id
    const jobId = typeof req.query.jobId === "string" ? req.query.jobId : ""
    if (!jobId) {
      res.status(400).json({ error: "jobId is required" })
      return
    }

    const escrow = await loadEscrowForJob(jobId)
    if (!escrow || (escrow.agency_id !== userId && escrow.freelancer_id !== userId)) {
      res.status(404).json({ error: "Workspace not found" })
      return
    }

    const [{ data: submission, error: subError }, { data: job, error: jobError }] = await Promise.all([
      req.supabase!.from("project_submissions").select("*").eq("job_id", jobId).maybeSingle(),
      createServiceClient().from("jobs").select("id, title, description").eq("id", jobId).maybeSingle(),
    ])
    if (subError) throw subError
    if (jobError) throw jobError

    res.json({
      role: escrow.agency_id === userId ? "agency" : "freelancer",
      job,
      escrow: { id: escrow.id, status: escrow.status_v2, amount_kobo: escrow.amount_kobo },
      submission: submission ?? null,
    })
  })
)

// POST /api/submissions { job_id, submission_type, content } -- the escrow's
// freelancer submits (or resubmits) work for a funded job.
submissionsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const userId = req.user!.id
    const { job_id, submission_type, content } = req.body ?? {}
    if (typeof job_id !== "string" || !job_id) {
      res.status(400).json({ error: "job_id is required" })
      return
    }
    const type = SUBMISSION_TYPES.includes(submission_type) ? submission_type : "general"
    if (!content || typeof content !== "object" || Array.isArray(content)) {
      res.status(400).json({ error: "content must be an object" })
      return
    }

    const escrow = await loadEscrowForJob(job_id)
    if (!escrow || escrow.freelancer_id !== userId) {
      res.status(403).json({ error: "Only the hired freelancer can submit work for this job" })
      return
    }
    if (escrow.status_v2 !== "funded") {
      res.status(409).json({ error: `Work can only be submitted while the escrow is funded (it is ${escrow.status_v2})` })
      return
    }

    const { data: existing, error: existingError } = await req.supabase!
      .from("project_submissions")
      .select("status")
      .eq("job_id", job_id)
      .maybeSingle()
    if (existingError) throw existingError
    if (existing?.status === "approved") {
      res.status(409).json({ error: "This submission has already been approved" })
      return
    }

    const now = new Date().toISOString()
    const { data, error } = await req.supabase!
      .from("project_submissions")
      .upsert(
        {
          job_id,
          freelancer_id: userId,
          agency_id: escrow.agency_id,
          submission_type: type,
          content,
          status: "submitted",
          submitted_at: now,
          updated_at: now,
        },
        { onConflict: "job_id" }
      )
      .select()
      .single()
    if (error) throw error

    res.json({ success: true, submission: data })
  })
)

async function loadSubmission(req: { supabase?: any }, submissionId: string) {
  // RLS: only the submission's agency/freelancer can read it.
  const { data, error } = await req.supabase
    .from("project_submissions")
    .select("id, job_id, freelancer_id, agency_id, status")
    .eq("id", submissionId)
    .maybeSingle()
  if (error) throw error
  return data as { id: string; job_id: string; freelancer_id: string; agency_id: string; status: string } | null
}

// GET /api/submissions/:id/comments
submissionsRouter.get(
  "/:id/comments",
  asyncHandler(async (req, res) => {
    const submission = await loadSubmission(req, req.params.id)
    if (!submission) {
      res.status(404).json({ error: "Submission not found" })
      return
    }
    const { data, error } = await req.supabase!
      .from("submission_comments")
      .select("id, submission_id, sender_id, message, created_at, sender:profiles(full_name)")
      .eq("submission_id", submission.id)
      .order("created_at", { ascending: true })
    if (error) throw error
    res.json({ comments: data ?? [] })
  })
)

// POST /api/submissions/:id/comments { message, is_revision_request }
// Either party can comment; only the agency can request changes.
submissionsRouter.post(
  "/:id/comments",
  asyncHandler(async (req, res) => {
    const userId = req.user!.id
    const message = typeof req.body?.message === "string" ? req.body.message.trim() : ""
    const isRevisionRequest = req.body?.is_revision_request === true
    if (!message) {
      res.status(400).json({ error: "message is required" })
      return
    }

    const submission = await loadSubmission(req, req.params.id)
    if (!submission) {
      res.status(404).json({ error: "Submission not found" })
      return
    }
    if (isRevisionRequest && submission.agency_id !== userId) {
      res.status(403).json({ error: "Only the agency can request changes" })
      return
    }
    if (isRevisionRequest && submission.status !== "submitted") {
      res.status(409).json({ error: `Changes can't be requested on a ${submission.status} submission` })
      return
    }

    const { data: comment, error } = await req.supabase!
      .from("submission_comments")
      .insert({ submission_id: submission.id, sender_id: userId, message })
      .select("id, submission_id, sender_id, message, created_at, sender:profiles(full_name)")
      .single()
    if (error) throw error

    if (isRevisionRequest) {
      const { error: updateError } = await req.supabase!
        .from("project_submissions")
        .update({ status: "changes_requested", updated_at: new Date().toISOString() })
        .eq("id", submission.id)
        .eq("status", "submitted")
      if (updateError) throw updateError
    }

    res.json({ success: true, comment })
  })
)

// POST /api/submissions/:id/approve -- the agency approves the work, which
// releases the escrow (funded -> released). The freelancer then requests the
// payout. Idempotent: re-approving an already-released escrow just re-applies
// the side effects.
submissionsRouter.post(
  "/:id/approve",
  asyncHandler(async (req, res) => {
    const userId = req.user!.id
    const submission = await loadSubmission(req, req.params.id)
    if (!submission) {
      res.status(404).json({ error: "Submission not found" })
      return
    }

    const escrow = await loadEscrowForJob(submission.job_id)
    if (!escrow || escrow.agency_id !== userId || submission.agency_id !== userId) {
      res.status(403).json({ error: "Only the agency that funded this job can approve it" })
      return
    }

    const alreadyReleased = escrow.status_v2 === "released" || escrow.status_v2 === "paid_out"
    if (!alreadyReleased) {
      if (submission.status !== "submitted") {
        res.status(409).json({ error: `Only submitted work can be approved (this one is ${submission.status})` })
        return
      }
      if (escrow.status_v2 !== "funded") {
        res.status(409).json({ error: `The escrow can't be released while it is ${escrow.status_v2}` })
        return
      }
    }

    const service = createServiceClient()
    if (!alreadyReleased) {
      const moved = await transitionEscrow(service, {
        escrowId: escrow.id,
        from: "funded",
        to: "released",
        type: "released",
        amountKobo: escrow.amount_kobo,
        actorId: userId,
        actorType: "agency",
        payload: { submission_id: submission.id },
        idempotencyKey: `release:${escrow.id}`,
      })
      if (!moved) {
        res.status(409).json({ error: "The escrow changed state; refresh and try again" })
        return
      }
    }

    const now = new Date().toISOString()
    const { error: subError } = await service
      .from("project_submissions")
      .update({ status: "approved", updated_at: now })
      .eq("id", submission.id)
    if (subError) throw subError

    // Legacy job columns: close the job and mark it payable ('completed') --
    // unless a payout has already started, which must never be reopened.
    const { data: job } = await service.from("jobs").select("payout_status").eq("id", submission.job_id).maybeSingle()
    const payoutStarted = job?.payout_status === "processing" || job?.payout_status === "paid"
    const { error: jobError } = await service
      .from("jobs")
      .update(payoutStarted ? { status: "closed" } : { status: "closed", payout_status: "completed" })
      .eq("id", submission.job_id)
    if (jobError) throw jobError

    // Soak-period mirror for the legacy Funded Jobs page (best-effort).
    const { error: fundedError } = await service
      .from("Funded_jobs101")
      .update({ job_completed: true })
      .eq("job_id", submission.job_id)
    if (fundedError) console.warn("[submissions] could not mirror job_completed to Funded_jobs101", fundedError)

    res.json({ success: true, status: "released" })
  })
)

export default submissionsRouter
