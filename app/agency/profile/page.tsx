import { redirect } from "next/navigation"
import AgencyProfileClient from "./AgencyProfileClient"
import { getFullUserData, getAgencyImage } from "@/app/actions/user"

export default async function AgencyProfilePage() {
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

  // Agency profile image fetched server-side — same source of truth pattern as
  // the agency dashboard. getAgencyImage() returns the resolved avatar string.
  const image = await getAgencyImage()

  return (
    <AgencyProfileClient
      initialProfile={profile || null}
      initialProfileImage={image || ""}
    />
  )
}
