import { NextResponse } from "next/server"
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import { createServiceRoleClient } from "@/lib/supabase-service"

const CREDITS_RATE_KOBO = 5000 // ₦50 per credit

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { reference, amount } = await req.json()

    if (!reference || typeof amount !== "number") {
      return NextResponse.json({ error: "Missing reference or amount" }, { status: 400 })
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
    const expectedAmountKobo = Math.round(Number(amount) * 100)
    if (transaction.amount !== expectedAmountKobo) {
      return NextResponse.json({ error: "Transaction amount does not match" }, { status: 400 })
    }

    // Optional: check currency is Nigerian Naira
    if (transaction.currency !== "NGN") {
      return NextResponse.json({ error: "Invalid transaction currency" }, { status: 400 })
    }

    // Reject a reference that already belongs to an escrow/job-funding
    // payment. This Paystack merchant account also processes escrow
    // deposits and manual job-funding references, and a freelancer can
    // read their own job's reference via existing RLS -- without this
    // check, that same, already-spent payment would also mint credits here.
    const service = createServiceRoleClient()
    const [escrowMatch, fundedJobMatch, paystackDataMatch] = await Promise.all([
      service.from("escrow_deposits").select("id").eq("paystack_reference", reference).maybeSingle(),
      service.from("Funded_jobs101").select("id").eq("reference_id", reference).maybeSingle(),
      service.from("Paystack_data").select("id").eq("reference", reference).maybeSingle(),
    ])
    if (escrowMatch.error || fundedJobMatch.error || paystackDataMatch.error) {
      console.error("verify-transaction denylist check failed:", escrowMatch.error || fundedJobMatch.error || paystackDataMatch.error)
      return NextResponse.json({ error: "Failed to verify payment reference" }, { status: 500 })
    }
    if (escrowMatch.data || fundedJobMatch.data || paystackDataMatch.data) {
      return NextResponse.json({ error: "This payment reference cannot be used for credits" }, { status: 400 })
    }

    // Derive credits from the Paystack-verified kobo amount server-side --
    // never trust a client-supplied credits_amount, which could claim any
    // value regardless of what was actually paid.
    const credits_amount = Math.floor(transaction.amount / CREDITS_RATE_KOBO)

    // Insert via the service-role client -- purchase_credits' client-writable
    // INSERT/UPDATE policies are being retired (see the companion migration);
    // this route no longer depends on them, and the freelancer_id comes from
    // the authenticated session, never from the request body.
    const { data, error } = await service
      .from("purchase_credits")
      .insert([
        {
          freelancer_id: user.id,
          credits_amount,
          amount,
          paystack_reference: reference,
          status: "completed",
        },
      ])
      .select()

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json({ error: "This reference has already been used" }, { status: 400 })
      }
      console.error("Supabase insert error:", error)
      return NextResponse.json({ error: "Failed to save purchase record", details: error.message }, { status: 500 })
    }

    const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single()

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
