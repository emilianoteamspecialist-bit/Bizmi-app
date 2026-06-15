"use server"

import { createClient } from "@/lib/supabase-server"
import { getCurrentUser } from "@/lib/auth"

export type ProposalInput = {
  proposal_text: string
  timeline: string
  budget: string
}

export type SubmitProposalResult =
  | { success: true; alreadySubmitted?: boolean }
  | { success: false; error: string; code?: string }

export async function submitProposal(
  jobId: string,
  input: ProposalInput,
  creditCost: number,
): Promise<SubmitProposalResult> {
  const supabase = await createClient()
  const user = await getCurrentUser()
  if (!user) return { success: false, error: "Unauthorized" }

  const { error: proposalError } = await supabase.from("proposals").insert([
    {
      job_id: jobId,
      freelancer_id: user.id,
      proposal_text: input.proposal_text,
      timeline: input.timeline,
      budget: input.budget,
      status: "pending",
    },
  ])

  if (proposalError) {
    // unique_violation on (job_id, freelancer_id): a prior attempt already
    // landed. Surface a meaningful "already submitted" instead of a generic
    // error, and skip the credit deduction (charge once, not per retry).
    if (proposalError.code === "23505") {
      return { success: true, alreadySubmitted: true }
    }
    console.error("submitProposal insert error:", proposalError)
    return {
      success: false,
      error: proposalError.message,
      code: proposalError.code,
    }
  }

  // Credit deduction. Not strictly atomic with the proposal insert — if this
  // fails the proposal is still recorded. We log loudly so it can be
  // reconciled, but we don't fail the whole call: the freelancer's intent
  // (submitting the proposal) succeeded.
  const { error: creditError } = await supabase.from("purchase_credits").insert([
    {
      freelancer_id: user.id,
      amount: creditCost * 50,
      credits_amount: -creditCost,
      status: "completed",
      paystack_reference: `job_bid_${jobId}_${user.id}_${Date.now()}`,
    },
  ])

  if (creditError) {
    console.error(
      "submitProposal credit deduction failed AFTER proposal insert — manual reconciliation needed",
      { jobId, freelancerId: user.id, creditCost, creditError },
    )
  }

  return { success: true }
}
