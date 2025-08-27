import { type NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY!

export async function POST(request: NextRequest) {
  try {
    const { userId, name, account_number, bank_code } = await request.json()

    if (!userId || !name || !account_number || !bank_code) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Create recipient with Paystack
    const response = await fetch("https://api.paystack.co/transferrecipient", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "nuban",
        name,
        account_number,
        bank_code,
        currency: "NGN",
      }),
    })

    const data = await response.json()

    if (data.status) {
      const recipientCode = data.data.recipient_code

      // Deactivate existing recipients for this user
      await supabase.from("payment_recipients").update({ is_active: false }).eq("user_id", userId)

      // Store recipient in database
      const { data: dbData, error: dbError } = await supabase
        .from("payment_recipients")
        .insert({
          user_id: userId,
          recipient_code: recipientCode,
          account_name: name,
          account_number,
          bank_code,
          bank_name: data.data.details?.bank_name || "",
          is_active: true,
        })
        .select()
        .single()

      if (dbError) {
        console.error("Database error:", dbError)
        return NextResponse.json({ error: "Failed to save recipient" }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        recipient_code: recipientCode,
        recipient_id: dbData.id,
      })
    } else {
      console.error("Paystack recipient creation error:", data)
      return NextResponse.json({ error: data.message || "Failed to create recipient" }, { status: 400 })
    }
  } catch (error) {
    console.error("Recipient creation error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
