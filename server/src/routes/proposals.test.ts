import { describe, it, expect, vi, beforeEach } from "vitest"
import express from "express"
import request from "supertest"
import * as notificationsModule from "../lib/notifications.js"
import proposalsRouter from "./proposals.js"

function appWith(user: { id: string }, supabase: any) {
  const app = express()
  app.use(express.json())
  app.use((req: any, _res, next) => {
    req.user = user
    req.supabase = supabase
    next()
  })
  app.use("/", proposalsRouter)
  return app
}

const notifyAgencyNewProposalMock = vi.spyOn(notificationsModule, "notifyAgencyNewProposal")
const notifyFreelancerProposalDecisionMock = vi.spyOn(notificationsModule, "notifyFreelancerProposalDecision")

beforeEach(() => {
  vi.clearAllMocks()
})

describe("POST /:proposalId/respond", () => {
  it("accepts a proposal owned by the calling agency and notifies the freelancer", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: { id: "p1", jobs: { agency_id: "agency-1" } }, error: null })
    const updateEq = vi.fn().mockResolvedValue({ error: null })
    const supabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle })) })),
        update: vi.fn(() => ({ eq: updateEq })),
      })),
    }

    const res = await request(appWith({ id: "agency-1" }, supabase)).post("/p1/respond").send({ action: "accept" })

    expect(res.body).toEqual({ success: true })
    expect(notifyFreelancerProposalDecisionMock).toHaveBeenCalledWith("p1", "accept")
  })

  it("returns success:false Forbidden when the proposal's job belongs to a different agency", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: { id: "p1", jobs: { agency_id: "agency-other" } }, error: null })
    const supabase = { from: vi.fn(() => ({ select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle })) })) })) }

    const res = await request(appWith({ id: "agency-1" }, supabase)).post("/p1/respond").send({ action: "accept" })

    expect(res.body).toEqual({ success: false, error: "Forbidden" })
  })
})

describe("POST /jobs/:jobId", () => {
  it("rejects a non-positive budget without calling the RPC", async () => {
    const supabase = { rpc: vi.fn() }

    const res = await request(appWith({ id: "freelancer-1" }, supabase))
      .post("/jobs/job-1")
      .send({ proposal_text: "hi", timeline: "1 week", budget: "0" })

    expect(res.body).toEqual({ success: false, error: "Please enter a valid budget.", code: "invalid_budget" })
    expect(supabase.rpc).not.toHaveBeenCalled()
  })

  it("submits via place_bid and notifies the agency on success", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: { full_name: "Jane" }, error: null })
    const supabase = {
      rpc: vi.fn().mockResolvedValue({ data: { ok: true }, error: null }),
      from: vi.fn(() => ({ select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle })) })) })),
    }

    const res = await request(appWith({ id: "freelancer-1" }, supabase))
      .post("/jobs/job-1")
      .send({ proposal_text: "hi", timeline: "1 week", budget: "5000", creditCost: 2 })

    expect(res.body).toEqual({ success: true, alreadySubmitted: false })
    expect(notifyAgencyNewProposalMock).toHaveBeenCalledWith("job-1", "Jane")
  })

  it("surfaces insufficient_credits without notifying anyone", async () => {
    const supabase = { rpc: vi.fn().mockResolvedValue({ data: { ok: false, code: "insufficient_credits" }, error: null }) }

    const res = await request(appWith({ id: "freelancer-1" }, supabase))
      .post("/jobs/job-1")
      .send({ proposal_text: "hi", timeline: "1 week", budget: "5000", creditCost: 2 })

    expect(res.body).toEqual({
      success: false,
      error: "Insufficient credits to place this bid.",
      code: "insufficient_credits",
    })
    expect(notifyAgencyNewProposalMock).not.toHaveBeenCalled()
  })
})

describe("GET /mine", () => {
  it("returns the freelancer's proposals enriched with job/funding/status info", async () => {
    const proposalsRange = vi.fn().mockResolvedValue({
      data: [{ id: "prop-1", job_id: "job-1" }],
      error: null,
    })
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "proposals") {
          return { select: vi.fn(() => ({ eq: vi.fn(() => ({ order: vi.fn(() => ({ range: proposalsRange })) })) })) }
        }
        if (table === "jobs") {
          return { select: vi.fn(() => ({ in: vi.fn().mockResolvedValue({ data: [{ id: "job-1", title: "Build a site", agency_id: "agency-1" }] }) })) }
        }
        if (table === "job_funding_status") {
          return { select: vi.fn(() => ({ in: vi.fn().mockResolvedValue({ data: [{ job_id: "job-1", funding_status: "funded", job_status: "in_progress" }] }) })) }
        }
        if (table === "freelancer_proposal_status") {
          return { select: vi.fn(() => ({ in: vi.fn().mockResolvedValue({ data: [{ proposal_id: "prop-1", freelancer_status: "accepted" }] }) })) }
        }
        if (table === "profiles") {
          return { select: vi.fn(() => ({ in: vi.fn().mockResolvedValue({ data: [{ id: "agency-1", full_name: "Jane", company_name: "Jane Co" }] }) })) }
        }
        throw new Error(`unexpected table ${table}`)
      }),
    }

    const res = await request(appWith({ id: "freelancer-1" }, supabase)).get("/mine")

    expect(res.body.proposals).toEqual([
      expect.objectContaining({
        id: "prop-1",
        job_title: "Build a site",
        agency_name: "Jane Co",
        funding_status: "funded",
        freelancer_status: "accepted",
      }),
    ])
  })
})
