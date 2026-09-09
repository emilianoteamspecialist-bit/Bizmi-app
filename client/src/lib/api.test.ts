import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("./supabase", () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { access_token: "token-123" } },
      }),
    },
  },
}))

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ hello: "world" }),
    })
  )
})

describe("apiFetch", () => {
  it("attaches the session's bearer token and calls the API base URL", async () => {
    const { apiFetch } = await import("./api")
    const result = await apiFetch("/api/me")

    expect(fetch).toHaveBeenCalledWith(
      `${import.meta.env.VITE_API_URL}/api/me`,
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer token-123" }),
      })
    )
    expect(result).toEqual({ hello: "world" })
  })

  it("throws when the response is not ok", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 404, json: async () => ({ error: "Not found" }) })
    )
    const { apiFetch } = await import("./api")
    await expect(apiFetch("/api/me")).rejects.toThrow("Not found")
  })
})
