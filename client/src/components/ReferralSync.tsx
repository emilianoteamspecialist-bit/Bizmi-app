import { useEffect } from "react"
import { apiFetch } from "../lib/api"

// Fires the one-time, idempotent referral/influencer sync on first
// authenticated load. Renders nothing. Mounted on each role's landing page
// after login (mirrors legacy's <ReferralSync /> mounted in the
// freelancer/agency/influencer layouts) so a signup carrying a stashed
// ref_code actually gets attributed.
export default function ReferralSync() {
  useEffect(() => {
    apiFetch("/api/me/referral-sync", { method: "POST" }).catch(() => {})
  }, [])
  return null
}
