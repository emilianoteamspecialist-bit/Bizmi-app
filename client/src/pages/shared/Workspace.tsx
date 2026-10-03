import { useState } from "react"
import { Link, useParams } from "react-router-dom"
import { CheckCircle, ExternalLink, Loader2, MessageSquare, Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import EscrowStatusBadge from "@/components/shared/EscrowStatusBadge"
import { useAuth } from "@/contexts/AuthContext"
import {
  formatKobo,
  useApproveSubmissionMutation,
  usePostCommentMutation,
  useSubmissionCommentsQuery,
  useSubmitWorkMutation,
  useWorkspaceQuery,
  type Submission,
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

export default function Workspace() {
  const { jobId = "" } = useParams()
  const workspaceQuery = useWorkspaceQuery(jobId)
  const approve = useApproveSubmissionMutation(jobId)
  const [approveError, setApproveError] = useState("")

  if (workspaceQuery.isLoading) {
    return <div className="min-h-screen bg-surface flex items-center justify-center text-sm text-muted-foreground">Loading workspace…</div>
  }
  if (workspaceQuery.isError || !workspaceQuery.data) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="text-center space-y-2">
          <p className="text-sm font-semibold text-foreground">Workspace not available</p>
          <p className="text-sm text-muted-foreground">Only the agency and freelancer on a funded job can open its workspace.</p>
        </div>
      </div>
    )
  }

  const { role, job, escrow, submission } = workspaceQuery.data
  const isFreelancer = role === "freelancer"
  const canSubmit = isFreelancer && escrow.status === "funded" && submission?.status !== "approved" && submission?.status !== "submitted"
  const canReview = !isFreelancer && escrow.status === "funded" && submission?.status === "submitted"

  const handleApprove = () => {
    if (!submission) return
    if (!confirm(`Approve this work and release ${formatKobo(escrow.amount_kobo)} to the freelancer? This can't be undone.`)) return
    setApproveError("")
    approve.mutate(submission.id, { onError: (err) => setApproveError(err instanceof Error ? err.message : "Approval failed") })
  }

  return (
    <div className="min-h-screen bg-surface pb-20">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <header className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Workspace</p>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">{job?.title ?? "Job"}</h1>
            <EscrowStatusBadge status={escrow.status} />
          </div>
          <p className="text-sm text-muted-foreground">
            {formatKobo(escrow.amount_kobo)} held in escrow ·{" "}
            <Link to={isFreelancer ? "/freelancer/funded-jobs" : "/agency/wallet"} className="text-primary hover:underline">
              {isFreelancer ? "Funded jobs" : "Wallet"}
            </Link>
          </p>
        </header>

        <section className="rounded-xl border border-border bg-card p-5 space-y-4" aria-labelledby="delivery-heading">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="delivery-heading" className="text-sm font-semibold text-foreground">Delivery</h2>
            {submission && <span className="text-xs text-muted-foreground">{SUBMISSION_STATUS_LABEL[submission.status]}</span>}
          </div>

          {escrow.status === "disputed" && <p className="text-sm text-destructive">This job is in dispute; delivery and approval are paused.</p>}
          {(escrow.status === "released" || escrow.status === "paid_out") && (
            <p className="text-sm text-success flex items-center gap-1.5">
              <CheckCircle className="h-4 w-4" /> Work approved and payment released.
            </p>
          )}

          {submission && <SubmissionView submission={submission} />}
          {!submission && !canSubmit && <p className="text-sm text-muted-foreground">No work has been submitted yet.</p>}
          {canSubmit && <SubmitWorkForm jobId={jobId} existing={submission} />}

          {canReview && (
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border">
              <Button onClick={handleApprove} disabled={approve.isPending} className="gap-1.5">
                {approve.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                Approve & release payment
              </Button>
              <p className="text-xs text-muted-foreground">Not right yet? Use "Request changes" below.</p>
              {approveError && <p className="w-full text-sm text-destructive">{approveError}</p>}
            </div>
          )}
        </section>

        {submission && <Comments submission={submission} jobId={jobId} canRequestChanges={canReview} />}
      </div>
    </div>
  )
}
