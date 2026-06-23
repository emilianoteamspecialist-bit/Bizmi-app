import { redirect } from "next/navigation"
import AdminCreditsClient from "./AdminCreditsClient"
import { getFullUserData } from "@/app/actions/user"
import { createClient } from "@/lib/supabase-server"

export default async function AdminCreditsPage() {
  const userData = await getFullUserData()

  if (!userData?.user) {
    redirect("/admin/login")
  }
  if (userData.profile?.account_type !== "admin") {
    redirect("/admin/login")
  }

  // Initial data fetched server-side — same tables/columns/filters as the
  // client's loadData() refetch (the source of truth).
  const supabase = await createClient()

  const [purchasesResult, freelancersResult] = await Promise.all([
    supabase.from("purchase_credits").select("*, profiles(full_name)").order("created_at", { ascending: false }),
    supabase
      .from("profiles")
      .select("id, full_name, created_at, updated_at, account_type")
      .eq("account_type", "freelancer")
      .order("created_at", { ascending: false }),
  ])

  const creditPurchases = purchasesResult.data || []
  const freelancers = freelancersResult.data || []
  const totalCredits = creditPurchases.reduce(
    (sum, purchase) => sum + (purchase.credits_amount || 0),
    0,
  )

  return (
    <AdminCreditsClient
      initialCreditPurchases={creditPurchases}
      initialFreelancers={freelancers}
      initialTotalCredits={totalCredits}
    />
  )
}
