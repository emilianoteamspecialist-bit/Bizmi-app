import { PageContainer } from "@/components/marketplace/primitives"

type Section = { title: string; intro?: string; points: string[]; warning?: boolean }

// Policy wording is the platform's own; only the presentation lives here.
const SECTIONS: Section[] = [
  {
    title: "Single Account Rule",
    points: [
      "Each freelancer is permitted to maintain only one account on Bizimi.",
      "Creating, attempting to create, or maintaining duplicate accounts is strictly prohibited.",
      "If any freelancer is found with duplicate accounts, all related accounts will be permanently banned.",
    ],
  },
  {
    title: "Authenticity Requirement",
    points: [
      "Freelancers must provide accurate and truthful information when creating their profiles.",
      "Misrepresentation of identity, skills, or credentials is not allowed.",
      "All freelancers must be authentic and genuine individuals; impersonation of another person or entity will lead to account termination.",
    ],
  },
  {
    title: "Profile Image Policy",
    points: [
      "Every freelancer must upload a clear and real photo of themselves as their profile avatar.",
      "Use of logos, cartoons, celebrities, AI-generated images, or any other non-personal images as a profile avatar is prohibited.",
      "This ensures proper visibility, transparency, and trust between freelancers and clients.",
    ],
  },
  {
    title: "NIN Verification Requirement",
    points: [
      "To enhance security and trust, every freelancer is required to complete NIN (National Identification Number) verification within 30 days of creating an account.",
      "Freelancers who fail to complete NIN verification within this timeframe will have their accounts suspended or permanently banned.",
      "Any freelancer found to have provided false or invalid NIN information will be removed from the platform.",
    ],
  },
  {
    title: "Consequences of Violation",
    warning: true,
    intro: "Violation of any part of this policy will result in one or more of the following actions:",
    points: [
      "Immediate suspension of the freelancer's account.",
      "Permanent ban from the Bizimi platform.",
      "Loss of access to ongoing projects and withdrawal of pending payments (subject to Bizimi's Terms of Service).",
    ],
  },
  {
    title: "Right to Review",
    points: [
      "Bizimi reserves the right to review, investigate, and take action on any freelancer account suspected of violating this policy.",
      "Decisions made by Bizimi regarding duplicate accounts, authenticity, and verification are final and binding.",
    ],
  },
]

export default function FreelancerPolicyPage() {
  return (
    <PageContainer width="narrow">
      <article className="mx-auto max-w-2xl">
        <header>
          <h1 className="font-heading text-xl font-semibold tracking-tight text-foreground sm:text-2xl">Bizimi Freelancer Duplicates &amp; Verification Policy</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            At Bizimi, we are committed to maintaining a safe, authentic, and trustworthy platform for freelancers and clients.
          </p>
        </header>

        <ol className="mt-6 divide-y divide-border rounded-lg border border-border bg-card">
          {SECTIONS.map((section, i) => (
            <li key={section.title} className="p-5">
              <h2 className="flex items-baseline gap-2 font-heading text-base font-semibold text-foreground">
                <span className={section.warning ? "text-destructive" : "text-muted-foreground"}>{i + 1}.</span>
                {section.title}
              </h2>
              {section.intro && <p className="mt-2 text-sm text-foreground">{section.intro}</p>}
              <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-muted-foreground marker:text-border">
                {section.points.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </article>
    </PageContainer>
  )
}
