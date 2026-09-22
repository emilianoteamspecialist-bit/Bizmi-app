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

function conversationsFrom(participant1Id: string, participant2Id: string) {
  return { select: vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn(() => Promise.resolve({ data: { participant1_id: participant1Id, participant2_id: participant2Id }, error: null })) })) })) }
}

describe("GET /:conversationId", () => {
  it("returns the conversation's messages, oldest first", async () => {
    const orderMock = vi.fn().mockResolvedValue({
      data: [
        { id: "m-1", conversation_id: "conv-1", sender_id: "user-1", receiver_id: "user-2", message_text: "hi", file_url: null, file_name: null, file_type: null, file_size: null, is_read: true, created_at: "2026-01-01T00:00:00Z" },
      ],
      error: null,
    })
    const eqMock = vi.fn(() => ({ order: orderMock }))
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "conversations") return conversationsFrom("user-1", "user-2")
        return { select: vi.fn(() => ({ eq: eqMock })) }
      }),
    }

    const res = await request(appWith({ id: "user-1" }, supabase)).get("/conv-1")

    expect(res.status).toBe(200)
    expect(supabase.from).toHaveBeenCalledWith("messages")
    expect(eqMock).toHaveBeenCalledWith("conversation_id", "conv-1")
    expect(orderMock).toHaveBeenCalledWith("created_at", { ascending: true })
    expect(res.body.messages).toHaveLength(1)
  })

  it("returns an empty list on a query error", async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "conversations") return conversationsFrom("user-1", "user-2")
        return { select: vi.fn(() => ({ eq: vi.fn(() => ({ order: vi.fn(() => Promise.resolve({ data: null, error: { message: "boom" } })) })) })) }
      }),
    }
    const res = await request(appWith({ id: "user-1" }, supabase)).get("/conv-1")
    expect(res.body).toEqual({ messages: [] })
  })

  it("returns 404 without querying messages when the caller is not a participant of the conversation", async () => {
    const messagesSelect = vi.fn()
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "conversations") return conversationsFrom("user-2", "user-3")
        return { select: messagesSelect }
      }),
    }

    const res = await request(appWith({ id: "user-1" }, supabase)).get("/conv-1")

    expect(res.status).toBe(404)
    expect(res.body).toEqual({ messages: [] })
    expect(messagesSelect).not.toHaveBeenCalled()
  })

  it("returns 404 when the conversation doesn't exist", async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "conversations") return { select: vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn(() => Promise.resolve({ data: null, error: null })) })) })) }
        return { select: vi.fn() }
      }),
    }

    const res = await request(appWith({ id: "user-1" }, supabase)).get("/conv-999")

    expect(res.status).toBe(404)
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

describe("POST /:conversationId (send text message)", () => {
  it("derives receiver_id from the conversation's participants, inserts the message, and bumps last_message_at", async () => {
    const convSingleMock = vi.fn().mockResolvedValue({ data: { participant1_id: "user-1", participant2_id: "user-2" }, error: null })
    const insertedMessage = { id: "m-1", conversation_id: "conv-1", sender_id: "user-1", receiver_id: "user-2", message_text: "hello", file_url: null, file_name: null, file_type: null, file_size: null, is_read: false, created_at: "2026-01-01T00:00:00Z" }
    const messageSingleMock = vi.fn().mockResolvedValue({ data: insertedMessage, error: null })
    const insertMock = vi.fn(() => ({ select: vi.fn(() => ({ single: messageSingleMock })) }))
    const conversationsUpdateEq = vi.fn().mockResolvedValue({ error: null })

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "conversations") {
          return {
            select: vi.fn(() => ({ eq: vi.fn(() => ({ single: convSingleMock })) })),
            update: vi.fn(() => ({ eq: conversationsUpdateEq })),
          }
        }
        if (table === "messages") {
          return { insert: insertMock }
        }
        throw new Error(`unexpected table ${table}`)
      }),
    }

    const res = await request(appWith({ id: "user-1" }, supabase)).post("/conv-1").send({ message_text: "hello" })

    expect(insertMock).toHaveBeenCalledWith({
      conversation_id: "conv-1",
      sender_id: "user-1",
      receiver_id: "user-2",
      message_text: "hello",
      is_read: false,
    })
    expect(conversationsUpdateEq).toHaveBeenCalledWith("id", "conv-1")
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ success: true, message: insertedMessage })
  })

  it("returns 400 when message_text is missing or empty", async () => {
    const supabase = { from: vi.fn() }
    const res = await request(appWith({ id: "user-1" }, supabase)).post("/conv-1").send({ message_text: "  " })
    expect(res.status).toBe(400)
    expect(supabase.from).not.toHaveBeenCalled()
  })

  it("returns 404 when the caller is not a participant in the conversation", async () => {
    const convSingleMock = vi.fn().mockResolvedValue({ data: null, error: null })
    const supabase = { from: vi.fn(() => ({ select: vi.fn(() => ({ eq: vi.fn(() => ({ single: convSingleMock })) })) })) }

    const res = await request(appWith({ id: "user-1" }, supabase)).post("/conv-1").send({ message_text: "hello" })
    expect(res.status).toBe(404)
  })
})

describe("POST /:conversationId/file (send file message)", () => {
  it("uploads to the message-files bucket and inserts a file message", async () => {
    process.env.SUPABASE_URL = "https://example.supabase.co"
    const convSingleMock = vi.fn().mockResolvedValue({ data: { participant1_id: "user-1", participant2_id: "user-2" }, error: null })
    const uploadMock = vi.fn().mockResolvedValue({ error: null })
    const insertedMessage = { id: "m-2", conversation_id: "conv-1", sender_id: "user-1", receiver_id: "user-2", message_text: "File: photo.png", file_url: "https://example.supabase.co/storage/v1/object/public/message-files/messages/generated-id.png", file_name: "photo.png", file_type: "image/png", file_size: 5, is_read: false, created_at: "2026-01-01T00:00:00Z" }
    const messageSingleMock = vi.fn().mockResolvedValue({ data: insertedMessage, error: null })
    const insertMock = vi.fn(() => ({ select: vi.fn(() => ({ single: messageSingleMock })) }))

    const supabase = {
      storage: { from: vi.fn(() => ({ upload: uploadMock })) },
      from: vi.fn((table: string) => {
        if (table === "conversations") {
          return { select: vi.fn(() => ({ eq: vi.fn(() => ({ single: convSingleMock })) })), update: vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: null }) })) }
        }
        if (table === "messages") return { insert: insertMock }
        throw new Error(`unexpected table ${table}`)
      }),
    }

    const res = await request(appWith({ id: "user-1" }, supabase))
      .post("/conv-1/file")
      .send({ data: Buffer.from("hello").toString("base64"), fileName: "photo.png", mimeType: "image/png" })

    expect(supabase.storage.from).toHaveBeenCalledWith("message-files")
    expect(uploadMock).toHaveBeenCalledWith(expect.stringMatching(/^messages\/.+\.png$/), Buffer.from("hello"), { contentType: "image/png" })
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({ conversation_id: "conv-1", sender_id: "user-1", receiver_id: "user-2", file_name: "photo.png", file_type: "image/png", file_size: 5 })
    )
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ success: true, message: insertedMessage })
  })

  it("returns 400 for a disallowed mimeType", async () => {
    const supabase = { from: vi.fn(), storage: { from: vi.fn() } }
    const res = await request(appWith({ id: "user-1" }, supabase))
      .post("/conv-1/file")
      .send({ data: Buffer.from("x").toString("base64"), fileName: "a.exe", mimeType: "application/x-msdownload" })
    expect(res.status).toBe(400)
    expect(supabase.from).not.toHaveBeenCalled()
  })
})
