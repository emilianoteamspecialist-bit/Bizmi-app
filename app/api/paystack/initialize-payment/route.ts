import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { amount, credits_amount } = body

    console.log("🚀 Initializing credits payment:", { amount, credits_amount })

    if (!amount || !credits_amount) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Validate minimum credits (10 credits = ₦500)
    if (credits_amount < 10) {
      return NextResponse.json({ error: "Minimum purchase is 10 credits" }, { status: 400 })
    }

    // Validate amount calculation (₦50 per credit)
    const expectedAmount = credits_amount * 50
    if (amount !== expectedAmount) {
      return NextResponse.json({ error: "Invalid amount calculation" }, { status: 400 })
    }

    // Get current user using the regular supabase client
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      console.error("❌ User authentication failed:", userError)
      return NextResponse.json({ error: "Authentication required" }, { status: 401 })
    }

    // Get user profile for email
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("email, full_name")
      .eq("id", user.id)
      .single()

    if (profileError || !profile) {
      console.error("❌ Profile not found:", profileError)
      return NextResponse.json({ error: "User profile not found" }, { status: 404 })
    }

    const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY

    if (!PAYSTACK_SECRET_KEY) {
      console.error("PAYSTACK_SECRET_KEY is not set")
      return NextResponse.json({ error: "Payment service not configured" }, { status: 500 })
    }

    // Generate unique reference
    const reference = `credits_${user.id}_${Date.now()}`
    console.log("📝 Generated reference:", reference)

    // Create purchase record first
    const { data: purchaseData, error: purchaseError } = await supabase
      .from("purchase_credits")
      .insert({
        freelancer_id: user.id,
        amount: amount,
        credits_amount: credits_amount,
        paystack_reference: reference,
        status: "pending",
      })
      .select()
      .single()

    if (purchaseError) {
      console.error("❌ Error creating purchase record:", purchaseError)
      return NextResponse.json({ error: "Failed to create purchase record" }, { status: 500 })
    }

    console.log("✅ Purchase record created:", purchaseData)

    // Initialize payment with Paystack
    const paystackPayload = {
      email: profile.email,
      amount: amount * 100, // Convert to kobo
      reference: reference,
      callback_url: `${process.env.NEXT_PUBLIC_APP_URL}/credits/verify?reference=${reference}`,
      metadata: {
        purchase_id: purchaseData.id,
        credits_amount: credits_amount,
        user_id: user.id,
        freelancer_name: profile.full_name || "Freelancer",
      },
    }

    console.log("📡 Calling Paystack initialize API...")

    const paystackResponse = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(paystackPayload),
    })

    const paystackResult = await paystackResponse.json()
    console.log("📥 Paystack response:", paystackResult)

    if (!paystackResult.status) {
      console.error("❌ Paystack initialization failed:", paystackResult)
      return NextResponse.json(
        {
          error: paystackResult.message || "Payment initialization failed",
          details: paystackResult,
        },
        { status: 400 },
      )
    }

    console.log("✅ Payment initialized successfully")

    return NextResponse.json({
      success: true,
      authorization_url: paystackResult.data.authorization_url,
      access_code: paystackResult.data.access_code,
      reference: paystackResult.data.reference,
    })
  } catch (error: any) {
    console.error("💥 Credits payment initialization error:", error)
    return NextResponse.json(
      {
        error: "Payment initialization failed",
        details: error.message,
      },
      { status: 500 },
    )
  }
}
