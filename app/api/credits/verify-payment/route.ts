import { type NextRequest, NextResponse } from "next/server"
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const reference = searchParams.get("reference")
    console.log("🔍 Verifying credits payment - Reference:", reference)

    if (!reference) {
      return NextResponse.json({ error: "Payment reference is required" }, { status: 400 })
    }

    const cookieStore = await cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })

    // Find the purchase record first
    // This record contains the freelancer_id, which we will use to update credits.
    const { data: purchaseRecord, error: purchaseError } = await supabase
      .from("purchase_credits")
      .select("*")
      .eq("paystack_reference", reference)
      .single()

    if (purchaseError || !purchaseRecord) {
      console.error("❌ Purchase record not found:", purchaseError)
      return NextResponse.json({ error: "Purchase record not found" }, { status: 404 })
    }

    // If already processed, return success
    if (purchaseRecord.status === "completed") {
      console.log("✅ Payment already processed")
      return NextResponse.json({
        success: true,
        message: "Credits purchase completed successfully",
        credits_added: purchaseRecord.credits_amount,
        amount_paid: purchaseRecord.amount,
      })
    }

    // Verify payment with Paystack
    const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY
    if (!PAYSTACK_SECRET_KEY) {
      console.error("PAYSTACK_SECRET_KEY is not set")
      return NextResponse.json({ error: "Payment service not configured" }, { status: 500 })
    }

    console.log("📡 Verifying with Paystack...")
    const paystackResponse = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
      },
    })
    const paystackData = await paystackResponse.json()
    console.log("📥 Paystack verification response:", paystackData)

    if (!paystackData.status || paystackData.data.status !== "success") {
      console.error("❌ Payment verification failed:", paystackData)
      return NextResponse.json({ error: "Payment verification failed" }, { status: 400 })
    }

    // Verify amount matches
    const paidAmount = paystackData.data.amount / 100 // Convert from kobo
    if (paidAmount !== purchaseRecord.amount) {
      console.error("❌ Amount mismatch:", { paid: paidAmount, expected: purchaseRecord.amount })
      return NextResponse.json({ error: "Payment amount mismatch" }, { status: 400 })
    }

    console.log("💳 Payment verified successfully, adding credits to user...")

    const freelancerId = purchaseRecord.freelancer_id

    // Mark the purchase complete. purchase_credits is the single source of
    // truth for a freelancer's balance (summed in getUserCredits), so completing
    // this row IS the credit — there is no separate profile column to keep in sync.
    const { error: statusError } = await supabase
      .from("purchase_credits")
      .update({ status: "completed" })
      .eq("id", purchaseRecord.id)
    if (statusError) {
      console.error("❌ Error updating purchase status:", statusError)
      return NextResponse.json({ error: "Failed to complete credits purchase" }, { status: 500 })
    }

    // Authoritative balance, derived from the ledger.
    const { data: ledgerRows } = await supabase
      .from("purchase_credits")
      .select("credits_amount")
      .eq("freelancer_id", freelancerId)
      .eq("status", "completed")
    const newBalance = (ledgerRows ?? []).reduce(
      (sum: number, row: any) => sum + (row.credits_amount || 0),
      0,
    )

    console.log("✅ Credits added successfully!")
    return NextResponse.json({
      success: true,
      message: "Credits purchase completed successfully",
      credits_added: purchaseRecord.credits_amount,
      amount_paid: purchaseRecord.amount,
      new_balance: newBalance,
    })
  } catch (error: any) {
    console.error("💥 Credits verification error:", error)
    return NextResponse.json(
      {
        error: "Payment verification failed",
        details: error.message,
      },
      { status: 500 },
    )
  }
}
