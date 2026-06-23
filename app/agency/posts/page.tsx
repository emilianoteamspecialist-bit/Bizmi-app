import { redirect } from "next/navigation"
import PostsClient from "./PostsClient"
import { getFullUserData } from "@/app/actions/user"
import { createClient } from "@/lib/supabase-server"

const ITEMS_PER_PAGE = 15

export default async function AgencyPostsPage() {
  // Authenticate first. The initial jobs query is scoped to the signed-in
  // agency, so we must have a user (and the right account type) before fetching.
  const userData = await getFullUserData()

  if (!userData?.user) {
    redirect("/login")
  }

  const { user, profile } = userData

  if (profile?.account_type === "freelancer") {
    redirect("/freelancer/dashboard")
  }
  if (profile?.account_type === "admin") {
    redirect("/admin/dashboard")
  }

  // Fetch the first page of this agency's job posts on the server — same
  // table/columns/filters/order/range and the same shaping the client used on
  // mount (no search term). The client takes over for search, pagination, and
  // realtime refetches. No shared action covers this exact shape (the funding
  // status join + derived fields), so it's replicated inline here.
  const supabase = await createClient()

  const { data, count } = await supabase
    .from("jobs")
    .select(
      `id,
      title,
      description,
      budget_min,
      budget_max,
      created_at,
      duration,
      location,
      job_type,
      skills,
      proposals(count),
      job_funding_status(funding_status, job_status)`,
      { count: "exact" },
    )
    .eq("agency_id", user.id)
    .order("created_at", { ascending: false })
    .range(0, ITEMS_PER_PAGE - 1)

  const initialJobs =
    data?.map((job: any) => ({
      ...job,
      proposals: job.proposals?.[0]?.count || 0,
      funding_status: job.job_funding_status?.[0]?.funding_status || "pending",
      job_status: job.job_funding_status?.[0]?.job_status || "open",
    })) || []

  const initialOffset = initialJobs.length
  const initialHasMore = initialJobs.length < (count || 0)

  return (
    <PostsClient
      initialJobs={initialJobs}
      initialOffset={initialOffset}
      initialHasMore={initialHasMore}
    />
  )
}
