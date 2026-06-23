import { redirect } from "next/navigation"
import UserDetailClient from "./UserDetailClient"
import { getFullUserData } from "@/app/actions/user"
import { createClient } from "@/lib/supabase-server"

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  // Admin guard — authenticate before reading anyone's data.
  const userData = await getFullUserData()
  if (!userData?.user) {
    redirect("/admin/login")
  }
  if (userData.profile?.account_type !== "admin") {
    redirect("/admin/login")
  }

  const supabase = await createClient()

  // The target user's profile is fetched first so we know whether to surface
  // agency-side (jobs posted) or freelancer-side (proposals, KYC) history.
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", id)
    .maybeSingle()

  // Everything else is pulled in parallel. Each query is scoped to this user.
  const [
    { data: kyc },
    { data: fundedJobs },
    { data: credits },
    { data: disputes },
    { data: jobsPosted },
    { data: proposals },
  ] = await Promise.all([
    supabase
      .from("freelancer_verification")
      .select("nin, status, created_at")
      .eq("freelancer_id", id)
      .maybeSingle(),
    supabase
      .from("Funded_jobs101")
      .select("*")
      .or(`agency_id.eq.${id},freelancer_id.eq.${id}`)
      .order("created_at", { ascending: false }),
    supabase
      .from("purchase_credits")
      .select("*")
      .eq("freelancer_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("disputes")
      .select(
        `*, job:jobs(title),
         initiator:profiles!disputes_initiator_id_fkey(full_name),
         respondent:profiles!disputes_respondent_id_fkey(full_name)`,
      )
      .or(`initiator_id.eq.${id},respondent_id.eq.${id}`)
      .order("created_at", { ascending: false }),
    supabase
      .from("jobs")
      .select("id, title, status, budget_min, budget_max, created_at")
      .eq("agency_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("proposals")
      .select("*, job:jobs(title)")
      .eq("freelancer_id", id)
      .order("created_at", { ascending: false }),
  ])

  return (
    <UserDetailClient
      profile={profile ?? null}
      kyc={kyc ?? null}
      fundedJobs={fundedJobs || []}
      credits={credits || []}
      disputes={disputes || []}
      jobsPosted={jobsPosted || []}
      proposals={proposals || []}
    />
  )
}
