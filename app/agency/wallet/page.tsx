import { redirect } from "next/navigation"
import WalletClient from "./WalletClient"
import { getFullUserData } from "@/app/actions/user"
import { createClient } from "@/lib/supabase-server"

export default async function AgencyWalletPage() {
  // Authenticate first, then redirect by account type — same source-of-truth
  // pattern as the agency dashboard.
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

  const userId = userData.user.id
  const supabase = await createClient()

  // Replicates the same table/columns/filters the client used on mount.
  const [profileResult, transactionResult, fundedJobsResult] = await Promise.all([
    supabase.from("profiles").select("wallet_balance").eq("id", userId).single(),
    supabase
      .from("agency_fundings")
      .select("*")
      .eq("agency_id", userId)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("Funded_jobs101")
      .select("*")
      .eq("agency_id", userId)
      .order("funded_at", { ascending: false }),
  ])

  const initialWalletBalance = profileResult.data?.wallet_balance || 0
  const initialTransactions = transactionResult.data || []
  const initialFundedJobs = fundedJobsResult.data || []

  return (
    <WalletClient
      initialWalletBalance={initialWalletBalance}
      initialTransactions={initialTransactions}
      initialFundedJobs={initialFundedJobs}
    />
  )
}
