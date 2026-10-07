import type { SupabaseClient } from "@supabase/supabase-js"

export type FreelancerTrust = { verification_status: string | null; identity_verified: boolean; jobs_completed: number }

/**
 * Trust signals for a set of freelancers, from the systems of record:
 *  - identity: freelancer_verification (written by the external KYC service);
 *  - jobs completed: escrows released or paid out to the freelancer.
 * Pass the service-role client: RLS only lets each user read their own rows,
 * and only status/counts for the given ids are returned.
 */
export async function getFreelancerTrust(service: SupabaseClient, freelancerIds: string[]): Promise<Map<string, FreelancerTrust>> {
  const result = new Map<string, FreelancerTrust>()
  const ids = [...new Set(freelancerIds.filter(Boolean))]
  if (ids.length === 0) return result

  const [verification, completed] = await Promise.all([
    service.from("freelancer_verification").select("freelancer_id, status").in("freelancer_id", ids),
    service.from("escrow_deposits").select("freelancer_id").in("freelancer_id", ids).in("status_v2", ["released", "paid_out"]),
  ])

  for (const id of ids) result.set(id, { verification_status: null, identity_verified: false, jobs_completed: 0 })
  for (const v of (verification.data ?? []) as { freelancer_id: string; status: string }[]) {
    const t = result.get(v.freelancer_id)
    if (t) {
      t.verification_status = v.status
      t.identity_verified = v.status === "verified"
    }
  }
  for (const e of (completed.data ?? []) as { freelancer_id: string }[]) {
    const t = result.get(e.freelancer_id)
    if (t) t.jobs_completed += 1
  }
  return result
}
