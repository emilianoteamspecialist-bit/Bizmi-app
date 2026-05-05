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

    // Use freelancer_id from the purchaseRecord to update credits
    const freelancerId = purchaseRecord.freelancer_id;

    // Add credits to user profile
    const { data: currentProfile, error: profileError } = await supabase
      .from("profiles")
      .select("credits")
      .eq("id", freelancerId) // Use freelancerId from purchase record
      .single()

    if (profileError) {
      console.error("❌ Error fetching user profile:", profileError)
      return NextResponse.json({ error: "Failed to fetch user profile" }, { status: 500 })
    }

    const currentCredits = currentProfile.credits || 0
    const newCredits = currentCredits + purchaseRecord.credits_amount
    console.log("📊 Credits calculation:", {
      current: currentCredits,
      adding: purchaseRecord.credits_amount,
      new_total: newCredits,
    })

    // Update user credits
    const { error: updateError } = await supabase.from("profiles").update({ credits: newCredits }).eq("id", freelancerId) // Use freelancerId
    if (updateError) {
      console.error("❌ Error updating user credits:", updateError)
      return NextResponse.json({ error: "Failed to add credits to account" }, { status: 500 })
    }

    // Update purchase record status
    const { error: statusError } = await supabase
      .from("purchase_credits")
      .update({ status: "completed" })
      .eq("id", purchaseRecord.id)
    if (statusError) {
      console.error("❌ Error updating purchase status:", statusError)
      // Don't fail the request, credits were already added
    }

    console.log("✅ Credits added successfully!")
    return NextResponse.json({
      success: true,
      message: "Credits purchase completed successfully",
      credits_added: purchaseRecord.credits_amount,
      amount_paid: purchaseRecord.amount,
      new_balance: newCredits,
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
