import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Helper function to handle database errors
export const handleSupabaseError = (error: any) => {
  console.error("Supabase error:", error)
  if (error.code === "PGRST116") {
    return "Table does not exist. Please contact support."
  }
  if (error.code === "23505") {
    return "This email or username is already taken."
  }
  if (error.code === "23503") {
    return "Database constraint error. Please try again."
  }
  // Handle RLS policy violations
  if (error.code === "42501" || error.message?.includes("row-level security policy")) {
    return "Permission denied. Please try again."
  }
  return error.message || "An unexpected error occurred."
}
