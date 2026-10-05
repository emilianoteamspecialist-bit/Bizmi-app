import { Router } from "express"
import { asyncHandler } from "../lib/http.js"
import { createServiceClient } from "../lib/supabase.js"
import { paystackRequest, PaystackError } from "../lib/paystack.js"
import { transitionEscrow } from "../lib/escrow.js"
import { logAdminAction } from "../lib/adminAudit.js"
import { DISPUTE_SELECT, DISPUTE_MESSAGE_SELECT } from "./disputes.js"

// Admin money views and dispute resolution, all on escrow v2. Mounted under
// /api/admin behind requireAuth + requireAdmin; reads use the service role
// because escrow RLS is scoped to participants.
const adminEscrowRouter = Router()

const nameOf = (p: any) => p?.company_name || p?.full_name || null

async function profileMap(service: ReturnType<typeof createServiceClient>, ids: string[]) {
  if (ids.length === 0) return new Map<string, any>()
  const { data, error } = await service.from("profiles").select("id, full_name, company_name, email").in("id", ids)
  if (error) throw error
  return new Map((data ?? []).map((p) => [p.id, p]))
}

// GET /api/admin/transactions -- the escrow ledger: every v2 escrow with its
// parties, job, payouts and totals. Read-only by design: money only moves
// through the state machine, so there are no "mark paid" flag toggles here.
adminEscrowRouter.get(
  "/transactions",
  asyncHandler(async (_req, res) => {
    const service = createServiceClient()
    const { data: escrows, error } = await service
      .from("escrow_deposits")
      .select("id, job_id, agency_id, freelancer_id, amount_kobo, status_v2, paystack_reference, created_at, funded_at, released_at, paid_out_at, refunded_at, disputed_at")
      .not("status_v2", "is", null)
      .order("created_at", { ascending: false })
    if (error) throw error

    const rows = escrows ?? []
    const jobIds = [...new Set(rows.map((e) => e.job_id))]
    const escrowIds = rows.map((e) => e.id)
    const [profiles, jobsRes, payoutsRes] = await Promise.all([
      profileMap(service, [...new Set(rows.flatMap((e) => [e.agency_id, e.freelancer_id]).filter(Boolean))] as string[]),
      jobIds.length ? service.from("jobs").select("id, title").in("id", jobIds) : Promise.resolve({ data: [], error: null }),
      escrowIds.length
        ? service
            .from("payouts")
            .select("id, escrow_id, status, gross_amount_kobo, platform_fee_kobo, net_amount_kobo, requested_at, completed_at, failure_reason")
            .in("escrow_id", escrowIds)
            .order("requested_at", { ascending: false })
        : Promise.resolve({ data: [], error: null }),
    ])
    if (jobsRes.error) throw jobsRes.error
    if (payoutsRes.error) throw payoutsRes.error

    const jobs = new Map((jobsRes.data ?? []).map((j: any) => [j.id, j.title]))
    const payoutsByEscrow = new Map<string, any[]>()
    for (const p of payoutsRes.data ?? []) {
      const list = payoutsByEscrow.get(p.escrow_id) ?? []
      list.push(p)
      payoutsByEscrow.set(p.escrow_id, list)
    }

    const totals = { funded_kobo: 0, released_kobo: 0, paid_out_kobo: 0, refunded_kobo: 0, in_escrow_kobo: 0, fees_kobo: 0 }
    for (const e of rows) {
      const amount = Number(e.amount_kobo) || 0
      if (["funded", "released", "paid_out", "disputed", "refunded"].includes(e.status_v2)) totals.funded_kobo += amount
      if (e.status_v2 === "funded" || e.status_v2 === "disputed") totals.in_escrow_kobo += amount
      if (e.status_v2 === "released") totals.released_kobo += amount
      if (e.status_v2 === "paid_out") totals.paid_out_kobo += amount
      if (e.status_v2 === "refunded") totals.refunded_kobo += amount
    }
    for (const p of payoutsRes.data ?? []) if (p.status === "success") totals.fees_kobo += Number(p.platform_fee_kobo) || 0

    res.json({
      totals,
      transactions: rows.map((e) => ({
        ...e,
        job_title: jobs.get(e.job_id) ?? null,
        agency_name: nameOf(profiles.get(e.agency_id)),
        freelancer_name: nameOf(profiles.get(e.freelancer_id)),
        payouts: payoutsByEscrow.get(e.id) ?? [],
      })),
    })
  })
)

// GET /api/admin/transactions/:escrowId/events -- the immutable audit trail.
adminEscrowRouter.get(
  "/transactions/:escrowId/events",
  asyncHandler(async (req, res) => {
    const { data, error } = await createServiceClient()
      .from("escrow_events")
      .select("id, type, from_status, to_status, amount_kobo, actor_id, actor_type, payload, created_at")
      .eq("escrow_id", req.params.escrowId)
      .order("created_at", { ascending: true })
    if (error) throw error
    res.json({ events: data ?? [] })
  })
)

// GET /api/admin/analytics -- top 20 freelancers by money actually paid out
// (successful payouts, net) and top 20 agencies by money funded into escrow.
adminEscrowRouter.get(
  "/analytics",
  asyncHandler(async (_req, res) => {
    const service = createServiceClient()
    const [payoutsRes, escrowsRes] = await Promise.all([
      service.from("payouts").select("freelancer_id, net_amount_kobo").eq("status", "success"),
      service
        .from("escrow_deposits")
        .select("agency_id, amount_kobo, status_v2")
        .in("status_v2", ["funded", "released", "paid_out", "disputed", "refunded"]),
    ])
    if (payoutsRes.error) throw payoutsRes.error
    if (escrowsRes.error) throw escrowsRes.error

    const earnings = new Map<string, { total: number; jobs: number }>()
    for (const p of payoutsRes.data ?? []) {
      const cur = earnings.get(p.freelancer_id) ?? { total: 0, jobs: 0 }
      earnings.set(p.freelancer_id, { total: cur.total + Number(p.net_amount_kobo), jobs: cur.jobs + 1 })
    }
    const deposits = new Map<string, { total: number; jobs: number }>()
    for (const e of escrowsRes.data ?? []) {
      const cur = deposits.get(e.agency_id) ?? { total: 0, jobs: 0 }
      deposits.set(e.agency_id, { total: cur.total + Number(e.amount_kobo), jobs: cur.jobs + 1 })
    }

    const profiles = await profileMap(service, [...new Set([...earnings.keys(), ...deposits.keys()])])
    const top = <T>(m: Map<string, { total: number; jobs: number }>, shape: (id: string, v: { total: number; jobs: number }) => T) =>
      [...m.entries()].sort((a, b) => b[1].total - a[1].total).slice(0, 20).map(([id, v]) => shape(id, v))

    res.json({
      topFreelancers: top(earnings, (id, v) => ({
        id,
        name: nameOf(profiles.get(id)) ?? "Unknown",
        email: profiles.get(id)?.email ?? null,
        earned_kobo: v.total,
        paid_jobs: v.jobs,
      })),
      topAgencies: top(deposits, (id, v) => ({
        id,
        name: nameOf(profiles.get(id)) ?? "Unknown",
        email: profiles.get(id)?.email ?? null,
        funded_kobo: v.total,
        funded_jobs: v.jobs,
      })),
    })
  })
)

// GET /api/admin/disputes -- all disputes with their conversations.
adminEscrowRouter.get(
  "/disputes",
  asyncHandler(async (_req, res) => {
    const service = createServiceClient()
    const { data: disputes, error } = await service.from("disputes").select(DISPUTE_SELECT).order("created_at", { ascending: false })
    if (error) throw error

    const ids = (disputes ?? []).map((d: any) => d.id)
    const messagesByDispute: Record<string, any[]> = {}
    if (ids.length) {
      const { data: messages, error: msgError } = await service
        .from("dispute_messages")
        .select(DISPUTE_MESSAGE_SELECT)
        .in("dispute_id", ids)
        .order("created_at", { ascending: true })
      if (msgError) throw msgError
      for (const m of messages ?? []) (messagesByDispute[m.dispute_id] ||= []).push(m)
    }
    res.json({ disputes: disputes ?? [], messagesByDispute })
  })
)

// POST /api/admin/disputes/:id/resolve { resolution_outcome: "full_release" | "refund" }
//   full_release: disputed -> released; the freelancer then withdraws through
//                 the normal payout path.
//   refund:       Paystack refunds the agency's original charge, then
//                 disputed -> refunded.
// partial_release is not supported on v2: the state machine has no split
// state, and the escrow plan's "payout + refund" split needs a product
// decision on how a partially-released escrow is represented.
adminEscrowRouter.post(
  "/disputes/:id/resolve",
  asyncHandler(async (req, res) => {
    const adminId = req.user!.id
    const outcome = req.body?.resolution_outcome
    if (outcome === "partial_release") {
      res.status(422).json({ error: "Partial release isn't supported yet -- resolve as a full release or a refund", code: "partial_not_supported" })
      return
    }
    if (outcome !== "full_release" && outcome !== "refund") {
      res.status(400).json({ error: "resolution_outcome must be 'full_release' or 'refund'" })
      return
    }

    const service = createServiceClient()
    const { data: dispute, error: disputeError } = await service.from("disputes").select("id, job_id, status").eq("id", req.params.id).maybeSingle()
    if (disputeError) throw disputeError
    if (!dispute) {
      res.status(404).json({ error: "Dispute not found" })
      return
    }
    if (dispute.status === "resolved") {
      res.status(409).json({ error: "Dispute is already resolved" })
      return
    }

    const { data: escrow, error: escrowError } = await service
      .from("escrow_deposits")
      .select("id, job_id, amount_kobo, status_v2, paystack_reference")
      .eq("job_id", dispute.job_id)
      .not("status_v2", "is", null)
      .maybeSingle()
    if (escrowError) throw escrowError
    if (!escrow || escrow.status_v2 !== "disputed") {
      res.status(409).json({ error: `The escrow for this job is ${escrow?.status_v2 ?? "missing"}, not disputed` })
      return
    }

    let refundPayload: Record<string, unknown> = {}
    if (outcome === "refund") {
      if (!escrow.paystack_reference) {
        res.status(409).json({ error: "Escrow has no Paystack reference to refund" })
        return
      }
      try {
        const refund = await paystackRequest<{ id?: number; status?: string }>("POST", "/refund", {
          transaction: escrow.paystack_reference,
          amount: escrow.amount_kobo,
        })
        refundPayload = { paystack_refund_id: refund.id ?? null, paystack_refund_status: refund.status ?? null }
      } catch (err) {
        res.status(502).json({ error: err instanceof PaystackError ? `Paystack refund failed: ${err.message}` : "Could not reach the payment service" })
        return
      }
    }

    const moved = await transitionEscrow(service, {
      escrowId: escrow.id,
      from: "disputed",
      to: outcome === "refund" ? "refunded" : "released",
      type: outcome === "refund" ? "refunded" : "released",
      amountKobo: escrow.amount_kobo,
      actorId: adminId,
      actorType: "admin",
      payload: { dispute_id: dispute.id, resolution_outcome: outcome, ...refundPayload },
      idempotencyKey: `resolve:${dispute.id}`,
    })
    if (!moved) {
      res.status(409).json({ error: "The escrow changed state; refresh and try again" })
      return
    }

    // A released escrow becomes payable through the normal payout path.
    // (Read-then-update rather than a NOT IN filter, which would skip NULL.)
    if (outcome === "full_release") {
      const { data: job } = await service.from("jobs").select("payout_status").eq("id", escrow.job_id).maybeSingle()
      const payoutStarted = job?.payout_status === "processing" || job?.payout_status === "paid"
      const { error: jobError } = await service
        .from("jobs")
        .update(payoutStarted ? { status: "closed" } : { status: "closed", payout_status: "completed" })
        .eq("id", escrow.job_id)
      if (jobError) throw jobError
    }

    const { error: updateError } = await service
      .from("disputes")
      .update({ status: "resolved", resolution_outcome: outcome, admin_id: adminId, updated_at: new Date().toISOString() })
      .eq("id", dispute.id)
    if (updateError) throw updateError

    await logAdminAction(service, {
      adminId,
      action: "dispute.resolve",
      targetType: "dispute",
      targetId: dispute.id,
      details: { resolution_outcome: outcome, escrow_id: escrow.id, amount_kobo: escrow.amount_kobo, ...refundPayload },
    })

    res.json({ success: true, status: "resolved", resolution_outcome: outcome })
  })
)

export default adminEscrowRouter
