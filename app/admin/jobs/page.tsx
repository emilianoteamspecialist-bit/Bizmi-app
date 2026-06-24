import { redirect } from "next/navigation"
import JobsModerationClient from "./JobsModerationClient"
import { getFullUserData } from "@/app/actions/user"
import { createClient } from "@/lib/supabase-server"

export default async function AdminJobsPage() {
  // Admin guard.
  const userData = await getFullUserData()
  if (!userData?.user) {
    redirect("/admin/login")
  }
  if (userData.profile?.account_type !== "admin") {
    redirect("/admin/login")
  }

  const supabase = await createClient()

  // select("*") so this still works before the moderation migration is applied
  // (moderation_status simply comes back undefined and is treated as visible).
  const { data: jobs } = await supabase
    .from("jobs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(300)

  // Resolve agency display names without relying on a FK-constraint name.
  const agencyIds = [...new Set((jobs || []).map((j: any) => j.agency_id).filter(Boolean))]
  const { data: agencies } = agencyIds.length
    ? await supabase.from("profiles").select("id, full_name, company_name").in("id", agencyIds)
    : { data: [] as any[] }
  const nameById = new Map((agencies || []).map((a: any) => [a.id, a.company_name || a.full_name || "Agency"]))

  const initialJobs = (jobs || []).map((j: any) => ({
    id: j.id,
    title: j.title,
    status: j.status,
    moderation_status: j.moderation_status ?? "visible",
    moderation_reason: j.moderation_reason ?? null,
    agency_name: nameById.get(j.agency_id) || "—",
    created_at: j.created_at,
    budget_min: j.budget_min,
    budget_max: j.budget_max,
  }))

  return <JobsModerationClient initialJobs={initialJobs} />
}
