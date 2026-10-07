import { useEffect, useRef, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { Check, CheckCircle, Clock, Loader2, Send, ShieldAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { useAuth } from "@/contexts/AuthContext"
import { ErrorState, FactList, PageContainer, Panel, SkeletonBlock } from "@/components/marketplace/primitives"
import { formatNaira } from "@/lib/format"
import { cn } from "@/lib/utils"
import {
  DISPUTE_TYPE_LABELS,
  useDisputeQuery,
  usePostDisputeMessageMutation,
  useRealtimeDisputeMessages,
  type Dispute,
} from "@/lib/queries/escrow"

const STATUS: Record<Dispute["status"], { label: string; icon: typeof Clock; className: string }> = {
  in_platform_review: { label: "Talking it through", icon: Clock, className: "bg-warning/10 text-warning" },
  admin_intervention: { label: "With an admin", icon: ShieldAlert, className: "bg-destructive/10 text-destructive" },
  resolved: { label: "Resolved", icon: CheckCircle, className: "bg-success/10 text-success" },
}

const OUTCOME_LABEL: Record<string, string> = {
  full_release: "Payment released to the freelancer",
  refund: "Payment refunded to the agency",
  partial_release: "Partial release",
  none: "No action",
}

const fmtDate = (d: string) => new Date(d).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })
const fmtStamp = (d: string) =>
  new Date(d).toLocaleString("en-NG", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })

function StatusBadge({ status }: { status: Dispute["status"] }) {
  const s = STATUS[status] ?? STATUS.in_platform_review
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium", s.className)}>
      <s.icon className="h-3.5 w-3.5" aria-hidden /> {s.label}
    </span>
  )
}

/** Where the dispute is in its life: opened → talk it through → admin review → decision. */
function DisputeProgress({ dispute }: { dispute: Dispute }) {
  const resolved = dispute.status === "resolved"
  const withAdmin = dispute.status === "admin_intervention"
  const steps = [
    { label: "Dispute opened", detail: fmtDate(dispute.created_at), state: "done" as const },
    { label: "Talk it through here", detail: "Both sides explain and try to agree.", state: withAdmin || resolved ? ("done" as const) : ("current" as const) },
    { label: "Admin review", detail: "If there's no agreement in 3–7 days, an admin reads this conversation.", state: resolved ? ("done" as const) : withAdmin ? ("current" as const) : ("todo" as const) },
    {
      label: "Decision",
      detail: resolved && dispute.resolution_outcome ? OUTCOME_LABEL[dispute.resolution_outcome] ?? dispute.resolution_outcome : "The escrowed money is released, refunded or split.",
      state: resolved ? ("done" as const) : ("todo" as const),
    },
  ]
  return (
    <ol className="space-y-3" aria-label="Dispute progress">
      {steps.map((step, i) => (
        <li key={step.label} className="flex gap-3">
          <span
            className={cn(
              "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold",
              step.state === "done" && "border-success bg-success text-white",
              step.state === "current" && "border-primary text-primary",
              step.state === "todo" && "border-border text-muted-foreground"
            )}
            aria-hidden
          >
            {step.state === "done" ? <Check className="h-3 w-3" /> : i + 1}
          </span>
          <div className="min-w-0">
            <p className={cn("text-sm", step.state === "todo" ? "text-muted-foreground" : "font-medium text-foreground")}>
              {step.label}
              <span className="sr-only">{step.state === "done" ? " (done)" : step.state === "current" ? " (current step)" : " (not yet)"}</span>
            </p>
            <p className="text-xs text-muted-foreground">{step.detail}</p>
          </div>
        </li>
      ))}
    </ol>
  )
}

export default function DisputeRoom() {
  const { id = "" } = useParams()
  const { user } = useAuth()
  const disputeQuery = useDisputeQuery(id)
  const postMessage = usePostDisputeMessageMutation(id)
  useRealtimeDisputeMessages(id)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const endRef = useRef<HTMLDivElement>(null)

  const messages = disputeQuery.data?.messages ?? []
  useEffect(() => {
    endRef.current?.scrollIntoView?.({ behavior: "smooth", block: "nearest" })
  }, [messages.length])

  if (disputeQuery.isLoading) {
    return (
      <PageContainer>
        <div className="space-y-4" aria-label="Loading dispute">
          <SkeletonBlock className="h-8 w-80" />
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            <SkeletonBlock className="h-[480px]" />
            <SkeletonBlock className="h-72" />
          </div>
        </div>
      </PageContainer>
    )
  }
  if (disputeQuery.isError || !disputeQuery.data) {
    return (
      <PageContainer width="narrow">
        <ErrorState title="Dispute not available" description="It doesn't exist, or you're not one of the two parties in it." />
      </PageContainer>
    )
  }

  const { dispute } = disputeQuery.data
  const isResolved = dispute.status === "resolved"
  const iOpenedIt = user?.id === dispute.initiator_id
  const otherParty = (iOpenedIt ? dispute.respondent?.full_name : dispute.initiator?.full_name) ?? "the other party"
  const amount = formatNaira(dispute.amount_disputed) ?? "—"

  const send = () => {
    const text = message.trim()
    if (!text || postMessage.isPending) return
    setError("")
    postMessage.mutate(text, {
      onSuccess: () => setMessage(""),
      onError: (err) => setError(err instanceof Error ? err.message : "Couldn't send. Try again."),
    })
  }

  return (
    <PageContainer>
      <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
        <Link to={`/workspace/${dispute.job_id}`} className="hover:text-foreground hover:underline">
          Workspace
        </Link>
        <span className="mx-1.5" aria-hidden>
          /
        </span>
        <span className="text-foreground">Dispute</span>
      </nav>

      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h1 className="font-heading text-xl font-semibold tracking-tight text-foreground sm:text-2xl">Dispute: {dispute.job?.title ?? "Job"}</h1>
        <StatusBadge status={dispute.status} />
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        {DISPUTE_TYPE_LABELS[dispute.dispute_type] ?? dispute.dispute_type} · <span className="tabular-nums text-foreground">{amount}</span> frozen in escrow
      </p>

      {isResolved && dispute.resolution_outcome && (
        <div role="status" className="mt-4 flex items-start gap-2 rounded-lg border border-success/30 bg-success/5 p-4 text-sm text-foreground">
          <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden />
          <p>
            <span className="font-medium">Resolved:</span> {OUTCOME_LABEL[dispute.resolution_outcome] ?? dispute.resolution_outcome}. This conversation is now closed.
          </p>
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="flex min-w-0 flex-col rounded-lg border border-border bg-card lg:h-[calc(100vh-220px)] lg:min-h-[480px]" aria-labelledby="discussion-heading">
          <div className="border-b border-border px-4 py-3">
            <h2 id="discussion-heading" className="text-sm font-semibold text-foreground">
              Conversation with {otherParty}
            </h2>
            <p className="text-xs text-muted-foreground">Keep it factual. An admin reads this if you can't agree.</p>
          </div>

          <div className="max-h-[60vh] min-h-[280px] flex-1 space-y-4 overflow-y-auto p-4 lg:max-h-none" aria-live="polite">
            {messages.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">No messages yet. Explain your side to get started.</p>
            ) : (
              messages.map((m) => {
                const mine = m.sender_id === user?.id
                return (
                  <div key={m.id} className={cn("flex flex-col", mine ? "items-end" : "items-start")}>
                    <p className="mb-1 text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">{mine ? "You" : m.sender?.full_name ?? "Participant"}</span> · {fmtStamp(m.created_at)}
                    </p>
                    <div
                      className={cn(
                        "max-w-[85%] whitespace-pre-wrap break-words rounded-lg px-3.5 py-2 text-sm",
                        mine ? "bg-primary text-primary-foreground" : "border border-border bg-surface text-foreground"
                      )}
                    >
                      {m.message}
                    </div>
                  </div>
                )
              })
            )}
            <div ref={endRef} />
          </div>

          {!isResolved && (
            <form
              onSubmit={(e) => {
                e.preventDefault()
                send()
              }}
              className="border-t border-border p-3"
            >
              <div className="flex items-end gap-2">
                <Textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault()
                      send()
                    }
                  }}
                  rows={2}
                  placeholder={`Reply to ${otherParty}…`}
                  aria-label="Message"
                  disabled={postMessage.isPending}
                  className="min-h-[44px] resize-none"
                />
                <Button type="submit" size="icon" aria-label="Send" disabled={postMessage.isPending || !message.trim()}>
                  {postMessage.isPending ? <Loader2 className="animate-spin" /> : <Send />}
                </Button>
              </div>
              <p className="mt-1.5 text-[11px] text-muted-foreground">Enter to send · Shift+Enter for a new line</p>
              {error && (
                <p role="alert" className="mt-1 text-sm text-destructive">
                  {error}
                </p>
              )}
            </form>
          )}
        </section>

        <aside className="space-y-5" aria-label="Dispute details">
          <Panel title="Progress">
            <DisputeProgress dispute={dispute} />
          </Panel>
          <Panel title="Details">
            <FactList
              items={[
                { label: "Reason", value: DISPUTE_TYPE_LABELS[dispute.dispute_type] ?? dispute.dispute_type },
                { label: "Amount frozen", value: amount },
                { label: "Opened by", value: iOpenedIt ? "You" : dispute.initiator?.full_name ?? "—" },
                { label: "Opened", value: fmtDate(dispute.created_at) },
              ]}
            />
          </Panel>
          <Panel title="Original complaint">
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{dispute.description}</p>
          </Panel>
          <p className="text-xs text-muted-foreground">
            While the dispute is open, no one can release or withdraw this money. Delivery and approval in the{" "}
            <Link to={`/workspace/${dispute.job_id}`} className="font-medium text-primary hover:underline">
              workspace
            </Link>{" "}
            are paused.
          </p>
        </aside>
      </div>
    </PageContainer>
  )
}
