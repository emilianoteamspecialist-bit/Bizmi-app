import { type NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

export async function POST(request: NextRequest) {
  try {
    const { tx_ref } = await request.json()

    if (!tx_ref) {
      return NextResponse.json({ success: false, error: "Transaction reference is required" }, { status: 400 })
    }

    // Verify payment with Flutterwave
    const verifyResponse = await fetch(
      `https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${tx_ref}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
      },
    )

    const verificationData = await verifyResponse.json()

    if (verificationData.status === "success" && verificationData.data.status === "successful") {
      const { amount, customer, tx_ref: reference } = verificationData.data

      // Find user by email
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", customer.email)
        .single()

      if (profileError || !profile) {
        console.error("User not found:", profileError)
        return NextResponse.json({ success: false, error: "User not found" }, { status: 404 })
      }

      // Update wallet balance
      const { error: walletError } = await supabase.rpc("increment_user_wallet", {
        uid: profile.id,
        amt: amount,
      })

      if (walletError) {
        console.error("Error updating wallet:", walletError)
        return NextResponse.json({ success: false, error: "Failed to update wallet" }, { status: 500 })
      }

      // Update funding record
      const { error: fundingError } = await supabase
        .from("wallet_fundings")
        .update({ status: "successful" })
        .eq("flutterwave_ref", reference)

      if (fundingError) {
        console.error("Error updating funding record:", fundingError)
      }

      return NextResponse.json({ success: true })
    } else {
      // Update funding record as failed
      await supabase.from("wallet_fundings").update({ status: "failed" }).eq("flutterwave_ref", tx_ref)

      return NextResponse.json({ success: false, error: "Payment verification failed" }, { status: 400 })
    }
  } catch (error) {
    console.error("Payment verification error:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
