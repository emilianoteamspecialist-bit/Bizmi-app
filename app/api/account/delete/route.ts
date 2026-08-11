import { NextResponse } from "next/server"
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import { createServiceRoleClient } from "@/lib/supabase-service"

// Permanently deletes the calling user's account.
//
// The client can only delete its own `profiles` row (RLS-bound) and cannot
// touch `auth.users` at all — so the old client-side "delete account" left the
// auth record behind, blocking re-signup with the same email. This route runs
// the privileged deletion with the service-role key:
//   1. delete the profiles row (cascades to jobs/proposals/referrals/etc.)
//   2. delete the auth.users row (frees the email, cascades auth-FK children)
// The caller is authenticated from their own cookie session; a user can only
// ever delete themselves.
export async function POST() {
  try {
    const cookieStore = await cookies()
    const userClient = createRouteHandlerClient({ cookies: () => cookieStore })
    const {
      data: { user },
    } = await userClient.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const service = createServiceRoleClient()

    // Remove application data first. Child tables FK profiles(id) ON DELETE
    // CASCADE, so this clears the user's jobs, proposals, referrals, etc.
    const { error: profileError } = await service
      .from("profiles")
      .delete()
      .eq("id", user.id)

    if (profileError) {
      return NextResponse.json({ error: "Failed to delete account data" }, { status: 500 })
    }

    // Remove the auth identity so the email can be reused on a fresh sign-up.
    const { error: authError } = await service.auth.admin.deleteUser(user.id)

    if (authError) {
      return NextResponse.json({ error: "Failed to delete account" }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("Error deleting account:", error)
    return NextResponse.json({ error: "Failed to delete account" }, { status: 500 })
  }
}
