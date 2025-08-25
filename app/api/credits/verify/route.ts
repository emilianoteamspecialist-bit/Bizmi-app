import { type NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const reference = searchParams.get("reference")

    if (!reference) {
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/agency/wallet?failed=1`)
    }

    const payRes = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
      },
    })

    const payData = await payRes.json()

    if (payData.status && payData.data.status === "success") {
      const { metadata, amount, customer } = payData.data
      const user_id = metadata?.user_id

      // Insert payment record
      await supabase.from("wallet_fundings").insert({
        user_id,
        amount: amount / 100,
        flutterwave_ref: reference,
        status: "successful",
      })

      // Update wallet balance
      await supabase.rpc("increment_user_wallet", {
        uid: user_id,
        amt: amount / 100,
      })

      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/agency/wallet?success=1`)
    } else {
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/agency/wallet?failed=1`)
    }
  } catch (error) {
    console.error("Verification error:", error)
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/agency/wallet?failed=1`)
  }
}

export async function POST(req: NextRequest) {
  try {
    const { reference, jobTitle, agencyName, depositId, jobId } = await req.json()

    if (!reference) {
      return NextResponse.json({ success: false, message: "Reference is required" }, { status: 400 })
    }

    console.log("🔍 Verifying payment with reference:", reference)

    // Verify payment with Paystack
    const verifyResponse = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
    })

    const verifyData = await verifyResponse.json()
    console.log("📥 Paystack verification response:", verifyData)

    if (verifyData.status && verifyData.data.status === "success") {
      const amount = verifyData.data.amount / 100 // Convert from kobo to naira

      console.log("✅ Payment verified successfully")
      console.log("💰 Amount:", amount)
      console.log("📝 Deposit ID:", depositId)

      // Update escrow deposit status
      const { error: updateError } = await supabase
        .from("escrow_deposits")
        .update({
          status: "funded",
          paystack_reference: reference,
          updated_at: new Date().toISOString(),
        })
        .eq("id", depositId)

      if (updateError) {
        console.error("❌ Error updating deposit:", updateError)
        return NextResponse.json({ success: false, message: "Failed to update deposit record" }, { status: 500 })
      }

      console.log("✅ Deposit record updated successfully")

      // Update job funding status
      const { error: jobUpdateError } = await supabase.from("job_funding_status").upsert({
        job_id: jobId,
        funding_status: "funded",
        job_status: "open",
        updated_at: new Date().toISOString(),
      })

      if (jobUpdateError) {
        console.error("❌ Error updating job funding status:", jobUpdateError)
        return NextResponse.json({ success: false, message: "Failed to update job status" }, { status: 500 })
      }

      console.log("✅ Job funding status updated successfully")

      return NextResponse.json({
        success: true,
        message: "Payment verified and records updated successfully",
        data: {
          amount,
          reference,
          status: "funded",
        },
      })
    } else {
      console.log("❌ Payment verification failed:", verifyData)
      return NextResponse.json({ success: false, message: "Payment verification failed" }, { status: 400 })
    }
  } catch (error) {
    console.error("💥 Error verifying payment:", error)
    return NextResponse.json({ success: false, message: "Server error during verification" }, { status: 500 })
  }
}
