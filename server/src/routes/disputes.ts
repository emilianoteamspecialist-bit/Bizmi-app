import { Router } from "express"
import { asyncHandler } from "../lib/http.js"
import { createServiceClient } from "../lib/supabase.js"
import { transitionEscrow, koboToNaira } from "../lib/escrow.js"

const disputesRouter = Router()

export const DISPUTE_TYPES = ["quality", "non_delivery", "client_abandonment", "extra_work"] as const

export const DISPUTE_SELECT = `
  id, job_id, initiator_id, respondent_id, dispute_type, status, resolution_outcome,
  amount_disputed, description, created_at, updated_at,
  job:jobs(title),
  initiator:profiles!disputes_initiator_id_fkey(full_name),
  respondent:profiles!disputes_respondent_id_fkey(full_name)
`

export const DISPUTE_MESSAGE_SELECT = `
  id, dispute_id, sender_id, message, created_at,
  sender:profiles!dispute_messages_sender_id_fkey(full_name)
`

// POST /api/disputes { job_id, dispute_type, description }
// Either party to a funded escrow can open a dispute, which freezes the funds
// (funded -> disputed). Parties and amount come from the escrow, not the body.
disputesRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const userId = req.user!.id
    const { job_id, dispute_type } = req.body ?? {}
    const description = typeof req.body?.description === "string" ? req.body.description.trim() : ""
    if (typeof job_id !== "string" || !job_id) {
      res.status(400).json({ error: "job_id is required" })
      return
    }
    if (!DISPUTE_TYPES.includes(dispute_type)) {
      res.status(400).json({ error: `dispute_type must be one of: ${DISPUTE_TYPES.join(", ")}` })
      return
    }
    if (!description) {
      res.status(400).json({ error: "description is required" })
      return
    }

    const service = createServiceClient()
    const { data: escrow, error: escrowError } = await service
      .from("escrow_deposits")
      .select("id, agency_id, freelancer_id, amount_kobo, status_v2")
      .eq("job_id", job_id)
      .not("status_v2", "is", null)
      .maybeSingle()
    if (escrowError) throw escrowError
    if (!escrow || (escrow.agency_id !== userId && escrow.freelancer_id !== userId) || !escrow.freelancer_id) {
      res.status(404).json({ error: "No escrow found for this job" })
      return
    }
    if (escrow.status_v2 !== "funded") {
      res.status(409).json({ error: `A dispute can only be opened while the escrow is funded (it is ${escrow.status_v2})` })
      return
    }

    const respondentId = escrow.agency_id === userId ? escrow.freelancer_id : escrow.agency_id

    // RLS: initiator_id must be the caller.
    const { data: dispute, error: insertError } = await req.supabase!
      .from("disputes")
      .insert({
        job_id,
        initiator_id: userId,
        respondent_id: respondentId,
        dispute_type,
        description,
        amount_disputed: koboToNaira(Number(escrow.amount_kobo)),
        status: "in_platform_review",
      })
      .select("id")
      .single()
    if (insertError) throw insertError

    const frozen = await transitionEscrow(service, {
      escrowId: escrow.id,
      from: "funded",
      to: "disputed",
      type: "disputed",
      amountKobo: escrow.amount_kobo,
      actorId: userId,
      actorType: escrow.agency_id === userId ? "agency" : "freelancer",
      payload: { dispute_id: dispute.id, dispute_type },
      idempotencyKey: `dispute:${dispute.id}`,
    })
    if (!frozen) {
      // Lost a race (e.g. approved or disputed in parallel): don't leave a
      // dispute pointing at funds that aren't frozen.
      await service.from("disputes").delete().eq("id", dispute.id)
      res.status(409).json({ error: "The escrow changed state; refresh and try again" })
      return
    }

    // Seed the room with the complaint so both parties see it.
    const { error: msgError } = await req.supabase!
      .from("dispute_messages")
      .insert({ dispute_id: dispute.id, sender_id: userId, message: description })
    if (msgError) console.error("[disputes] could not insert opening message", msgError)

    res.json({ success: true, dispute: { id: dispute.id } })
  })
)

// GET /api/disputes/:id -- the dispute and its conversation (participants only, via RLS).
disputesRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const { data: dispute, error } = await req.supabase!.from("disputes").select(DISPUTE_SELECT).eq("id", req.params.id).maybeSingle()
    if (error) throw error
    if (!dispute) {
      res.status(404).json({ error: "Dispute not found" })
      return
    }
    const { data: messages, error: msgError } = await req.supabase!
      .from("dispute_messages")
      .select(DISPUTE_MESSAGE_SELECT)
      .eq("dispute_id", req.params.id)
      .order("created_at", { ascending: true })
    if (msgError) throw msgError
    res.json({ dispute, messages: messages ?? [] })
  })
)

// POST /api/disputes/:id/messages { message }
disputesRouter.post(
  "/:id/messages",
  asyncHandler(async (req, res) => {
    const message = typeof req.body?.message === "string" ? req.body.message.trim() : ""
    if (!message) {
      res.status(400).json({ error: "message is required" })
      return
    }
    const { data: dispute, error } = await req.supabase!.from("disputes").select("id, status").eq("id", req.params.id).maybeSingle()
    if (error) throw error
    if (!dispute) {
      res.status(404).json({ error: "Dispute not found" })
      return
    }
    if (dispute.status === "resolved") {
      res.status(409).json({ error: "This dispute is resolved" })
      return
    }
    const { data, error: insertError } = await req.supabase!
      .from("dispute_messages")
      .insert({ dispute_id: dispute.id, sender_id: req.user!.id, message })
      .select(DISPUTE_MESSAGE_SELECT)
      .single()
    if (insertError) throw insertError
    res.json({ message: data })
  })
)

export default disputesRouter
