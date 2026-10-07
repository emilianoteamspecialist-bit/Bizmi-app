import { Router } from "express"
import { asyncHandler } from "../lib/http.js"
import { resolveAvatar } from "../lib/avatar.js"
import { createServiceClient } from "../lib/supabase.js"
import { getFreelancerTrust } from "../lib/trustSignals.js"

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

    // Trust signals from the systems of record (see lib/trustSignals).
    const [logosResult, trust, skillsResult] = await Promise.all([
      supabase.from("freelancer_logos").select("freelancer_id, logo_path, logo_data").in("freelancer_id", freelancerIds),
      getFreelancerTrust(createServiceClient(), freelancerIds),
      supabase.from("freelancer_skills").select("user_id, skill_name").in("user_id", freelancerIds),
    ])

    const logoMap: Record<string, string> = {}
    logosResult.data?.forEach((l) => {
      logoMap[l.freelancer_id] = resolveAvatar(l)
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
      verification_status: trust.get(p.id)?.verification_status ?? null,
      identity_verified: trust.get(p.id)?.identity_verified ?? false,
      jobs_completed: trust.get(p.id)?.jobs_completed ?? 0,
    }))

    res.json({ freelancers, hasMore: profilesData.length === limit })
  })
)

export default freelancersRouter
