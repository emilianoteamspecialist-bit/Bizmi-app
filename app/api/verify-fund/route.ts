import { type NextRequest, NextResponse } from "next/server"
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"

export async function POST(request: NextRequest) {
  try {
    const { name, jobTitle, amount, reference } = await request.json()

    // Validate required fields
    if (!name || !jobTitle || !amount || !reference) {
      return NextResponse.json({ error: "All fields are required" }, { status: 400 })
    }

    // Verify payment with Paystack API
    const verifyResponse = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
      },
    })

    if (!verifyResponse.ok) {
      return NextResponse.json({ verified: false, message: "Failed to verify payment with Paystack" }, { status: 400 })
    }

    const verifyData = await verifyResponse.json()
    const transactionData = verifyData.data

    // Check if payment was successful and amount matches
    if (transactionData.status === "success" && transactionData.amount / 100 === Number(amount)) {
      // Initialize Supabase client
      const supabase = createRouteHandlerClient({ cookies })

      // Insert verified payment into Paystack_data table
      const { error: insertError } = await supabase.from("Paystack_data").insert([
        {
          agency_name: name,
          job_title: jobTitle,
          amount: Number(amount),
          reference: reference,
          verified: true,
        },
      ])

      if (insertError) {
        console.error("DB insert error:", insertError)
        return NextResponse.json(
          { verified: false, message: "Error saving verified payment to database" },
          { status: 500 },
        )
      }

      // Update job status to verified in Funded_jobs101 table
      const { error: updateError } = await supabase
        .from("Funded_jobs101")
        .update({ status: "verified" })
        .eq("reference_id", reference)

      if (updateError) {
        console.error("Job status update error:", updateError)
        return NextResponse.json({ verified: false, message: "Error updating job status" }, { status: 500 })
      }

      return NextResponse.json({
        verified: true,
        message: "Payment verified and job status updated successfully",
        data: transactionData,
      })
    } else {
      return NextResponse.json({
        verified: false,
        message: "Payment not verified or amount mismatch",
      })
    }
  } catch (error: any) {
    console.error("Verification error:", error)
    return NextResponse.json({ verified: false, message: "Error verifying payment" }, { status: 500 })
  }
}
