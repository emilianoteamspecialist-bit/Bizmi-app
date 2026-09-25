import { Router } from "express"
import { requireAuth } from "../middleware/auth.js"
import { createServiceClient } from "../lib/supabase.js"
import { runReferralSync } from "../lib/referralSync.js"
import { asyncHandler } from "../lib/http.js"

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

meRouter.post(
  "/referral-sync",
  requireAuth,
  asyncHandler(async (req, res) => {
    const service = createServiceClient()
    const meta = (req.user!.user_metadata ?? {}) as Record<string, unknown>
    await runReferralSync(service, req.user!.id, meta)
    res.json({ success: true })
  })
)

export default meRouter
