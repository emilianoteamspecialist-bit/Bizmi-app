import crypto from "node:crypto"
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { verifyPaystackSignature, paystackRequest, PaystackError } from "./paystack.js"

const SECRET = "sk_test_secret"
const sign = (body: string) => crypto.createHmac("sha512", SECRET).update(body).digest("hex")

beforeEach(() => {
  process.env.PAYSTACK_SECRET_KEY = SECRET
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("verifyPaystackSignature", () => {
  const body = JSON.stringify({ event: "charge.success", data: { id: 1 } })

  it("accepts the HMAC-SHA512 of the exact raw body", () => {
    expect(verifyPaystackSignature(Buffer.from(body), sign(body))).toBe(true)
  })

  it("rejects a missing signature", () => {
    expect(verifyPaystackSignature(body, undefined)).toBe(false)
  })

  it("rejects a signature over different bytes (e.g. re-serialized JSON)", () => {
    expect(verifyPaystackSignature(body, sign(body + " "))).toBe(false)
  })

  it("rejects a malformed signature of the wrong length without throwing", () => {
    expect(verifyPaystackSignature(body, "abc")).toBe(false)
  })
})

describe("paystackRequest", () => {
  it("returns data and sends the secret key as a bearer token", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: true, data: { x: 1 } }) })
    vi.stubGlobal("fetch", fetchMock)

    await expect(paystackRequest("POST", "/transfer", { a: 1 })).resolves.toEqual({ x: 1 })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe("https://api.paystack.co/transfer")
    expect(init.headers.Authorization).toBe(`Bearer ${SECRET}`)
    expect(init.body).toBe(JSON.stringify({ a: 1 }))
  })

  it("throws PaystackError when Paystack reports status: false, even on HTTP 200", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: false, message: "Insufficient balance" }) }))
    await expect(paystackRequest("POST", "/transfer", {})).rejects.toMatchObject({ message: "Insufficient balance" })
    await expect(paystackRequest("POST", "/transfer", {})).rejects.toBeInstanceOf(PaystackError)
  })

  it("throws PaystackError on a non-2xx response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({ status: false, message: "Invalid key" }) }))
    await expect(paystackRequest("GET", "/bank")).rejects.toMatchObject({ status: 401 })
  })

  it("lets network failures surface as non-Paystack errors (callers treat these as ambiguous)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")))
    const err = await paystackRequest("POST", "/transfer", {}).catch((e) => e)
    expect(err).toBeInstanceOf(TypeError)
    expect(err).not.toBeInstanceOf(PaystackError)
  })
})
