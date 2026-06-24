import type { SupabaseClient } from "@supabase/supabase-js"

// Best-effort admin audit logging. Writes a row to admin_audit_log via the
// service-role client. Never throws — an audit failure must not break the
// underlying admin action, and it degrades gracefully if the table hasn't been
// migrated yet (logs and moves on).
export async function logAdminAction(
  service: SupabaseClient,
  entry: {
    adminId: string
    action: string
    targetType?: string
    targetId?: string
    details?: Record<string, any>
  },
): Promise<void> {
  try {
    const { error } = await service.from("admin_audit_log").insert({
      admin_id: entry.adminId,
      action: entry.action,
      target_type: entry.targetType ?? null,
      target_id: entry.targetId ?? null,
      details: entry.details ?? null,
    })
    if (error) {
      console.error("admin audit log insert failed", { action: entry.action, error: error.message })
    }
  } catch (err) {
    console.error("admin audit log unexpected error", { action: entry.action, err })
  }
}
