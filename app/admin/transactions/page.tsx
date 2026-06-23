import { redirect } from "next/navigation"
import TransactionsClient from "./TransactionsClient"
import { getFullUserData } from "@/app/actions/user"
import { createClient } from "@/lib/supabase-server"

type GroupedTransactions = {
  [key: string]: {
    user_name: string
    user_id: string
    transactions: any[]
    total_amount: number
  }
}

export default async function AdminTransactionsPage() {
  // Admin guard — authenticate before fetching any transaction data.
  const userData = await getFullUserData()

  if (!userData?.user) {
    redirect("/admin/login")
  }
  if (userData.profile?.account_type !== "admin") {
    redirect("/admin/login")
  }

  // Replicate the client's loadTransactions() on the server: fetch the funded
  // jobs, resolve agency/freelancer names, and group exactly as before.
  const supabase = await createClient()
  const { data: transactionsData } = await supabase
    .from("Funded_jobs101")
    .select("*")
    .order("created_at", { ascending: false })

  const transactions = transactionsData || []

  const agencyIds = [...new Set(transactions.map((t) => t.agency_id).filter(Boolean))]
  const freelancerIds = [...new Set(transactions.map((t) => t.freelancer_id).filter(Boolean))]

  const [{ data: agencyProfiles }, { data: freelancerProfiles }] = await Promise.all([
    supabase.from("profiles").select("id, full_name").in("id", agencyIds),
    supabase.from("profiles").select("id, full_name").in("id", freelancerIds),
  ])

  const agencyMap = new Map(agencyProfiles?.map((p) => [p.id, p]) || [])
  const freelancerMap = new Map(freelancerProfiles?.map((p) => [p.id, p]) || [])

  const groupedAgencies: GroupedTransactions = {}
  const groupedFreelancers: GroupedTransactions = {}

  transactions.forEach((transaction) => {
    if (transaction.agency_id) {
      const agency = agencyMap.get(transaction.agency_id)
      const agencyId = transaction.agency_id
      if (!groupedAgencies[agencyId]) {
        groupedAgencies[agencyId] = {
          user_name: agency?.full_name || "Unknown Agency",
          user_id: agencyId,
          transactions: [],
          total_amount: 0,
        }
      }
      groupedAgencies[agencyId].transactions.push({ ...transaction, agency_name: agency?.full_name })
      groupedAgencies[agencyId].total_amount += transaction.amount || 0
    }

    if (transaction.freelancer_id) {
      const freelancer = freelancerMap.get(transaction.freelancer_id)
      const freelancerId = transaction.freelancer_id
      if (!groupedFreelancers[freelancerId]) {
        groupedFreelancers[freelancerId] = {
          user_name: freelancer?.full_name || "Unknown Freelancer",
          user_id: freelancerId,
          transactions: [],
          total_amount: 0,
        }
      }
      groupedFreelancers[freelancerId].transactions.push({ ...transaction, freelancer_name: freelancer?.full_name })
      groupedFreelancers[freelancerId].total_amount += transaction.amount || 0
    }
  })

  return (
    <TransactionsClient
      initialAgencyTransactions={groupedAgencies}
      initialFreelancerTransactions={groupedFreelancers}
    />
  )
}
