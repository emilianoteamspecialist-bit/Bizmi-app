const BUCKET = "avatars"

function supabaseBaseUrl(): string {
  return process.env.NEXT_PUBLIC_SUPABASE_URL || ""
}

export function getAvatarUrl(path: string | null | undefined): string {
  if (!path) return ""
  const base = supabaseBaseUrl()
  if (!base) return ""
  return `${base}/storage/v1/object/public/${BUCKET}/${path}`
}

export function resolveAvatar(row: {
  logo_path?: string | null
  image_path?: string | null
  logo_data?: string | null
  image_data?: string | null
} | null | undefined): string {
  if (!row) return ""
  const path = row.logo_path || row.image_path
  if (path) return getAvatarUrl(path)
  return row.logo_data || row.image_data || ""
}
