"use server"

import { createClient } from "@/lib/supabase-server"

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
  
  const { data: { user } } = await supabase.auth.getUser()
  
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

  return {
    jobs: data || [],
    totalCount: data?.[0]?.total_count || 0,
  }
}

export async function toggleBookmark(jobId: string, isBookmarked: boolean) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

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
  const { data: { user } } = await supabase.auth.getUser()

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
  const { data: { user } } = await supabase.auth.getUser()
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
  const { data: { user } } = await supabase.auth.getUser()
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

export async function getFreelancerProposals(params: {
  searchTerm?: string
  offset?: number
  limit?: number
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) throw new Error("Unauthorized")

  let query = supabase
    .from("proposals")
    .select(`
      *,
      jobs!inner(
        title,
        description,
        budget_min,
        budget_max,
        job_type,
        duration,
        location,
        skills,
        status,
        profiles!jobs_agency_id_fkey(company_name, full_name)
      )
    `)
    .eq("freelancer_id", user.id)
    .order("created_at", { ascending: false })
    .range(params.offset || 0, (params.offset || 0) + (params.limit || 10) - 1)

  if (params.searchTerm) {
    query = query.or(`title.ilike.%${params.searchTerm}%,description.ilike.%${params.searchTerm}%`, { foreignTable: "jobs" })
  }

  const { data, error } = await query

  if (error) {
    console.error("Error fetching proposals:", error)
    return []
  }

  return data.map((item: any) => ({
    ...item,
    job_title: item.jobs.title,
    job_description: item.jobs.description,
    job_budget_min: item.jobs.budget_min,
    job_budget_max: item.jobs.budget_max,
    job_type: item.jobs.job_type,
    job_duration: item.jobs.duration,
    job_location: item.jobs.location,
    skills: item.jobs.skills,
    agency_name: item.jobs.profiles?.company_name || item.jobs.profiles?.full_name || "Unknown",
    job_status: item.jobs.status,
  }))
}
