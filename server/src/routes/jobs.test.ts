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
        if (table === "proposals") {
          return { select: vi.fn(() => ({ eq: vi.fn(() => ({ in: vi.fn().mockResolvedValue({ data: [{ job_id: "job-1" }] }) })) })) }
        }
        throw new Error(`unexpected table ${table}`)
      }),
    }
    const res = await request(appWith({ id: "freelancer-1" }, supabase)).get("/saved")

    expect(res.body.jobs[0]).toEqual(
      expect.objectContaining({
        id: "job-1",
        isBookmarked: true,
        has_applied: true,
        proposal_count: 3,
        agencyInfo: expect.objectContaining({ name: "Acme", totalJobs: 4 }),
        agency_info: expect.objectContaining({ company_name: "Acme", total_jobs: 4 }),
      })
    )
  })

  it("never invents agency details the profile doesn't have", async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "saved_jobs") {
          return { select: vi.fn(() => ({ eq: vi.fn(() => ({ order: vi.fn().mockResolvedValue({ data: [{ created_at: "2026-01-01T00:00:00Z", jobs: { id: "job-1", agency_id: "agency-1", created_at: "2026-01-01T00:00:00Z", proposals: [] } }], error: null }) })) })) }
        }
        if (table === "profiles") return { select: vi.fn(() => ({ in: vi.fn().mockResolvedValue({ data: [{ id: "agency-1", company_name: "Acme" }] }) })) }
        if (table === "jobs") return { select: vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ count: 1 }) })) }
        if (table === "proposals") return { select: vi.fn(() => ({ eq: vi.fn(() => ({ in: vi.fn().mockResolvedValue({ data: [] }) })) })) }
        throw new Error(`unexpected table ${table}`)
      }),
    }
    const res = await request(appWith({ id: "freelancer-1" }, supabase)).get("/saved")
    expect(res.body.jobs[0].agencyInfo).toEqual(expect.objectContaining({ location: null, employees: null, description: null, memberSince: null }))
    expect(res.body.jobs[0].has_applied).toBe(false)
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
    const eqAgency = vi.fn().mockResolvedValue({ error: null })
    const eqId = vi.fn(() => ({ eq: eqAgency }))
    const supabase = { from: vi.fn(() => ({ update: vi.fn(() => ({ eq: eqId })) })) }

    const res = await request(appWith({ id: "agency-1" }, supabase))
      .patch("/job-1/status")
      .send({ status: "closed" })

    expect(eqId).toHaveBeenCalledWith("id", "job-1")
    expect(eqAgency).toHaveBeenCalledWith("agency_id", "agency-1")
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

describe("GET /:jobId/proposals", () => {
  it("returns the job's proposals with embedded freelancer profiles when the caller owns the job", async () => {
    const jobMaybeSingle = vi.fn().mockResolvedValue({ data: { id: "job-1", agency_id: "agency-1" }, error: null })
    const proposalsOrder = vi.fn().mockResolvedValue({
      data: [
        {
          id: "prop-1",
          job_id: "job-1",
          freelancer_id: "freelancer-1",
          proposal_text: "I can do this",
          budget: 5000,
          timeline: "2 weeks",
          attachments: null,
          status: "pending",
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-01T00:00:00Z",
          profiles: { id: "freelancer-1", full_name: "Jane Doe", bio: "A dev", location: "Lagos", phone: null, website: null },
        },
      ],
      error: null,
    })
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "jobs") {
          return { select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: jobMaybeSingle })) })) }
        }
        if (table === "proposals") {
          return { select: vi.fn(() => ({ eq: vi.fn(() => ({ order: proposalsOrder })) })) }
        }
        throw new Error(`unexpected table ${table}`)
      }),
    }

    const res = await request(appWith({ id: "agency-1" }, supabase)).get("/job-1/proposals")

    expect(res.status).toBe(200)
    expect(res.body.proposals).toHaveLength(1)
    expect(res.body.proposals[0].profiles).toEqual({
      id: "freelancer-1",
      full_name: "Jane Doe",
      bio: "A dev",
      location: "Lagos",
      phone: null,
      website: null,
    })
  })

  it("returns 403 when the caller does not own the job", async () => {
    const jobMaybeSingle = vi.fn().mockResolvedValue({ data: { id: "job-1", agency_id: "agency-other" }, error: null })
    const supabase = {
      from: vi.fn(() => ({ select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: jobMaybeSingle })) })) })),
    }

    const res = await request(appWith({ id: "agency-1" }, supabase)).get("/job-1/proposals")

    expect(res.status).toBe(403)
    expect(res.body).toEqual({ error: "Forbidden" })
  })

  it("returns an empty list when the job doesn't exist", async () => {
    const jobMaybeSingle = vi.fn().mockResolvedValue({ data: null, error: null })
    const supabase = {
      from: vi.fn(() => ({ select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: jobMaybeSingle })) })) })),
    }

    const res = await request(appWith({ id: "agency-1" }, supabase)).get("/job-1/proposals")

    expect(res.body).toEqual({ proposals: [] })
  })
})
