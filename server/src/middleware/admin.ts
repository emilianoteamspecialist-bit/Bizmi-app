import type { Request, Response, NextFunction } from "express"

// Accepts either `role` or `account_type` equal to "admin" — the codebase
// uses these two fields inconsistently (see middleware.ts in the Next.js app),
// so admin checks anywhere must accept either rather than risk locking out a
// legitimate admin.
export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user || !req.supabase) {
    res.status(401).json({ error: "Unauthorized" })
    return
  }

  const { data: profile, error } = await req.supabase
    .from("profiles")
    .select("role, account_type")
    .eq("id", req.user.id)
    .maybeSingle()

  const isAdmin = profile?.role === "admin" || profile?.account_type === "admin"

  if (error || !isAdmin) {
    res.status(403).json({ error: "Forbidden" })
    return
  }

  next()
}
