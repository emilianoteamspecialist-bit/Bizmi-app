import { describe, it, expect, beforeEach, vi } from "vitest"

beforeEach(() => {
  vi.stubEnv("VITE_SUPABASE_URL", "https://example.supabase.co")
})

describe("getAvatarUrl", () => {
  it("builds a public storage URL for a given path", async () => {
    const { getAvatarUrl } = await import("./avatar")
    expect(getAvatarUrl("user-1/logo.png")).toBe("https://example.supabase.co/storage/v1/object/public/avatars/user-1/logo.png")
  })

  it("returns an empty string for a missing path", async () => {
    const { getAvatarUrl } = await import("./avatar")
    expect(getAvatarUrl(null)).toBe("")
    expect(getAvatarUrl(undefined)).toBe("")
  })
})

describe("resolveAvatar", () => {
  it("prefers logo_path over logo_data", async () => {
    const { resolveAvatar } = await import("./avatar")
    expect(resolveAvatar({ logo_path: "a/b.png", logo_data: "data:image/png;base64,xyz" })).toBe(
      "https://example.supabase.co/storage/v1/object/public/avatars/a/b.png"
    )
  })

  it("falls back to image_data when no path is present", async () => {
    const { resolveAvatar } = await import("./avatar")
    expect(resolveAvatar({ image_data: "data:image/png;base64,xyz" })).toBe("data:image/png;base64,xyz")
  })
})
