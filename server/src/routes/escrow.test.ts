import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import express from "express"
import request from "supertest"
import { fakeSupabase, callsTo, hasFilter, type Handler } from "../test/fakeSupabase.js"

let service = fakeSupabase(() => ({}))
vi.mock("../lib/supabase.js", () => ({ createServiceClient: () => service.client }))

import escrowRouter from "./escrow.js"

function appWith(user: { id: string; email?: string }, userClient: any) {
  const a = express()
  a.use(express.json())
  a.use((req: any, _res, next) => {
    req.user = user
    req.supabase = userClient
    next()
  })
  a.use("/", escrowRouter)
  a.use((err: any, _req: any, res: any, _next: any) => res.status(500).json({ error: err.message }))
  return a
}

const agency = { id: "agency-1", email: "a@x.com" }
const proposal = {
  id: "prop-1",
  job_id: "job-1",
  freelancer_id: "free-1",
  status: "accepted",
  budget: 50_000,
  jobs: { id: "job-1", agency_id: "agency-1", title: "Site" },
}

const userClientWith = (handler: Handler) => fakeSupabase(handler)
const useService = (handler: Handler) => (service = fakeSupabase(handler))

const paystackOk = (data: unknown) => vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: true, data }) })

beforeEach(() => {
  process.env.PAYSTACK_SECRET_KEY = "sk_test"
  process.env.CLIENT_ORIGIN = "https://app.example"
  vi.spyOn(console, "error").mockImplementation(() => {})
})
afterEach(() => vi.unstubAllGlobals())

describe("POST /initialize", () => {
  it("rejects an agency funding someone else's job", async () => {
    const user = userClientWith(() => ({ data: { ...proposal, jobs: { ...proposal.jobs, agency_id: "other" } } }))
    const s = useService(() => ({}))
    const res = await request(appWith(agency, user.client)).post("/initialize").send({ proposalId: "prop-1" })
    expect(res.status).toBe(403)
    expect(s.calls).toHaveLength(0)
  })

  it("rejects a proposal that isn't accepted", async () => {
    const user = userClientWith(() => ({ data: { ...proposal, status: "pending" } }))
    useService(() => ({}))
    const res = await request(appWith(agency, user.client)).post("/initialize").send({ proposalId: "prop-1" })
    expect(res.status).toBe(409)
  })

  it("hands back the existing checkout when the escrow is still awaiting payment", async () => {
    const user = userClientWith(() => ({ data: proposal }))
    const s = useService((op) =>
      op.table === "escrow_deposits" && op.action === "select"
        ? { data: { id: "esc-1", status_v2: "awaiting", paystack_reference: "escrow_esc-1_a", paystack_authorization_url: "https://pay/x" } }
        : {}
    )
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)

    const res = await request(appWith(agency, user.client)).post("/initialize").send({ proposalId: "prop-1" })

    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ resumed: true, authorization_url: "https://pay/x" })
    expect(fetchMock).not.toHaveBeenCalled()
    expect(callsTo(s.calls, "escrow_deposits", "insert")).toHaveLength(0)
  })

  it("refuses to fund a job whose escrow is already funded", async () => {
    const user = userClientWith(() => ({ data: proposal }))
    useService((op) => (op.table === "escrow_deposits" && op.action === "select" ? { data: { id: "esc-1", status_v2: "funded" } } : {}))
    const res = await request(appWith(agency, user.client)).post("/initialize").send({ proposalId: "prop-1" })
    expect(res.status).toBe(409)
  })

  it("creates a pending escrow from the proposal (server-derived kobo), initializes Paystack and moves to awaiting", async () => {
    const user = userClientWith(() => ({ data: proposal }))
    const s = useService((op) => {
      if (op.table === "escrow_deposits" && op.action === "select") return { data: null }
      if (op.table === "escrow_deposits" && op.action === "insert") return { data: { id: "esc-new" } }
      if (op.table === "escrow_deposits" && op.action === "update") return { data: { id: "esc-new" } }
      return {}
    })
    const fetchMock = paystackOk({ authorization_url: "https://pay/new", access_code: "ac", reference: "escrow_esc-new_r" })
    vi.stubGlobal("fetch", fetchMock)

    const res = await request(appWith(agency, user.client)).post("/initialize").send({ proposalId: "prop-1", amount: 1 })

    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ escrow_id: "esc-new", authorization_url: "https://pay/new" })
    const [insert] = callsTo(s.calls, "escrow_deposits", "insert")
    expect(insert.payload).toMatchObject({ job_id: "job-1", agency_id: "agency-1", freelancer_id: "free-1", amount_kobo: 5_000_000, status_v2: "pending" })
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body).toMatchObject({ email: "a@x.com", amount: 5_000_000, callback_url: "https://app.example/agency/escrow/return" })
    expect(body.reference).toMatch(/^escrow_esc-new_/)
    const [update] = callsTo(s.calls, "escrow_deposits", "update")
    expect(update.payload).toMatchObject({ status_v2: "awaiting", paystack_reference: "escrow_esc-new_r", paystack_authorization_url: "https://pay/new" })
    expect(hasFilter(update, "eq", "status_v2", "pending")).toBe(true)
  })

  it("reuses a pending escrow left by a failed attempt instead of inserting a duplicate", async () => {
    const user = userClientWith(() => ({ data: proposal }))
    const s = useService((op) => {
      if (op.table === "escrow_deposits" && op.action === "select")
        return { data: { id: "esc-old", status_v2: "pending", freelancer_id: "free-1", amount_kobo: 5_000_000 } }
      if (op.table === "escrow_deposits" && op.action === "update") return { data: { id: "esc-old" } }
      return {}
    })
    vi.stubGlobal("fetch", paystackOk({ authorization_url: "u", access_code: "a", reference: "escrow_esc-old_r" }))

    const res = await request(appWith(agency, user.client)).post("/initialize").send({ proposalId: "prop-1" })

    expect(res.status).toBe(200)
    expect(res.body.escrow_id).toBe("esc-old")
    expect(callsTo(s.calls, "escrow_deposits", "insert")).toHaveLength(0)
  })

  it("returns 502 and leaves the escrow pending when Paystack rejects the initialization", async () => {
    const user = userClientWith(() => ({ data: proposal }))
    const s = useService((op) => {
      if (op.table === "escrow_deposits" && op.action === "select") return { data: null }
      if (op.table === "escrow_deposits" && op.action === "insert") return { data: { id: "esc-new" } }
      return {}
    })
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 400, json: async () => ({ status: false, message: "Invalid email" }) }))

    const res = await request(appWith(agency, user.client)).post("/initialize").send({ proposalId: "prop-1" })

    expect(res.status).toBe(502)
    expect(res.body.error).toBe("Invalid email")
    expect(callsTo(s.calls, "escrow_deposits", "update")).toHaveLength(0)
  })
})

describe("GET /verify", () => {
  it("only accepts escrow references", async () => {
    const user = userClientWith(() => ({}))
    const res = await request(appWith(agency, user.client)).get("/verify?reference=credits_1")
    expect(res.status).toBe(400)
  })

  it("404s when RLS hides the escrow from the caller", async () => {
    const user = userClientWith(() => ({ data: null }))
    const res = await request(appWith(agency, user.client)).get("/verify?reference=escrow_esc-1_a")
    expect(res.status).toBe(404)
  })

  it("reports an already-funded escrow without calling Paystack", async () => {
    const user = userClientWith(() => ({ data: { id: "esc-1", status_v2: "funded" } }))
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
    const res = await request(appWith(agency, user.client)).get("/verify?reference=escrow_esc-1_a")
    expect(res.body).toMatchObject({ already_processed: true, status: "funded" })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("funds the escrow when Paystack confirms the full amount", async () => {
    const user = userClientWith(() => ({
      data: { id: "esc-1", job_id: "job-1", agency_id: "agency-1", freelancer_id: "free-1", amount_kobo: 5_000_000, status_v2: "awaiting" },
    }))
    const s = useService((op) => (op.table === "escrow_deposits" && op.action === "update" ? { data: { id: "esc-1" } } : {}))
    vi.stubGlobal("fetch", paystackOk({ status: "success", amount: 5_000_000 }))

    const res = await request(appWith(agency, user.client)).get("/verify?reference=escrow_esc-1_a")

    expect(res.status).toBe(200)
    expect(callsTo(s.calls, "escrow_deposits", "update")[0].payload).toMatchObject({ status_v2: "funded" })
    expect(callsTo(s.calls, "escrow_append_event", "rpc")[0].payload).toMatchObject({ p_actor_type: "agency", p_idempotency_key: "verify:escrow_esc-1_a" })
  })

  it("returns 402 when the Paystack charge isn't successful", async () => {
    const user = userClientWith(() => ({ data: { id: "esc-1", amount_kobo: 5_000_000, status_v2: "awaiting", agency_id: "agency-1" } }))
    useService(() => ({}))
    vi.stubGlobal("fetch", paystackOk({ status: "abandoned", amount: 5_000_000 }))
    const res = await request(appWith(agency, user.client)).get("/verify?reference=escrow_esc-1_a")
    expect(res.status).toBe(402)
  })
})

describe("GET /mine", () => {
  it("returns the caller's escrows enriched with job, parties, submission, dispute and latest payout", async () => {
    const user = userClientWith(() => ({
      data: [{ id: "esc-1", job_id: "job-1", agency_id: "agency-1", freelancer_id: "free-1", amount_kobo: 100, status_v2: "released" }],
    }))
    useService((op) => {
      if (op.table === "jobs") return { data: [{ id: "job-1", title: "Site" }] }
      if (op.table === "profiles") return { data: [{ id: "agency-1", company_name: "Acme" }, { id: "free-1", full_name: "Jane" }] }
      if (op.table === "project_submissions") return { data: [{ job_id: "job-1", status: "approved" }] }
      if (op.table === "payouts") return { data: [{ escrow_id: "esc-1", status: "failed" }] }
      if (op.table === "disputes") return { data: [] }
      return {}
    })

    const res = await request(appWith({ id: "free-1" }, user.client)).get("/mine")

    expect(res.status).toBe(200)
    expect(res.body.escrows[0]).toMatchObject({
      role: "freelancer",
      job_title: "Site",
      agency_name: "Acme",
      freelancer_name: "Jane",
      submission_status: "approved",
      open_dispute_id: null,
      latest_payout: { status: "failed" },
    })
  })
})
