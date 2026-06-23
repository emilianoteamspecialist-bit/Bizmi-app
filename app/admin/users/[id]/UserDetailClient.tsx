"use client"

import { useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { AdminSidebar } from "@/components/admin-sidebar"
import { ArrowLeft, Mail, Calendar, Wallet, ShieldCheck, Ban, CheckCircle2 } from "lucide-react"

interface UserDetailClientProps {
  profile: any | null
  kyc: { nin: string; status: string; created_at: string } | null
  fundedJobs: any[]
  credits: any[]
  disputes: any[]
  jobsPosted: any[]
  proposals: any[]
}

const fmtDate = (d?: string) => (d ? new Date(d).toLocaleDateString() : "—")
const fmtNaira = (n: any) => `₦ ${Number(n || 0).toLocaleString()}`

export default function UserDetailClient({
  profile,
  kyc,
  fundedJobs,
  credits,
  disputes,
  jobsPosted,
  proposals,
}: UserDetailClientProps) {
  const [updating, setUpdating] = useState(false)

  if (!profile) {
    return (
      <div className="min-h-screen bg-slate-50">
        <AdminSidebar />
        <div className="lg:pl-64 p-4 lg:p-6">
          <Link href="/admin/users" className="inline-flex items-center text-sm text-slate-600 hover:text-primary mb-6">
            <ArrowLeft className="h-4 w-4 mr-1" /> Back to users
          </Link>
          <Card>
            <CardContent className="p-8 text-center text-slate-500">User not found.</CardContent>
          </Card>
        </div>
      </div>
    )
  }

  const isAgency = profile.account_type === "agency"
  const isFreelancer = profile.account_type === "freelancer"

  const setDisabled = async (disabled: boolean) => {
    const action = disabled ? "disable" : "enable"
    if (!confirm(`Are you sure you want to ${action} this user?`)) return
    setUpdating(true)
    try {
      const res = await fetch(`/api/admin/users/${profile.id}/disable`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ disabled }),
      })
      const data = await res.json()
      if (!res.ok) {
        alert(data.error || `Failed to ${action} user`)
        return
      }
      alert(`User ${disabled ? "disabled" : "enabled"} successfully.`)
    } catch (e) {
      console.error(`Error trying to ${action} user:`, e)
      alert(`Failed to ${action} user.`)
    } finally {
      setUpdating(false)
    }
  }

  // Funded jobs span both roles; total value across this user's escrowed jobs.
  const totalFundedValue = fundedJobs.reduce((sum, j) => sum + Number(j.amount || 0), 0)
  const openDisputes = disputes.filter((d) => d.status !== "resolved").length
  const totalCredits = credits
    .filter((c) => (c.status || "").toLowerCase() === "completed" || (c.status || "").toLowerCase() === "success")
    .reduce((sum, c) => sum + Number(c.credits_amount || 0), 0)

  const kycBadge = !kyc ? (
    <Badge className="bg-slate-100 text-slate-700 border-none">Not submitted</Badge>
  ) : kyc.status === "verified" ? (
    <Badge className="bg-green-100 text-green-800 border-none">Verified</Badge>
  ) : (
    <Badge className="bg-yellow-100 text-yellow-800 border-none capitalize">{kyc.status}</Badge>
  )

  return (
    <div className="min-h-screen bg-slate-50">
      <AdminSidebar />
      <div className="lg:pl-64">
        <div className="p-4 lg:p-6 max-w-6xl mx-auto space-y-6">
          <Link href="/admin/users" className="inline-flex items-center text-sm text-slate-600 hover:text-primary">
            <ArrowLeft className="h-4 w-4 mr-1" /> Back to users
          </Link>

          {/* Header */}
          <Card>
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <h1 className="text-2xl font-bold text-slate-900">{profile.full_name || "No name"}</h1>
                    <Badge variant="outline" className="border-orange-200 text-primary capitalize">
                      {profile.account_type || "user"}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-slate-600">
                    <span className="inline-flex items-center gap-1"><Mail className="h-4 w-4" /> {profile.email || "—"}</span>
                    <span className="inline-flex items-center gap-1"><Calendar className="h-4 w-4" /> Joined {fmtDate(profile.created_at)}</span>
                    <span className="inline-flex items-center gap-1"><Wallet className="h-4 w-4" /> {fmtNaira(profile.wallet_balance)}</span>
                    <span className="inline-flex items-center gap-1"><ShieldCheck className="h-4 w-4" /> KYC: {kycBadge}</span>
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button variant="outline" size="sm" disabled={updating} onClick={() => setDisabled(false)}>
                    <CheckCircle2 className="h-4 w-4 mr-1" /> Enable
                  </Button>
                  <Button variant="destructive" size="sm" disabled={updating} onClick={() => setDisabled(true)}>
                    <Ban className="h-4 w-4 mr-1" /> Disable
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Metrics */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard label="Wallet balance" value={fmtNaira(profile.wallet_balance)} />
            <MetricCard label="Funded-job value" value={fmtNaira(totalFundedValue)} />
            <MetricCard label="Open disputes" value={String(openDisputes)} />
            <MetricCard label={isAgency ? "Jobs posted" : "Credits"} value={isAgency ? String(jobsPosted.length) : String(totalCredits)} />
          </div>

          {/* Tabs */}
          <Tabs defaultValue="transactions" className="w-full">
            <TabsList className="bg-orange-100">
              <TabsTrigger value="transactions">Transactions ({fundedJobs.length})</TabsTrigger>
              {isAgency && <TabsTrigger value="jobs">Jobs ({jobsPosted.length})</TabsTrigger>}
              {isFreelancer && <TabsTrigger value="proposals">Proposals ({proposals.length})</TabsTrigger>}
              <TabsTrigger value="disputes">Disputes ({disputes.length})</TabsTrigger>
              {isFreelancer && <TabsTrigger value="credits">Credits ({credits.length})</TabsTrigger>}
            </TabsList>

            <TabsContent value="transactions" className="mt-4">
              <SectionCard title="Funded jobs (escrow)">
                {fundedJobs.length === 0 ? (
                  <Empty>No funded jobs.</Empty>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Job</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Payout</TableHead>
                        <TableHead>Funded</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {fundedJobs.map((j) => (
                        <TableRow key={j.id}>
                          <TableCell className="font-medium">{j.job_title || j.job_id}</TableCell>
                          <TableCell>{fmtNaira(j.amount)}</TableCell>
                          <TableCell className="capitalize">{j.status}</TableCell>
                          <TableCell>{j.payout_successful ? "Paid" : "—"}</TableCell>
                          <TableCell>{fmtDate(j.funded_at || j.created_at)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </SectionCard>
            </TabsContent>

            {isAgency && (
              <TabsContent value="jobs" className="mt-4">
                <SectionCard title="Jobs posted">
                  {jobsPosted.length === 0 ? (
                    <Empty>No jobs posted.</Empty>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Title</TableHead>
                          <TableHead>Budget</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Posted</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {jobsPosted.map((j) => (
                          <TableRow key={j.id}>
                            <TableCell className="font-medium">{j.title}</TableCell>
                            <TableCell>{fmtNaira(j.budget_min)} – {fmtNaira(j.budget_max)}</TableCell>
                            <TableCell className="capitalize">{j.status}</TableCell>
                            <TableCell>{fmtDate(j.created_at)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </SectionCard>
              </TabsContent>
            )}

            {isFreelancer && (
              <TabsContent value="proposals" className="mt-4">
                <SectionCard title="Proposals submitted">
                  {proposals.length === 0 ? (
                    <Empty>No proposals.</Empty>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Job</TableHead>
                          <TableHead>Bid</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Submitted</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {proposals.map((p) => (
                          <TableRow key={p.id}>
                            <TableCell className="font-medium">{p.job?.title || p.job_id}</TableCell>
                            <TableCell>{fmtNaira(p.budget)}</TableCell>
                            <TableCell className="capitalize">{p.status}</TableCell>
                            <TableCell>{fmtDate(p.created_at)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </SectionCard>
              </TabsContent>
            )}

            <TabsContent value="disputes" className="mt-4">
              <SectionCard title="Disputes">
                {disputes.length === 0 ? (
                  <Empty>No disputes.</Empty>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Job</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Opened</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {disputes.map((d) => (
                        <TableRow key={d.id}>
                          <TableCell className="font-medium">{d.job?.title || d.job_id}</TableCell>
                          <TableCell className="capitalize">{(d.dispute_type || "").replace(/_/g, " ")}</TableCell>
                          <TableCell>{fmtNaira(d.amount_disputed)}</TableCell>
                          <TableCell className="capitalize">{(d.status || "").replace(/_/g, " ")}</TableCell>
                          <TableCell>{fmtDate(d.created_at)}</TableCell>
                          <TableCell>
                            <Link href={`/disputes/${d.id}`} className="text-primary text-sm hover:underline">
                              Open
                            </Link>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </SectionCard>
            </TabsContent>

            {isFreelancer && (
              <TabsContent value="credits" className="mt-4">
                <SectionCard title="Credit purchases">
                  {credits.length === 0 ? (
                    <Empty>No credit purchases.</Empty>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Reference</TableHead>
                          <TableHead>Credits</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Date</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {credits.map((c) => (
                          <TableRow key={c.id}>
                            <TableCell className="font-mono text-xs">{c.paystack_reference || "—"}</TableCell>
                            <TableCell>{c.credits_amount}</TableCell>
                            <TableCell className="capitalize">{c.status}</TableCell>
                            <TableCell>{fmtDate(c.created_at)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </SectionCard>
              </TabsContent>
            )}
          </Tabs>
        </div>
      </div>
    </div>
  )
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs font-medium text-slate-500">{label}</p>
        <p className="text-xl font-bold text-slate-900 mt-1">{value}</p>
      </CardContent>
    </Card>
  )
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-0 overflow-x-auto">{children}</CardContent>
    </Card>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="p-8 text-center text-slate-500 text-sm">{children}</div>
}
