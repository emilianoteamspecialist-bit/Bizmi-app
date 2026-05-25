import { type NextRequest, NextResponse } from "next/server"
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import { createServiceRoleClient } from "@/lib/supabase-service"
import { syncFundedJob } from "@/lib/funded-jobs-sync"

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY

// Manual fallback verifier. The webhook is the primary path — this exists for
// when the user returns from Paystack faster than the webhook arrives, or when
// a webhook is missed. Idempotent: safe to call any number of times.

export async function GET(request: NextRequest) {
  if (!PAYSTACK_SECRET_KEY) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 })
  }

  const reference = new URL(request.url).searchParams.get("reference")
  if (!reference) {
    return NextResponse.json({ error: "reference is required" }, { status: 400 })
  }
  if (!reference.startsWith("escrow_")) {
    return NextResponse.json({ error: "Not an escrow reference" }, { status: 400 })
  }

  const cookieStore = await cookies()
  const userClient = createRouteHandlerClient({ cookies: () => cookieStore })
  const {
    data: { user },
  } = await userClient.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Use the user client to look up the escrow so RLS enforces that only the
  // agency or freelancer can verify their own.
  const { data: escrow, error: lookupError } = await userClient
    .from("escrow_deposits")
    .select("id, status_v2, amount_kobo, agency_id, freelancer_id, job_id")
    .eq("paystack_reference", reference)
    .maybeSingle()

  if (lookupError) {
    return NextResponse.json(
      { error: "Failed to look up escrow", details: lookupError.message },
      { status: 500 },
    )
  }
  if (!escrow) {
    return NextResponse.json({ error: "Escrow not found" }, { status: 404 })
  }

  // Already funded (or beyond): just report status. No need to hit Paystack.
  if (escrow.status_v2 !== "awaiting") {
    // Backfill the legacy Funded_jobs101 row if a prior verify/webhook missed it
    // (e.g., the sync didn't exist when this escrow was funded).
    if (["funded", "released", "paid_out"].includes(escrow.status_v2 as string)) {
      const service = createServiceRoleClient()
      await syncFundedJob(service, { reference, escrow })
    }
    return NextResponse.json({
      success: true,
      already_processed: true,
      escrow_id: escrow.id,
      status: escrow.status_v2,
    })
  }

  // Ask Paystack for the truth.
  let paystackData: any
  try {
    const res = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      { headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` } },
    )
    paystackData = await res.json()
  } catch (err) {
    return NextResponse.json(
      { error: "Paystack verify request failed", details: (err as Error).message },
      { status: 502 },
    )
  }

  if (!paystackData?.status || paystackData?.data?.status !== "success") {
    return NextResponse.json(
      {
        success: false,
        error: "Payment not successful on Paystack",
        paystack_status: paystackData?.data?.status,
      },
      { status: 402 },
    )
  }

  const paidAmountKobo = Number(paystackData.data.amount)
  if (paidAmountKobo !== escrow.amount_kobo) {
    return NextResponse.json(
      {
        success: false,
        error: "Amount mismatch — refusing to mark funded",
        expected_kobo: escrow.amount_kobo,
        paid_kobo: paidAmountKobo,
      },
      { status: 409 },
    )
  }

  // State transition uses the service-role client so we bypass RLS but the
  // optimistic `eq('status_v2', 'awaiting')` guarantees we won't race past the
  // webhook.
  const service = createServiceRoleClient()
  const { error: transitionError, data: updated } = await service
    .from("escrow_deposits")
    .update({ status_v2: "funded", status: "funded" })
    .eq("id", escrow.id)
    .eq("status_v2", "awaiting")
    .select("id")
    .maybeSingle()

  if (transitionError) {
    return NextResponse.json(
      { error: "Failed to transition escrow", details: transitionError.message },
      { status: 500 },
    )
  }

  // updated will be null if the webhook beat us — that's fine, idempotent.
  if (updated) {
    await service.from("escrow_events").insert({
      escrow_id: escrow.id,
      type: "funded",
      from_status: "awaiting",
      to_status: "funded",
      amount_kobo: paidAmountKobo,
      actor_id: user.id,
      actor_type: "agency",
      payload: {
        paystack_reference: reference,
        via: "manual_verify",
      },
      idempotency_key: `verify:${reference}`,
    })
  }

  // Mirror to the legacy Funded_jobs101 table so the freelancer's "Funded Jobs"
  // page picks the job up. Runs regardless of who won the race — the sync is
  // idempotent on reference_id.
  await syncFundedJob(service, { reference, escrow })

  return NextResponse.json({
    success: true,
    escrow_id: escrow.id,
    status: "funded",
    amount_kobo: paidAmountKobo,
    raced_webhook: !updated,
  })
}
