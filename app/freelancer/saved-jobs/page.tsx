import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/auth"
import { getSavedJobs } from "@/app/actions/jobs"
import SavedJobsClient from "./SavedJobsClient"

export default async function SavedJobsPage() {
  const user = await getCurrentUser()
  if (!user) {
    redirect("/login")
  }

  const savedJobs = await getSavedJobs()

  return <SavedJobsClient initialSavedJobs={savedJobs} />
}
