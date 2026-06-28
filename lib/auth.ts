import { cache } from "react"
import { createClient } from "@/lib/supabase-server"

// Validates the session token against Supabase Auth (a network round-trip).
// Wrapped in React's cache() so multiple server actions invoked in the same
// request/render share a single round-trip instead of each re-authenticating.
export const getCurrentUser = cache(async () => {
  const supabase = await createClient()
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    return user
  } catch {
    // An invalid/expired refresh token (e.g. a stale cookie after a server
    // restart or sign-out) surfaces here. Treat it as "no user" so callers
    // redirect to login cleanly instead of throwing.
    return null
  }
})
