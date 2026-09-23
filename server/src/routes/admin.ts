import { Router } from "express"
import { asyncHandler } from "../lib/http.js"

const adminRouter = Router()

adminRouter.get(
  "/users",
  asyncHandler(async (req, res) => {
    const { data, error } = await req.supabase!
      .from("profiles")
      .select("id, email, full_name, account_type, created_at, wallet_balance")
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Error fetching admin users list:", error)
      res.json({ users: [] })
      return
    }

    res.json({ users: data || [] })
  })
)

export default adminRouter
