import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { ReactNode } from "react"

const apiFetchMock = vi.fn()
vi.mock("../api", () => ({ apiFetch: (...args: unknown[]) => apiFetchMock(...args) }))

const channelMock = { on: vi.fn(), subscribe: vi.fn() }
channelMock.on.mockReturnValue(channelMock)
channelMock.subscribe.mockReturnValue(channelMock)
const supabaseMock = {
  channel: vi.fn(() => channelMock),
  removeChannel: vi.fn(),
}
vi.mock("../supabase", () => ({ supabase: supabaseMock }))

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

beforeEach(() => {
  vi.clearAllMocks()
  channelMock.on.mockReturnValue(channelMock)
  channelMock.subscribe.mockReturnValue(channelMock)
  supabaseMock.channel.mockReturnValue(channelMock)
})

describe("useConversationsQuery", () => {
  it("GETs /api/messages/conversations", async () => {
    apiFetchMock.mockResolvedValue({ conversations: [{ id: "conv-1", last_message_at: "2026-01-01T00:00:00Z", participant: { id: "user-2", full_name: "Jane", avatar: "" } }] })
    const { useConversationsQuery } = await import("./messages")

    const { result } = renderHook(() => useConversationsQuery(), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(apiFetchMock).toHaveBeenCalledWith("/api/messages/conversations")
    expect(result.current.data?.conversations[0].participant.full_name).toBe("Jane")
  })
})

describe("useConversationMessagesQuery", () => {
  it("GETs /api/messages/:conversationId when enabled", async () => {
    apiFetchMock.mockResolvedValue({ messages: [] })
    const { useConversationMessagesQuery } = await import("./messages")

    const { result } = renderHook(() => useConversationMessagesQuery("conv-1"), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(apiFetchMock).toHaveBeenCalledWith("/api/messages/conv-1")
  })

  it("does not fetch when conversationId is null", async () => {
    const { useConversationMessagesQuery } = await import("./messages")
    renderHook(() => useConversationMessagesQuery(null), { wrapper })
    expect(apiFetchMock).not.toHaveBeenCalled()
  })
})

describe("useSendMessageMutation", () => {
  it("POSTs /api/messages/:conversationId with message_text and invalidates conversations + this conversation's messages", async () => {
    apiFetchMock.mockResolvedValue({ success: true, message: { id: "m-1" } })
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const invalidateSpy = vi.spyOn(client, "invalidateQueries")
    const { useSendMessageMutation } = await import("./messages")

    const { result } = renderHook(() => useSendMessageMutation(), {
      wrapper: ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>,
    })
    result.current.mutate({ conversationId: "conv-1", message_text: "hi" })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(apiFetchMock).toHaveBeenCalledWith("/api/messages/conv-1", {
      method: "POST",
      body: JSON.stringify({ message_text: "hi" }),
    })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["messages", "conversations"] })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["messages", "conv-1"] })
  })
})

describe("useSendFileMessageMutation", () => {
  it("POSTs /api/messages/:conversationId/file with the file payload", async () => {
    apiFetchMock.mockResolvedValue({ success: true, message: { id: "m-2" } })
    const { useSendFileMessageMutation } = await import("./messages")

    const { result } = renderHook(() => useSendFileMessageMutation(), { wrapper })
    result.current.mutate({ conversationId: "conv-1", data: "aGVsbG8=", fileName: "a.png", mimeType: "image/png" })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(apiFetchMock).toHaveBeenCalledWith("/api/messages/conv-1/file", {
      method: "POST",
      body: JSON.stringify({ data: "aGVsbG8=", fileName: "a.png", mimeType: "image/png" }),
    })
  })
})

describe("useMarkReadMutation", () => {
  it("PATCHes /api/messages/:conversationId/read", async () => {
    apiFetchMock.mockResolvedValue({ success: true })
    const { useMarkReadMutation } = await import("./messages")

    const { result } = renderHook(() => useMarkReadMutation(), { wrapper })
    result.current.mutate("conv-1")

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(apiFetchMock).toHaveBeenCalledWith("/api/messages/conv-1/read", { method: "PATCH" })
  })
})

describe("useRealtimeMessages", () => {
  it("subscribes to a postgres_changes channel scoped to the conversation when conversationId is set", async () => {
    const { useRealtimeMessages } = await import("./messages")
    renderHook(() => useRealtimeMessages("conv-1"), { wrapper })

    expect(supabaseMock.channel).toHaveBeenCalledWith("messages_channel_conv-1")
    expect(channelMock.on).toHaveBeenCalledWith(
      "postgres_changes",
      expect.objectContaining({ event: "INSERT", schema: "public", table: "messages", filter: "conversation_id=eq.conv-1" }),
      expect.any(Function)
    )
    expect(channelMock.subscribe).toHaveBeenCalled()
  })

  it("does not subscribe when conversationId is null", async () => {
    const { useRealtimeMessages } = await import("./messages")
    renderHook(() => useRealtimeMessages(null), { wrapper })
    expect(supabaseMock.channel).not.toHaveBeenCalled()
  })

  it("removes the channel on unmount", async () => {
    const { useRealtimeMessages } = await import("./messages")
    const { unmount } = renderHook(() => useRealtimeMessages("conv-1"), { wrapper })
    unmount()
    expect(supabaseMock.removeChannel).toHaveBeenCalledWith(channelMock)
  })
})
