import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/auth"
import { getFreelancerProposals } from "@/app/actions/jobs"
import ProposalsClient from "./ProposalsClient"

export default async function ProposalsPage() {
  const user = await getCurrentUser()
  if (!user) {
    redirect("/login")
  }

  // Initial page fetched server-side; the client handles search + load-more.
  const { proposals, hasMore } = await getFreelancerProposals({ offset: 0, limit: 15 })

  return (
    <ProposalsClient
      initialProposals={proposals}
      initialHasMore={hasMore}
      initialOffset={proposals.length}
    />
  )
}
