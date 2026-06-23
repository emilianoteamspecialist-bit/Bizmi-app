"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { supabase } from "@/lib/supabase"
import { AdminSidebar } from "@/components/admin-sidebar"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ShieldAlert, CheckCircle, Clock } from "lucide-react"

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

interface AdminDisputesClientProps {
  initialDisputes: Dispute[]
}

export default function AdminDisputesClient({ initialDisputes }: AdminDisputesClientProps) {
  const [disputes, setDisputes] = useState<Dispute[]>(initialDisputes)
  const [loading, setLoading] = useState(false)

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
    switch (status) {
      case 'in_platform_review':
        return <Badge variant="outline" className="text-yellow-600 border-yellow-200 bg-yellow-50"><Clock className="w-3 h-3 mr-1"/> In Platform Review</Badge>
      case 'admin_intervention':
        return <Badge variant="outline" className="text-red-600 border-red-200 bg-red-50"><ShieldAlert className="w-3 h-3 mr-1"/> Admin Intervention</Badge>
      case 'resolved':
        return <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50"><CheckCircle className="w-3 h-3 mr-1"/> Resolved</Badge>
      default:
        return <Badge>{status}</Badge>
    }
  }

  if (loading) {
    return (
      <SidebarProvider>
        <AdminSidebar />
        <SidebarInset>
          <div className="p-4 lg:p-6 text-lg">Loading disputes...</div>
        </SidebarInset>
      </SidebarProvider>
    )
  }

  return (
    <SidebarProvider>
      <AdminSidebar />
      <SidebarInset>
        <div className="p-4 lg:p-6">
          <div className="mb-6">
            <h1 className="text-2xl lg:text-primaryxl font-bold text-slate-900">Dispute Resolution</h1>
            <p className="text-slate-600">Manage and resolve active disputes between freelancers and agencies.</p>
          </div>

          <div className="space-y-4">
            {disputes.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center text-slate-500">
                  <ShieldAlert className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                  No disputes found.
                </CardContent>
              </Card>
            ) : (
              disputes.map((dispute) => (
                <Card key={dispute.id} className="overflow-hidden">
                  <CardHeader className="bg-slate-50 border-b pb-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-lg flex items-center gap-2">
                          {dispute.job?.title || 'Unknown Job'}
                          {getStatusBadge(dispute.status)}
                        </CardTitle>
                        <CardDescription className="mt-1">
                          Type: <strong>{dispute.dispute_type.replace('_', ' ')}</strong> | Amount: <strong>₦ {dispute.amount_disputed}</strong>
                        </CardDescription>
                      </div>
                      <div className="text-sm text-slate-500 text-right">
                        <div>Initiator: {dispute.initiator?.full_name}</div>
                        <div>Respondent: {dispute.respondent?.full_name}</div>
                        <div className="text-xs mt-1">{new Date(dispute.created_at).toLocaleDateString()}</div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 lg:p-6">
                    <div className="mb-6">
                      <h4 className="font-semibold text-sm text-slate-700 mb-2">Dispute Description</h4>
                      <p className="text-sm text-slate-600 bg-slate-50 p-3 rounded-xl border">
                        {dispute.description}
                      </p>
                    </div>

                    {dispute.status !== 'resolved' ? (
                      <div className="flex flex-wrap gap-2">
                        <Button 
                          onClick={() => handleResolve(dispute.id, 'full_release')}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          Full Release (To Freelancer)
                        </Button>
                        <Button 
                          onClick={() => handleResolve(dispute.id, 'refund')}
                          variant="destructive"
                        >
                          Full Refund (To Agency)
                        </Button>
                        <Button 
                          onClick={() => handleResolve(dispute.id, 'partial_release')}
                          variant="outline"
                        >
                          Partial Release
                        </Button>
                      </div>
                    ) : (
                      <div className="text-sm text-green-700 font-medium">
                        This dispute has been resolved.
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
