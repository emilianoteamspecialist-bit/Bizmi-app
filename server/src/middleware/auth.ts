import type { Request, Response, NextFunction } from "express"
import { createUserClient } from "../lib/supabase.js"

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization
  const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : null

  if (!token) {
    res.status(401).json({ error: "Unauthorized" })
    return
  }

  const supabase = createUserClient(token)
  const { data, error } = await supabase.auth.getUser(token)

  if (error || !data.user) {
    res.status(401).json({ error: "Unauthorized" })
    return
  }

  req.user = { id: data.user.id, email: data.user.email }
  req.supabase = supabase
  next()
}
