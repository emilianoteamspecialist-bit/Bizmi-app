import { redirect } from "next/navigation"
import DashboardClient from "./DashboardClient"
import { getFullUserData } from "@/app/actions/user"
import { getJobs } from "@/app/actions/jobs"
import { getAvatarUrl } from "@/lib/avatar-url"

export default async function FreelancerDashboardPage() {
  // Fetch user data and jobs in parallel
  const [userData, jobsData] = await Promise.all([
    getFullUserData(),
    getJobs({ offset: 0, limit: 6 })
  ])

  if (!userData?.user) {
    redirect("/login")
  }

  const { user, profile, credits, balance, isVerified } = userData

  if (profile?.account_type === "agency") {
    redirect("/agency/dashboard")
  }
  if (profile?.account_type === "admin") {
    redirect("/admin/dashboard")
  }

  // Transform jobs data to match the expected initial structure in the client
  const transformedJobs = jobsData?.jobs?.map((job: any) => ({
      ...job,
      budget: `₦ ${job.budget_min?.toLocaleString()} - ₦ ${job.budget_max?.toLocaleString()}`,
      postedDate: new Date(job.created_at).toLocaleDateString(),
      proposals: job.proposal_count || 0,
      rating: 4.8,
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
    <DashboardClient 
      initialUser={user} 
      initialProfile={profile} 
      initialCredits={credits} 
      initialBalance={balance} 
      initialJobs={transformedJobs}
      initialTotalJobsCount={jobsData?.totalCount || 0}
      initialIsVerified={isVerified}
    />
  )
}
