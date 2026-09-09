import { describe, it, expect } from "vitest"
import express from "express"
import request from "supertest"
import { HttpError, asyncHandler, errorHandler } from "./http.js"

function testApp() {
  const app = express()

  app.get(
    "/known-error",
    asyncHandler(async () => {
      throw new HttpError(404, "Not found", "not_found")
    })
  )

  app.get(
    "/unknown-error",
    asyncHandler(async () => {
      throw new Error("boom")
    })
  )

  app.get(
    "/ok",
    asyncHandler(async (_req, res) => {
      res.json({ ok: true })
    })
  )

  app.use(errorHandler)
  return app
}

describe("asyncHandler + errorHandler", () => {
  it("passes through successful handlers unaffected", async () => {
    const res = await request(testApp()).get("/ok")
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ ok: true })
  })

  it("maps a thrown HttpError to its status, message, and code", async () => {
    const res = await request(testApp()).get("/known-error")
    expect(res.status).toBe(404)
    expect(res.body).toEqual({ error: "Not found", code: "not_found" })
  })

  it("maps any other thrown error to a generic 500", async () => {
    const res = await request(testApp()).get("/unknown-error")
    expect(res.status).toBe(500)
    expect(res.body).toEqual({ error: "Internal server error" })
  })
})
