import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

const useAuthMock = vi.fn()
vi.mock("../../contexts/AuthContext", () => ({ useAuth: () => useAuthMock() }))

const useConversationsQueryMock = vi.fn()
const useConversationMessagesQueryMock = vi.fn()
const sendMessageMutate = vi.fn()
const sendFileMutate = vi.fn()
const markReadMutate = vi.fn()
const useRealtimeMessagesMock = vi.fn()
vi.mock("../../lib/queries/messages", () => ({
  useConversationsQuery: () => useConversationsQueryMock(),
  useConversationMessagesQuery: (...args: unknown[]) => useConversationMessagesQueryMock(...args),
  useSendMessageMutation: () => ({ mutate: sendMessageMutate, isPending: false }),
  useSendFileMessageMutation: () => ({ mutate: sendFileMutate, isPending: false }),
  useMarkReadMutation: () => ({ mutate: markReadMutate }),
  useRealtimeMessages: (...args: unknown[]) => useRealtimeMessagesMock(...args),
}))

import Messages from "./Messages"

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <Messages />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

const oneConversation = { id: "conv-1", last_message_at: "2026-01-01T00:00:00Z", participant: { id: "user-2", full_name: "Jane Doe", avatar: "" } }
const oneMessage = { id: "m-1", conversation_id: "conv-1", sender_id: "user-2", receiver_id: "user-1", message_text: "Hello there", file_url: null, file_name: null, file_type: null, file_size: null, is_read: false, created_at: "2026-01-01T00:00:00Z" }

beforeEach(() => {
  vi.clearAllMocks()
  useAuthMock.mockReturnValue({ user: { id: "user-1" } })
  useConversationsQueryMock.mockReturnValue({ isLoading: false, data: { conversations: [] } })
  useConversationMessagesQueryMock.mockReturnValue({ isLoading: false, data: { messages: [] } })
})

describe("Messages", () => {
  it("shows a loading skeleton while conversations are pending", () => {
    useConversationsQueryMock.mockReturnValue({ isLoading: true, data: undefined })
    renderPage()
    expect(screen.getByTestId("messages-skeleton")).toBeInTheDocument()
  })

  it("shows an empty state when there are no conversations", () => {
    renderPage()
    expect(screen.getByText("No conversations found.")).toBeInTheDocument()
  })

  it("lists conversations and auto-selects the first one, marking it read", async () => {
    useConversationsQueryMock.mockReturnValue({ isLoading: false, data: { conversations: [oneConversation] } })
    renderPage()

    expect(screen.getByText("Jane Doe")).toBeInTheDocument()
    await waitFor(() => expect(markReadMutate).toHaveBeenCalledWith("conv-1"))
  })

  it("renders messages for the selected conversation, aligned by sender", () => {
    useConversationsQueryMock.mockReturnValue({ isLoading: false, data: { conversations: [oneConversation] } })
    useConversationMessagesQueryMock.mockReturnValue({ isLoading: false, data: { messages: [oneMessage] } })
    renderPage()

    expect(screen.getByText("Hello there")).toBeInTheDocument()
  })

  it("sends a text message and clears the input", async () => {
    useConversationsQueryMock.mockReturnValue({ isLoading: false, data: { conversations: [oneConversation] } })
    const user = userEvent.setup()
    renderPage()

    const textarea = screen.getByPlaceholderText(/type your message/i)
    await user.type(textarea, "Hi Jane")
    await user.click(screen.getByRole("button", { name: /send message/i }))

    expect(sendMessageMutate).toHaveBeenCalledWith({ conversationId: "conv-1", message_text: "Hi Jane" }, expect.anything())
  })

  it("filters the conversation list by search term", async () => {
    const other = { id: "conv-2", last_message_at: "2026-01-01T00:00:00Z", participant: { id: "user-3", full_name: "Acme Co", avatar: "" } }
    useConversationsQueryMock.mockReturnValue({ isLoading: false, data: { conversations: [oneConversation, other] } })
    const user = userEvent.setup()
    renderPage()

    expect(screen.getByText("Jane Doe")).toBeInTheDocument()
    expect(screen.getByText("Acme Co")).toBeInTheDocument()

    await user.type(screen.getByPlaceholderText(/search conversations/i), "Acme")

    await waitFor(() => {
      expect(screen.queryByText("Jane Doe")).not.toBeInTheDocument()
      expect(screen.getByText("Acme Co")).toBeInTheDocument()
    })
  })
})
