"use client"

import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { AdminSidebar } from "@/components/admin-sidebar"

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
    ? "bg-destructive/10 text-destructive"
    : action.includes("resolve")
      ? "bg-info/10 text-info"
      : "bg-surface-2 text-muted-foreground"
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full font-mono text-[11px] font-medium ${cls}`}>{action}</span>
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
    <div className="flex h-screen bg-surface">
      <AdminSidebar />
      <div className="flex-1 overflow-auto">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-3">
            <header className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Admin</p>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">Audit log</h1>
              <p className="text-sm text-muted-foreground">A record of consequential admin actions (money movement, account changes).</p>
            </header>
            <Input
              placeholder="Search action, admin, target…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="md:max-w-xs"
            />
          </div>

          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <h2 className="text-base font-semibold text-foreground">Recent actions ({logs.length})</h2>
            </div>
            <div className="overflow-x-auto">
              {logs.length === 0 ? (
                <div className="p-12 text-center text-sm text-muted-foreground">
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
                        <TableCell className="whitespace-nowrap text-sm text-muted-foreground tabular-nums">{fmtDateTime(l.created_at)}</TableCell>
                        <TableCell className="text-sm text-foreground">{l.admin?.full_name || l.admin?.email || "—"}</TableCell>
                        <TableCell>{actionBadge(l.action)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {l.target_type ? (
                            <span>
                              {l.target_type}
                              {l.target_id && <span className="block font-mono text-[11px] text-muted-foreground/70">{l.target_id}</span>}
                            </span>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-xs">
                          {l.details ? (
                            <pre className="whitespace-pre-wrap break-words font-mono">{JSON.stringify(l.details)}</pre>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
