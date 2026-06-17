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

export type RespondResult = { success: true } | { success: false; error: string }

// Accept or reject a proposal. Only the agency that owns the job may do this —
// previously this was a direct browser update with no ownership check, and
// accepting a proposal gates funding. The ownership check is explicit here
// (defence-in-depth beyond RLS).
export async function respondToProposal(
  proposalId: string,
  action: "accept" | "reject",
): Promise<RespondResult> {
  const supabase = await createClient()
  const user = await getCurrentUser()
  if (!user) return { success: false, error: "Unauthorized" }

  // The proposal's job must belong to the calling agency.
  const { data: proposal, error: lookupError } = await supabase
    .from("proposals")
    .select("id, jobs!inner(agency_id)")
    .eq("id", proposalId)
    .maybeSingle()

  if (lookupError) return { success: false, error: lookupError.message }
  if (!proposal) return { success: false, error: "Proposal not found" }
  if ((proposal as any).jobs?.agency_id !== user.id) {
    return { success: false, error: "Forbidden" }
  }

  const { error } = await supabase
    .from("proposals")
    .update({
      status: action === "accept" ? "accepted" : "rejected",
      updated_at: new Date().toISOString(),
    })
    .eq("id", proposalId)

  if (error) return { success: false, error: error.message }
  return { success: true }
}

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
