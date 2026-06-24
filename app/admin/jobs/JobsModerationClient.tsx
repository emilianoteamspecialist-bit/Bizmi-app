"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { AdminSidebar } from "@/components/admin-sidebar"
import { Briefcase, Ban, RotateCcw } from "lucide-react"

interface JobRow {
  id: string
  title: string
  status: string
  moderation_status: string
  moderation_reason: string | null
  agency_name: string
  created_at: string
  budget_min: number | null
  budget_max: number | null
}

interface JobsModerationClientProps {
  initialJobs: JobRow[]
}

const fmtDate = (d?: string) => (d ? new Date(d).toLocaleDateString() : "—")
const fmtNaira = (n: any) => `₦ ${Number(n || 0).toLocaleString()}`

export default function JobsModerationClient({ initialJobs }: JobsModerationClientProps) {
  const [jobs, setJobs] = useState<JobRow[]>(initialJobs)
  const [search, setSearch] = useState("")
  const [busyId, setBusyId] = useState<string | null>(null)

  const moderate = async (job: JobRow, action: "remove" | "restore") => {
    let reason: string | null = null
    if (action === "remove") {
      reason = prompt("Reason for removing this job (optional):") || null
    } else if (!confirm("Restore this job to the marketplace?")) {
      return
    }
    setBusyId(job.id)
    try {
      const res = await fetch(`/api/admin/jobs/${job.id}/moderate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reason }),
      })
      const data = await res.json()
      if (!res.ok) {
        alert(data.error || "Action failed")
        return
      }
      // Optimistically reflect the new state.
      setJobs((prev) =>
        prev.map((j) =>
          j.id === job.id
            ? { ...j, moderation_status: data.moderation_status, moderation_reason: action === "remove" ? reason : null }
            : j,
        ),
      )
    } catch (e) {
      console.error(`Error trying to ${action} job:`, e)
      alert("Something went wrong.")
    } finally {
      setBusyId(null)
    }
  }

  const matches = (j: JobRow) =>
    !search.trim() ||
    j.title.toLowerCase().includes(search.toLowerCase()) ||
    j.agency_name.toLowerCase().includes(search.toLowerCase())

  const visible = jobs.filter((j) => j.moderation_status !== "removed" && matches(j))
  const removed = jobs.filter((j) => j.moderation_status === "removed" && matches(j))

  const JobTable = ({ rows, removedView }: { rows: JobRow[]; removedView: boolean }) => (
    <Card>
      <CardContent className="p-0 overflow-x-auto">
        {rows.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-sm">No jobs.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Agency</TableHead>
                <TableHead>Budget</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Posted</TableHead>
                {removedView && <TableHead>Reason</TableHead>}
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((j) => (
                <TableRow key={j.id}>
                  <TableCell className="font-medium max-w-xs truncate">{j.title}</TableCell>
                  <TableCell>{j.agency_name}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    {fmtNaira(j.budget_min)} – {fmtNaira(j.budget_max)}
                  </TableCell>
                  <TableCell className="capitalize">{j.status}</TableCell>
                  <TableCell>{fmtDate(j.created_at)}</TableCell>
                  {removedView && (
                    <TableCell className="text-xs text-slate-500 max-w-[12rem] truncate">
                      {j.moderation_reason || "—"}
                    </TableCell>
                  )}
                  <TableCell className="text-right">
                    {removedView ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busyId === j.id}
                        onClick={() => moderate(j, "restore")}
                      >
                        <RotateCcw className="h-4 w-4 mr-1" /> Restore
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={busyId === j.id}
                        onClick={() => moderate(j, "remove")}
                      >
                        <Ban className="h-4 w-4 mr-1" /> Remove
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )

  return (
    <div className="min-h-screen bg-slate-50">
      <AdminSidebar />
      <div className="lg:pl-64">
        <div className="p-4 lg:p-6 max-w-6xl mx-auto space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                <Briefcase className="h-6 w-6 text-primary" /> Job Moderation
              </h1>
              <p className="text-slate-600">Remove fraudulent or policy-violating job postings from the marketplace.</p>
            </div>
            <Input
              placeholder="Search title or agency…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-xs"
            />
          </div>

          <Tabs defaultValue="active" className="w-full">
            <TabsList className="bg-orange-100">
              <TabsTrigger value="active">Active ({visible.length})</TabsTrigger>
              <TabsTrigger value="removed">
                <Badge className="bg-red-100 text-red-800 border-none mr-1">Removed</Badge> ({removed.length})
              </TabsTrigger>
            </TabsList>
            <TabsContent value="active" className="mt-4">
              <JobTable rows={visible} removedView={false} />
            </TabsContent>
            <TabsContent value="removed" className="mt-4">
              <JobTable rows={removed} removedView />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}
