import { createClient } from "@supabase/supabase-js"
import { verifyPaystackTransaction } from "@/utils/paystack"
import { type NextRequest, NextResponse } from "next/server"

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { reference, user_id } = body

    if (!reference || !user_id) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const trx = await verifyPaystackTransaction(reference)
    const amount = trx.amount / 100 // Convert from kobo to naira

    // Update funding record
    await supabase.from("wallet_fundings").update({ status: "successful" }).eq("flutterwave_ref", reference)

    // Get or create wallet
    const { data: wallet } = await supabase.from("user_wallets").select("*").eq("user_id", user_id).single()

    if (!wallet) {
      await supabase.from("user_wallets").insert({ user_id, balance: amount })
    } else {
      await supabase.rpc("increment_user_wallet", { uid: user_id, amt: amount })
    }

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    console.error("Wallet callback error:", error)
    return NextResponse.json({ error: (error as Error).message }, { status: 400 })
  }
}
