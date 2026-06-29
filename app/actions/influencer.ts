"use server"

import { runReferralSync } from "@/lib/influencer-sync"

// Server action wrapper so client components can trigger the first-load
// referral/influencer setup. The logic lives in lib/influencer-sync.ts so server
// components (the influencer layout) can await it directly too.
export async function syncReferralAndInfluencer(): Promise<void> {
  await runReferralSync()
}
