// server/src/app.ts
import express from "express"
import cors from "cors"
import meRouter from "./routes/me.js"
import userRouter from "./routes/user.js"
import jobsRouter from "./routes/jobs.js"
import proposalsRouter from "./routes/proposals.js"
import { requireAuth } from "./middleware/auth.js"
import { errorHandler } from "./lib/http.js"

export function createApp() {
  const app = express()

  app.use(
    cors({
      origin: process.env.CLIENT_ORIGIN ?? "http://localhost:5173",
    })
  )
  app.use(express.json())

  app.use("/api/me", meRouter)
  app.use("/api/user", requireAuth, userRouter)
  app.use("/api/jobs", requireAuth, jobsRouter)
  app.use("/api/proposals", requireAuth, proposalsRouter)

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" })
  })

  app.use(errorHandler)

  return app
}
