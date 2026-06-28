"use server"

import { createClient } from "@/lib/supabase-server"
import { getCurrentUser } from "@/lib/auth"

export async function getJobs(params: {
  searchQuery?: string
  offset?: number
  limit?: number
  fromDate?: string
  toDate?: string
  maxCredits?: number
  jobType?: string
  categorySkills?: string[]
}) {
  const supabase = await createClient()
  
  const user = await getCurrentUser()
  
  if (!user) {
    throw new Error("Unauthorized")
  }

  const { data, error } = await supabase.rpc("get_jobs_with_details", {
    p_user_id: user.id,
    p_search_query: params.searchQuery || "",
    p_offset: params.offset || 0,
    p_limit: params.limit || 10,
    p_from_date: params.fromDate || null,
    p_to_date: params.toDate || null,
    p_max_credits: params.maxCredits || null,
    p_job_type: params.jobType || null,
    p_category_skills: params.categorySkills || null,
  })

  if (error) {
    console.error("Error fetching jobs:", error)
    return { jobs: [], totalCount: 0, error: error.message }
  }

  const jobs = data || []

  // Attach the freelancer's applied-status here (server-side) so the client
  // doesn't need a second browser round-trip to the proposals table, and so
  // the initial server-rendered jobs already reflect what the user applied to.
  let jobsWithApplied = jobs
  if (jobs.length > 0) {
    const jobIds = jobs.map((j: any) => j.id)
    const { data: applied } = await supabase
      .from("proposals")
      .select("job_id")
      .eq("freelancer_id", user.id)
      .in("job_id", jobIds)
    const appliedSet = new Set((applied || []).map((p: any) => p.job_id))
    jobsWithApplied = jobs.map((j: any) => ({ ...j, has_applied: appliedSet.has(j.id) }))
  }

  return {
    jobs: jobsWithApplied,
    totalCount: data?.[0]?.total_count || 0,
  }
}

// Returns the freelancer's bookmarked jobs, enriched with agency info and that
// agency's total job count. Previously run as a browser query + N+1 count loop;
// now executed server-side.
export async function getSavedJobs() {
  const supabase = await createClient()
  const user = await getCurrentUser()

  if (!user) return []

  const { data: savedJobsData, error } = await supabase
    .from("saved_jobs")
    .select(`
      *,
      jobs!saved_jobs_job_id_fkey (
        *,
        proposals(count)
      )
    `)
    .eq("freelancer_id", user.id)
    .order("created_at", { ascending: false })

  if (error) {
    console.error("Error loading saved jobs:", error)
    return []
  }

  // There's no declared FK between jobs.agency_id and profiles.id, so PostgREST
  // can't embed the agency — fetch the agency profiles separately and merge.
  const agencyIds = [
    ...new Set((savedJobsData || []).map((item: any) => item.jobs?.agency_id).filter(Boolean)),
  ]

  const profilesById: Record<string, any> = {}
  if (agencyIds.length > 0) {
    const { data: agencyProfiles } = await supabase
      .from("profiles")
      .select("id, full_name, company_name, company_size, bio, location, phone, website, email, created_at")
      .in("id", agencyIds)
    for (const p of agencyProfiles || []) profilesById[(p as any).id] = p
  }

  // Total job count per agency.
  const agencyJobCounts: Record<string, number> = {}
  for (const agencyId of agencyIds) {
    const { count } = await supabase
      .from("jobs")
      .select("*", { count: "exact", head: true })
      .eq("agency_id", agencyId)
    agencyJobCounts[agencyId as string] = count || 0
  }

  return (savedJobsData || []).map((item: any) => {
    const job = item.jobs
    const profile = profilesById[job?.agency_id] || null
    return {
      ...job,
      savedAt: new Date(item.created_at).toLocaleDateString(),
      budget: `₦ ${job.budget_min?.toLocaleString()} - ₦ ${job.budget_max?.toLocaleString()}`,
      postedDate: new Date(job.created_at).toLocaleDateString(),
      proposals: job.proposals?.[0]?.count || 0,
      isBookmarked: true,
      agencyInfo: {
        id: profile?.id,
        name: profile?.company_name || profile?.full_name || "Unknown Agency",
        location: profile?.location || "Nigeria",
        employees: profile?.company_size || "10-50",
        description: profile?.bio || "Professional agency providing quality services.",
        memberSince: profile?.created_at ? new Date(profile.created_at).getFullYear().toString() : "2020",
        phone: profile?.phone,
        website: profile?.website,
        email: profile?.email,
        fullName: profile?.full_name,
        companyName: profile?.company_name,
        totalJobs: agencyJobCounts[job?.agency_id] || 0,
      },
    }
  })
}

export async function toggleBookmark(jobId: string, isBookmarked: boolean) {
  const supabase = await createClient()
  const user = await getCurrentUser()

  if (!user) throw new Error("Unauthorized")

  if (isBookmarked) {
    const { error } = await supabase
      .from("saved_jobs")
      .delete()
      .eq("freelancer_id", user.id)
      .eq("job_id", jobId)
    if (error) throw error
  } else {
    const { error } = await supabase
      .from("saved_jobs")
      .insert([{ freelancer_id: user.id, job_id: jobId }])
    if (error) throw error
  }

  return { success: true }
}

export async function getAgencyJobs() {
  const supabase = await createClient()
  const user = await getCurrentUser()

  if (!user) throw new Error("Unauthorized")

  const { data, error } = await supabase
    .from("jobs")
    .select("*, proposals(count)")
    .eq("agency_id", user.id)
    .order("created_at", { ascending: false })

  if (error) {
    console.error("Error fetching agency jobs:", error)
    return []
  }

  return data?.map((job: any) => ({
    ...job,
    proposals: job.proposals?.[0]?.count || 0,
  })) || []
}

export async function updateJobStatus(jobId: string, newStatus: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from("jobs")
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq("id", jobId)

  if (error) throw error
  return { success: true }
}

export type JobInput = {
  title: string
  description: string
  skills: string[]
  budget_min: number | null
  budget_max: number | null
  duration: string
  location: string
  job_type: string
  credit_cost: number
}

export type CreateJobResult =
  | { success: true; deduped?: boolean }
  | { success: false; error: string; code?: string }

export async function createJob(
  input: JobInput,
  idempotencyKey: string,
): Promise<CreateJobResult> {
  const supabase = await createClient()
  const user = await getCurrentUser()
  if (!user) return { success: false, error: "Unauthorized" }

  const { error } = await supabase.from("jobs").insert([
    {
      ...input,
      agency_id: user.id,
      status: "active",
      created_at: new Date().toISOString(),
      idempotency_key: idempotencyKey,
    },
  ])

  if (error) {
    // unique_violation on idempotency_key: a prior attempt already landed.
    if (error.code === "23505") return { success: true, deduped: true }
    console.error("createJob error:", error)
    return { success: false, error: error.message, code: error.code }
  }

  return { success: true }
}

export type UpdateJobResult =
  | { success: true }
  | { success: false; error: string; code?: string }

export async function updateJob(
  jobId: string,
  input: JobInput,
): Promise<UpdateJobResult> {
  const supabase = await createClient()
  const user = await getCurrentUser()
  if (!user) return { success: false, error: "Unauthorized" }

  // Ownership check is also enforced by RLS; the explicit filter keeps the
  // update from touching rows the user shouldn't see even if RLS is misconfigured.
  const { error } = await supabase
    .from("jobs")
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq("id", jobId)
    .eq("agency_id", user.id)

  if (error) {
    console.error("updateJob error:", error)
    return { success: false, error: error.message, code: error.code }
  }

  return { success: true }
}

// Returns the freelancer's proposals enriched with job details, agency name,
// funding status and per-proposal freelancer status. Mirrors the multi-step,
// embed-free fetch the proposals screen used to run in the browser — now done
// server-side in one round-trip from the client's perspective.
export async function getFreelancerProposals(params: {
  searchTerm?: string
  offset?: number
  limit?: number
}): Promise<{ proposals: any[]; hasMore: boolean }> {
  const supabase = await createClient()
  const user = await getCurrentUser()

  if (!user) return { proposals: [], hasMore: false }

  const limit = params.limit ?? 15
  const offset = params.offset ?? 0
  const searchTerm = params.searchTerm?.trim()

  // Optional search: resolve matching job ids first (avoids embedded joins that
  // break on FK naming).
  let jobIdsToFilter: string[] | undefined
  if (searchTerm) {
    const { data: searchedJobs, error: searchError } = await supabase
      .from("jobs")
      .select("id")
      .or(`title.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`)
    if (searchError) {
      console.error("Error searching jobs:", searchError)
      return { proposals: [], hasMore: false }
    }
    jobIdsToFilter = (searchedJobs || []).map((j: any) => j.id)
    if (jobIdsToFilter.length === 0) return { proposals: [], hasMore: false }
  }

  // Step 1: proposals page (no embedded joins).
  let proposalsQuery = supabase
    .from("proposals")
    .select("*")
    .eq("freelancer_id", user.id)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1)
  if (jobIdsToFilter !== undefined) {
    proposalsQuery = proposalsQuery.in("job_id", jobIdsToFilter)
  }

  const { data: proposalsData, error: proposalsError } = await proposalsQuery
  if (proposalsError) {
    console.error("Error loading proposals:", proposalsError.message)
    return { proposals: [], hasMore: false }
  }
  if (!proposalsData || proposalsData.length === 0) {
    return { proposals: [], hasMore: false }
  }

  // Step 2: related data in parallel.
  const jobIds = Array.from(new Set(proposalsData.map((p: any) => p.job_id).filter(Boolean)))
  const proposalIds = proposalsData.map((p: any) => p.id).filter(Boolean)

  const [jobsRes, fundingRes, statusRes] = await Promise.all([
    jobIds.length
      ? supabase
          .from("jobs")
          .select("id, title, description, budget_min, budget_max, job_type, duration, location, skills, agency_id")
          .in("id", jobIds)
      : Promise.resolve({ data: [] as any[] }),
    jobIds.length
      ? supabase.from("job_funding_status").select("job_id, funding_status, job_status").in("job_id", jobIds)
      : Promise.resolve({ data: [] as any[] }),
    proposalIds.length
      ? supabase.from("freelancer_proposal_status").select("proposal_id, freelancer_status").in("proposal_id", proposalIds)
      : Promise.resolve({ data: [] as any[] }),
  ])

  const jobById: Record<string, any> = {}
  for (const j of (jobsRes.data as any[]) || []) jobById[j.id] = j
  const fundingByJobId: Record<string, any> = {}
  for (const f of (fundingRes.data as any[]) || []) fundingByJobId[f.job_id] = f
  const statusByProposalId: Record<string, any> = {}
  for (const s of (statusRes.data as any[]) || []) statusByProposalId[s.proposal_id] = s

  // Step 3: agency profiles.
  const agencyIds = Array.from(
    new Set(Object.values(jobById).map((j: any) => j?.agency_id).filter(Boolean)),
  )
  const agencyById: Record<string, any> = {}
  if (agencyIds.length > 0) {
    const { data: agencies } = await supabase
      .from("profiles")
      .select("id, full_name, company_name")
      .in("id", agencyIds)
    for (const a of (agencies as any[]) || []) agencyById[a.id] = a
  }

  // Step 4: stitch.
  const proposals = proposalsData.map((proposal: any) => {
    const job = jobById[proposal.job_id]
    const agency = job ? agencyById[job.agency_id] : null
    const funding = fundingByJobId[proposal.job_id]
    const fStatus = statusByProposalId[proposal.id]
    return {
      ...proposal,
      job_title: job?.title || "Unknown Job",
      job_description: job?.description || "No description available",
      job_budget_min: job?.budget_min || 0,
      job_budget_max: job?.budget_max || 0,
      job_type: job?.job_type || "Not specified",
      job_duration: job?.duration || "Not specified",
      job_location: job?.location || "Not specified",
      skills: job?.skills || [],
      agency_name: agency?.company_name || agency?.full_name || "Unknown Agency",
      funding_status: funding?.funding_status || "pending",
      job_status: funding?.job_status || "open",
      freelancer_status: fStatus?.freelancer_status || "pending",
    }
  })

  return { proposals, hasMore: proposalsData.length === limit }
}
