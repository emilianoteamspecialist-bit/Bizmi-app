import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor, fireEvent } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

const useCreateJobMutationMock = vi.fn()
const useUpdateJobMutationMock = vi.fn()
vi.mock("../../lib/queries/jobs", () => ({
  useCreateJobMutation: () => useCreateJobMutationMock(),
  useUpdateJobMutation: () => useUpdateJobMutationMock(),
}))

import PostJobModal from "./PostJobModal"

function renderModal(props: Partial<React.ComponentProps<typeof PostJobModal>> = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <PostJobModal isOpen onClose={vi.fn()} editingJob={null} onSuccess={vi.fn()} {...props} />
    </QueryClientProvider>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  useCreateJobMutationMock.mockReturnValue({ mutate: vi.fn(), isPending: false })
  useUpdateJobMutationMock.mockReturnValue({ mutate: vi.fn(), isPending: false })
})

describe("PostJobModal", () => {
  it("renders step 1 fields when creating a new job", () => {
    renderModal()
    expect(screen.getByText(/step 1 of 4/i)).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/full-stack developer/i)).toBeInTheDocument()
  })

  it("pre-fills the form when editingJob is provided", () => {
    renderModal({
      editingJob: {
        id: "job-1",
        title: "Existing job",
        description: "Existing description",
        budget_min: 1000,
        budget_max: 2000,
        duration: "2 weeks",
        location: "Lagos",
        job_type: "Remote",
        credit_cost: 10,
        status: "active",
        skills: ["React"],
        created_at: "2026-01-01T00:00:00Z",
        agency_id: "agency-1",
        proposals: 0,
      },
    })
    expect(screen.getByDisplayValue("Existing job")).toBeInTheDocument()
  })

  it("disables Next on step 1 until title, description, and duration are filled", async () => {
    const user = userEvent.setup()
    renderModal()
    const nextButton = screen.getByRole("button", { name: /next/i })
    expect(nextButton).toBeDisabled()

    await user.type(screen.getByPlaceholderText(/full-stack developer/i), "A job")
    await user.type(screen.getByPlaceholderText(/describe your project/i), "A description")
    await user.type(screen.getByPlaceholderText(/2 weeks, 1 month/i), "2 weeks")

    expect(nextButton).not.toBeDisabled()
  })

  // Radix's default popper positioning can take over a minute in jsdom on Windows.
  it("calls createJob mutation with the assembled input and idempotencyKey on final submit", async () => {
    const mutate = vi.fn()
    useCreateJobMutationMock.mockReturnValue({ mutate, isPending: false })
    const user = userEvent.setup()
    renderModal()

    await user.type(screen.getByPlaceholderText(/full-stack developer/i), "A job")
    await user.type(screen.getByPlaceholderText(/describe your project/i), "A description")
    await user.type(screen.getByPlaceholderText(/2 weeks, 1 month/i), "2 weeks")
    await user.click(screen.getByRole("button", { name: /next/i }))

    // Step 2: pick at least one skill and leave credits at its default.
    const firstSkillCheckbox = screen.getAllByRole("checkbox")[0]
    await user.click(firstSkillCheckbox)
    await user.click(screen.getByRole("button", { name: /next/i }))

    // Step 3: job type, location, budgets.
    // Radix's SelectValue always renders its (placeholder or selected) text
    // in a span with an inline `pointer-events: none` style -- in a real
    // browser this lets a click on the visible text pass through to the
    // trigger button beneath it, but jsdom has no real hit-testing, so
    // user-event's strict per-element pointer-events check rejects a
    // simulated click on that span even though the interaction is valid.
    // Use fireEvent to open the trigger and select the option: both the
    // trigger and each SelectItem fall back to selecting/opening on a plain
    // "click" event (guarded by `pointerType !== "mouse"`, which holds since
    // no real pointerdown ever set it to "mouse" here), and this also avoids
    // an unrelated jsdom quirk where a full simulated pointer click sequence
    // on the option leaves a later, unrelated input's computed pointer-events
    // reported as "none".
    fireEvent.click(screen.getByText(/select job type/i))
    fireEvent.click(await screen.findByText("Remote"))
    await user.type(screen.getByPlaceholderText(/lagos, nigeria/i), "Lagos")
    await user.type(screen.getByPlaceholderText("100000"), "100000")
    await user.type(screen.getByPlaceholderText("500000"), "500000")
    await user.click(screen.getByRole("button", { name: /next/i }))

    // Step 4: submit.
    await user.click(screen.getByRole("button", { name: /post job/i }))

    // useCreateJobMutation's `mutate` is called as `mutate(input, { onSuccess, onError })`
    // (the standard React Query calling convention), so assert on the first
    // argument specifically rather than the full call signature.
    expect(mutate.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        title: "A job",
        description: "A description",
        duration: "2 weeks",
        job_type: "Remote",
        location: "Lagos",
        budget_min: 100000,
        budget_max: 500000,
        idempotencyKey: expect.any(String),
      })
    )
    // Types through all four steps with userEvent (~2s alone); under full-suite
    // load it can brush the 5s default, so give it headroom.
  }, 15_000)
})
