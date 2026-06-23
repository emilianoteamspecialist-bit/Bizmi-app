import { type NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"
import crypto from "crypto"

export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    const signature = request.headers.get("x-paystack-signature")

    console.log("🔔 Webhook received")

    const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY

    if (!PAYSTACK_SECRET_KEY) {
      console.error("❌ PAYSTACK_SECRET_KEY not found")
      return NextResponse.json({ error: "Webhook not configured" }, { status: 500 })
    }

    // Mandatory signature verification. No escape hatch — this endpoint credits
    // real money, so an unsigned or mis-signed request is always rejected.
    if (!signature) {
      console.error("❌ Missing webhook signature")
      return NextResponse.json({ error: "Missing signature" }, { status: 400 })
    }

    const hash = crypto.createHmac("sha512", PAYSTACK_SECRET_KEY).update(body).digest("hex")

    if (hash !== signature) {
      console.error("❌ Invalid webhook signature")
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
    }

    const event = JSON.parse(body)

    console.log("📨 Webhook event:", {
      event: event.event,
      reference: event.data?.reference,
      status: event.data?.status,
    })

    // Handle successful charge
    if (event.event === "charge.success" && event.data.status === "success") {
      const reference = event.data.reference
      const amount = event.data.amount / 100 // Convert from kobo to naira
      const metadata = event.data.metadata

      console.log("💰 Processing successful charge:", { reference, amount, metadata })

      // Get deposit ID from metadata or reference
      let depositId = metadata?.deposit_id
      if (!depositId && reference.includes("dep_")) {
        depositId = reference.split("_")[1]
      }

      if (depositId) {
        // Update deposit status
        const { data: updateData, error: updateError } = await supabase
          .from("escrow_deposits")
          .update({
            status: "confirmed",
            paystack_reference: reference,
            balance: amount,
            updated_at: new Date().toISOString(),
          })
          .eq("id", depositId)
          .select()
          .single()

        if (updateError) {
          console.error("❌ Error updating deposit via webhook:", updateError)
        } else {
          console.log("✅ Deposit updated via webhook:", updateData)
        }
      }
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error("💥 Webhook processing error:", error)
    return NextResponse.json(
      {
        error: "Webhook processing failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
