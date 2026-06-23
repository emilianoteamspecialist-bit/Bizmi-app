import { redirect } from "next/navigation"
import BizpalClient from "./BizpalClient"
import { getFullUserData } from "@/app/actions/user"
import { createClient } from "@/lib/supabase-server"

export default async function BizpalPage() {
  // Authenticate first, then redirect by account type — same source-of-truth
  // pattern as the freelancer/agency dashboards.
  const userData = await getFullUserData()

  if (!userData?.user) {
    redirect("/login")
  }

  const { user, profile } = userData

  if (profile?.account_type === "agency") {
    redirect("/agency/dashboard")
  }
  if (profile?.account_type === "admin") {
    redirect("/admin/dashboard")
  }

  // Replicate the client's initial mount queries server-side (same tables,
  // columns and filters), scoped to this user.
  const supabase = await createClient()

  const [completedRes, historyRes] = await Promise.all([
    supabase
      .from("purchase_credits")
      .select("credits_amount, status")
      .eq("freelancer_id", user.id)
      .eq("status", "completed"),
    supabase
      .from("purchase_credits")
      .select("*")
      .eq("freelancer_id", user.id)
      .order("created_at", { ascending: false }),
  ])

  // Net credits from completed purchases (positive purchases minus deductions),
  // floored at 0 — identical to loadBizpalData().
  const totalCreditsFromPurchases = (completedRes.data || []).reduce(
    (sum, purchase) => sum + (purchase.credits_amount || 0),
    0,
  )
  const initialCurrentCredits = Math.max(0, totalCreditsFromPurchases)

  const initialCreditPurchases = historyRes.data || []

  return (
    <BizpalClient
      initialCreditPurchases={initialCreditPurchases}
      initialCurrentCredits={initialCurrentCredits}
    />
  )
}
