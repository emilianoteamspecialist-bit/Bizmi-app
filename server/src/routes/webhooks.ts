import crypto from "node:crypto"
import express, { Router } from "express"
import { asyncHandler } from "../lib/http.js"
import { createServiceClient } from "../lib/supabase.js"
import { verifyPaystackSignature } from "../lib/paystack.js"
import { markEscrowFunded, type EscrowRow } from "../lib/escrow.js"
import { settlePayout, PAYOUT_REFERENCE_PREFIX } from "../lib/payouts.js"

const webhooksRouter = Router()

// Single Paystack webhook for every flow this server owns (escrow funding and
// payout transfers). Mounted in app.ts BEFORE express.json(): the signature is
// an HMAC over the exact raw bytes, so the body must not be parsed first.
//
// Response policy: 400 for requests that fail authentication/shape checks
// (never retried usefully); 200 once an event is applied or deduped; 500 only
// when applying it failed, after releasing the dedupe claim so Paystack's
// retry is processed rather than deduped.
webhooksRouter.post(
  "/paystack",
  express.raw({ type: "*/*", limit: "1mb" }),
  asyncHandler(async (req, res) => {
    const rawBody: Buffer = Buffer.isBuffer(req.body) ? req.body : Buffer.from("")
    const signature = req.header("x-paystack-signature")

    if (!verifyPaystackSignature(rawBody, signature)) {
      res.status(400).json({ error: "Invalid signature" })
      return
    }

    let event: any
    try {
      event = JSON.parse(rawBody.toString("utf8"))
    } catch {
      res.status(400).json({ error: "Invalid JSON" })
      return
    }

    const eventType: string | undefined = event?.event
    if (!eventType) {
      res.status(400).json({ error: "Missing event type" })
      return
    }

    // Paystack puts a numeric id on its event data; fall back to a hash of the
    // body so dedupe still works if it's ever absent.
    const rawId = event?.data?.id ?? event?.id
    const eventId = rawId ? `${eventType}:${rawId}` : crypto.createHash("sha256").update(rawBody).digest("hex")

    const service = createServiceClient()

    // Claim the event. A unique violation means we've seen it before.
    const { error: claimError } = await service
      .from("webhook_events")
      .insert({ provider: "paystack", event_id: eventId, event_type: eventType, payload: event })
    if (claimError) {
      if ((claimError as { code?: string }).code === "23505") {
        res.json({ received: true, deduped: true })
        return
      }
      console.error("[webhook] failed to record event", claimError)
      res.status(500).json({ error: "Failed to record event" })
      return
    }

    try {
      if (eventType === "charge.success" && event?.data?.status === "success") {
        await handleChargeSuccess(service, event, eventId)
      } else if (eventType === "transfer.success" || eventType === "transfer.failed" || eventType === "transfer.reversed") {
        await handleTransfer(service, event, eventId)
      }
    } catch (err) {
      // Handlers are idempotent, so release the claim and let Paystack's retry
      // reprocess the event -- otherwise the retry would be deduped and the
      // event silently never applied.
      console.error("[webhook] handler error -- releasing claim for retry", { eventType, eventId, err })
      await service.from("webhook_events").delete().eq("provider", "paystack").eq("event_id", eventId)
      res.status(500).json({ error: "Processing failed" })
      return
    }

    await service
      .from("webhook_events")
      .update({ processed_at: new Date().toISOString() })
      .eq("provider", "paystack")
      .eq("event_id", eventId)

    res.json({ received: true })
  })
)

async function handleChargeSuccess(service: ReturnType<typeof createServiceClient>, event: any, eventId: string) {
  const reference: string | undefined = event?.data?.reference
  // Only escrow references are ours to settle here. Credit purchases are
  // verified by POST /api/user/credits/verify; anything else is ignored.
  if (!reference?.startsWith("escrow_")) return

  const { data: escrow, error } = await service
    .from("escrow_deposits")
    .select("id, job_id, agency_id, freelancer_id, amount_kobo, status_v2")
    .eq("paystack_reference", reference)
    .maybeSingle()
  if (error) throw error
  if (!escrow) {
    console.warn("[webhook] no escrow for reference", reference)
    return
  }

  await markEscrowFunded(service, escrow as EscrowRow, Number(event?.data?.amount ?? 0), {
    reference,
    actorType: "system",
    idempotencyKey: `paystack:${eventId}`,
    via: "webhook",
  })
}

async function handleTransfer(service: ReturnType<typeof createServiceClient>, event: any, eventId: string) {
  const reference: string | undefined = event?.data?.reference
  if (!reference?.startsWith(PAYOUT_REFERENCE_PREFIX)) return

  const payoutId = reference.slice(PAYOUT_REFERENCE_PREFIX.length)
  const outcome = event.event === "transfer.success" ? "success" : event.event === "transfer.failed" ? "failed" : "reversed"
  await settlePayout(service, payoutId, outcome, {
    transferCode: event?.data?.transfer_code ?? null,
    reason: event?.data?.reason ?? event?.data?.gateway_response ?? null,
    eventId,
  })
}

export default webhooksRouter
