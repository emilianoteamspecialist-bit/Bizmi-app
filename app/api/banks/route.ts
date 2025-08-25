import { NextResponse } from "next/server"

export async function GET() {
  const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY

  try {
    const res = await fetch("https://api.paystack.co/bank?currency=NGN", {
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
      },
    })

    const data = await res.json()
    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch banks" }, { status: 500 })
  }
}
