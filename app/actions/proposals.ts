"use server"

import { createClient } from "@/lib/supabase-server"
import { getCurrentUser } from "@/lib/auth"

export type ProposalInput = {
  proposal_text: string
  timeline: string
  budget: string
  attachments?: string[]
}

export type SubmitProposalResult =
  | { success: true; alreadySubmitted?: boolean }
  | { success: false; error: string; code?: string }

// Submitting a proposal charges the freelancer's credits. Both the proposal
// insert and the charge happen inside the place_bid Postgres function as a
// single transaction: balance-checked, idempotent (one charge per job), and
// taken from auth.uid() server-side. The client is never trusted with the
// credit math, and the proposal can never be recorded without being charged.
export async function submitProposal(
  jobId: string,
  input: ProposalInput,
  creditCost: number,
): Promise<SubmitProposalResult> {
  const supabase = await createClient()
  const user = await getCurrentUser()
  if (!user) return { success: false, error: "Unauthorized" }

  const { data, error } = await supabase.rpc("place_bid", {
    p_job_id: jobId,
    p_proposal_text: input.proposal_text,
    p_timeline: input.timeline,
    p_budget: input.budget,
    p_credit_cost: creditCost,
    p_attachments: input.attachments ?? null,
  })

  if (error) {
    console.error("place_bid RPC error:", error)
    return { success: false, error: error.message, code: error.code }
  }

  const result = (data ?? {}) as { ok?: boolean; code?: string; balance?: number }

  if (result.ok) {
    return { success: true, alreadySubmitted: result.code === "already_submitted" }
  }

  switch (result.code) {
    case "insufficient_credits":
      return { success: false, error: "Insufficient credits to place this bid.", code: result.code }
    case "unauthorized":
      return { success: false, error: "Unauthorized", code: result.code }
    default:
      return { success: false, error: "Could not submit proposal. Please try again.", code: result.code }
  }
}
