import { type NextRequest, NextResponse } from "next/server"

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY!

export async function POST(request: NextRequest) {
  try {
    const { accountNumber, bankCode } = await request.json()

    if (!accountNumber || !bankCode) {
      return NextResponse.json({ error: "Missing account number or bank code" }, { status: 400 })
    }

    const response = await fetch(
      `https://api.paystack.co/bank/resolve?account_number=${accountNumber}&bank_code=${bankCode}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
      },
    )

    const data = await response.json()

    if (data.status) {
      return NextResponse.json({
        success: true,
        account_name: data.data.account_name,
        account_number: data.data.account_number,
      })
    } else {
      return NextResponse.json({ error: data.message || "Account verification failed" }, { status: 400 })
    }
  } catch (error) {
    console.error("Account verification error:", error)
    return NextResponse.json({ error: "Account verification failed" }, { status: 500 })
  }
}
