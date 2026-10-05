import crypto from "node:crypto"

const PAYSTACK_BASE_URL = "https://api.paystack.co"

export class PaystackError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

function secretKey(): string {
  const key = process.env.PAYSTACK_SECRET_KEY
  if (!key) throw new Error("Missing required env var: PAYSTACK_SECRET_KEY")
  return key
}

// Thin wrapper over the Paystack REST API. Throws PaystackError when the HTTP
// call fails or Paystack reports `status: false`, so callers never mistake a
// rejected request for success.
export async function paystackRequest<T = any>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${PAYSTACK_BASE_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${secretKey()}`,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })

  let json: any = null
  try {
    json = await res.json()
  } catch {
    // Non-JSON body: fall through to the error below.
  }

  if (!res.ok || !json?.status) {
    throw new PaystackError(json?.message || `Paystack ${method} ${path} failed with ${res.status}`, res.status)
  }
  return json.data as T
}

// Paystack signs the raw request body with HMAC-SHA512 using the secret key.
// Must be computed over the exact bytes received -- never a re-serialized
// JSON object -- and compared in constant time.
export function verifyPaystackSignature(rawBody: Buffer | string, signature: string | undefined): boolean {
  if (!signature) return false
  const expected = crypto.createHmac("sha512", secretKey()).update(rawBody).digest("hex")
  const a = Buffer.from(expected, "utf8")
  const b = Buffer.from(signature, "utf8")
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}
