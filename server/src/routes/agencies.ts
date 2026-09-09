import { Router } from "express"
import { asyncHandler } from "../lib/http.js"
import { resolveAvatar } from "../lib/avatar.js"

const agenciesRouter = Router()

agenciesRouter.get(
  "/:agencyId/image",
  asyncHandler(async (req, res) => {
    const { agencyId } = req.params

    const { data, error } = await req.supabase!
      .from("agency_image")
      .select("image_path, image_data")
      .eq("agency_id", agencyId)
      .maybeSingle()

    if (error || !data) {
      res.json({ image: null })
      return
    }

    res.json({ image: resolveAvatar(data) || null })
  })
)

export default agenciesRouter
