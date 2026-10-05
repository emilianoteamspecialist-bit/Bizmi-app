// server/src/app.ts
import express from "express"
import cors from "cors"
import meRouter from "./routes/me.js"
import userRouter from "./routes/user.js"
import jobsRouter from "./routes/jobs.js"
import proposalsRouter from "./routes/proposals.js"
import agenciesRouter from "./routes/agencies.js"
import freelancersRouter from "./routes/freelancers.js"
import messagesRouter from "./routes/messages.js"
import adminRouter from "./routes/admin.js"
import influencerRouter from "./routes/influencer.js"
import escrowRouter from "./routes/escrow.js"
import submissionsRouter from "./routes/submissions.js"
import payoutsRouter from "./routes/payouts.js"
import disputesRouter from "./routes/disputes.js"
import adminEscrowRouter from "./routes/adminEscrow.js"
import webhooksRouter from "./routes/webhooks.js"
import { requireAuth } from "./middleware/auth.js"
import { requireAdmin } from "./middleware/admin.js"
import { errorHandler, HttpError } from "./lib/http.js"

export function createApp() {
  const app = express()

  app.use(
    cors({
      origin: process.env.CLIENT_ORIGIN ?? "http://localhost:5173",
    })
  )
  // Webhooks verify an HMAC over the raw body, so they must be mounted before
  // the JSON parser (the router applies express.raw itself).
  app.use("/api/webhooks", webhooksRouter)

  app.use(express.json({ limit: "8mb" }))

  app.use("/api/me", meRouter)
  app.use("/api/user", requireAuth, userRouter)
  app.use("/api/jobs", requireAuth, jobsRouter)
  app.use("/api/proposals", requireAuth, proposalsRouter)
  app.use("/api/agencies", requireAuth, agenciesRouter)
  app.use("/api/freelancers", requireAuth, freelancersRouter)
  app.use("/api/messages", requireAuth, messagesRouter)
  app.use("/api/admin", requireAuth, requireAdmin, adminRouter)
  app.use("/api/admin", requireAuth, requireAdmin, adminEscrowRouter)
  app.use("/api/influencer", requireAuth, influencerRouter)
  app.use("/api/escrow", requireAuth, escrowRouter)
  app.use("/api/submissions", requireAuth, submissionsRouter)
  app.use("/api/payouts", requireAuth, payoutsRouter)
  app.use("/api/disputes", requireAuth, disputesRouter)

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" })
  })

  app.use((_req, _res, next) => {
    next(new HttpError(404, "Not found", "not_found"))
  })

  app.use(errorHandler)

  return app
}
