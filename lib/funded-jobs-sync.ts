import type { SupabaseClient } from "@supabase/supabase-js"

// Transitional shim: the freelancer "Funded Jobs" page still reads from the
// legacy `Funded_jobs101` table. The new escrow flow only writes to
// `escrow_deposits`, so without this sync the freelancer can't see a funded
// job until the legacy UI is migrated to read escrow_deposits directly.
//
// Idempotent on (reference_id): no-ops if a row with this paystack_reference
// already exists. Logs failures but never throws — the escrow transition is
// the source of truth; this is best-effort UI plumbing.

type SyncInput = {
  reference: string
  escrow: {
    id: string
    job_id: string
    agency_id: string
    freelancer_id: string | null
    amount_kobo: number | null
  }
}

export async function syncFundedJob(
  service: SupabaseClient,
  { reference, escrow }: SyncInput,
): Promise<void> {
  try {
    // Skip if already synced — dedupe on the paystack reference, which is
    // the only ID both sides share.
    const { data: existing } = await service
      .from("Funded_jobs101")
      .select("id")
      .eq("reference_id", reference)
      .maybeSingle()

    if (existing) return

    const [{ data: agencyProfile }, { data: jobData }] = await Promise.all([
      service
        .from("profiles")
        .select("full_name, company_name")
        .eq("id", escrow.agency_id)
        .maybeSingle(),
      service
        .from("jobs")
        .select("title")
        .eq("id", escrow.job_id)
        .maybeSingle(),
    ])

    const agencyName =
      agencyProfile?.company_name || agencyProfile?.full_name || "Agency"
    const jobTitle = jobData?.title || "Job"
    const amountNaira = escrow.amount_kobo ? escrow.amount_kobo / 100 : 0

    const { error: insertError } = await service.from("Funded_jobs101").insert({
      reference_id: reference,
      agency_name: agencyName,
      job_title: jobTitle,
      amount: amountNaira,
      status: "verified",
      freelancer_id: escrow.freelancer_id,
      agency_id: escrow.agency_id,
      job_id: escrow.job_id,
      funded_at: new Date().toISOString(),
    })

    if (insertError) {
      console.error("syncFundedJob insert failed", {
        reference,
        escrow_id: escrow.id,
        error: insertError,
      })
    }
  } catch (err) {
    console.error("syncFundedJob unexpected error", {
      reference,
      escrow_id: escrow.id,
      err,
    })
  }
}
