import { Router } from "express"
import { requireAuth } from "../middleware/auth.js"

const meRouter = Router()

meRouter.get("/", requireAuth, async (req, res) => {
  const { data, error } = await req.supabase!
    .from("profiles")
    .select("*")
    .eq("id", req.user!.id)
    .single()

  if (error || !data) {
    res.status(404).json({ error: "Profile not found" })
    return
  }

  res.json(data)
})

export default meRouter
