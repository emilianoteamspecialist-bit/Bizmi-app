import { redirect } from "next/navigation"
import AnalyticsClient from "./AnalyticsClient"
import { getFullUserData } from "@/app/actions/user"
import { createClient } from "@/lib/supabase-server"

interface TopFreelancer {
  id: string
  full_name: string
  email: string
  total_earnings: number
  completed_jobs: number
}

interface TopAgency {
  id: string
  full_name: string
  email: string
  total_deposits: number
  funded_jobs: number
}

export default async function AdminAnalyticsPage() {
  // Admin guard — authenticate before touching analytics data.
  const userData = await getFullUserData()

  if (!userData?.user) {
    redirect("/admin/login")
  }

  if (userData.profile?.account_type !== "admin") {
    redirect("/admin/login")
  }

  // Initial analytics computed server-side — same tables/columns and
  // aggregation the client previously did on mount (the source of truth).
  let topFreelancers: TopFreelancer[] = []
  let topAgencies: TopAgency[] = []

  try {
    const supabase = await createClient()

    const { data: transactions } = await supabase.from("Funded_jobs101").select("*")
    const { data: profiles } = await supabase.from("profiles").select("id, full_name, email")

    // Create profile lookup map
    const profileMap = new Map()
    profiles?.forEach((profile) => {
      profileMap.set(profile.id, profile)
    })

    // Calculate freelancer earnings (from payout_successful transactions)
    const freelancerEarnings = new Map()
    transactions?.forEach((transaction) => {
      if (transaction.payout_successful && transaction.freelancer_id) {
        const current = freelancerEarnings.get(transaction.freelancer_id) || { total: 0, jobs: 0 }
        freelancerEarnings.set(transaction.freelancer_id, {
          total: current.total + (transaction.amount || 0),
          jobs: current.jobs + 1,
        })
      }
    })

    // Calculate agency deposits (from successful transactions)
    const agencyDeposits = new Map()
    transactions?.forEach((transaction) => {
      if (transaction.job_confirmed && transaction.agency_id) {
        const current = agencyDeposits.get(transaction.agency_id) || { total: 0, jobs: 0 }
        agencyDeposits.set(transaction.agency_id, {
          total: current.total + (transaction.amount || 0),
          jobs: current.jobs + 1,
        })
      }
    })

    const freelancersList: TopFreelancer[] = []
    freelancerEarnings.forEach((earnings, freelancerId) => {
      const profile = profileMap.get(freelancerId)
      if (profile) {
        freelancersList.push({
          id: freelancerId,
          full_name: profile.full_name || "Unknown",
          email: profile.email || "Unknown",
          total_earnings: earnings.total,
          completed_jobs: earnings.jobs,
        })
      }
    })

    // Build top agencies list
    const agenciesList: TopAgency[] = []
    agencyDeposits.forEach((deposits, agencyId) => {
      const profile = profileMap.get(agencyId)
      if (profile) {
        agenciesList.push({
          id: agencyId,
          full_name: profile.full_name || "Unknown",
          email: profile.email || "Unknown",
          total_deposits: deposits.total,
          funded_jobs: deposits.jobs,
        })
      }
    })

    // Sort by earnings/deposits (highest first)
    freelancersList.sort((a, b) => b.total_earnings - a.total_earnings)
    agenciesList.sort((a, b) => b.total_deposits - a.total_deposits)

    topFreelancers = freelancersList.slice(0, 20) // Top 20
    topAgencies = agenciesList.slice(0, 20) // Top 20
  } catch (error) {
    console.error("Error loading analytics:", error)
  }

  return (
    <AnalyticsClient
      initialTopFreelancers={topFreelancers}
      initialTopAgencies={topAgencies}
    />
  )
}
