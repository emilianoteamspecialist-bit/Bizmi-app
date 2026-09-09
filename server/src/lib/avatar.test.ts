import { describe, it, expect, beforeEach } from "vitest"
import { getAvatarUrl, resolveAvatar } from "./avatar.js"

beforeEach(() => {
  process.env.SUPABASE_URL = "https://example.supabase.co"
})

describe("getAvatarUrl", () => {
  it("builds a public storage URL for a given path", () => {
    expect(getAvatarUrl("user-1/logo.png")).toBe(
      "https://example.supabase.co/storage/v1/object/public/avatars/user-1/logo.png"
    )
  })

  it("returns an empty string for a missing path", () => {
    expect(getAvatarUrl(null)).toBe("")
    expect(getAvatarUrl(undefined)).toBe("")
  })
})

describe("resolveAvatar", () => {
  it("prefers logo_path over logo_data", () => {
    expect(resolveAvatar({ logo_path: "a/b.png", logo_data: "data:image/png;base64,xyz" })).toBe(
      "https://example.supabase.co/storage/v1/object/public/avatars/a/b.png"
    )
  })

  it("falls back to image_data when no path is present", () => {
    expect(resolveAvatar({ image_data: "data:image/png;base64,xyz" })).toBe("data:image/png;base64,xyz")
  })

  it("returns an empty string for a null row", () => {
    expect(resolveAvatar(null)).toBe("")
  })
})
