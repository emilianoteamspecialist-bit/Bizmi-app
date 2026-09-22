import { describe, it, expect, vi } from "vitest"
import request from "supertest"
import express from "express"
import messagesRouter from "./messages.js"

function appWith(user: { id: string }, supabase: any) {
  const app = express()
  app.use(express.json())
  app.use((req: any, _res, next) => {
    req.user = user
    req.supabase = supabase
    next()
  })
  app.use("/", messagesRouter)
  return app
}

describe("GET /conversations", () => {
  it("lists the caller's conversations with the other participant's profile and avatar", async () => {
    process.env.SUPABASE_URL = "https://example.supabase.co"
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "conversations") {
          return {
            select: vi.fn(() => ({
              or: vi.fn(() => ({
                order: vi.fn(() =>
                  Promise.resolve({
                    data: [{ id: "conv-1", last_message_at: "2026-01-02T00:00:00Z", participant1_id: "user-1", participant2_id: "user-2" }],
                    error: null,
                  })
                ),
              })),
            })),
          }
        }
        if (table === "profiles") {
          return { select: vi.fn(() => ({ in: vi.fn(() => Promise.resolve({ data: [{ id: "user-2", full_name: "Jane Doe", account_type: "freelancer", company_name: null }], error: null })) })) }
        }
        if (table === "freelancer_logos") {
          return { select: vi.fn(() => ({ in: vi.fn(() => Promise.resolve({ data: [{ freelancer_id: "user-2", logo_path: "user-2/avatar.png", logo_data: null }], error: null })) })) }
        }
        if (table === "agency_image") {
          return { select: vi.fn(() => ({ in: vi.fn(() => Promise.resolve({ data: [], error: null })) })) }
        }
        throw new Error(`unexpected table ${table}`)
      }),
    }

    const res = await request(appWith({ id: "user-1" }, supabase)).get("/conversations")

    expect(res.status).toBe(200)
    expect(res.body).toEqual({
      conversations: [
        {
          id: "conv-1",
          last_message_at: "2026-01-02T00:00:00Z",
          participant: {
            id: "user-2",
            full_name: "Jane Doe",
            avatar: "https://example.supabase.co/storage/v1/object/public/avatars/user-2/avatar.png",
          },
        },
      ],
    })
  })

  it("returns an empty list when the caller has no conversations", async () => {
    const supabase = {
      from: vi.fn(() => ({ select: vi.fn(() => ({ or: vi.fn(() => ({ order: vi.fn(() => Promise.resolve({ data: [], error: null })) })) })) })),
    }
    const res = await request(appWith({ id: "user-1" }, supabase)).get("/conversations")
    expect(res.body).toEqual({ conversations: [] })
  })

  it("returns an empty list on a query error", async () => {
    const supabase = {
      from: vi.fn(() => ({ select: vi.fn(() => ({ or: vi.fn(() => ({ order: vi.fn(() => Promise.resolve({ data: null, error: { message: "boom" } })) })) })) })),
    }
    const res = await request(appWith({ id: "user-1" }, supabase)).get("/conversations")
    expect(res.body).toEqual({ conversations: [] })
  })
})

describe("GET /:conversationId", () => {
  it("returns the conversation's messages, oldest first", async () => {
    const orderMock = vi.fn().mockResolvedValue({
      data: [
        { id: "m-1", conversation_id: "conv-1", sender_id: "user-1", receiver_id: "user-2", message_text: "hi", file_url: null, file_name: null, file_type: null, file_size: null, is_read: true, created_at: "2026-01-01T00:00:00Z" },
      ],
      error: null,
    })
    const eqMock = vi.fn(() => ({ order: orderMock }))
    const supabase = { from: vi.fn(() => ({ select: vi.fn(() => ({ eq: eqMock })) })) }

    const res = await request(appWith({ id: "user-1" }, supabase)).get("/conv-1")

    expect(res.status).toBe(200)
    expect(supabase.from).toHaveBeenCalledWith("messages")
    expect(eqMock).toHaveBeenCalledWith("conversation_id", "conv-1")
    expect(orderMock).toHaveBeenCalledWith("created_at", { ascending: true })
    expect(res.body.messages).toHaveLength(1)
  })

  it("returns an empty list on a query error", async () => {
    const supabase = { from: vi.fn(() => ({ select: vi.fn(() => ({ eq: vi.fn(() => ({ order: vi.fn(() => Promise.resolve({ data: null, error: { message: "boom" } })) })) })) })) }
    const res = await request(appWith({ id: "user-1" }, supabase)).get("/conv-1")
    expect(res.body).toEqual({ messages: [] })
  })
})

describe("PATCH /:conversationId/read", () => {
  it("marks the caller's unread received messages in the conversation as read", async () => {
    const eqReadMock = vi.fn().mockResolvedValue({ error: null })
    const eqReceiverMock = vi.fn(() => ({ eq: eqReadMock }))
    const eqConvMock = vi.fn(() => ({ eq: eqReceiverMock }))
    const updateMock = vi.fn(() => ({ eq: eqConvMock }))
    const supabase = { from: vi.fn(() => ({ update: updateMock })) }

    const res = await request(appWith({ id: "user-1" }, supabase)).patch("/conv-1/read")

    expect(res.status).toBe(200)
    expect(supabase.from).toHaveBeenCalledWith("messages")
    expect(updateMock).toHaveBeenCalledWith({ is_read: true })
    expect(eqConvMock).toHaveBeenCalledWith("conversation_id", "conv-1")
    expect(eqReceiverMock).toHaveBeenCalledWith("receiver_id", "user-1")
    expect(eqReadMock).toHaveBeenCalledWith("is_read", false)
    expect(res.body).toEqual({ success: true })
  })
})
