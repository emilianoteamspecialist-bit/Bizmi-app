import { redirect } from "next/navigation"
import FindFreelancersClient, {
  FREELANCERS_PER_PAGE,
  type FreelancerProfile,
} from "./FindFreelancersClient"
import { getFullUserData } from "@/app/actions/user"
import { createClient } from "@/lib/supabase-server"
import { resolveAvatar } from "@/lib/avatar-url"
import { getCategoriesForSkills } from "@/lib/categories"

export default async function FindFreelancersPage() {
  // Authenticate first, then redirect by account type — same gate as the
  // agency dashboard (the source of truth).
  const userData = await getFullUserData()

  if (!userData?.user) {
    redirect("/login")
  }

  const { profile } = userData

  if (profile?.account_type === "freelancer") {
    redirect("/freelancer/dashboard")
  }
  if (profile?.account_type === "admin") {
    redirect("/admin/dashboard")
  }

  // Replicate the client's initial unfiltered first-page load on the server.
  // Mirrors loadFreelancers(0) with no filters/searchQuery applied.
  const supabase = await createClient()

  let initialFreelancers: FreelancerProfile[] = []
  let initialHasMore = false

  const { data: profilesData, count } = await supabase
    .from("profiles")
    .select("id, full_name, bio, location, created_at", { count: "exact" })
    .eq("account_type", "freelancer")
    .order("created_at", { ascending: false })
    .range(0, FREELANCERS_PER_PAGE - 1)

  if (profilesData && profilesData.length > 0) {
    const freelancerIds = profilesData.map((p) => p.id)

    const [logosResult, verificationResult, completedJobsResult, skillsResult] = await Promise.all([
      supabase.from("freelancer_logos").select("freelancer_id, logo_path, logo_data").in("freelancer_id", freelancerIds),
      supabase
        .from("Freelancer_identitie")
        .select("user_id, verification_status")
        .in("user_id", freelancerIds),
      supabase
        .from("freelancer_proposal_status")
        .select("freelancer_id, status")
        .in("freelancer_id", freelancerIds)
        .eq("status", "completed"),
      supabase
        .from("freelancer_skills")
        .select("user_id, skill_name")
        .in("user_id", freelancerIds),
    ])

    const logoMap: Record<string, string> = {}
    logosResult.data?.forEach((l) => {
      logoMap[l.freelancer_id] = resolveAvatar(l)
    })

    const verificationMap: Record<string, string> = {}
    verificationResult.data?.forEach((v) => {
      verificationMap[v.user_id] = v.verification_status
    })

    const completedCountMap: Record<string, number> = {}
    completedJobsResult.data?.forEach((j) => {
      completedCountMap[j.freelancer_id] = (completedCountMap[j.freelancer_id] || 0) + 1
    })

    const skillsMap: Record<string, string[]> = {}
    skillsResult.data?.forEach((s) => {
      if (!skillsMap[s.user_id]) skillsMap[s.user_id] = []
      skillsMap[s.user_id].push(s.skill_name)
    })

    initialFreelancers = profilesData.map((p) => {
      const skillsArray = skillsMap[p.id] || []
      return {
        id: p.id,
        full_name: p.full_name,
        bio: p.bio,
        location: p.location,
        skills: skillsArray.join(", "),
        experience_level: "Expert",
        hourly_rate: 0,
        created_at: p.created_at,
        logo: logoMap[p.id] || null,
        verification_status: verificationMap[p.id] || null,
        jobs_completed: completedCountMap[p.id] || 0,
        categories: getCategoriesForSkills(skillsArray),
      }
    })

    initialHasMore = FREELANCERS_PER_PAGE < (count || 0)
  }

  return (
    <FindFreelancersClient
      initialFreelancers={initialFreelancers}
      initialHasMore={initialHasMore}
    />
  )
}
