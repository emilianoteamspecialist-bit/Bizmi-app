import { redirect } from "next/navigation"
import { getInfluencerData } from "@/lib/influencer"
import InfluencerDashboardClient from "./InfluencerDashboardClient"

export default async function InfluencerDashboardPage() {
  const data = await getInfluencerData()
  if (!data) redirect("/login")

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "")
  return <InfluencerDashboardClient data={data} appUrl={appUrl} />
}
