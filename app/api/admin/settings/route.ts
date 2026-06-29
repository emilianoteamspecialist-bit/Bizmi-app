import { NextResponse } from "next/server"
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import { createServiceRoleClient } from "@/lib/supabase-service"
import { logAdminAction } from "@/lib/admin-audit"

// Admin-only editor for numeric app_settings. Currently the influencer
// commission rate and the platform fee %. Rate changes apply to FUTURE
// qualifying events only (already-qualified referrals keep their commission).
const ALLOWED_KEYS = new Set(["influencer_commission_pct", "platform_fee_pct"])

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))

    // Authn + authz: admin only.
    const cookieStore = await cookies()
    const authClient = createRouteHandlerClient({ cookies: () => cookieStore })
    const {
      data: { user },
    } = await authClient.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const { data: adminProfile } = await authClient
      .from("profiles")
      .select("account_type")
      .eq("id", user.id)
      .maybeSingle()
    if (adminProfile?.account_type !== "admin") {
      return NextResponse.json({ error: "Forbidden: admin only" }, { status: 403 })
    }

    const updates: Record<string, number> = {}
    for (const [key, raw] of Object.entries(body || {})) {
      if (!ALLOWED_KEYS.has(key)) continue
      const n = Number(raw)
      if (!Number.isFinite(n) || n < 0 || n > 100) {
        return NextResponse.json({ error: `${key} must be a number between 0 and 100` }, { status: 400 })
      }
      updates[key] = n
    }
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No valid settings provided" }, { status: 400 })
    }

    const service = createServiceRoleClient()
    const rows = Object.entries(updates).map(([key, value]) => ({
      key,
      value,
      updated_at: new Date().toISOString(),
    }))
    const { error } = await service.from("app_settings").upsert(rows, { onConflict: "key" })
    if (error) {
      return NextResponse.json({ error: "Failed to save settings" }, { status: 500 })
    }

    await logAdminAction(service, {
      adminId: user.id,
      action: "settings.update",
      targetType: "app_settings",
      targetId: Object.keys(updates).join(","),
      details: updates,
    })

    return NextResponse.json({ success: true, updated: updates })
  } catch (error) {
    console.error("Admin settings update error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
