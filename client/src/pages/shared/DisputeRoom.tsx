import { useEffect, useRef, useState } from "react"
import { useParams } from "react-router-dom"
import { CheckCircle, Clock, Loader2, Send, ShieldAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useAuth } from "@/contexts/AuthContext"
import {
  DISPUTE_TYPE_LABELS,
  useDisputeQuery,
  usePostDisputeMessageMutation,
  useRealtimeDisputeMessages,
  type Dispute,
} from "@/lib/queries/escrow"

function StatusBadge({ status }: { status: Dispute["status"] }) {
  const base = "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium"
  if (status === "resolved") return <span className={`${base} bg-success/10 text-success`}><CheckCircle className="h-3 w-3" /> Resolved</span>
  if (status === "admin_intervention") return <span className={`${base} bg-destructive/10 text-destructive`}><ShieldAlert className="h-3 w-3" /> Admin intervention</span>
  return <span className={`${base} bg-warning/10 text-warning`}><Clock className="h-3 w-3" /> In platform review</span>
}

const OUTCOME_LABEL: Record<string, string> = {
  full_release: "Payment released to the freelancer",
  refund: "Payment refunded to the agency",
  partial_release: "Partial release",
  none: "No action",
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
    endRef.current?.scrollIntoView?.({ behavior: "smooth" })
  }, [messages.length])

  if (disputeQuery.isLoading) {
    return <div className="min-h-screen bg-surface flex items-center justify-center text-sm text-muted-foreground">Loading dispute…</div>
  }
  if (disputeQuery.isError || !disputeQuery.data) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Dispute not found, or you don't have access to it.</p>
      </div>
    )
  }

  const { dispute } = disputeQuery.data
  const isResolved = dispute.status === "resolved"
  const otherParty = user?.id === dispute.initiator_id ? dispute.respondent?.full_name : dispute.initiator?.full_name

  const send = (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    postMessage.mutate(message.trim(), {
      onSuccess: () => setMessage(""),
      onError: (err) => setError(err instanceof Error ? err.message : "Could not send"),
    })
  }

  return (
    <div className="min-h-screen bg-surface pb-20">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <header className="rounded-xl border border-border bg-card p-5 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Dispute room</p>
              <h1 className="text-xl font-semibold tracking-tight text-foreground">{dispute.job?.title ?? "Job"}</h1>
              <p className="text-sm text-muted-foreground">
                {DISPUTE_TYPE_LABELS[dispute.dispute_type] ?? dispute.dispute_type} · ₦{Number(dispute.amount_disputed).toLocaleString()} frozen in escrow
              </p>
            </div>
            <div className="flex flex-col items-start sm:items-end gap-1.5">
              <StatusBadge status={dispute.status} />
              <p className="text-xs text-muted-foreground">
                Opened {new Date(dispute.created_at).toLocaleDateString()} · Other party: <strong>{otherParty ?? "—"}</strong>
              </p>
            </div>
          </div>
          <div className="rounded-lg bg-surface-2 p-3">
            <p className="text-xs font-medium text-muted-foreground">Original complaint</p>
            <p className="mt-1 text-sm text-foreground whitespace-pre-wrap">{dispute.description}</p>
          </div>
          {isResolved && dispute.resolution_outcome && (
            <p className="rounded-lg border border-success/30 bg-success/10 p-3 text-sm text-success">
              Resolved: {OUTCOME_LABEL[dispute.resolution_outcome] ?? dispute.resolution_outcome}.
            </p>
          )}
        </header>

        <section className="rounded-xl border border-border bg-card flex flex-col" style={{ minHeight: 420 }} aria-labelledby="discussion-heading">
          <div className="border-b border-border px-5 py-3">
            <h2 id="discussion-heading" className="text-sm font-semibold text-foreground">Discussion</h2>
            <p className="text-xs text-muted-foreground">Try to resolve it here. If it isn't resolved in 3–7 days, an admin reviews this conversation and decides.</p>
          </div>
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {messages.map((m) => {
              const mine = m.sender_id === user?.id
              return (
                <div key={m.id} className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
                  <p className="text-xs text-muted-foreground mb-1">
                    {mine ? "You" : m.sender?.full_name ?? "Participant"} · {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </p>
                  <div className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm whitespace-pre-wrap break-words ${mine ? "bg-primary text-primary-foreground rounded-br-none" : "bg-surface-2 text-foreground rounded-bl-none"}`}>
                    {m.message}
                  </div>
                </div>
              )
            })}
            <div ref={endRef} />
          </div>
          {!isResolved && (
            <form onSubmit={send} className="border-t border-border p-3 flex gap-2">
              <Input value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Type your message…" aria-label="Message" disabled={postMessage.isPending} />
              <Button type="submit" aria-label="Send" disabled={postMessage.isPending || !message.trim()}>
                {postMessage.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </form>
          )}
          {error && <p className="px-5 pb-3 text-sm text-destructive">{error}</p>}
        </section>
      </div>
    </div>
  )
}
