"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { AdminSidebar } from "@/components/admin-sidebar"
import { ScrollText } from "lucide-react"

interface AuditEntry {
  id: string
  action: string
  target_type: string | null
  target_id: string | null
  details: any
  created_at: string
  admin?: { full_name?: string; email?: string } | null
}

interface AuditLogClientProps {
  initialLogs: AuditEntry[]
}

const fmtDateTime = (d?: string) => (d ? new Date(d).toLocaleString() : "—")

function actionBadge(action: string) {
  const danger = action.includes("disable") || action.includes("refund")
  const cls = danger
    ? "bg-red-100 text-red-800"
    : action.includes("resolve")
      ? "bg-blue-100 text-blue-800"
      : "bg-slate-100 text-slate-800"
  return <Badge className={`${cls} border-none font-mono text-xs`}>{action}</Badge>
}

export default function AuditLogClient({ initialLogs }: AuditLogClientProps) {
  const [search, setSearch] = useState("")

  const logs = initialLogs.filter((l) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      l.action.toLowerCase().includes(q) ||
      (l.target_id || "").toLowerCase().includes(q) ||
      (l.target_type || "").toLowerCase().includes(q) ||
      (l.admin?.full_name || "").toLowerCase().includes(q) ||
      (l.admin?.email || "").toLowerCase().includes(q)
    )
  })

  return (
    <div className="min-h-screen bg-slate-50">
      <AdminSidebar />
      <div className="lg:pl-64">
        <div className="p-4 lg:p-6 max-w-6xl mx-auto space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                <ScrollText className="h-6 w-6 text-primary" /> Audit Log
              </h1>
              <p className="text-slate-600">A record of consequential admin actions (money movement, account changes).</p>
            </div>
            <Input
              placeholder="Search action, admin, target…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-xs"
            />
          </div>

          <Card>
            <CardHeader className="border-b">
              <CardTitle className="text-base">Recent actions ({logs.length})</CardTitle>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              {logs.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-sm">
                  No audit entries yet. Admin actions (dispute resolutions, user disable/enable) will appear here.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>When</TableHead>
                      <TableHead>Admin</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Target</TableHead>
                      <TableHead>Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((l) => (
                      <TableRow key={l.id}>
                        <TableCell className="whitespace-nowrap text-sm">{fmtDateTime(l.created_at)}</TableCell>
                        <TableCell className="text-sm">
                          {l.admin?.full_name || l.admin?.email || "—"}
                        </TableCell>
                        <TableCell>{actionBadge(l.action)}</TableCell>
                        <TableCell className="text-sm">
                          {l.target_type ? (
                            <span>
                              {l.target_type}
                              {l.target_id && (
                                <span className="block font-mono text-[11px] text-slate-400">{l.target_id}</span>
                              )}
                            </span>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-slate-600 max-w-xs">
                          {l.details ? (
                            <pre className="whitespace-pre-wrap break-words font-mono">
                              {JSON.stringify(l.details)}
                            </pre>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
