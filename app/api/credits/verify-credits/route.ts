import { type NextRequest, NextResponse } from "next/server"
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const reference = searchParams.get("reference")
    console.log("🔍 Verifying credit purchase - Reference:", reference)

    if (!reference) {
      return NextResponse.json({ error: "Payment reference is required" }, { status: 400 })
    }

    const cookieStore = cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })

    // 1. Find the purchase record in purchase_credits table
    const { data: purchaseRecords, error: purchaseError } = await supabase
      .from("purchase_credits")
      .select("*")
      .eq("paystack_reference", reference)
      .order("created_at", { ascending: false })

    if (purchaseError || !purchaseRecords || purchaseRecords.length === 0) {
      console.error("❌ Purchase record not found:", purchaseError)
      return NextResponse.json({ error: "Purchase record not found" }, { status: 404 })
    }

    // Get the most recent purchase record
    const purchaseRecord = purchaseRecords[0]
    console.log("📋 Found purchase record:", purchaseRecord)

    // 2. If already completed, return success
    if (purchaseRecord.status === "completed") {
      console.log("✅ Credits already purchased")
      return NextResponse.json({
        success: true,
        message: "Credits already purchased successfully",
        credits: purchaseRecord.credits_amount,
      })
    }

    // 3. Verify with Paystack
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

    // 4. Verify amount matches (kobo → naira)
    const paidAmount = paystackData.data.amount / 100
    if (paidAmount !== purchaseRecord.amount) {
      console.error("❌ Amount mismatch:", { paid: paidAmount, expected: purchaseRecord.amount })
      return NextResponse.json({ error: "Payment amount mismatch" }, { status: 400 })
    }

    console.log("💳 Payment verified successfully, updating purchase status...")

    // 5. Update purchase status to completed
    const { error: updateError } = await supabase
      .from("purchase_credits")
      .update({ status: "completed" })
      .eq("paystack_reference", reference)

    if (updateError) {
      console.error("❌ Error updating purchase status:", updateError)
      return NextResponse.json({ error: "Failed to update purchase status" }, { status: 500 })
    }

    // 6. Add credits to user profile
    const { data: userProfile, error: profileError } = await supabase
      .from("profiles")
      .select("credits_balance")
      .eq("id", purchaseRecord.freelancer_id)
      .single()

    if (profileError) {
      console.error("❌ Error fetching user profile:", profileError)
      // purchase already verified, so we don’t fail request
    } else {
      const currentCredits = userProfile.credits_balance || 0
      const newCredits = currentCredits + purchaseRecord.credits_amount

      const { error: creditUpdateError } = await supabase
        .from("profiles")
        .update({ credits_balance: newCredits })
        .eq("id", purchaseRecord.freelancer_id)

      if (creditUpdateError) {
        console.error("❌ Error updating user credits:", creditUpdateError)
        // Don’t fail request, purchase already verified
      }
    }

    console.log("✅ Credits purchase verified successfully!")
    return NextResponse.json({
      success: true,
      message: "Credits purchased successfully",
      credits_added: purchaseRecord.credits_amount,
      total_credits: (userProfile?.credits_balance || 0) + purchaseRecord.credits_amount,
    })
  } catch (error: any) {
    console.error("💥 Credit purchase verification error:", error)
    return NextResponse.json(
      {
        error: "Credit purchase verification failed",
        details: error.message,
      },
      { status: 500 },
    )
  }
}
