import { useState } from "react"
import { Link, useParams } from "react-router-dom"
import { Check, CheckCircle, ExternalLink, Loader2, MessageSquare, Send, ShieldAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import EscrowStatusBadge from "@/components/shared/EscrowStatusBadge"
import { ErrorState, FactList, PageContainer, Panel, SkeletonBlock } from "@/components/marketplace/primitives"
import { cn } from "@/lib/utils"
import { useAuth } from "@/contexts/AuthContext"
import {
  formatKobo,
  useApproveSubmissionMutation,
  usePostCommentMutation,
  useSubmissionCommentsQuery,
  useSubmitWorkMutation,
  useWorkspaceQuery,
  type Submission,
  type Workspace as WorkspaceData,
} from "@/lib/queries/escrow"

const SUBMISSION_STATUS_LABEL: Record<Submission["status"], string> = {
  draft: "Draft",
  submitted: "Submitted — awaiting review",
  changes_requested: "Changes requested",
  approved: "Approved",
}

function SubmitWorkForm({ jobId, existing }: { jobId: string; existing: Submission | null }) {
  const submit = useSubmitWorkMutation(jobId)
  const [type, setType] = useState<Submission["submission_type"]>(existing?.submission_type ?? "general")
  const [githubUrl, setGithubUrl] = useState(existing?.content.github_url ?? "")
  const [figmaUrl, setFigmaUrl] = useState(existing?.content.figma_url ?? "")
  const [driveLink, setDriveLink] = useState(existing?.content.drive_link ?? "")
  const [notes, setNotes] = useState(existing?.content.notes ?? "")
  const [error, setError] = useState("")

  const hasSomething = [githubUrl, figmaUrl, driveLink, notes].some((v) => v.trim())

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        setError("")
        const content = Object.fromEntries(
          Object.entries({ github_url: githubUrl, figma_url: figmaUrl, drive_link: driveLink, notes }).filter(([, v]) => v.trim())
        )
        submit.mutate({ submission_type: type, content }, { onError: (err) => setError(err instanceof Error ? err.message : "Submission failed") })
      }}
      className="space-y-3"
    >
      <div className="space-y-1.5">
        <Label htmlFor="submission-type">Type of work</Label>
        <select
          id="submission-type"
          value={type}
          onChange={(e) => setType(e.target.value as Submission["submission_type"])}
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="general">General</option>
          <option value="tech">Development</option>
          <option value="design">Design</option>
          <option value="writing">Writing</option>
        </select>
      </div>
      {(type === "tech" || type === "general") && (
        <div className="space-y-1.5">
          <Label htmlFor="github-url">Repository / deployment link</Label>
          <Input id="github-url" type="url" value={githubUrl} onChange={(e) => setGithubUrl(e.target.value)} placeholder="https://github.com/…" />
        </div>
      )}
      {(type === "design" || type === "general") && (
        <div className="space-y-1.5">
          <Label htmlFor="figma-url">Design link</Label>
          <Input id="figma-url" type="url" value={figmaUrl} onChange={(e) => setFigmaUrl(e.target.value)} placeholder="https://figma.com/…" />
        </div>
      )}
      <div className="space-y-1.5">
        <Label htmlFor="drive-link">Files link</Label>
        <Input id="drive-link" type="url" value={driveLink} onChange={(e) => setDriveLink(e.target.value)} placeholder="https://drive.google.com/…" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="notes">Notes for the agency</Label>
        <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={submit.isPending || !hasSomething}>
        {submit.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : existing ? "Resubmit work" : "Submit work"}
      </Button>
    </form>
  )
}

function SubmissionView({ submission }: { submission: Submission }) {
  const links: [string, string | undefined][] = [
    ["Repository / deployment", submission.content.github_url],
    ["Design", submission.content.figma_url],
    ["Files", submission.content.drive_link],
  ]
  return (
    <div className="space-y-3 text-sm">
      {links
        .filter(([, url]) => url)
        .map(([label, url]) => (
          <a key={label} href={url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-primary hover:underline break-all">
            <ExternalLink className="h-3.5 w-3.5 shrink-0" /> {label}: {url}
          </a>
        ))}
      {submission.content.notes && <p className="whitespace-pre-wrap text-muted-foreground">{submission.content.notes}</p>}
      {submission.submitted_at && <p className="text-xs text-muted-foreground">Submitted {new Date(submission.submitted_at).toLocaleString()}</p>}
    </div>
  )
}

function Comments({ submission, jobId, canRequestChanges }: { submission: Submission; jobId: string; canRequestChanges: boolean }) {
  const { user } = useAuth()
  const commentsQuery = useSubmissionCommentsQuery(submission.id)
  const post = usePostCommentMutation(submission.id, jobId)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  const send = (isRevisionRequest: boolean) => {
    setError("")
    post.mutate(
      { message: message.trim(), is_revision_request: isRevisionRequest },
      { onSuccess: () => setMessage(""), onError: (err) => setError(err instanceof Error ? err.message : "Could not send") }
    )
  }

  return (
    <section className="rounded-xl border border-border bg-card p-5 space-y-4" aria-labelledby="feedback-heading">
      <h2 id="feedback-heading" className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <MessageSquare className="h-4 w-4" /> Feedback
      </h2>
      <div className="space-y-3">
        {(commentsQuery.data?.comments ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">No feedback yet.</p>
        ) : (
          commentsQuery.data!.comments.map((c) => (
            <div key={c.id} className="text-sm">
              <p className="text-xs text-muted-foreground">
                {c.sender_id === user?.id ? "You" : c.sender?.full_name ?? "Participant"} · {new Date(c.created_at).toLocaleString()}
              </p>
              <p className="whitespace-pre-wrap text-foreground">{c.message}</p>
            </div>
          ))
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="comment" className="sr-only">
          Message
        </Label>
        <Textarea id="comment" value={message} onChange={(e) => setMessage(e.target.value)} rows={3} placeholder="Write a message…" />
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex flex-wrap gap-2">
          <Button size="sm" className="gap-1.5" onClick={() => send(false)} disabled={post.isPending || !message.trim()}>
            <Send className="h-3.5 w-3.5" /> Send
          </Button>
          {canRequestChanges && (
            <Button size="sm" variant="outline" onClick={() => send(true)} disabled={post.isPending || !message.trim()}>
              Request changes
            </Button>
          )}
        </div>
      </div>
    </section>
  )
}

const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" }) : null)

/** The engagement's money trail, in order. */
function PaymentTimeline({ data }: { data: WorkspaceData }) {
  const { escrow, submission } = data
  const steps = [
    { label: "Paid into escrow", date: escrow.funded_at, done: !!escrow.funded_at || escrow.status !== "awaiting" },
    { label: "Work submitted", date: submission?.submitted_at, done: !!submission && submission.status !== "draft" },
    { label: "Approved and released", date: escrow.released_at, done: ["released", "paid_out"].includes(escrow.status) },
    { label: "Paid out to freelancer", date: escrow.paid_out_at, done: escrow.status === "paid_out" },
  ]
  return (
    <ol className="space-y-3" aria-label="Payment progress">
      {steps.map((step, i) => (
        <li key={step.label} className="flex gap-3">
          <span
            className={cn(
              "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold",
              step.done ? "border-success bg-success text-white" : "border-border text-muted-foreground"
            )}
            aria-hidden
          >
            {step.done ? <Check className="h-3 w-3" /> : i + 1}
          </span>
          <div className="min-w-0">
            <p className={cn("text-sm", step.done ? "font-medium text-foreground" : "text-muted-foreground")}>
              {step.label}
              <span className="sr-only">{step.done ? " (done)" : " (not yet)"}</span>
            </p>
            {step.done && fmtDate(step.date) && <p className="text-xs text-muted-foreground">{fmtDate(step.date)}</p>}
          </div>
        </li>
      ))}
    </ol>
  )
}

export default function Workspace() {
  const { jobId = "" } = useParams()
  const workspaceQuery = useWorkspaceQuery(jobId)
  const approve = useApproveSubmissionMutation(jobId)
  const [approveError, setApproveError] = useState("")

  if (workspaceQuery.isLoading) {
    return (
      <PageContainer>
        <div className="space-y-4" aria-label="Loading workspace">
          <SkeletonBlock className="h-8 w-80" />
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            <SkeletonBlock className="h-72" />
            <SkeletonBlock className="h-72" />
          </div>
        </div>
      </PageContainer>
    )
  }
  if (workspaceQuery.isError || !workspaceQuery.data) {
    return (
      <PageContainer width="narrow">
        <ErrorState title="Workspace not available" description="Only the agency and freelancer on a funded job can open its workspace." />
      </PageContainer>
    )
  }

  const data = workspaceQuery.data
  const { role, job, escrow, submission } = data
  const isFreelancer = role === "freelancer"
  const canSubmit = isFreelancer && escrow.status === "funded" && submission?.status !== "approved" && submission?.status !== "submitted"
  const canReview = !isFreelancer && escrow.status === "funded" && submission?.status === "submitted"
  const otherParty = isFreelancer ? data.parties?.agency_name : data.parties?.freelancer_name
  const home = isFreelancer ? { to: "/freelancer/funded-jobs", label: "My jobs" } : { to: "/agency/wallet", label: "Payments" }

  const handleApprove = () => {
    if (!submission) return
    if (!confirm(`Approve this work and release ${formatKobo(escrow.amount_kobo)} to the freelancer? This can't be undone.`)) return
    setApproveError("")
    approve.mutate(submission.id, { onError: (err) => setApproveError(err instanceof Error ? err.message : "Approval failed") })
  }

  return (
    <PageContainer>
      <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
        <Link to={home.to} className="hover:text-foreground hover:underline">
          {home.label}
        </Link>
        <span className="mx-1.5" aria-hidden>
          /
        </span>
        <span className="text-foreground">Workspace</span>
      </nav>

      <div className="mt-2 min-w-0">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-heading text-xl font-semibold tracking-tight text-foreground sm:text-2xl">{job?.title ?? "Job"}</h1>
          <EscrowStatusBadge status={escrow.status} />
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {isFreelancer ? "Client" : "Freelancer"}: <span className="font-medium text-foreground">{otherParty ?? "—"}</span> ·{" "}
          <span className="tabular-nums">{formatKobo(escrow.amount_kobo)}</span> held in escrow
        </p>
      </div>

      {escrow.status === "disputed" && (
        <div role="status" className="mt-4 flex flex-col gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-start gap-2 text-sm text-foreground">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden />
            This job is in dispute. Delivery and approval are paused until it's resolved.
          </p>
          {data.open_dispute_id && (
            <Button asChild size="sm" variant="outline">
              <Link to={`/disputes/${data.open_dispute_id}`}>Open dispute room</Link>
            </Button>
          )}
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-5">
          <section className="rounded-lg border border-border bg-card" aria-labelledby="delivery-heading">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
              <h2 id="delivery-heading" className="text-sm font-semibold text-foreground">
                Deliverables
              </h2>
              {submission && <span className="text-xs text-muted-foreground">{SUBMISSION_STATUS_LABEL[submission.status]}</span>}
            </div>
            <div className="space-y-4 p-4">
              {(escrow.status === "released" || escrow.status === "paid_out") && (
                <p className="flex items-center gap-1.5 text-sm text-success">
                  <CheckCircle className="h-4 w-4" /> Work approved and payment released.
                </p>
              )}
              {submission && <SubmissionView submission={submission} />}
              {!submission && !canSubmit && (
                <p className="text-sm text-muted-foreground">{isFreelancer ? "Nothing to submit right now." : "No work has been submitted yet."}</p>
              )}
              {canSubmit && <SubmitWorkForm jobId={jobId} existing={submission} />}
              {canReview && (
                <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
                  <Button onClick={handleApprove} disabled={approve.isPending}>
                    {approve.isPending ? <Loader2 className="animate-spin" /> : <CheckCircle />}
                    Approve & release payment
                  </Button>
                  <p className="text-xs text-muted-foreground">Not right yet? Use "Request changes" in the feedback below.</p>
                  {approveError && <p className="w-full text-sm text-destructive">{approveError}</p>}
                </div>
              )}
            </div>
          </section>

          {submission && <Comments submission={submission} jobId={jobId} canRequestChanges={canReview} />}
        </div>

        <aside className="space-y-5" aria-label="Contract details">
          <Panel title="Contract">
            <FactList
              items={[
                { label: "Contract value", value: formatKobo(escrow.amount_kobo) },
                { label: "Client", value: data.parties?.agency_name ?? "—" },
                { label: "Freelancer", value: data.parties?.freelancer_name ?? "—" },
                ...(job?.duration ? [{ label: "Duration", value: job.duration }] : []),
              ]}
            />
          </Panel>
          <Panel title="Payment">
            <PaymentTimeline data={data} />
            <p className="mt-4 text-xs text-muted-foreground">Money stays in escrow until the client approves the work.</p>
          </Panel>
          <Panel title="Actions" bodyClassName="space-y-2">
            <Button asChild variant="outline" className="w-full">
              <Link to={`/${role}/messages`}>
                <MessageSquare /> Message {isFreelancer ? "client" : "freelancer"}
              </Link>
            </Button>
            {data.open_dispute_id ? (
              <Button asChild variant="ghost" className="w-full">
                <Link to={`/disputes/${data.open_dispute_id}`}>View dispute</Link>
              </Button>
            ) : (
              escrow.status === "funded" && (
                <p className="text-xs text-muted-foreground">
                  Problem with this job? You can open a dispute from{" "}
                  <Link to={home.to} className="font-medium text-primary hover:underline">
                    {home.label}
                  </Link>
                  .
                </p>
              )
            )}
          </Panel>
        </aside>
      </div>
    </PageContainer>
  )
}
