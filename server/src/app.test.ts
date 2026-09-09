// server/src/app.test.ts
import { describe, it, expect } from "vitest"
import request from "supertest"
import { createApp } from "./app.js"

describe("GET /health", () => {
  it("returns status ok", async () => {
    const app = createApp()
    const res = await request(app).get("/health")
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ status: "ok" })
  })
})

describe("auth gate on Phase 1 routers", () => {
  it("requires auth on /api/user", async () => {
    const res = await request(createApp()).get("/api/user/credits")
    expect(res.status).toBe(401)
  })

  it("requires auth on /api/jobs", async () => {
    const res = await request(createApp()).get("/api/jobs")
    expect(res.status).toBe(401)
  })

  it("requires auth on /api/proposals", async () => {
    const res = await request(createApp()).get("/api/proposals/mine")
    expect(res.status).toBe(401)
  })
})
