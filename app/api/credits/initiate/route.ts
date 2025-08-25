import { type NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  try {
    const { email, amount, user_id } = await req.json()

    const response = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        amount: amount * 100, // kobo
        callback_url: `${process.env.NEXT_PUBLIC_APP_URL}/credits/verify`,
        metadata: {
          user_id: user_id,
        },
      }),
    })

    const data = await response.json()

    if (data.status) {
      return NextResponse.json({ url: data.data.authorization_url, reference: data.data.reference })
    } else {
      return NextResponse.json({ error: data.message }, { status: 400 })
    }
  } catch (err) {
    console.error("Payment initialization error:", err)
    return NextResponse.json({ error: "Failed to initialize payment" }, { status: 500 })
  }
}
