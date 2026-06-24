import { redirect } from "next/navigation"
import AuditLogClient from "./AuditLogClient"
import { getFullUserData } from "@/app/actions/user"
import { createClient } from "@/lib/supabase-server"

export default async function AdminAuditPage() {
  // Admin guard.
  const userData = await getFullUserData()
  if (!userData?.user) {
    redirect("/admin/login")
  }
  if (userData.profile?.account_type !== "admin") {
    redirect("/admin/login")
  }

  // Most recent admin actions first. Joins the acting admin's name/email.
  // If the table hasn't been migrated yet, this returns null and the page
  // shows an empty state rather than erroring.
  const supabase = await createClient()
  const { data: logs } = await supabase
    .from("admin_audit_log")
    .select(
      `id, action, target_type, target_id, details, created_at,
       admin:profiles!admin_audit_log_admin_id_fkey(full_name, email)`,
    )
    .order("created_at", { ascending: false })
    .limit(200)

  // Supabase types the to-one `admin` join as an array; at runtime it's a single
  // object. Cast to the client's shape rather than fight the inference.
  return <AuditLogClient initialLogs={(logs ?? []) as any} />
}
