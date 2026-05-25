import { type NextRequest, NextResponse } from "next/server"
import crypto from "crypto"
import { createServiceRoleClient } from "@/lib/supabase-service"
import { syncFundedJob } from "@/lib/funded-jobs-sync"

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY

// Always return 200 to Paystack unless the signature is bad. Non-200 responses
// make Paystack retry, which is wasted work once we've already recorded the
// event. Internal failures are logged and surfaced via webhook_events.

export async function POST(request: NextRequest) {
  if (!PAYSTACK_SECRET_KEY) {
    console.error("paystack.webhook: PAYSTACK_SECRET_KEY missing")
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 })
  }

  const rawBody = await request.text()
  const signature = request.headers.get("x-paystack-signature")

  // Mandatory signature verification. No escape hatch.
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 })
  }
  const expected = crypto
    .createHmac("sha512", PAYSTACK_SECRET_KEY)
    .update(rawBody)
    .digest("hex")
  if (expected !== signature) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
  }

  let event: any
  try {
    event = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const eventType: string | undefined = event?.event
  if (!eventType) {
    return NextResponse.json({ error: "Missing event type" }, { status: 400 })
  }

  // Paystack puts a numeric `id` on transaction events. If absent, fall back to
  // a sha256 of the raw body so we still dedupe.
  const rawEventId = event?.data?.id ?? event?.id
  const eventId = rawEventId
    ? String(rawEventId)
    : crypto.createHash("sha256").update(rawBody).digest("hex")

  const supabase = createServiceRoleClient()

  // Dedupe: claim this event by inserting into webhook_events. If another
  // request already wrote it, treat as already-processed and return.
  const { error: claimError } = await supabase.from("webhook_events").insert({
    provider: "paystack",
    event_id: eventId,
    event_type: eventType,
    payload: event,
  })
  if (claimError) {
    // 23505 = unique_violation. Anything else is a real failure to record.
    if ((claimError as any).code === "23505") {
      return NextResponse.json({ received: true, deduped: true })
    }
    console.error("paystack.webhook: failed to claim event", claimError)
    return NextResponse.json({ error: "Failed to record event" }, { status: 500 })
  }

  try {
    if (eventType === "charge.success" && event?.data?.status === "success") {
      await handleChargeSuccess(supabase, event, eventId)
    }
    // transfer.* events are handled by the payout webhook (Phase 2.3).
  } catch (err) {
    console.error("paystack.webhook: handler error", err)
    // Record failure but still acknowledge — webhook_events has the raw payload
    // for replay.
  }

  await supabase
    .from("webhook_events")
    .update({ processed_at: new Date().toISOString() })
    .eq("provider", "paystack")
    .eq("event_id", eventId)

  return NextResponse.json({ received: true })
}

async function handleChargeSuccess(
  supabase: ReturnType<typeof createServiceRoleClient>,
  event: any,
  eventId: string,
) {
  const reference: string | undefined = event?.data?.reference
  const paidAmountKobo: number = Number(event?.data?.amount ?? 0)

  if (!reference) return

  // Only handle references we issued. Credits/other Paystack flows use their
  // own prefixes and are processed elsewhere.
  if (!reference.startsWith("escrow_")) return

  const { data: escrow, error: lookupError } = await supabase
    .from("escrow_deposits")
    .select("id, status_v2, amount_kobo, agency_id, freelancer_id, job_id")
    .eq("paystack_reference", reference)
    .maybeSingle()

  if (lookupError) {
    console.error("paystack.webhook: escrow lookup failed", lookupError)
    return
  }
  if (!escrow) {
    console.warn("paystack.webhook: no escrow for reference", reference)
    return
  }

  // Idempotent: only transition awaiting → funded. Any later state means we've
  // already processed this (or a parallel verify call did).
  if (escrow.status_v2 !== "awaiting") {
    return
  }

  // Server-side amount check. If Paystack reports a different amount than the
  // escrow expected, refuse the transition and log loudly — could be tampering
  // or a price change between init and pay.
  if (paidAmountKobo !== escrow.amount_kobo) {
    console.error("paystack.webhook: amount mismatch", {
      escrow_id: escrow.id,
      expected_kobo: escrow.amount_kobo,
      paid_kobo: paidAmountKobo,
    })
    return
  }

  const { error: transitionError } = await supabase
    .from("escrow_deposits")
    .update({
      status_v2: "funded",
      // Keep the legacy column readable for old code during the soak.
      status: "funded",
    })
    .eq("id", escrow.id)
    .eq("status_v2", "awaiting") // optimistic concurrency

  if (transitionError) {
    console.error("paystack.webhook: transition failed", transitionError)
    return
  }

  await supabase.from("escrow_events").insert({
    escrow_id: escrow.id,
    type: "funded",
    from_status: "awaiting",
    to_status: "funded",
    amount_kobo: paidAmountKobo,
    actor_type: "system",
    payload: {
      paystack_reference: reference,
      paystack_event_id: eventId,
    },
    idempotency_key: `paystack:${eventId}`,
  })

  // Mirror to the legacy Funded_jobs101 table so the freelancer UI picks it up.
  await syncFundedJob(supabase, { reference, escrow })
}
