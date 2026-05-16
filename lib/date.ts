const SHORT = new Intl.DateTimeFormat("en-NG", {
  day: "numeric",
  month: "short",
})

const FULL = new Intl.DateTimeFormat("en-NG", {
  day: "numeric",
  month: "short",
  year: "numeric",
})

const LONG = new Intl.DateTimeFormat("en-NG", {
  day: "numeric",
  month: "long",
  year: "numeric",
})

const TIME = new Intl.DateTimeFormat("en-NG", {
  hour: "numeric",
  minute: "numeric",
})

function parse(input: string | Date | null | undefined): Date | null {
  if (!input) return null
  const d = input instanceof Date ? input : new Date(input)
  return Number.isFinite(d.getTime()) ? d : null
}

/** "12 Apr" — current year omitted, perfect for recency-context labels. */
export function formatDate(input: string | Date | null | undefined): string {
  const d = parse(input)
  if (!d) return ""
  const currentYear = new Date().getFullYear()
  return d.getFullYear() === currentYear ? SHORT.format(d) : FULL.format(d)
}

/** "12 Apr 2026" — always includes the year. */
export function formatDateFull(input: string | Date | null | undefined): string {
  const d = parse(input)
  return d ? FULL.format(d) : ""
}

/** "12 April 2026" — editorial long form. */
export function formatDateLong(input: string | Date | null | undefined): string {
  const d = parse(input)
  return d ? LONG.format(d) : ""
}

/** "14:32" — 24h time. */
export function formatTime(input: string | Date | null | undefined): string {
  const d = parse(input)
  return d ? TIME.format(d) : ""
}

/** "2h ago", "3d ago", "Apr 12" — human, with fallback to short date. */
export function formatRelative(input: string | Date | null | undefined): string {
  const d = parse(input)
  if (!d) return ""
  const diffMs = Date.now() - d.getTime()
  const diffMin = Math.floor(diffMs / 60_000)
  if (diffMin < 1) return "just now"
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  const diffDay = Math.floor(diffHr / 24)
  if (diffDay < 7) return `${diffDay}d ago`
  return formatDate(d)
}
