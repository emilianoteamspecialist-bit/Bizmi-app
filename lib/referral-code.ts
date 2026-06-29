import { randomBytes } from "crypto"

// Short, URL-friendly referral code. Avoids ambiguous characters (0/o, 1/l/i)
// so codes are easy to read and share. Uniqueness is enforced by the
// `influencer_profiles.referral_code` UNIQUE constraint — the caller retries on
// the rare collision.
//
// Uses a CSPRNG with rejection sampling so codes are unguessable and unbiased
// across the alphabet (no modulo bias).
const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789" // 31 chars
const MAX_UNBIASED = Math.floor(256 / ALPHABET.length) * ALPHABET.length // 248

export function generateReferralCode(length = 10): string {
  let code = ""
  while (code.length < length) {
    const bytes = randomBytes(length - code.length + 4)
    for (let i = 0; i < bytes.length && code.length < length; i++) {
      const b = bytes[i]
      if (b < MAX_UNBIASED) code += ALPHABET[b % ALPHABET.length]
    }
  }
  return code
}
