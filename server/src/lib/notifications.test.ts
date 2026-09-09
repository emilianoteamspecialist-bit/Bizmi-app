import { describe, it, expect, vi, beforeEach } from "vitest"

const maybeSingleMock = vi.fn()
const fromMock = vi.fn(() => ({
  select: vi.fn(() => ({
    eq: vi.fn(() => ({
      maybeSingle: maybeSingleMock,
    })),
  })),
}))
vi.mock("./supabase.js", () => ({
  createServiceClient: vi.fn(() => ({ from: fromMock })),
}))

const sendEmailMock = vi.fn()
vi.mock("./email.js", () => ({
  sendEmail: sendEmailMock,
  emailLayout: vi.fn((opts: { heading: string }) => `<html>${opts.heading}</html>`),
}))

beforeEach(() => {
  vi.clearAllMocks()
  process.env.CLIENT_ORIGIN = "http://localhost:5173"
})

describe("notifyAgencyNewProposal", () => {
  it("emails the agency that owns the job", async () => {
    maybeSingleMock
      .mockResolvedValueOnce({ data: { title: "Build a website", agency_id: "agency-1" }, error: null })
      .mockResolvedValueOnce({ data: { email: "agency@example.com" }, error: null })

    const { notifyAgencyNewProposal } = await import("./notifications.js")
    await notifyAgencyNewProposal("job-1", "Jane Doe")

    expect(sendEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({ to: "agency@example.com", subject: expect.stringContaining("Build a website") })
    )
  })

  it("does nothing when the job has no agency_id", async () => {
    maybeSingleMock.mockResolvedValueOnce({ data: null, error: null })

    const { notifyAgencyNewProposal } = await import("./notifications.js")
    await notifyAgencyNewProposal("job-missing", "Jane Doe")

    expect(sendEmailMock).not.toHaveBeenCalled()
  })

  it("swallows errors instead of throwing (fail-soft)", async () => {
    maybeSingleMock.mockRejectedValueOnce(new Error("db down"))

    const { notifyAgencyNewProposal } = await import("./notifications.js")
    await expect(notifyAgencyNewProposal("job-1", "Jane Doe")).resolves.toBeUndefined()
  })
})

describe("notifyFreelancerProposalDecision", () => {
  it("emails the freelancer who submitted the proposal", async () => {
    maybeSingleMock
      .mockResolvedValueOnce({
        data: { freelancer_id: "freelancer-1", jobs: { title: "Build a website" } },
        error: null,
      })
      .mockResolvedValueOnce({ data: { email: "freelancer@example.com" }, error: null })

    const { notifyFreelancerProposalDecision } = await import("./notifications.js")
    await notifyFreelancerProposalDecision("proposal-1", "accept")

    expect(sendEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({ to: "freelancer@example.com", subject: expect.stringContaining("accepted") })
    )
  })
})
