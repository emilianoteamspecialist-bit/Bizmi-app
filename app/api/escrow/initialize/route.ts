import { type NextRequest, NextResponse } from "next/server"
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY
const APP_URL = process.env.NEXT_PUBLIC_APP_URL

type Status =
  | "pending"
  | "awaiting"
  | "funded"
  | "released"
  | "paid_out"
  | "refunded"
  | "disputed"
  | "cancelled"

const ACTIVE_STATUSES: Status[] = [
  "awaiting",
  "funded",
  "released",
  "paid_out",
  "disputed",
]

export async function POST(request: NextRequest) {
  if (!PAYSTACK_SECRET_KEY || !APP_URL) {
    return NextResponse.json(
      { error: "Server misconfigured: PAYSTACK_SECRET_KEY / NEXT_PUBLIC_APP_URL" },
      { status: 500 },
    )
  }

  const cookieStore = await cookies()
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore })

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: { proposalId?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const proposalId = body.proposalId
  if (!proposalId || typeof proposalId !== "string") {
    return NextResponse.json({ error: "proposalId is required" }, { status: 400 })
  }

  // Pull the proposal + its job in one round trip. The server resolves
  // amount/agency/freelancer here — the client never gets to specify them.
  const { data: proposal, error: proposalError } = await supabase
    .from("proposals")
    .select("id, job_id, freelancer_id, status, budget, jobs(id, agency_id, title)")
    .eq("id", proposalId)
    .single()

  if (proposalError || !proposal) {
    return NextResponse.json({ error: "Proposal not found" }, { status: 404 })
  }

  if (proposal.status !== "accepted") {
    return NextResponse.json(
      { error: "Proposal must be accepted before funding" },
      { status: 409 },
    )
  }

  const job: any = Array.isArray(proposal.jobs) ? proposal.jobs[0] : proposal.jobs
  if (!job) {
    return NextResponse.json({ error: "Job not found for proposal" }, { status: 404 })
  }

  if (job.agency_id !== user.id) {
    return NextResponse.json(
      { error: "Only the owning agency can fund this job" },
      { status: 403 },
    )
  }

  const budgetNaira = Number(proposal.budget)
  if (!Number.isFinite(budgetNaira) || budgetNaira <= 0) {
    return NextResponse.json(
      { error: "Proposal has no valid budget to fund" },
      { status: 422 },
    )
  }
  const amountKobo = Math.round(budgetNaira * 100)

  // Refuse to re-initialize if an active escrow already exists for this job.
  const { data: existing, error: existingError } = await supabase
    .from("escrow_deposits")
    .select("id, status_v2, paystack_authorization_url, paystack_reference")
    .eq("job_id", job.id)
    .not("status_v2", "is", null)
    .maybeSingle()

  if (existingError) {
    return NextResponse.json(
      { error: "Failed to check existing escrow", details: existingError.message },
      { status: 500 },
    )
  }

  if (existing && ACTIVE_STATUSES.includes(existing.status_v2 as Status)) {
    // If it's still awaiting payment, hand back the same Paystack URL so the
    // agency can resume. Otherwise reject.
    if (
      existing.status_v2 === "awaiting" &&
      existing.paystack_authorization_url &&
      existing.paystack_reference
    ) {
      return NextResponse.json({
        success: true,
        resumed: true,
        escrow_id: existing.id,
        authorization_url: existing.paystack_authorization_url,
        reference: existing.paystack_reference,
      })
    }
    return NextResponse.json(
      { error: `Escrow for this job is already ${existing.status_v2}` },
      { status: 409 },
    )
  }

  // 1) Insert the escrow row in status_v2='pending'. validate_initial requires
  //    this — any other initial state raises.
  const { data: inserted, error: insertError } = await supabase
    .from("escrow_deposits")
    .insert({
      job_id: job.id,
      agency_id: user.id,
      freelancer_id: proposal.freelancer_id,
      amount_kobo: amountKobo,
      status_v2: "pending",
      // Legacy columns (NOT NULL + CHECK constraint). Keep populated for the
      // soak period; the new state machine is the source of truth.
      status: "awaiting",
      balance: budgetNaira,
    })
    .select("id")
    .single()

  if (insertError || !inserted) {
    return NextResponse.json(
      { error: "Failed to create escrow row", details: insertError?.message },
      { status: 500 },
    )
  }

  const escrowId = inserted.id
  const reference = `escrow_${escrowId}`

  // 2) Initialize the Paystack transaction.
  let paystackData: any
  try {
    const paystackRes = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: user.email,
        amount: amountKobo,
        currency: "NGN",
        reference,
        callback_url: `${APP_URL}/agency/dashboard?escrow_funded=${escrowId}`,
        metadata: {
          escrow_id: escrowId,
          job_id: job.id,
          job_title: job.title,
          proposal_id: proposal.id,
        },
      }),
    })
    paystackData = await paystackRes.json()
  } catch (err) {
    return NextResponse.json(
      { error: "Paystack initialization failed", details: (err as Error).message },
      { status: 502 },
    )
  }

  if (!paystackData?.status) {
    return NextResponse.json(
      { error: paystackData?.message || "Paystack returned an error" },
      { status: 502 },
    )
  }

  // 3) Persist the Paystack reference + URL and transition pending → awaiting.
  const { error: updateError } = await supabase
    .from("escrow_deposits")
    .update({
      paystack_reference: paystackData.data.reference,
      paystack_authorization_url: paystackData.data.authorization_url,
      paystack_access_code: paystackData.data.access_code,
      status_v2: "awaiting",
    })
    .eq("id", escrowId)

  if (updateError) {
    return NextResponse.json(
      { error: "Failed to record Paystack reference", details: updateError.message },
      { status: 500 },
    )
  }

  // 4) Append the funding_initiated event (idempotent on retry).
  await supabase.from("escrow_events").insert({
    escrow_id: escrowId,
    type: "funding_initiated",
    from_status: "pending",
    to_status: "awaiting",
    amount_kobo: amountKobo,
    actor_id: user.id,
    actor_type: "agency",
    payload: {
      paystack_reference: paystackData.data.reference,
      proposal_id: proposal.id,
    },
    idempotency_key: `init:${escrowId}`,
  })

  return NextResponse.json({
    success: true,
    escrow_id: escrowId,
    authorization_url: paystackData.data.authorization_url,
    reference: paystackData.data.reference,
  })
}
