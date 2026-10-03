import type { EscrowStatus } from "@/lib/queries/escrow"

const STYLES: Record<EscrowStatus, { label: string; className: string }> = {
  pending: { label: "Pending", className: "bg-surface-2 text-muted-foreground" },
  awaiting: { label: "Awaiting payment", className: "bg-warning/10 text-warning" },
  funded: { label: "Funded", className: "bg-primary/10 text-primary" },
  released: { label: "Released", className: "bg-success/10 text-success" },
  paid_out: { label: "Paid out", className: "bg-success/10 text-success" },
  disputed: { label: "Disputed", className: "bg-destructive/10 text-destructive" },
  refunded: { label: "Refunded", className: "bg-surface-2 text-muted-foreground" },
  cancelled: { label: "Cancelled", className: "bg-surface-2 text-muted-foreground" },
}

export default function EscrowStatusBadge({ status }: { status: EscrowStatus }) {
  const s = STYLES[status] ?? { label: status, className: "bg-surface-2 text-muted-foreground" }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${s.className}`}>{s.label}</span>
  )
}
