import type { SupabaseClient } from "@supabase/supabase-js"
import { transitionEscrow, koboToNaira } from "./escrow.js"
import { notifyFreelancerPayout } from "./notifications.js"

// Transfers we initiate use this reference format, so the webhook can map a
// transfer.* event back to its payouts row.
export const payoutReference = (payoutId: string) => `payout_${payoutId}`
export const PAYOUT_REFERENCE_PREFIX = "payout_"

type TransferOutcome = "success" | "failed" | "reversed"

// Applies a Paystack transfer.* outcome to a payout. Idempotent: only a payout
// still in 'processing' is settled; replays and late duplicates are no-ops.
export async function settlePayout(
  service: SupabaseClient,
  payoutId: string,
  outcome: TransferOutcome,
  details: { transferCode?: string | null; reason?: string | null; eventId: string }
): Promise<void> {
  const { data: payout, error } = await service
    .from("payouts")
    .update({
      status: outcome,
      ...(outcome === "success" ? { completed_at: new Date().toISOString() } : { failure_reason: details.reason ?? outcome }),
      ...(details.transferCode ? { paystack_transfer_code: details.transferCode } : {}),
    })
    .eq("id", payoutId)
    .eq("status", "processing")
    .select("id, escrow_id, freelancer_id, net_amount_kobo")
    .maybeSingle()

  if (error) throw error
  if (!payout) return // already settled (or unknown) -- nothing to do

  const { data: escrow } = await service.from("escrow_deposits").select("job_id").eq("id", payout.escrow_id).maybeSingle()
  const jobId = escrow?.job_id as string | undefined

  if (outcome === "success") {
    await transitionEscrow(service, {
      escrowId: payout.escrow_id,
      from: "released",
      to: "paid_out",
      type: "paid_out",
      amountKobo: payout.net_amount_kobo,
      actorType: "system",
      payload: { payout_id: payout.id, transfer_code: details.transferCode ?? null, paystack_event_id: details.eventId },
      idempotencyKey: `payout_success:${payout.id}`,
    })
    if (jobId) {
      // Keep the legacy job columns the Next.js app reads in step.
      await service
        .from("jobs")
        .update({ payout_status: "paid", payout_amount: koboToNaira(payout.net_amount_kobo), paid_at: new Date().toISOString() })
        .eq("id", jobId)
      await notifyFreelancerPayout(payout.freelancer_id, jobId, koboToNaira(payout.net_amount_kobo))
    }
    return
  }

  if (outcome === "failed" && jobId) {
    // Release the cross-app payout claim so the freelancer can retry. The
    // escrow stays 'released'; the failed payouts row no longer counts toward
    // the one-active-payout-per-escrow index.
    await service.from("jobs").update({ payout_status: "completed" }).eq("id", jobId).eq("payout_status", "processing")
  }

  if (outcome === "reversed") {
    // Money came back after a reported success or mid-flight. The escrow may
    // already be paid_out, which the state machine can't undo -- flag for an
    // admin rather than guessing.
    console.error("[payouts] transfer reversed -- needs admin review", { payoutId: payout.id, escrowId: payout.escrow_id })
  }
}
