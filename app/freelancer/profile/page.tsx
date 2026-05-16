import { redirect } from "next/navigation"
import ProfileClient from "./ProfileClient"
import { getFullUserData } from "@/app/actions/user"
import { createClient } from "@/lib/supabase-server"
import { resolveAvatar } from "@/lib/avatar-url"

export default async function FreelancerProfilePage() {
  const userData = await getFullUserData()

  if (!userData?.user) {
    redirect("/login")
  }

  const { user, profile } = userData
  const supabase = await createClient()

  const { data: logoData } = await supabase
    .from("freelancer_logos")
    .select("logo_path, logo_data")
    .eq("freelancer_id", user.id)
    .single()

  return (
    <ProfileClient
      initialUser={user}
      initialProfile={profile || null}
      initialLogo={resolveAvatar(logoData)}
    />
  )
}
