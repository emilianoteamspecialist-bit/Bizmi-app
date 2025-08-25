import { NextResponse } from "next/server"

export async function POST(req: Request) {
  const body = await req.json()
  const { account_number, bank_code, amount, freelancer_name } = body

  if (!account_number || !bank_code || !amount || !freelancer_name) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
  }

  const FLAT_FEE_PERCENTAGE = 0.15
  const payoutAmount = Math.floor(amount * (1 - FLAT_FEE_PERCENTAGE)) // Paystack accepts amount in kobo

  const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY

  try {
    // 1. Create a transfer recipient
    const recipientRes = await fetch("https://api.paystack.co/transferrecipient", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "nuban",
        name: freelancer_name,
        account_number,
        bank_code,
        currency: "NGN",
      }),
    })

    const recipientData = await recipientRes.json()

    if (!recipientData.status) {
      return NextResponse.json({ error: recipientData.message }, { status: 400 })
    }

    const recipientCode = recipientData.data.recipient_code

    // 2. Initiate transfer
    const transferRes = await fetch("https://api.paystack.co/transfer", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        source: "balance",
        amount: payoutAmount,
        recipient: recipientCode,
        reason: `Payout to freelancer: ${freelancer_name}`,
      }),
    })

    const transferData = await transferRes.json()

    if (!transferData.status) {
      return NextResponse.json({ error: transferData.message }, { status: 400 })
    }

    return NextResponse.json({ success: true, data: transferData.data })
  } catch (error) {
    return NextResponse.json({ error: "Something went wrong", detail: error }, { status: 500 })
  }
}
