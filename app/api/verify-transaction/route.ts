import { NextResponse } from "next/server"
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })

    const { user_id, reference, credits_amount, amount } = await req.json()

    if (!user_id || !reference || !credits_amount || !amount) {
      return NextResponse.json({ error: "Missing user_id, reference, credits_amount, or amount" }, { status: 400 })
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user_id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json({ error: "Profile not found", details: profileError?.message }, { status: 404 })
    }

    // Verify transaction with Paystack
    const verifyRes = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
      },
    })

    const verifyData = await verifyRes.json()

    if (!verifyRes.ok || verifyData.status === false) {
      return NextResponse.json({ error: "Transaction verification failed", details: verifyData }, { status: 400 })
    }

    const transaction = verifyData.data

    if (transaction.status !== "success") {
      return NextResponse.json({ error: "Transaction not successful" }, { status: 400 })
    }

    // Check that the amount matches (Paystack amounts are in kobo: ₦ 1 = 100 kobo)
    const expectedAmountKobo = Number(amount) * 100
    if (transaction.amount !== expectedAmountKobo) {
      return NextResponse.json({ error: "Transaction amount does not match" }, { status: 400 })
    }

    // Optional: check currency is Nigerian Naira
    if (transaction.currency !== "NGN") {
      return NextResponse.json({ error: "Invalid transaction currency" }, { status: 400 })
    }

    // Insert purchase record
    const { data, error } = await supabase
      .from("purchase_credits")
      .insert([
        {
          freelancer_id: user_id,
          credits_amount,
          amount,
          paystack_reference: reference,
          status: "completed",
        },
      ])
      .select()

    if (error) {
      console.error("Supabase insert error:", error)
      return NextResponse.json({ error: "Failed to save purchase record", details: error.message }, { status: 500 })
    }

    return NextResponse.json({
      message: "Transaction verified and credits added successfully",
      purchase: data,
      success: true,
      credits_added: credits_amount,
      profile,
    })
  } catch (err: any) {
    console.error("API error:", err)
    return NextResponse.json({ error: "Internal server error", details: err.message }, { status: 500 })
  }
}
