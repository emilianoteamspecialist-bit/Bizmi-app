import { describe, it, expect, vi, beforeEach } from "vitest"
import { render } from "@testing-library/react"

const apiFetchMock = vi.fn()
vi.mock("../lib/api", () => ({ apiFetch: (...args: unknown[]) => apiFetchMock(...args) }))

import ReferralSync from "./ReferralSync"

beforeEach(() => {
  vi.clearAllMocks()
})

describe("ReferralSync", () => {
  it("POSTs /api/me/referral-sync once on mount and renders nothing", () => {
    apiFetchMock.mockResolvedValue({ success: true })
    const { container } = render(<ReferralSync />)
    expect(apiFetchMock).toHaveBeenCalledWith("/api/me/referral-sync", { method: "POST" })
    expect(apiFetchMock).toHaveBeenCalledTimes(1)
    expect(container).toBeEmptyDOMElement()
  })

  it("swallows a failed sync without throwing", () => {
    apiFetchMock.mockRejectedValue(new Error("network error"))
    expect(() => render(<ReferralSync />)).not.toThrow()
  })
})
