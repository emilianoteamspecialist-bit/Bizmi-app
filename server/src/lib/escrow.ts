import type { SupabaseClient } from "@supabase/supabase-js"

// Escrow v2 core (docs/escrow-production-plan.md, scripts/escrow-00{1,2}-*.sql).
//
// All writes to escrow tables go through the service-role client (the v2 RLS
// only grants participants SELECT), and only after the route has checked the
// caller's identity and ownership itself. Amounts are integer kobo end to end.

export type EscrowStatus =
  | "pending"
  | "awaiting"
  | "funded"
  | "released"
  | "paid_out"
  | "refunded"
  | "disputed"
  | "cancelled"

export type EscrowActorType = "agency" | "freelancer" | "admin" | "system"

export type EscrowRow = {
  id: string
  job_id: string
  agency_id: string
  freelancer_id: string | null
  amount_kobo: number | null
  status_v2: EscrowStatus | null
  paystack_reference?: string | null
}

// Statuses that mean a job already has a live escrow (a new one must not be
// created alongside it).
export const ACTIVE_ESCROW_STATUSES: EscrowStatus[] = ["awaiting", "funded", "released", "paid_out", "disputed"]

// The legacy free-text `status` column is still read by the Next.js app during
// the soak period, and its CHECK constraint only allows these values
// (scripts/create-disputes-tables.sql). Keep it in step with status_v2.
const LEGACY_STATUS: Partial<Record<EscrowStatus, string>> = {
  awaiting: "awaiting",
  funded: "funded",
  released: "confirmed",
  paid_out: "confirmed",
  disputed: "disputed",
  refunded: "refunded",
}

export const PLATFORM_FEE_PERCENT = 15

// Payout amounts are always derived from escrow state, never from a request.
export function payoutAmounts(grossKobo: number): { grossKobo: number; feeKobo: number; netKobo: number } {
  if (!Number.isSafeInteger(grossKobo) || grossKobo <= 0) {
    throw new Error(`Invalid escrow amount: ${grossKobo}`)
  }
  const feeKobo = Math.round((grossKobo * PLATFORM_FEE_PERCENT) / 100)
  return { grossKobo, feeKobo, netKobo: grossKobo - feeKobo }
}

export const koboToNaira = (kobo: number) => kobo / 100

type TransitionInput = {
  escrowId: string
  from: EscrowStatus
  to: EscrowStatus
  type: string
  amountKobo?: number | null
  actorId?: string | null
  actorType: EscrowActorType
  payload?: Record<string, unknown>
  idempotencyKey: string
  extra?: Record<string, unknown>
}

// Moves an escrow from `from` to `to` with an optimistic-concurrency guard
// (`.eq("status_v2", from)`), so two racing callers (e.g. webhook vs. manual
// verify) can't both win. The DB trigger (escrow-002) separately rejects any
// transition the state machine doesn't allow.
//
// Returns true if this call performed the transition, false if the escrow was
// no longer in `from` (someone else got there first -- callers treat that as
// "already done", which keeps every money path idempotent).
export async function transitionEscrow(service: SupabaseClient, input: TransitionInput): Promise<boolean> {
  const legacy = LEGACY_STATUS[input.to]
  const { data, error } = await service
    .from("escrow_deposits")
    .update({ status_v2: input.to, ...(legacy ? { status: legacy } : {}), ...(input.extra ?? {}) })
    .eq("id", input.escrowId)
    .eq("status_v2", input.from)
    .select("id")
    .maybeSingle()

  if (error) throw error
  if (!data) return false

  await appendEscrowEvent(service, input)
  return true
}

// escrow_append_event (escrow-002) is idempotent on idempotency_key.
export async function appendEscrowEvent(
  service: SupabaseClient,
  input: Omit<TransitionInput, "extra"> & { from: EscrowStatus | null }
): Promise<void> {
  const { error } = await service.rpc("escrow_append_event", {
    p_escrow_id: input.escrowId,
    p_type: input.type,
    p_from: input.from,
    p_to: input.to,
    p_amount: input.amountKobo ?? null,
    p_actor_id: input.actorId ?? null,
    p_actor_type: input.actorType,
    p_payload: input.payload ?? {},
    p_idempotency_key: input.idempotencyKey,
  })
  // The state change has already committed; a missing audit row must be
  // visible in logs, but it must not turn a completed money movement into an
  // error response that invites a retry.
  if (error) {
    console.error("[escrow] failed to append event", { escrowId: input.escrowId, type: input.type, error })
  }
}

// Soak-period shim, ported from the Next.js app's lib/funded-jobs-sync.ts: the
// legacy "Funded Jobs" page still reads Funded_jobs101. Idempotent on
// reference_id; best-effort (logs, never throws). Delete together with the
// legacy table when the soak ends.
export async function syncFundedJob(service: SupabaseClient, reference: string, escrow: EscrowRow): Promise<void> {
  try {
    const { data: existing } = await service.from("Funded_jobs101").select("id").eq("reference_id", reference).maybeSingle()
    if (existing) return

    const [{ data: agency }, { data: job }] = await Promise.all([
      service.from("profiles").select("full_name, company_name").eq("id", escrow.agency_id).maybeSingle(),
      service.from("jobs").select("title").eq("id", escrow.job_id).maybeSingle(),
    ])

    const { error } = await service.from("Funded_jobs101").insert({
      reference_id: reference,
      agency_name: agency?.company_name || agency?.full_name || "Agency",
      job_title: job?.title || "Job",
      amount: escrow.amount_kobo ? koboToNaira(escrow.amount_kobo) : 0,
      status: "verified",
      freelancer_id: escrow.freelancer_id,
      agency_id: escrow.agency_id,
      job_id: escrow.job_id,
      funded_at: new Date().toISOString(),
    })
    if (error) console.error("[escrow] syncFundedJob insert failed", { reference, escrowId: escrow.id, error })
  } catch (err) {
    console.error("[escrow] syncFundedJob unexpected error", { reference, escrowId: escrow.id, err })
  }
}

// Marks an awaiting escrow funded after Paystack has confirmed the charge.
// Shared by the webhook and the manual verify fallback so both apply the same
// amount check and transition. Returns "funded" if this call did it,
// "already" if it had already happened, or "amount_mismatch".
export async function markEscrowFunded(
  service: SupabaseClient,
  escrow: EscrowRow,
  paidKobo: number,
  opts: { reference: string; actorId?: string | null; actorType: EscrowActorType; idempotencyKey: string; via: string }
): Promise<"funded" | "already" | "amount_mismatch"> {
  if (escrow.status_v2 !== "awaiting") return "already"

  if (paidKobo !== escrow.amount_kobo) {
    console.error("[escrow] amount mismatch -- refusing to mark funded", {
      escrowId: escrow.id,
      expectedKobo: escrow.amount_kobo,
      paidKobo,
    })
    return "amount_mismatch"
  }

  const won = await transitionEscrow(service, {
    escrowId: escrow.id,
    from: "awaiting",
    to: "funded",
    type: "funded",
    amountKobo: paidKobo,
    actorId: opts.actorId ?? null,
    actorType: opts.actorType,
    payload: { paystack_reference: opts.reference, via: opts.via },
    idempotencyKey: opts.idempotencyKey,
  })

  // Mirror to Funded_jobs101 whoever won the race (idempotent).
  await syncFundedJob(service, opts.reference, escrow)
  return won ? "funded" : "already"
}
