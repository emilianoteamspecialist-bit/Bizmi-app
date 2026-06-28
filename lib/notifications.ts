import "server-only"
import { createServiceRoleClient } from "@/lib/supabase-service"
import { sendEmail, emailLayout } from "@/lib/email"

// Transactional email senders, one per event. Each resolves its own recipient
// + context from the DB (service-role, so RLS never blocks a cross-party
// lookup) and is fully fail-soft: any error is logged and swallowed so the
// triggering action (placing a bid, a payout, etc.) is never affected.

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || "https://bizimii.com").replace(/\/$/, "")

const naira = (n: number) => `₦${Number(n || 0).toLocaleString()}`

// HTML-escape user-controlled values (freelancer names, job titles) before
// embedding them in email markup, so they can't inject links or formatting.
const esc = (s: unknown) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")

/** A freelancer submitted a proposal → tell the agency that owns the job. */
export async function notifyAgencyNewProposal(jobId: string, freelancerName?: string | null) {
  try {
    const service = createServiceRoleClient()
    const { data: job } = await service
      .from("jobs")
      .select("title, agency_id")
      .eq("id", jobId)
      .maybeSingle()
    if (!job?.agency_id) return

    const { data: agency } = await service
      .from("profiles")
      .select("email")
      .eq("id", job.agency_id)
      .maybeSingle()
    if (!agency?.email) return

    await sendEmail({
      to: agency.email,
      subject: `New proposal on “${job.title}”`,
      html: emailLayout({
        heading: "You have a new proposal",
        body: `${esc(freelancerName || "A freelancer")} just submitted a proposal on your job <strong>${esc(job.title)}</strong>. Review it and respond from your dashboard.`,
        cta: { label: "Review proposals", url: `${APP_URL}/agency/dashboard` },
      }),
    })
  } catch (e) {
    console.error("[notify] notifyAgencyNewProposal failed:", e)
  }
}

/** Agency accepted/rejected a proposal → tell the freelancer who submitted it. */
export async function notifyFreelancerProposalDecision(proposalId: string, action: "accept" | "reject") {
  try {
    const service = createServiceRoleClient()
    const { data: proposal } = await service
      .from("proposals")
      .select("freelancer_id, jobs(title)")
      .eq("id", proposalId)
      .maybeSingle()
    if (!proposal?.freelancer_id) return

    const { data: freelancer } = await service
      .from("profiles")
      .select("email")
      .eq("id", proposal.freelancer_id)
      .maybeSingle()
    if (!freelancer?.email) return

    const jobTitle = (proposal as any).jobs?.title || "a job"
    const accepted = action === "accept"

    await sendEmail({
      to: freelancer.email,
      subject: accepted ? `Your proposal was accepted 🎉` : `Update on your proposal`,
      html: emailLayout({
        heading: accepted ? "Your proposal was accepted" : "Your proposal wasn't selected",
        body: accepted
          ? `Great news — the agency accepted your proposal on <strong>${esc(jobTitle)}</strong>. Once they fund the job into escrow, you can verify it and start work.`
          : `The agency has moved forward with another freelancer on <strong>${esc(jobTitle)}</strong>. Keep applying — new jobs are posted every day.`,
        cta: { label: "Open dashboard", url: `${APP_URL}/freelancer/proposals` },
      }),
    })
  } catch (e) {
    console.error("[notify] notifyFreelancerProposalDecision failed:", e)
  }
}

/** A payout was initiated to a freelancer → send them a confirmation. */
export async function notifyFreelancerPayout(freelancerId: string, jobId: string, amountNaira: number) {
  try {
    const service = createServiceRoleClient()
    const [{ data: freelancer }, { data: job }] = await Promise.all([
      service.from("profiles").select("email").eq("id", freelancerId).maybeSingle(),
      service.from("jobs").select("title").eq("id", jobId).maybeSingle(),
    ])
    if (!freelancer?.email) return

    await sendEmail({
      to: freelancer.email,
      subject: `Your payout of ${naira(amountNaira)} is on its way`,
      html: emailLayout({
        heading: "Payout initiated",
        body: `Your payout of <strong>${naira(amountNaira)}</strong> for <strong>${esc(job?.title || "your job")}</strong> has been initiated to your saved bank account. It usually arrives within 24–48 hours.`,
        cta: { label: "View funded jobs", url: `${APP_URL}/freelancer/funded-jobs` },
      }),
    })
  } catch (e) {
    console.error("[notify] notifyFreelancerPayout failed:", e)
  }
}
