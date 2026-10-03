import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import SupportContact from "./SupportContact"

const openMock = vi.fn()

beforeEach(() => {
  openMock.mockReset()
  vi.stubGlobal("open", openMock)
})

describe("SupportContact", () => {
  it("renders the support channels, social links and help sections", () => {
    render(<SupportContact />)
    expect(screen.getByRole("heading", { name: /contact & support/i })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: /email support/i })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: /whatsapp support/i })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: /join community/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /instagram/i })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: /how we can help/i })).toBeInTheDocument()
  })

  it("opens a mailto link from Email us", () => {
    render(<SupportContact />)
    fireEvent.click(screen.getByRole("button", { name: /email us/i }))
    expect(openMock).toHaveBeenCalledWith("mailto:contact@bizimii.com", "_blank")
  })

  it("opens WhatsApp with a prefilled support message from Chat with us", () => {
    render(<SupportContact />)
    fireEvent.click(screen.getByRole("button", { name: /chat with us/i }))
    const [url, target] = openMock.mock.calls[0]
    expect(url).toMatch(/^https:\/\/wa\.me\/\+2347026875518\?text=/)
    expect(decodeURIComponent(url.split("text=")[1])).toBe("Hello Support, I need assistance with Bizimi platform.")
    expect(target).toBe("_blank")
  })
})
