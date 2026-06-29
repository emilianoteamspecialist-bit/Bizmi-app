"use client"

import { useEffect } from "react"
import { syncReferralAndInfluencer } from "@/app/actions/influencer"

// Fires the one-time, idempotent referral/influencer setup on first
// authenticated load. Renders nothing. Mounted in the dashboard layouts so it
// runs once the user lands in the app after sign-up + email confirmation.
export function ReferralSync() {
  useEffect(() => {
    syncReferralAndInfluencer().catch(() => {})
  }, [])
  return null
}
