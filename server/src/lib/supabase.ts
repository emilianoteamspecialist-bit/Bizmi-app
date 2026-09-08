import { createClient, type SupabaseClient } from "@supabase/supabase-js"

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing required env var: ${name}`)
  return value
}

// Per-request client scoped to the caller's access token — RLS applies
// exactly as it does for lib/supabase-server.ts in the Next.js app.
export function createUserClient(accessToken: string): SupabaseClient {
  const url = requireEnv("SUPABASE_URL")
  const anonKey = requireEnv("SUPABASE_ANON_KEY")
  return createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  })
}

// Bypasses RLS. Only for system paths (webhooks, admin, cron) — never
// for a route driven directly by a user request.
export function createServiceClient(): SupabaseClient {
  const url = requireEnv("SUPABASE_URL")
  const serviceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY")
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
