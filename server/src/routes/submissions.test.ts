import { describe, it, expect, vi, beforeEach } from "vitest"
import express from "express"
import request from "supertest"
import { fakeSupabase, callsTo, hasFilter, type Handler } from "../test/fakeSupabase.js"

let service = fakeSupabase(() => ({}))
vi.mock("../lib/supabase.js", () => ({ createServiceClient: () => service.client }))

import submissionsRouter from "./submissions.js"

function appWith(user: { id: string }, userClient: any) {
  const a = express()
  a.use(express.json())
  a.use((req: any, _res, next) => {
    req.user = user
    req.supabase = userClient
    next()
  })
  a.use("/", submissionsRouter)
  a.use((err: any, _req: any, res: any, _next: any) => res.status(500).json({ error: err.message }))
  return a
}

const useService = (handler: Handler) => (service = fakeSupabase(handler))
const escrow = (status_v2: string) => ({ id: "esc-1", job_id: "job-1", agency_id: "agency-1", freelancer_id: "free-1", amount_kobo: 100, status_v2 })
const submission = (status: string) => ({ id: "sub-1", job_id: "job-1", freelancer_id: "free-1", agency_id: "agency-1", status })

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {})
  vi.spyOn(console, "error").mockImplementation(() => {})
})

describe("GET /", () => {
  it("404s for someone who isn't a party to the job's escrow", async () => {
    useService((op) => (op.table === "escrow_deposits" ? { data: escrow("funded") } : {}))
    const user = fakeSupabase(() => ({}))
    const res = await request(appWith({ id: "stranger" }, user.client)).get("/?jobId=job-1")
    expect(res.status).toBe(404)
  })

  it("returns role, job, escrow state and submission for a party", async () => {
    useService((op) => {
      if (op.table === "escrow_deposits") return { data: escrow("funded") }
      if (op.table === "jobs") return { data: { id: "job-1", title: "Site" } }
      return {}
    })
    const user = fakeSupabase(() => ({ data: submission("submitted") }))
    const res = await request(appWith({ id: "agency-1" }, user.client)).get("/?jobId=job-1")
    expect(res.body).toMatchObject({ role: "agency", job: { title: "Site" }, escrow: { status: "funded" }, submission: { status: "submitted" } })
  })
})

describe("POST / (submit work)", () => {
  const body = { job_id: "job-1", submission_type: "tech", content: { github_url: "https://github.com/x" } }

  it("only lets the escrow's freelancer submit", async () => {
    useService(() => ({ data: escrow("funded") }))
    const user = fakeSupabase(() => ({}))
    const res = await request(appWith({ id: "agency-1" }, user.client)).post("/").send(body)
    expect(res.status).toBe(403)
    expect(user.calls).toHaveLength(0)
  })

  it("refuses submissions unless the escrow is funded", async () => {
    useService(() => ({ data: escrow("awaiting") }))
    const user = fakeSupabase(() => ({}))
    const res = await request(appWith({ id: "free-1" }, user.client)).post("/").send(body)
    expect(res.status).toBe(409)
  })

  it("upserts a submitted row with identities from the escrow, ignoring body-supplied ids", async () => {
    useService(() => ({ data: escrow("funded") }))
    const user = fakeSupabase((op) => (op.action === "upsert" ? { data: { id: "sub-1" } } : { data: null }))
    const res = await request(appWith({ id: "free-1" }, user.client))
      .post("/")
      .send({ ...body, freelancer_id: "spoof", agency_id: "spoof" })
    expect(res.status).toBe(200)
    const [upsert] = callsTo(user.calls, "project_submissions", "upsert")
    expect(upsert.payload).toMatchObject({ job_id: "job-1", freelancer_id: "free-1", agency_id: "agency-1", submission_type: "tech", status: "submitted" })
  })

  it("won't overwrite an approved submission", async () => {
    useService(() => ({ data: escrow("funded") }))
    const user = fakeSupabase(() => ({ data: { status: "approved" } }))
    const res = await request(appWith({ id: "free-1" }, user.client)).post("/").send(body)
    expect(res.status).toBe(409)
  })
})

describe("POST /:id/comments", () => {
  it("lets only the agency request changes", async () => {
    const user = fakeSupabase(() => ({ data: submission("submitted") }))
    const res = await request(appWith({ id: "free-1" }, user.client)).post("/sub-1/comments").send({ message: "pls", is_revision_request: true })
    expect(res.status).toBe(403)
  })

  it("posts the comment as the caller and flips a submitted submission to changes_requested", async () => {
    const user = fakeSupabase((op) => (op.action === "insert" ? { data: { id: "c-1" } } : { data: submission("submitted") }))
    const res = await request(appWith({ id: "agency-1" }, user.client))
      .post("/sub-1/comments")
      .send({ message: "Fix the header", is_revision_request: true, sender_id: "spoof" })
    expect(res.status).toBe(200)
    expect(callsTo(user.calls, "submission_comments", "insert")[0].payload).toEqual({ submission_id: "sub-1", sender_id: "agency-1", message: "Fix the header" })
    expect(callsTo(user.calls, "project_submissions", "update")[0].payload).toMatchObject({ status: "changes_requested" })
  })
})

describe("POST /:id/approve", () => {
  it("only lets the funding agency approve", async () => {
    const user = fakeSupabase(() => ({ data: submission("submitted") }))
    const s = useService(() => ({ data: escrow("funded") }))
    const res = await request(appWith({ id: "free-1" }, user.client)).post("/sub-1/approve")
    expect(res.status).toBe(403)
    expect(callsTo(s.calls, "escrow_deposits", "update")).toHaveLength(0)
  })

  it("refuses to approve work that hasn't been submitted", async () => {
    const user = fakeSupabase(() => ({ data: submission("changes_requested") }))
    useService(() => ({ data: escrow("funded") }))
    const res = await request(appWith({ id: "agency-1" }, user.client)).post("/sub-1/approve")
    expect(res.status).toBe(409)
  })

  it("can't release a disputed escrow", async () => {
    const user = fakeSupabase(() => ({ data: submission("submitted") }))
    useService(() => ({ data: escrow("disputed") }))
    const res = await request(appWith({ id: "agency-1" }, user.client)).post("/sub-1/approve")
    expect(res.status).toBe(409)
  })

  it("releases the escrow, approves the submission and marks the job payable", async () => {
    const user = fakeSupabase(() => ({ data: submission("submitted") }))
    const s = useService((op) => {
      if (op.table === "escrow_deposits" && op.action === "select") return { data: escrow("funded") }
      if (op.table === "escrow_deposits" && op.action === "update") return { data: { id: "esc-1" } }
      if (op.table === "jobs" && op.action === "select") return { data: { payout_status: null } }
      return {}
    })

    const res = await request(appWith({ id: "agency-1" }, user.client)).post("/sub-1/approve")

    expect(res.status).toBe(200)
    const [release] = callsTo(s.calls, "escrow_deposits", "update")
    expect(release.payload).toMatchObject({ status_v2: "released", status: "confirmed" })
    expect(hasFilter(release, "eq", "status_v2", "funded")).toBe(true)
    expect(callsTo(s.calls, "escrow_append_event", "rpc")[0].payload).toMatchObject({ p_idempotency_key: "release:esc-1", p_actor_type: "agency" })
    expect(callsTo(s.calls, "project_submissions", "update")[0].payload).toMatchObject({ status: "approved" })
    expect(callsTo(s.calls, "jobs", "update")[0].payload).toEqual({ status: "closed", payout_status: "completed" })
  })

  it("never reopens a payout that has already started", async () => {
    const user = fakeSupabase(() => ({ data: submission("submitted") }))
    const s = useService((op) => {
      if (op.table === "escrow_deposits" && op.action === "select") return { data: escrow("funded") }
      if (op.table === "escrow_deposits" && op.action === "update") return { data: { id: "esc-1" } }
      if (op.table === "jobs" && op.action === "select") return { data: { payout_status: "processing" } }
      return {}
    })
    await request(appWith({ id: "agency-1" }, user.client)).post("/sub-1/approve")
    expect(callsTo(s.calls, "jobs", "update")[0].payload).toEqual({ status: "closed" })
  })

  it("is idempotent: re-approving an already-released escrow doesn't transition again", async () => {
    const user = fakeSupabase(() => ({ data: submission("approved") }))
    const s = useService((op) => {
      if (op.table === "escrow_deposits" && op.action === "select") return { data: escrow("released") }
      if (op.table === "jobs" && op.action === "select") return { data: { payout_status: "completed" } }
      return {}
    })
    const res = await request(appWith({ id: "agency-1" }, user.client)).post("/sub-1/approve")
    expect(res.status).toBe(200)
    expect(callsTo(s.calls, "escrow_deposits", "update")).toHaveLength(0)
  })
})
