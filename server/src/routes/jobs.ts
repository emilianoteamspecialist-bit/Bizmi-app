import { Router } from "express"
import { asyncHandler } from "../lib/http.js"

const jobsRouter = Router()

function toStringArray(value: unknown): string[] | undefined {
  if (value === undefined) return undefined
  return Array.isArray(value) ? value.map(String) : [String(value)]
}

jobsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const supabase = req.supabase!
    const user = req.user!
    const q = req.query

    const { data, error } = await supabase.rpc("get_jobs_with_details", {
      p_user_id: user.id,
      p_search_query: (q.searchQuery as string) || "",
      p_offset: Number(q.offset ?? 0),
      p_limit: Number(q.limit ?? 10),
      p_from_date: (q.fromDate as string) || null,
      p_to_date: (q.toDate as string) || null,
      p_max_credits: q.maxCredits ? Number(q.maxCredits) : null,
      p_job_type: (q.jobType as string) || null,
      p_category_skills: toStringArray(q.categorySkills) || null,
    })

    if (error) {
      console.error("Error fetching jobs:", error)
      res.json({ jobs: [], totalCount: 0, error: error.message })
      return
    }

    const jobs = data || []
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

    res.json({ jobs: jobsWithApplied, totalCount: data?.[0]?.total_count || 0 })
  })
)

jobsRouter.get(
  "/saved",
  asyncHandler(async (req, res) => {
    const supabase = req.supabase!
    const user = req.user!

    const { data: savedJobsData, error } = await supabase
      .from("saved_jobs")
      .select(`*, jobs!saved_jobs_job_id_fkey (*, proposals(count))`)
      .eq("freelancer_id", user.id)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Error loading saved jobs:", error)
      res.json({ jobs: [] })
      return
    }

    const agencyIds = [...new Set((savedJobsData || []).map((item: any) => item.jobs?.agency_id).filter(Boolean))]

    const profilesById: Record<string, any> = {}
    if (agencyIds.length > 0) {
      const { data: agencyProfiles } = await supabase
        .from("profiles")
        .select("id, full_name, company_name, company_size, bio, location, phone, website, email, created_at")
        .in("id", agencyIds)
      for (const p of agencyProfiles || []) profilesById[(p as any).id] = p
    }

    const agencyJobCounts: Record<string, number> = {}
    for (const agencyId of agencyIds) {
      const { count } = await supabase.from("jobs").select("*", { count: "exact", head: true }).eq("agency_id", agencyId)
      agencyJobCounts[agencyId as string] = count || 0
    }

    // Which of these the caller has already applied to (same as GET /).
    const savedJobIds = (savedJobsData || []).map((item: any) => item.jobs?.id).filter(Boolean)
    let appliedSet = new Set<string>()
    if (savedJobIds.length > 0) {
      const { data: applied } = await supabase.from("proposals").select("job_id").eq("freelancer_id", user.id).in("job_id", savedJobIds)
      appliedSet = new Set((applied || []).map((p: any) => p.job_id))
    }

    // Missing profile fields stay null: never invent agency details (no
    // placeholder location/size/bio/"member since"), they read as real facts.
    const jobs = (savedJobsData || []).filter((item: any) => item.jobs).map((item: any) => {
      const job = item.jobs
      const profile = profilesById[job?.agency_id] || null
      const proposalCount = job.proposals?.[0]?.count || 0
      return {
        ...job,
        savedAt: new Date(item.created_at).toLocaleDateString(),
        budget: `₦ ${job.budget_min?.toLocaleString()} - ₦ ${job.budget_max?.toLocaleString()}`,
        postedDate: new Date(job.created_at).toLocaleDateString(),
        proposals: proposalCount,
        proposal_count: proposalCount,
        isBookmarked: true,
        is_bookmarked: true,
        has_applied: appliedSet.has(job.id),
        // Same shape as get_jobs_with_details' agency_info, for the shared job card.
        agency_info: profile
          ? {
              full_name: profile.full_name ?? null,
              company_name: profile.company_name ?? null,
              location: profile.location ?? null,
              created_at: profile.created_at ?? null,
              bio: profile.bio ?? null,
              total_jobs: agencyJobCounts[job?.agency_id] ?? null,
            }
          : null,
        agencyInfo: {
          id: profile?.id,
          name: profile?.company_name || profile?.full_name || "Agency",
          location: profile?.location ?? null,
          employees: profile?.company_size ?? null,
          description: profile?.bio ?? null,
          memberSince: profile?.created_at ? new Date(profile.created_at).getFullYear().toString() : null,
          phone: profile?.phone,
          website: profile?.website,
          email: profile?.email,
          fullName: profile?.full_name,
          companyName: profile?.company_name,
          totalJobs: agencyJobCounts[job?.agency_id] || 0,
        },
      }
    })

    res.json({ jobs })
  })
)

jobsRouter.post(
  "/:jobId/bookmark",
  asyncHandler(async (req, res) => {
    const { jobId } = req.params
    const isBookmarked = req.body?.isBookmarked === true
    const supabase = req.supabase!
    const user = req.user!

    if (isBookmarked) {
      const { error } = await supabase.from("saved_jobs").delete().eq("freelancer_id", user.id).eq("job_id", jobId)
      if (error) throw error
    } else {
      const { error } = await supabase.from("saved_jobs").insert([{ freelancer_id: user.id, job_id: jobId }])
      if (error) throw error
    }

    res.json({ success: true })
  })
)

jobsRouter.get(
  "/agency",
  asyncHandler(async (req, res) => {
    const supabase = req.supabase!
    const user = req.user!

    const { data, error } = await supabase
      .from("jobs")
      .select("*, proposals(count)")
      .eq("agency_id", user.id)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Error fetching agency jobs:", error)
      res.json({ jobs: [] })
      return
    }

    const jobs = data?.map((job: any) => ({ ...job, proposals: job.proposals?.[0]?.count || 0 })) || []
    res.json({ jobs })
  })
)

jobsRouter.patch(
  "/:jobId/status",
  asyncHandler(async (req, res) => {
    const { jobId } = req.params
    const { status } = req.body ?? {}
    const user = req.user!
    const { error } = await req.supabase!
      .from("jobs")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", jobId)
      .eq("agency_id", user.id)

    if (error) throw error
    res.json({ success: true })
  })
)

jobsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const { idempotencyKey, ...input } = req.body ?? {}
    const supabase = req.supabase!
    const user = req.user!

    const { error } = await supabase.from("jobs").insert([
      { ...input, agency_id: user.id, status: "active", created_at: new Date().toISOString(), idempotency_key: idempotencyKey },
    ])

    if (error) {
      if (error.code === "23505") {
        res.json({ success: true, deduped: true })
        return
      }
      console.error("createJob error:", error)
      res.json({ success: false, error: error.message, code: error.code })
      return
    }

    res.json({ success: true })
  })
)

jobsRouter.put(
  "/:jobId",
  asyncHandler(async (req, res) => {
    const { jobId } = req.params
    const input = req.body ?? {}
    const supabase = req.supabase!
    const user = req.user!

    const { error } = await supabase
      .from("jobs")
      .update({ ...input, updated_at: new Date().toISOString() })
      .eq("id", jobId)
      .eq("agency_id", user.id)

    if (error) {
      console.error("updateJob error:", error)
      res.json({ success: false, error: error.message, code: error.code })
      return
    }

    res.json({ success: true })
  })
)

jobsRouter.get(
  "/:jobId/proposals",
  asyncHandler(async (req, res) => {
    const { jobId } = req.params
    const supabase = req.supabase!
    const user = req.user!

    const { data: job, error: jobError } = await supabase.from("jobs").select("id, agency_id").eq("id", jobId).maybeSingle()

    if (jobError || !job) {
      res.json({ proposals: [] })
      return
    }
    if (job.agency_id !== user.id) {
      res.status(403).json({ error: "Forbidden" })
      return
    }

    const { data, error } = await supabase
      .from("proposals")
      .select(
        `id, job_id, freelancer_id, proposal_text, budget, timeline, attachments, status, created_at, updated_at,
         profiles!proposals_freelancer_id_fkey ( id, full_name, bio, location, phone, website )`
      )
      .eq("job_id", jobId)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Error fetching job proposals:", error)
      res.json({ proposals: [] })
      return
    }

    res.json({ proposals: data || [] })
  })
)

export default jobsRouter
