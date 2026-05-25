import { createClient } from "@supabase/supabase-js"

// Service-role client. Bypasses RLS. Use ONLY in server routes that need to
// write on behalf of the system (webhooks, cron, admin actions). Never expose
// this client to user code paths.

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

export function createServiceRoleClient() {
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Service-role supabase client requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY"
    )
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
