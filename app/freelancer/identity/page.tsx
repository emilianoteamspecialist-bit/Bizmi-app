import { redirect } from "next/navigation"
import IdentityClient from "./IdentityClient"
import { getFullUserData } from "@/app/actions/user"
import { createClient } from "@/lib/supabase-server"

export default async function IdentityPage() {
  // Authenticate first, then redirect by account type — same source-of-truth
  // pattern as the agency/freelancer dashboards.
  const userData = await getFullUserData()

  if (!userData?.user) {
    redirect("/login")
  }

  const { profile } = userData

  if (profile?.account_type === "agency") {
    redirect("/agency/dashboard")
  }
  if (profile?.account_type === "admin") {
    redirect("/admin/dashboard")
  }

  // Fetch the existing verification record server-side — same
  // freelancer_verification query (columns, filter) the client ran on mount.
  const supabase = await createClient()
  const { data: verification } = await supabase
    .from("freelancer_verification")
    .select("nin, status, created_at")
    .eq("freelancer_id", userData.user.id)
    .maybeSingle()

  return <IdentityClient initialVerification={verification ?? null} />
}
