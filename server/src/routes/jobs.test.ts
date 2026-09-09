import { describe, it, expect, vi } from "vitest"
import express from "express"
import request from "supertest"
import jobsRouter from "./jobs.js"

function appWith(user: { id: string }, supabase: any) {
  const app = express()
  app.use(express.json())
  app.use((req: any, _res, next) => {
    req.user = user
    req.supabase = supabase
    next()
  })
  app.use("/", jobsRouter)
  return app
}

describe("GET /", () => {
  it("calls get_jobs_with_details and attaches has_applied", async () => {
    const supabase = {
      rpc: vi.fn().mockResolvedValue({ data: [{ id: "job-1", total_count: 1 }], error: null }),
      from: vi.fn(() => ({
        select: vi.fn(() => ({ eq: vi.fn(() => ({ in: vi.fn().mockResolvedValue({ data: [{ job_id: "job-1" }] }) })) })),
      })),
    }
    const res = await request(appWith({ id: "freelancer-1" }, supabase)).get("/?searchQuery=react&limit=5")

    expect(supabase.rpc).toHaveBeenCalledWith(
      "get_jobs_with_details",
      expect.objectContaining({ p_user_id: "freelancer-1", p_search_query: "react", p_limit: 5 })
    )
    expect(res.body).toEqual({ jobs: [{ id: "job-1", total_count: 1, has_applied: true }], totalCount: 1 })
  })
})

describe("GET /saved", () => {
  it("enriches saved jobs with agency info and job counts", async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "saved_jobs") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                order: vi.fn().mockResolvedValue({
                  data: [
                    {
                      created_at: "2026-01-01T00:00:00Z",
                      jobs: { id: "job-1", agency_id: "agency-1", budget_min: 1000, budget_max: 2000, created_at: "2026-01-01T00:00:00Z", proposals: [{ count: 3 }] },
                    },
                  ],
                  error: null,
                }),
              })),
            })),
          }
        }
        if (table === "profiles") {
          return { select: vi.fn(() => ({ in: vi.fn().mockResolvedValue({ data: [{ id: "agency-1", company_name: "Acme" }] }) })) }
        }
        if (table === "jobs") {
          return { select: vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ count: 4 }) })) }
        }
        throw new Error(`unexpected table ${table}`)
      }),
    }
    const res = await request(appWith({ id: "freelancer-1" }, supabase)).get("/saved")

    expect(res.body.jobs[0]).toEqual(
      expect.objectContaining({ id: "job-1", isBookmarked: true, agencyInfo: expect.objectContaining({ name: "Acme", totalJobs: 4 }) })
    )
  })
})

describe("POST /:jobId/bookmark", () => {
  it("deletes the saved_jobs row when isBookmarked is true", async () => {
    const eqEq = vi.fn().mockResolvedValue({ error: null })
    const supabase = { from: vi.fn(() => ({ delete: vi.fn(() => ({ eq: vi.fn(() => ({ eq: eqEq })) })) })) }

    const res = await request(appWith({ id: "freelancer-1" }, supabase))
      .post("/job-1/bookmark")
      .send({ isBookmarked: true })

    expect(res.body).toEqual({ success: true })
  })

  it("inserts a saved_jobs row when isBookmarked is false", async () => {
    const insert = vi.fn().mockResolvedValue({ error: null })
    const supabase = { from: vi.fn(() => ({ insert })) }

    const res = await request(appWith({ id: "freelancer-1" }, supabase))
      .post("/job-1/bookmark")
      .send({ isBookmarked: false })

    expect(insert).toHaveBeenCalledWith([{ freelancer_id: "freelancer-1", job_id: "job-1" }])
    expect(res.body).toEqual({ success: true })
  })
})

describe("GET /agency", () => {
  it("returns the agency's own jobs with proposal counts", async () => {
    const supabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({ order: vi.fn().mockResolvedValue({ data: [{ id: "job-1", proposals: [{ count: 2 }] }], error: null }) })),
        })),
      })),
    }
    const res = await request(appWith({ id: "agency-1" }, supabase)).get("/agency")
    expect(res.body).toEqual({ jobs: [{ id: "job-1", proposals: 2 }] })
  })
})

describe("PATCH /:jobId/status", () => {
  it("updates the job status", async () => {
    const eq = vi.fn().mockResolvedValue({ error: null })
    const supabase = { from: vi.fn(() => ({ update: vi.fn(() => ({ eq })) })) }

    const res = await request(appWith({ id: "agency-1" }, supabase))
      .patch("/job-1/status")
      .send({ status: "closed" })

    expect(res.body).toEqual({ success: true })
  })
})

describe("POST / (createJob)", () => {
  it("creates a job for the calling agency", async () => {
    const insert = vi.fn().mockResolvedValue({ error: null })
    const supabase = { from: vi.fn(() => ({ insert })) }

    const res = await request(appWith({ id: "agency-1" }, supabase))
      .post("/")
      .send({ title: "Build a site", idempotencyKey: "key-1" })

    expect(insert).toHaveBeenCalledWith([expect.objectContaining({ title: "Build a site", agency_id: "agency-1", status: "active" })])
    expect(res.body).toEqual({ success: true })
  })

  it("treats a unique_violation on idempotency_key as a successful dedupe", async () => {
    const insert = vi.fn().mockResolvedValue({ error: { code: "23505", message: "duplicate key" } })
    const supabase = { from: vi.fn(() => ({ insert })) }

    const res = await request(appWith({ id: "agency-1" }, supabase))
      .post("/")
      .send({ title: "Build a site", idempotencyKey: "key-1" })

    expect(res.body).toEqual({ success: true, deduped: true })
  })
})

describe("PUT /:jobId (updateJob)", () => {
  it("updates a job scoped to the calling agency", async () => {
    const eqAgency = vi.fn().mockResolvedValue({ error: null })
    const eqId = vi.fn(() => ({ eq: eqAgency }))
    const supabase = { from: vi.fn(() => ({ update: vi.fn(() => ({ eq: eqId })) })) }

    const res = await request(appWith({ id: "agency-1" }, supabase))
      .put("/job-1")
      .send({ title: "Updated title" })

    expect(res.body).toEqual({ success: true })
  })
})
