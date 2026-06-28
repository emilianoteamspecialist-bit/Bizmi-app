"use client"

import { useState } from "react"
import { supabase } from "@/lib/supabase"
import { AdminSidebar } from "@/components/admin-sidebar"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { ShieldAlert, CheckCircle, Clock, MessageSquare, ChevronDown } from "lucide-react"

interface Dispute {
  id: string
  job_id: string
  initiator_id: string
  respondent_id: string
  dispute_type: string
  status: string
  amount_disputed: number
  description: string
  created_at: string
  job?: { title: string }
  initiator?: { full_name: string }
  respondent?: { full_name: string }
}

interface DisputeMessage {
  id: string
  dispute_id: string
  sender_id: string
  message: string
  created_at: string
  sender?: { full_name: string } | null
}

interface AdminDisputesClientProps {
  initialDisputes: Dispute[]
  initialMessagesByDispute: Record<string, DisputeMessage[]>
}

export default function AdminDisputesClient({
  initialDisputes,
  initialMessagesByDispute,
}: AdminDisputesClientProps) {
  const [disputes, setDisputes] = useState<Dispute[]>(initialDisputes)
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const toggleConversation = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Initial disputes come from the server component as props (source-of-truth
  // pattern). loadDisputes is kept as a refetch, used after resolving a dispute.

  const loadDisputes = async () => {
    try {
      // For the UI, we'd normally hit the API or supabase directly if RLS allows admin
      const { data, error } = await supabase
        .from("disputes")
        .select(`
          *,
          job:jobs(title),
          initiator:profiles!disputes_initiator_id_fkey(full_name),
          respondent:profiles!disputes_respondent_id_fkey(full_name)
        `)
        .order("created_at", { ascending: false })

      if (error) throw error
      setDisputes(data || [])
    } catch (error) {
      console.error("Error loading disputes:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleResolve = async (disputeId: string, outcome: string) => {
    if (!confirm(`Are you sure you want to resolve this dispute with: ${outcome}?`)) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(`/api/admin/disputes/${disputeId}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resolution_outcome: outcome,
          admin_id: session.user.id,
          partial_amount: outcome === 'partial_release' ? prompt('Enter the amount to release to the freelancer:') : 0
        })
      });

      if (!response.ok) {
        const err = await response.json();
        alert(err.error || 'Failed to resolve dispute');
        return;
      }

      alert('Dispute resolved successfully!');
      loadDisputes();
    } catch (error) {
      console.error('Error:', error);
      alert('An error occurred while resolving the dispute.');
    }
  }

  const getStatusBadge = (status: string) => {
    const base = "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium"
    switch (status) {
      case 'in_platform_review':
        return <span className={`${base} bg-warning/10 text-warning`}><Clock className="w-3 h-3"/> In platform review</span>
      case 'admin_intervention':
        return <span className={`${base} bg-destructive/10 text-destructive`}><ShieldAlert className="w-3 h-3"/> Admin intervention</span>
      case 'resolved':
        return <span className={`${base} bg-success/10 text-success`}><CheckCircle className="w-3 h-3"/> Resolved</span>
      default:
        return <span className={`${base} bg-surface-2 text-muted-foreground capitalize`}>{status}</span>
    }
  }

  if (loading) {
    return (
      <SidebarProvider>
        <AdminSidebar />
        <SidebarInset>
          <div className="min-h-svh bg-surface flex items-center justify-center text-sm text-muted-foreground">
            Loading disputes…
          </div>
        </SidebarInset>
      </SidebarProvider>
    )
  }

  return (
    <SidebarProvider>
      <AdminSidebar />
      <SidebarInset>
        <div className="min-h-svh bg-surface">
          <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
            <header className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Admin</p>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">Dispute resolution</h1>
              <p className="text-sm text-muted-foreground">Manage and resolve active disputes between freelancers and agencies.</p>
            </header>

            <div className="space-y-4">
              {disputes.length === 0 ? (
                <div className="rounded-xl border border-border bg-card p-12 text-center">
                  <div className="mx-auto h-11 w-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                    <ShieldAlert className="h-5 w-5" />
                  </div>
                  <p className="mt-4 text-sm text-muted-foreground">No disputes found.</p>
                </div>
              ) : (
                disputes.map((dispute) => (
                  <div key={dispute.id} className="rounded-xl border border-border bg-card overflow-hidden">
                    <div className="bg-surface-2 border-b border-border px-5 py-4">
                      <div className="flex flex-col sm:flex-row justify-between gap-3 sm:items-start">
                        <div className="min-w-0">
                          <h3 className="text-base font-semibold text-foreground flex items-center gap-2 flex-wrap">
                            {dispute.job?.title || 'Unknown job'}
                            {getStatusBadge(dispute.status)}
                          </h3>
                          <p className="mt-1 text-sm text-muted-foreground">
                            Type <strong className="font-medium text-foreground capitalize">{dispute.dispute_type.replace('_', ' ')}</strong>
                            {' · '}Amount <strong className="font-medium text-foreground tabular-nums">₦{dispute.amount_disputed.toLocaleString()}</strong>
                          </p>
                        </div>
                        <div className="text-sm text-muted-foreground sm:text-right shrink-0">
                          <div>Initiator: <span className="text-foreground">{dispute.initiator?.full_name}</span></div>
                          <div>Respondent: <span className="text-foreground">{dispute.respondent?.full_name}</span></div>
                          <div className="text-xs mt-1 tabular-nums">{new Date(dispute.created_at).toLocaleDateString()}</div>
                        </div>
                      </div>
                    </div>
                    <div className="p-5 space-y-6">
                      <div>
                        <h4 className="text-sm font-semibold text-foreground mb-2">Dispute description</h4>
                        <p className="text-sm text-muted-foreground bg-surface-2 p-3 rounded-xl border border-border whitespace-pre-wrap">
                          {dispute.description}
                        </p>
                      </div>

                      {/* Dispute-room conversation — review the evidence before deciding. */}
                      {(() => {
                        const msgs = initialMessagesByDispute[dispute.id] || []
                        const isOpen = expanded.has(dispute.id)
                        return (
                          <div>
                            <button
                              type="button"
                              onClick={() => toggleConversation(dispute.id)}
                              className="flex items-center gap-2 text-sm font-semibold text-foreground hover:text-primary transition-colors"
                            >
                              <MessageSquare className="w-4 h-4" />
                              Conversation ({msgs.length})
                              <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                            </button>
                            {isOpen && (
                              <div className="mt-3 max-h-72 overflow-y-auto space-y-3 bg-surface-2 border border-border rounded-xl p-3">
                                {msgs.length === 0 ? (
                                  <p className="text-sm text-muted-foreground">No messages in this dispute.</p>
                                ) : (
                                  msgs.map((m) => (
                                    <div key={m.id} className="text-sm">
                                      <div className="flex items-baseline gap-2">
                                        <span className="font-semibold text-foreground">{m.sender?.full_name || "Unknown"}</span>
                                        <span className="text-xs text-muted-foreground tabular-nums">{new Date(m.created_at).toLocaleString()}</span>
                                      </div>
                                      <p className="text-muted-foreground whitespace-pre-wrap">{m.message}</p>
                                    </div>
                                  ))
                                )}
                              </div>
                            )}
                          </div>
                        )
                      })()}

                      {dispute.status !== 'resolved' ? (
                        <div className="flex flex-wrap gap-2">
                          <Button
                            onClick={() => handleResolve(dispute.id, 'full_release')}
                            className="bg-success text-white hover:bg-success/90"
                          >
                            Full release (to freelancer)
                          </Button>
                          <Button onClick={() => handleResolve(dispute.id, 'refund')} variant="destructive">
                            Full refund (to agency)
                          </Button>
                          <Button onClick={() => handleResolve(dispute.id, 'partial_release')} variant="outline">
                            Partial release
                          </Button>
                        </div>
                      ) : (
                        <p className="text-sm font-medium text-success">This dispute has been resolved.</p>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
