import { describe, it, expect, vi, beforeEach } from "vitest"

const sendMock = vi.fn()
vi.mock("resend", () => ({
  Resend: vi.fn().mockImplementation(() => ({ emails: { send: sendMock } })),
}))

beforeEach(() => {
  vi.resetModules()
  sendMock.mockReset()
  delete process.env.RESEND_API_KEY
  delete process.env.EMAIL_FROM
})

describe("sendEmail", () => {
  it("skips sending and returns { skipped: true } when RESEND_API_KEY is unset", async () => {
    const { sendEmail } = await import("./email.js")
    const result = await sendEmail({ to: "a@b.com", subject: "Hi", html: "<p>hi</p>" })

    expect(result).toEqual({ skipped: true })
    expect(sendMock).not.toHaveBeenCalled()
  })

  it("sends via Resend with the configured from address when the key is set", async () => {
    process.env.RESEND_API_KEY = "re_test_key"
    process.env.EMAIL_FROM = "Bizimi Team <team@bizimii.com>"
    sendMock.mockResolvedValue({ data: { id: "email-1" }, error: null })

    const { sendEmail } = await import("./email.js")
    const result = await sendEmail({ to: "a@b.com", subject: "Hi", html: "<p>hi</p>" })

    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "Bizimi Team <team@bizimii.com>",
        to: "a@b.com",
        subject: "Hi",
        html: "<p>hi</p>",
      })
    )
    expect(result).toEqual({ id: "email-1" })
  })
})

describe("emailLayout", () => {
  it("HTML-escapes the heading and embeds the body and CTA", async () => {
    process.env.RESEND_API_KEY = "re_test_key"
    const { emailLayout } = await import("./email.js")
    const html = emailLayout({
      heading: "You've got <mail>",
      body: "Some <strong>body</strong> html",
      cta: { label: "Open", url: "https://example.com" },
    })

    expect(html).toContain("You&#39;ve got &lt;mail&gt;")
    expect(html).toContain("Some <strong>body</strong> html")
    expect(html).toContain('href="https://example.com"')
    expect(html).toContain(">Open<")
  })
})
