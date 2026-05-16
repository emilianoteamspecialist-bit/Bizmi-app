import { redirect } from "next/navigation"
import { getFullUserData } from "@/app/actions/user"
import { getJobs } from "@/app/actions/jobs"
import { getAvatarUrl } from "@/lib/avatar-url"
import MarketplaceClient from "./MarketplaceClient"

export default async function MarketplacePage() {
  const { user, profile, credits, balance } = await getFullUserData()

  if (!user || profile?.account_type !== "freelancer") {
    redirect("/login")
  }

  // Load initial jobs
  const { jobs: jobsData, totalCount } = await getJobs({ limit: 20, offset: 0 })

  // Transform initial jobs data
  const formattedJobs = jobsData?.map((job: any) => ({
    ...job,
    budget: `₦ ${job.budget_min?.toLocaleString()} - ₦ ${job.budget_max?.toLocaleString()}`,
    postedDate: new Date(job.created_at).toLocaleDateString(),
    proposals: job.proposal_count || 0,
    rating: 4.8, // Mock data
    isLiked: false,
    agencyInfo: {
      ...job.agency_info,
      name: job.agency_info?.company_name || job.agency_info?.full_name || "Unknown Agency",
      logo: getAvatarUrl(job.agency_info?.logo_path),
      rating: 4.8,
      reviews: 156,
      founded: job.agency_info?.created_at ? new Date(job.agency_info.created_at).getFullYear().toString() : "2020",
      employees: job.agency_info?.company_size || "10-50",
      description: job.agency_info?.bio || "Professional agency providing quality services.",
      memberSince: job.agency_info?.created_at ? new Date(job.agency_info.created_at).getFullYear().toString() : "2020",
      totalJobs: job.agency_info?.total_jobs || 0,
    },
  })) || []

  return (
    <MarketplaceClient 
      initialUser={user} 
      initialProfile={profile} 
      initialCredits={credits} 
      initialBalance={balance} 
      initialJobs={formattedJobs}
      initialTotalJobsCount={totalCount || 0}
    />
  )
}
