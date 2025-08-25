import { type NextRequest, NextResponse } from "next/server"
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const reference = searchParams.get("reference")
    console.log("🔍 Verifying wallet funding payment - Reference:", reference)

    if (!reference) {
      return NextResponse.json({ error: "Payment reference is required" }, { status: 400 })
    }

    const cookieStore = cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })

    // Find the funding record in Funded_jobs101 table - use first() instead of single()
    const { data: fundingRecords, error: fundingError } = await supabase
      .from("Funded_jobs101")
      .select("*")
      .eq("reference_id", reference)
      .order("created_at", { ascending: false })

    if (fundingError || !fundingRecords || fundingRecords.length === 0) {
      console.error("❌ Funding record not found:", fundingError)
      return NextResponse.json({ error: "Funding record not found" }, { status: 404 })
    }

    // Get the most recent funding record
    const fundingRecord = fundingRecords[0]
    console.log("📋 Found funding record:", fundingRecord)

    // If already verified, return success
    if (fundingRecord.status === "verified") {
      console.log("✅ Payment already verified")
      return NextResponse.json({
        success: true,
        message: "Payment already verified successfully",
        amount: fundingRecord.amount,
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

    // Verify amount matches (convert from kobo to naira)
    const paidAmount = paystackData.data.amount / 100
    if (paidAmount !== fundingRecord.amount) {
      console.error("❌ Amount mismatch:", { paid: paidAmount, expected: fundingRecord.amount })
      return NextResponse.json({ error: "Payment amount mismatch" }, { status: 400 })
    }

    console.log("💳 Payment verified successfully, updating funding status...")

    // Update all funding records with this reference to verified
    const { error: updateError } = await supabase
      .from("Funded_jobs101")
      .update({ status: "verified" })
      .eq("reference_id", reference)

    if (updateError) {
      console.error("❌ Error updating funding status:", updateError)
      return NextResponse.json({ error: "Failed to update funding status" }, { status: 500 })
    }

    // Also update agency wallet balance
    const { data: agencyProfile, error: profileError } = await supabase
      .from("profiles")
      .select("wallet_balance")
      .eq("id", fundingRecord.agency_id)
      .single()

    if (profileError) {
      console.error("❌ Error fetching agency profile:", profileError)
      // Don't fail the request, funding was already verified
    } else {
      const currentBalance = agencyProfile.wallet_balance || 0
      const newBalance = currentBalance - fundingRecord.amount

      const { error: balanceUpdateError } = await supabase
        .from("profiles")
        .update({ wallet_balance: newBalance })
        .eq("id", fundingRecord.agency_id)

      if (balanceUpdateError) {
        console.error("❌ Error updating agency wallet balance:", balanceUpdateError)
        // Don't fail the request, funding was already verified
      }
    }

    console.log("✅ Funding verified successfully!")
    return NextResponse.json({
      success: true,
      message: "Payment verified successfully",
      amount: fundingRecord.amount,
      job_title: fundingRecord.job_title,
      agency_name: fundingRecord.agency_name,
    })
  } catch (error: any) {
    console.error("💥 Payment verification error:", error)
    return NextResponse.json(
      {
        error: "Payment verification failed",
        details: error.message,
      },
      { status: 500 },
    )
  }
}
