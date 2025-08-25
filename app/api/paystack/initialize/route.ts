import { type NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY!

export async function POST(request: NextRequest) {
  try {
    const { depositId, email, amount, metadata } = await request.json()

    if (!depositId || !email || !amount) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Initialize payment with Paystack
    const response = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        amount: Math.round(amount * 100), // Convert to kobo
        currency: "NGN",
        reference: `escrow_${depositId}_${Date.now()}`,
        callback_url: `${process.env.NEXT_PUBLIC_APP_URL}/agency-deposit?payment=success`,
        metadata: {
          deposit_id: depositId,
          ...metadata,
        },
      }),
    })

    const data = await response.json()

    if (!data.status) {
      return NextResponse.json({ error: data.message || "Payment initialization failed" }, { status: 400 })
    }

    // Update deposit with Paystack reference and access code
    const { error: updateError } = await supabase
      .from("escrow_deposits")
      .update({
        paystack_reference: data.data.reference,
        paystack_access_code: data.data.access_code,
        status: "awaiting",
      })
      .eq("id", depositId)

    if (updateError) {
      console.error("Error updating deposit:", updateError)
      return NextResponse.json({ error: "Failed to update deposit" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: {
        authorization_url: data.data.authorization_url,
        access_code: data.data.access_code,
        reference: data.data.reference,
      },
    })
  } catch (error) {
    console.error("Payment initialization error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
