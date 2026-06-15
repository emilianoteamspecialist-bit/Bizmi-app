import { type NextRequest, NextResponse } from "next/server"
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const reference = searchParams.get("reference")
    const amount = searchParams.get("amount") // Get amount from query params
    console.log("🔍 Verifying credit purchase - Reference:", reference, "Amount:", amount)

    if (!reference) {
      return NextResponse.json({ error: "Payment reference is required" }, { status: 400 })
    }

    if (!amount || Number.parseFloat(amount) <= 0) {
      return NextResponse.json({ error: "Valid amount is required" }, { status: 400 })
    }

    const cookieStore = await cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()
    if (userError || !user) {
      console.log("❌ User authentication failed:", userError)
      return NextResponse.json({ error: "User not authenticated" }, { status: 401 })
    }

    console.log("✅ User authenticated:", user.id)

    const amountNum = Number.parseFloat(amount)
    const creditsToAdd = Math.floor(amountNum / 50) // Calculate credits (1 credit = N50)

    const { data: existingPurchase } = await supabase
      .from("purchase_credits")
      .select("*")
      .eq("paystack_reference", reference)
      .single()

    if (existingPurchase && existingPurchase.status === "completed") {
      console.log("✅ Credits already purchased")
      return NextResponse.json({
        success: true,
        message: "Credits already purchased successfully",
        credits_added: existingPurchase.credits_amount,
      })
    }

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

    if (!paystackResponse.ok) {
      console.error("❌ Paystack API error:", paystackResponse.status)
      return NextResponse.json({ error: "Payment verification service unavailable" }, { status: 503 })
    }

    const paystackData = await paystackResponse.json()
    console.log("📥 Paystack verification response:", paystackData)

    if (!paystackData.status || paystackData.data.status !== "success") {
      console.error("❌ Payment verification failed:", paystackData)
      return NextResponse.json({ error: "Payment verification failed" }, { status: 400 })
    }

    const paidAmount = paystackData.data.amount / 100
    if (Math.abs(paidAmount - amountNum) > 0.01) {
      console.error("❌ Amount mismatch:", { paid: paidAmount, expected: amountNum })
      return NextResponse.json({ error: "Payment amount mismatch" }, { status: 400 })
    }

    console.log("💳 Payment verified successfully, recording purchase...")

    const { data: purchaseRecord, error: purchaseError } = await supabase.from("purchase_credits").insert({
      freelancer_id: user.id,
      credits_amount: creditsToAdd,
      amount: amountNum,
      paystack_reference: reference,
      status: "completed",
    })

    if (purchaseError) {
      console.error("❌ Error creating purchase record:", purchaseError)
      return NextResponse.json({ error: "Failed to create purchase record" }, { status: 500 })
    }

    // purchase_credits is the single source of truth — the insert above already
    // credits the user. Derive the balance from the ledger for the response.
    const { data: ledgerRows } = await supabase
      .from("purchase_credits")
      .select("credits_amount")
      .eq("freelancer_id", user.id)
      .eq("status", "completed")
    const newCredits = (ledgerRows ?? []).reduce(
      (sum: number, row: any) => sum + (row.credits_amount || 0),
      0,
    )

    console.log("✅ Credits purchase verified successfully!")
    return NextResponse.json({
      success: true,
      message: "Credits purchased successfully",
      credits_added: creditsToAdd,
      total_credits: newCredits,
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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { reference, amount } = body
    console.log("🔍 Verifying credit purchase via POST - Reference:", reference, "Amount:", amount)

    if (!reference) {
      return NextResponse.json({ error: "Payment reference is required" }, { status: 400 })
    }

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: "Valid amount is required" }, { status: 400 })
    }

    const cookieStore = await cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })

    // Get current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: "User not authenticated" }, { status: 401 })
    }

    // Calculate credits (10 credits = N500, so 1 credit = N50)
    const creditsToAdd = Math.floor(amount / 50)

    // Verify with Paystack
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

    if (!paystackResponse.ok) {
      console.error("❌ Paystack API error:", paystackResponse.status)
      return NextResponse.json({ error: "Payment verification service unavailable" }, { status: 503 })
    }

    const paystackData = await paystackResponse.json()
    console.log("📥 Paystack verification response:", paystackData)

    if (!paystackData.status || paystackData.data.status !== "success") {
      console.error("❌ Payment verification failed:", paystackData)
      return NextResponse.json({ error: "Payment verification failed" }, { status: 400 })
    }

    const paidAmount = paystackData.data.amount / 100
    if (Math.abs(paidAmount - amount) > 0.01) {
      // Allow small floating point differences
      console.error("❌ Amount mismatch:", { paid: paidAmount, expected: amount })
      return NextResponse.json({ error: "Payment amount mismatch" }, { status: 400 })
    }

    const { data: existingPurchase } = await supabase
      .from("purchase_credits")
      .select("*")
      .eq("paystack_reference", reference)
      .single()

    if (existingPurchase) {
      return NextResponse.json({ error: "This payment reference has already been used" }, { status: 400 })
    }

    // Record the purchase
    const { error: recordError } = await supabase.from("purchase_credits").insert({
      freelancer_id: user.id,
      amount: amount,
      credits_amount: creditsToAdd,
      paystack_reference: reference,
      status: "completed",
    })

    if (recordError) {
      console.error("❌ Error recording purchase:", recordError)
      return NextResponse.json({ error: "Failed to record purchase" }, { status: 500 })
    }

    // purchase_credits is the single source of truth — the insert above already
    // credits the user. Derive the balance from the ledger for the response.
    const { data: ledgerRows } = await supabase
      .from("purchase_credits")
      .select("credits_amount")
      .eq("freelancer_id", user.id)
      .eq("status", "completed")
    const newCredits = (ledgerRows ?? []).reduce(
      (sum: number, row: any) => sum + (row.credits_amount || 0),
      0,
    )

    console.log("✅ Credits purchase verified successfully!")
    return NextResponse.json({
      success: true,
      message: "Credits purchased successfully",
      credits_added: creditsToAdd,
      total_credits: newCredits,
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
