import { describe, it, expect } from "vitest"
import { generateReferralCode } from "./referralCode.js"

describe("generateReferralCode", () => {
  it("generates a code of the requested length using only unambiguous lowercase/digit characters", () => {
    const code = generateReferralCode(10)
    expect(code).toHaveLength(10)
    expect(code).toMatch(/^[abcdefghjkmnpqrstuvwxyz23456789]+$/)
  })

  it("defaults to length 10 when no length is given", () => {
    expect(generateReferralCode()).toHaveLength(10)
  })

  it("generates different codes across calls", () => {
    const codes = new Set(Array.from({ length: 20 }, () => generateReferralCode()))
    expect(codes.size).toBe(20)
  })
})
