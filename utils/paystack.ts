export async function verifyPaystackTransaction(reference: string) {
  const res = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
    headers: {
      Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
    },
  })

  const data = await res.json()

  if (data.status && data.data.status === "success") {
    return data.data
  }

  throw new Error("Invalid or failed transaction")
}
