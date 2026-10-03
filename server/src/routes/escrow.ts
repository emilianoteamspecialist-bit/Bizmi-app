import { Router } from "express"
import { asyncHandler } from "../lib/http.js"
import { createServiceClient } from "../lib/supabase.js"
import { paystackRequest, PaystackError } from "../lib/paystack.js"
import { ACTIVE_ESCROW_STATUSES, markEscrowFunded, transitionEscrow, type EscrowRow, type EscrowStatus } from "../lib/escrow.js"

const escrowRouter = Router()

const ESCROW_COLUMNS =
  "id, job_id, agency_id, freelancer_id, amount_kobo, status_v2, paystack_reference, funded_at, released_at, paid_out_at, refunded_at, disputed_at, created_at"

// POST /api/escrow/initialize { proposalId }
// The agency funds an accepted proposal. Amount, agency and freelancer all
// come from the proposal/job rows -- never from the request.
escrowRouter.post(
  "/initialize",
  asyncHandler(async (req, res) => {
    const user = req.user!
    const { proposalId } = req.body ?? {}
    if (typeof proposalId !== "string" || !proposalId) {
      res.status(400).json({ error: "proposalId is required" })
      return
    }

    const { data: proposal, error: proposalError } = await req.supabase!
      .from("proposals")
      .select("id, job_id, freelancer_id, status, budget, jobs(id, agency_id, title)")
      .eq("id", proposalId)
      .maybeSingle()
    if (proposalError) throw proposalError
    if (!proposal) {
      res.status(404).json({ error: "Proposal not found" })
      return
    }

    const job: any = Array.isArray(proposal.jobs) ? proposal.jobs[0] : proposal.jobs
    if (!job) {
      res.status(404).json({ error: "Job not found for proposal" })
      return
    }
    if (job.agency_id !== user.id) {
      res.status(403).json({ error: "Only the owning agency can fund this job" })
      return
    }
    if (proposal.status !== "accepted") {
      res.status(409).json({ error: "Proposal must be accepted before funding" })
      return
    }

    const budgetNaira = Number(proposal.budget)
    if (!Number.isFinite(budgetNaira) || budgetNaira <= 0) {
      res.status(422).json({ error: "Proposal has no valid budget to fund" })
      return
    }
    const amountKobo = Math.round(budgetNaira * 100)

    const service = createServiceClient()
    const { data: existing, error: existingError } = await service
      .from("escrow_deposits")
      .select("id, status_v2, freelancer_id, amount_kobo, paystack_reference, paystack_authorization_url")
      .eq("job_id", job.id)
      .not("status_v2", "is", null)
      .maybeSingle()
    if (existingError) throw existingError

    if (existing && ACTIVE_ESCROW_STATUSES.includes(existing.status_v2 as EscrowStatus)) {
      // Still awaiting payment: hand back the same checkout so the agency can resume.
      if (existing.status_v2 === "awaiting" && existing.paystack_authorization_url && existing.paystack_reference) {
        res.json({
          success: true,
          resumed: true,
          escrow_id: existing.id,
          authorization_url: existing.paystack_authorization_url,
          reference: existing.paystack_reference,
        })
        return
      }
      res.status(409).json({ error: `Escrow for this job is already ${existing.status_v2}` })
      return
    }

    // One escrow row per job (partial unique index on job_id). A 'pending' row
    // left by an earlier attempt whose Paystack init failed is reused rather
    // than duplicated. Anything else non-active (refunded/cancelled) blocks.
    let escrowId: string
    if (existing && existing.status_v2 === "pending") {
      if (existing.freelancer_id !== proposal.freelancer_id || existing.amount_kobo !== amountKobo) {
        res.status(409).json({ error: "A different funding attempt is pending for this job" })
        return
      }
      escrowId = existing.id
    } else if (existing) {
      res.status(409).json({ error: `Escrow for this job is already ${existing.status_v2}` })
      return
    } else {
      const { data: inserted, error: insertError } = await service
        .from("escrow_deposits")
        .insert({
          job_id: job.id,
          agency_id: user.id,
          freelancer_id: proposal.freelancer_id,
          amount_kobo: amountKobo,
          status_v2: "pending",
          // Legacy NOT NULL/CHECK columns, kept populated for the soak period.
          status: "awaiting",
          balance: budgetNaira,
        })
        .select("id")
        .single()
      if (insertError) throw insertError
      escrowId = inserted.id
    }

    // Unique per attempt: Paystack rejects a reused reference, and a failed
    // attempt may already have registered one.
    const reference = `escrow_${escrowId}_${Date.now().toString(36)}`
    let checkout: { authorization_url: string; access_code: string; reference: string }
    try {
      checkout = await paystackRequest("POST", "/transaction/initialize", {
        email: user.email,
        amount: amountKobo,
        currency: "NGN",
        reference,
        callback_url: `${process.env.CLIENT_ORIGIN ?? "http://localhost:5173"}/agency/escrow/return`,
        metadata: { escrow_id: escrowId, job_id: job.id, job_title: job.title, proposal_id: proposal.id },
      })
    } catch (err) {
      console.error("[escrow] Paystack initialize failed", { escrowId, err })
      res.status(502).json({ error: err instanceof PaystackError ? err.message : "Could not reach the payment service" })
      return
    }

    const moved = await transitionEscrow(service, {
      escrowId,
      from: "pending",
      to: "awaiting",
      type: "funding_initiated",
      amountKobo,
      actorId: user.id,
      actorType: "agency",
      payload: { paystack_reference: checkout.reference, proposal_id: proposal.id },
      idempotencyKey: `init:${escrowId}:${checkout.reference}`,
      extra: {
        paystack_reference: checkout.reference,
        paystack_authorization_url: checkout.authorization_url,
        paystack_access_code: checkout.access_code,
      },
    })
    if (!moved) {
      res.status(409).json({ error: "Escrow changed while initializing; please retry" })
      return
    }

    res.json({ success: true, escrow_id: escrowId, authorization_url: checkout.authorization_url, reference: checkout.reference })
  })
)

// GET /api/escrow/verify?reference=
// Manual fallback for when the agency returns from checkout before (or
// without) the webhook. Idempotent with the webhook.
escrowRouter.get(
  "/verify",
  asyncHandler(async (req, res) => {
    const user = req.user!
    const reference = typeof req.query.reference === "string" ? req.query.reference : ""
    if (!reference.startsWith("escrow_")) {
      res.status(400).json({ error: "A valid escrow reference is required" })
      return
    }

    // RLS: only the escrow's agency or freelancer can see it.
    const { data: escrow, error } = await req.supabase!
      .from("escrow_deposits")
      .select("id, job_id, agency_id, freelancer_id, amount_kobo, status_v2")
      .eq("paystack_reference", reference)
      .maybeSingle()
    if (error) throw error
    if (!escrow) {
      res.status(404).json({ error: "Escrow not found" })
      return
    }

    if (escrow.status_v2 !== "awaiting") {
      res.json({ success: true, already_processed: true, escrow_id: escrow.id, status: escrow.status_v2 })
      return
    }

    let txn: { status: string; amount: number }
    try {
      txn = await paystackRequest("GET", `/transaction/verify/${encodeURIComponent(reference)}`)
    } catch (err) {
      res.status(502).json({ error: err instanceof PaystackError ? err.message : "Could not reach the payment service" })
      return
    }
    if (txn.status !== "success") {
      res.status(402).json({ success: false, error: "Payment not successful", paystack_status: txn.status })
      return
    }

    const result = await markEscrowFunded(createServiceClient(), escrow as EscrowRow, Number(txn.amount), {
      reference,
      actorId: user.id,
      actorType: escrow.agency_id === user.id ? "agency" : "freelancer",
      idempotencyKey: `verify:${reference}`,
      via: "manual_verify",
    })
    if (result === "amount_mismatch") {
      res.status(409).json({ success: false, error: "Paid amount does not match the escrow -- contact support" })
      return
    }
    res.json({ success: true, escrow_id: escrow.id, status: "funded" })
  })
)

// GET /api/escrow/job/:jobId -- the current escrow for a job (participants only, via RLS).
escrowRouter.get(
  "/job/:jobId",
  asyncHandler(async (req, res) => {
    const { data, error } = await req.supabase!
      .from("escrow_deposits")
      .select(ESCROW_COLUMNS)
      .eq("job_id", req.params.jobId)
      .not("status_v2", "is", null)
      .maybeSingle()
    if (error) throw error
    res.json({ escrow: data ?? null })
  })
)

// GET /api/escrow/mine -- every v2 escrow the caller is a party to, with the
// job, the other party, the submission state and the latest payout. Backs
// both /freelancer/funded-jobs and /agency/wallet.
escrowRouter.get(
  "/mine",
  asyncHandler(async (req, res) => {
    const userId = req.user!.id
    const { data: escrows, error } = await req.supabase!
      .from("escrow_deposits")
      .select(ESCROW_COLUMNS)
      .or(`agency_id.eq.${userId},freelancer_id.eq.${userId}`)
      .not("status_v2", "is", null)
      .order("created_at", { ascending: false })
    if (error) throw error

    const rows = escrows ?? []
    if (rows.length === 0) {
      res.json({ escrows: [] })
      return
    }

    const jobIds = [...new Set(rows.map((e) => e.job_id))]
    const partyIds = [...new Set(rows.flatMap((e) => [e.agency_id, e.freelancer_id]).filter(Boolean))] as string[]
    const escrowIds = rows.map((e) => e.id)

    const service = createServiceClient()
    const [jobsRes, profilesRes, submissionsRes, payoutsRes, disputesRes] = await Promise.all([
      service.from("jobs").select("id, title").in("id", jobIds),
      service.from("profiles").select("id, full_name, company_name").in("id", partyIds),
      service.from("project_submissions").select("job_id, status").in("job_id", jobIds),
      service
        .from("payouts")
        .select("escrow_id, status, net_amount_kobo, requested_at, completed_at, failure_reason")
        .in("escrow_id", escrowIds)
        .order("requested_at", { ascending: false }),
      service.from("disputes").select("id, job_id, status").in("job_id", jobIds).neq("status", "resolved"),
    ])
    for (const r of [jobsRes, profilesRes, submissionsRes, payoutsRes, disputesRes]) if (r.error) throw r.error

    const byId = <T extends { id: string }>(list: T[] | null) => new Map((list ?? []).map((x) => [x.id, x]))
    const jobs = byId(jobsRes.data)
    const profiles = byId(profilesRes.data)
    const submissionByJob = new Map((submissionsRes.data ?? []).map((s) => [s.job_id, s.status]))
    const disputeByJob = new Map((disputesRes.data ?? []).map((d) => [d.job_id, d.id]))
    const latestPayout = new Map<string, any>()
    for (const p of payoutsRes.data ?? []) if (!latestPayout.has(p.escrow_id)) latestPayout.set(p.escrow_id, p)

    const name = (id: string | null) => {
      const p: any = id ? profiles.get(id) : null
      return p?.company_name || p?.full_name || null
    }

    res.json({
      escrows: rows.map((e) => ({
        ...e,
        role: e.agency_id === userId ? "agency" : "freelancer",
        job_title: (jobs.get(e.job_id) as any)?.title ?? null,
        agency_name: name(e.agency_id),
        freelancer_name: name(e.freelancer_id),
        submission_status: submissionByJob.get(e.job_id) ?? null,
        open_dispute_id: disputeByJob.get(e.job_id) ?? null,
        latest_payout: latestPayout.get(e.id) ?? null,
      })),
    })
  })
)

export default escrowRouter
