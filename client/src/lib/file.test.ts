import { describe, it, expect } from "vitest"
import { fileToBase64 } from "./file"

describe("fileToBase64", () => {
  it("resolves the base64 payload, data URL, mime type, and file name", async () => {
    const file = new File(["hello"], "avatar.png", { type: "image/png" })

    const result = await fileToBase64(file)

    expect(result.data).toBe(btoa("hello"))
    expect(result.dataUrl).toContain("base64,")
    expect(result.mimeType).toBe("image/png")
    expect(result.fileName).toBe("avatar.png")
  })
})
