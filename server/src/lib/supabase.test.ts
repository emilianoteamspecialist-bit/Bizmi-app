import { describe, it, expect, vi, beforeEach } from "vitest"

const createClientMock = vi.fn(() => ({ mocked: true }))
vi.mock("@supabase/supabase-js", () => ({
  createClient: createClientMock,
}))

beforeEach(() => {
  createClientMock.mockClear()
  process.env.SUPABASE_URL = "https://example.supabase.co"
  process.env.SUPABASE_ANON_KEY = "anon-key"
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key"
})

describe("createUserClient", () => {
  it("builds a client scoped to the given bearer token", async () => {
    const { createUserClient } = await import("./supabase.js")
    createUserClient("user-token-123")

    expect(createClientMock).toHaveBeenCalledWith(
      "https://example.supabase.co",
      "anon-key",
      expect.objectContaining({
        global: { headers: { Authorization: "Bearer user-token-123" } },
      })
    )
  })
})

describe("createServiceClient", () => {
  it("builds a client with the service-role key", async () => {
    const { createServiceClient } = await import("./supabase.js")
    createServiceClient()

    expect(createClientMock).toHaveBeenCalledWith(
      "https://example.supabase.co",
      "service-key",
      expect.objectContaining({
        auth: { persistSession: false, autoRefreshToken: false },
      })
    )
  })
})
