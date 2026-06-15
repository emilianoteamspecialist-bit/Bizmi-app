import { type NextRequest, NextResponse } from "next/server"
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import { paystack } from "@/lib/paystack"
import { createServiceRoleClient } from "@/lib/supabase-service"

const PLATFORM_FEE = 0.15 // 15% platform fee

// Pays a freelancer for an approved, funded job.
//
// Security model (do NOT trust the client here — this moves real money):
//   * The caller must be authenticated; the freelancer is taken from the
//     session, never from the request body.
//   * The job, amount and destination are derived server-side from the escrow
//     record and the freelancer's saved bank details — the body only carries
//     jobId.
//   * Double-pay is prevented by an optimistic state transition: we flip
//     jobs.payout_status from 'completed' (approved) to 'processing' with a
//     conditional update. Only one caller can win that race; everyone else
//     sees 0 rows and bails before any transfer happens.
export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies()
    const userClient = createRouteHandlerClient({ cookies: () => cookieStore })
    const {
      data: { user },
    } = await userClient.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { jobId } = await req.json()
    if (!jobId) {
      return NextResponse.json({ error: "jobId is required" }, { status: 400 })
    }

    const service = createServiceRoleClient()

    // Source of truth for who gets paid and how much: the escrow record.
    const { data: escrow, error: escrowError } = await service
      .from("escrow_deposits")
      .select("id, amount_kobo, freelancer_id, job_id")
      .eq("job_id", jobId)
      .maybeSingle()

    if (escrowError) {
      return NextResponse.json({ error: "Failed to look up escrow" }, { status: 500 })
    }
    if (!escrow) {
      return NextResponse.json({ error: "No escrow for this job" }, { status: 404 })
    }
    // Authorisation: only the freelancer the funds are held for can be paid.
    if (escrow.freelancer_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    if (!escrow.amount_kobo || escrow.amount_kobo <= 0) {
      return NextResponse.json({ error: "Escrow amount missing" }, { status: 409 })
    }

    // Bank destination comes from the freelancer's saved details, not the body.
    const { data: bank } = await service
      .from("freelancer_bank_details")
      .select("account_number, bank_code")
      .eq("freelancer_id", user.id)
      .maybeSingle()
    if (!bank?.account_number || !bank?.bank_code) {
      return NextResponse.json({ error: "No bank details on file" }, { status: 400 })
    }

    // Double-pay guard: claim the job for payout. Only succeeds if it's
    // currently 'completed' (approved) and not already processing/paid.
    const { data: claimed, error: claimError } = await service
      .from("jobs")
      .update({ payout_status: "processing" })
      .eq("id", jobId)
      .eq("payout_status", "completed")
      .select("id")
      .maybeSingle()

    if (claimError) {
      return NextResponse.json({ error: "Failed to lock job for payout" }, { status: 500 })
    }
    if (!claimed) {
      // Already processing/paid, or not yet approved — nothing to do.
      return NextResponse.json(
        { error: "Job is not in a payable state (already paid or not approved)" },
        { status: 409 },
      )
    }

    const amountNaira = escrow.amount_kobo / 100
    const payoutAmount = Math.round(amountNaira * (1 - PLATFORM_FEE))

    try {
      const { data: freelancer } = await service
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .maybeSingle()

      const recipientRes = await paystack.post("/transferrecipient", {
        type: "nuban",
        name: freelancer?.full_name || "Freelancer",
        account_number: bank.account_number,
        bank_code: bank.bank_code,
        currency: "NGN",
      })

      await paystack.post("/transfer", {
        source: "balance",
        amount: payoutAmount * 100, // kobo
        recipient: recipientRes.data.data.recipient_code,
        reason: `Payout for Job #${jobId}`,
        reference: `payout_${jobId}`, // idempotency on Paystack's side too
      })

      await service
        .from("jobs")
        .update({
          payout_status: "paid",
          payout_amount: payoutAmount,
          paid_at: new Date().toISOString(),
        })
        .eq("id", jobId)

      return NextResponse.json({ success: true, payout_amount: payoutAmount })
    } catch (transferError) {
      // Transfer failed — release the claim so it can be retried.
      await service.from("jobs").update({ payout_status: "completed" }).eq("id", jobId)
      console.error("Payout transfer failed:", transferError)
      return NextResponse.json({ error: "Transfer failed" }, { status: 502 })
    }
  } catch (error) {
    console.error("Payout error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
