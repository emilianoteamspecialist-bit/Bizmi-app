import { type NextRequest, NextResponse } from "next/server"
import { paystack } from "@/lib/paystack"
import { supabase } from "@/lib/supabase"

export async function POST(req: NextRequest) {
  try {
    const { amount, account_number, bank_code, jobId, freelancerId } = await req.json()

    const platformFee = 0.15 // 15% platform fee
    const payoutAmount = Math.round(amount * (1 - platformFee))

    // Get freelancer details
    const { data: freelancer } = await supabase.from("profiles").select("full_name").eq("id", freelancerId).single()

    // Step 1: Create a transfer recipient
    const recipientRes = await paystack.post("/transferrecipient", {
      type: "nuban",
      name: freelancer?.full_name || "Freelancer",
      account_number,
      bank_code,
      currency: "NGN",
    })

    // Step 2: Transfer to freelancer
    await paystack.post("/transfer", {
      source: "balance",
      amount: payoutAmount * 100, // Convert to kobo
      recipient: recipientRes.data.data.recipient_code,
      reason: `Payout for Job #${jobId}`,
    })

    // Update job status to paid out
    await supabase
      .from("jobs")
      .update({
        payout_status: "paid",
        payout_amount: payoutAmount,
        paid_at: new Date().toISOString(),
      })
      .eq("id", jobId)

    return NextResponse.json({ success: true, payout_amount: payoutAmount })
  } catch (error) {
    console.error("Payout error:", error)
    return NextResponse.json({ error: "Transfer failed" }, { status: 500 })
  }
}
