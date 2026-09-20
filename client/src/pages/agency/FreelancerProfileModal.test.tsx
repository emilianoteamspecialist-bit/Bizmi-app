import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import FreelancerProfileModal from "./FreelancerProfileModal"
import type { FreelancerSearchResult } from "@/lib/queries/freelancers"

const freelancer: FreelancerSearchResult = {
  id: "freelancer-1",
  full_name: "Jane Doe",
  bio: "I build things",
  location: "Lagos",
  skills: ["Web Development"],
  created_at: "2026-01-01T00:00:00Z",
  logo: null,
  verification_status: "verified",
  jobs_completed: 6,
}

describe("FreelancerProfileModal", () => {
  it("renders nothing when closed", () => {
    const { container } = render(<FreelancerProfileModal freelancer={freelancer} isOpen={false} onClose={vi.fn()} />)
    expect(container).toBeEmptyDOMElement()
  })

  it("renders nothing when no freelancer is selected", () => {
    const { container } = render(<FreelancerProfileModal freelancer={null} isOpen onClose={vi.fn()} />)
    expect(container).toBeEmptyDOMElement()
  })

  it("shows the freelancer's details, trust badge, skills, and derived categories", () => {
    render(<FreelancerProfileModal freelancer={freelancer} isOpen onClose={vi.fn()} />)
    expect(screen.getByText("Jane Doe")).toBeInTheDocument()
    expect(screen.getByText("I build things")).toBeInTheDocument()
    expect(screen.getByText("Lagos")).toBeInTheDocument()
    expect(screen.getByText("Fully Verified")).toBeInTheDocument()
    expect(screen.getByText("Web Development")).toBeInTheDocument()
    expect(screen.getByText("Tech")).toBeInTheDocument()
    expect(screen.getByText("6")).toBeInTheDocument()
  })

  it("calls onClose when the close button is clicked", async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<FreelancerProfileModal freelancer={freelancer} isOpen onClose={onClose} />)
    await user.click(screen.getByRole("button", { name: /close/i }))
    expect(onClose).toHaveBeenCalled()
  })
})
