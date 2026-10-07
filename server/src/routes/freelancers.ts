import { Router } from "express"
import { asyncHandler } from "../lib/http.js"
import { resolveAvatar } from "../lib/avatar.js"
import { createServiceClient } from "../lib/supabase.js"

const freelancersRouter = Router()

freelancersRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const limit = Number(req.query.limit ?? 20)
    const offset = Number(req.query.offset ?? 0)
    const rawSearch = typeof req.query.search === "string" ? req.query.search : ""
    // Strip PostgREST filter-DSL metacharacters before interpolating into
    // .or() below — otherwise a search term containing "," "(" ")" "." ":"
    // or "\" can inject additional filter clauses (PostgREST/Supabase
    // filter injection).
    const search = rawSearch.replace(/[,()\\:*.]/g, " ").trim().slice(0, 100)

    const supabase = req.supabase!

    let query = supabase
      .from("profiles")
      .select("id, full_name, bio, location, created_at")
      .eq("account_type", "freelancer")
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1)

    if (search) {
      query = query.or(`full_name.ilike.%${search}%,bio.ilike.%${search}%`)
    }

    const { data: profilesData, error } = await query

    if (error) {
      console.error("Error searching freelancers:", error)
      res.json({ freelancers: [], hasMore: false })
      return
    }

    if (!profilesData || profilesData.length === 0) {
      res.json({ freelancers: [], hasMore: false })
      return
    }

    const freelancerIds = profilesData.map((p: { id: string }) => p.id)

    // Trust signals come from the systems of record, read with the service
    // role because RLS only lets each user see their own rows -- and only the
    // status/count for the freelancers on this page:
    //   - identity: freelancer_verification (written by the external KYC
    //     service), not the legacy Freelancer_identitie table;
    //   - jobs completed: escrows released or paid out to the freelancer, not
    //     the self-reported freelancer_proposal_status.
    const service = createServiceClient()
    const [logosResult, verificationResult, completedJobsResult, skillsResult] = await Promise.all([
      supabase.from("freelancer_logos").select("freelancer_id, logo_path, logo_data").in("freelancer_id", freelancerIds),
      service.from("freelancer_verification").select("freelancer_id, status").in("freelancer_id", freelancerIds),
      service.from("escrow_deposits").select("freelancer_id").in("freelancer_id", freelancerIds).in("status_v2", ["released", "paid_out"]),
      supabase.from("freelancer_skills").select("user_id, skill_name").in("user_id", freelancerIds),
    ])

    const logoMap: Record<string, string> = {}
    logosResult.data?.forEach((l) => {
      logoMap[l.freelancer_id] = resolveAvatar(l)
    })

    const verificationMap: Record<string, string> = {}
    verificationResult.data?.forEach((v: { freelancer_id: string; status: string }) => {
      verificationMap[v.freelancer_id] = v.status
    })

    const completedCountMap: Record<string, number> = {}
    completedJobsResult.data?.forEach((j: { freelancer_id: string }) => {
      completedCountMap[j.freelancer_id] = (completedCountMap[j.freelancer_id] || 0) + 1
    })

    const skillsMap: Record<string, string[]> = {}
    skillsResult.data?.forEach((s: { user_id: string; skill_name: string }) => {
      if (!skillsMap[s.user_id]) skillsMap[s.user_id] = []
      skillsMap[s.user_id].push(s.skill_name)
    })

    const freelancers = profilesData.map((p: { id: string; full_name: string; bio: string | null; location: string | null; created_at: string }) => ({
      id: p.id,
      full_name: p.full_name,
      bio: p.bio,
      location: p.location,
      skills: skillsMap[p.id] || [],
      created_at: p.created_at,
      logo: logoMap[p.id] || null,
      verification_status: verificationMap[p.id] || null,
      identity_verified: verificationMap[p.id] === "verified",
      jobs_completed: completedCountMap[p.id] || 0,
    }))

    res.json({ freelancers, hasMore: profilesData.length === limit })
  })
)

export default freelancersRouter
