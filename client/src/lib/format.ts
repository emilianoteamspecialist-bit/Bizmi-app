// Display formatting shared across the marketplace UI. Money from the jobs API
// is in naira; escrow amounts are kobo and use formatKobo in queries/escrow.

export function formatNaira(value: number | string | null | undefined): string | null {
  const n = Number(value)
  if (value == null || value === "" || !Number.isFinite(n)) return null
  return `₦${n.toLocaleString("en-NG", { maximumFractionDigits: 0 })}`
}

/** "₦100,000 – ₦200,000", "From ₦100,000", "Up to ₦200,000" or "Budget not set". */
export function formatBudgetRange(min: number | string | null | undefined, max: number | string | null | undefined): string {
  const lo = formatNaira(min)
  const hi = formatNaira(max)
  if (lo && hi) return lo === hi ? lo : `${lo} – ${hi}`
  if (lo) return `From ${lo}`
  if (hi) return `Up to ${hi}`
  return "Budget not set"
}

/** "just now", "5 minutes ago", "3 hours ago", "2 days ago", then a date. */
export function formatTimeAgo(value: string | null | undefined, now = Date.now()): string {
  if (!value) return ""
  const then = new Date(value).getTime()
  if (!Number.isFinite(then)) return ""
  const minutes = Math.max(0, Math.floor((now - then) / 60000))
  if (minutes < 1) return "just now"
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`
  return new Date(value).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })
}

/** "Member since Mar 2026". */
export function formatMemberSince(value: string | null | undefined): string | null {
  if (!value) return null
  const d = new Date(value)
  if (!Number.isFinite(d.getTime())) return null
  return `Member since ${d.toLocaleDateString("en-NG", { month: "short", year: "numeric" })}`
}
