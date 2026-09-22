# React + Node Migration — Phase 3b (Realtime Messaging) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port `/freelancer/messages` and `/agency/messages` — the split-pane conversation-list + chat-thread inbox, with Supabase Realtime for live message delivery and file attachments — to `client/`. This is the second and final slice of Phase 3 ("Credits & realtime messaging" per the design spec); Phase 3a (credits) already merged.

**Architecture:** New server routes on a new `messagesRouter` (`server/src/routes/messages.ts`, mounted at `/api/messages`) handle every read/write: listing conversations (enriched with the other participant's profile/avatar), listing a conversation's messages, sending a text message, sending a file message, and marking messages read. The one piece that stays client-side, by design: the **Supabase Realtime subscription** itself — a `postgres_changes` channel on `messages` filtered to the open conversation, using the browser's own `client/src/lib/supabase.ts` instance directly (not proxied through Express; WebSocket realtime isn't a REST concept the server can usefully sit in front of, and the design spec explicitly calls these channels out as "portable as-is"). New realtime INSERT events are written directly into the same TanStack Query cache entry the initial fetch populates (via `queryClient.setQueryData`), so there is exactly one source of truth for a conversation's message list — not a second, parallel `useState` array like the original.

The freelancer and agency versions of this page (`app/freelancer/messages/page.tsx`, `app/agency/messages/MessagesClient.tsx`) are ~700-line near-duplicates of each other — same tables, same queries, same realtime channel shape, trivial copy differences only. This plan ports **one shared page component**, mounted at both `/freelancer/messages` and `/agency/messages`.

**Tech Stack:** Same as prior phases (`client/`: React 19, TanStack Query, react-router, the browser Supabase client for realtime only; `server/`: Express + `req.supabase`). No new dependencies. Reuses `fileToBase64` (already ported in Phase 2d, `client/src/lib/file.ts`) for the file-attachment upload flow.

**Spec:** `docs/superpowers/specs/2026-09-08-nextjs-to-react-node-migration-design.md` (Section 7, Phase 3 row — "Realtime re-subscribed in React"; Section 6 — "Messaging — split-pane thread list + conversation, backed by existing Supabase Realtime channels")

## Global Constraints

- **No role gate on this page.** Unlike every other ported page, `/freelancer/messages` and `/agency/messages` render the identical component with identical query logic — the data itself (conversations the caller participates in, scoped by RLS/`req.user!.id`) is symmetric for both account types. `RequireAuth` (already wrapping both routes) is the only gate needed; do not add an `account_type` check.
- **Starting a *new* conversation is out of scope.** This plan ports the inbox (list existing conversations, send/receive within them) — it does NOT wire up "Contact freelancer"/"Message" entry points on other already-shipped pages (`FindFreelancers.tsx`, `ProposalsModal.tsx`, etc.), which is why those pages' Global Constraints explicitly deferred messaging in the first place. That wiring is a separate, deliberate follow-up once this inbox exists. A conversation only appears here if a `conversations` row for the caller already exists (created via the original Next.js app, or by a future phase).
- **`receiver_id` is derived server-side from the conversation's participants, never trusted from the client.** The original computes it client-side (`participant1_id === currentUserId ? participant2_id : participant1_id`) and sends it as part of the insert payload — this plan's server routes instead look up the conversation's two participant ids via `req.supabase` (which only returns rows the RLS policy allows the caller to see) and compute the other participant themselves. This is brand-new server code with no fidelity obligation to preserve a client-trusted field, consistent with the `user_id`/`credits_amount` fixes made earlier in this migration.
- **File uploads use a server-side mimeType allowlist**, matching the pattern already established for avatar uploads (`server/src/routes/user.ts`'s `ALLOWED_AVATAR_TYPES`) — the original only validates file type client-side (`handleFileSelect`'s `allowedTypes` array), which is UX only, not a security boundary. Allowed: `image/jpeg`, `image/png`, `image/gif`, `application/pdf`, `application/msword`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document` (the same six types the original's client-side check already lists) — reject anything else with 400, matching the avatar route's shape.
- **Realtime updates write into the TanStack Query cache directly** (`queryClient.setQueryData(["messages", conversationId], ...)`), not a separate local array — this is the one deliberate architectural deviation from a byte-for-byte port, chosen to avoid the dual-source-of-truth cache bugs this migration's final reviews have repeatedly caught in other phases.
- **The two hardcoded, non-functional UI elements in the original are dropped, not ported**: the static green "online" dot next to each conversation/contact (there is no real presence system anywhere in this codebase — it's a static, always-on placeholder that would misrepresent real status to users) and the empty commented-out `{/* <span>React</span> */}` skill-tag placeholder. The `Popover` with the static "Always engage with agency on Google meets" advice text IS ported verbatim (it's real, intentional, harmless copy, not fake data).
- **Status/UI colors already use semantic tokens or plain default component styling** in the parts of the original being ported (`bg-primary`, `text-white`, `bg-surface-2`) — the one literal-color instance being dropped is the fake "online" dot (see above), so no other color conversion is needed.
- **Every data need funnels through a query/mutation hook** in `client/src/lib/queries/messages.ts` — no page or component calls `apiFetch` directly. The one exception, by design and explicitly called out above: the realtime subscription itself uses the browser Supabase client directly, not `apiFetch`.
- **File storage path convention**: `messages/{random-uuid}.{ext}` in the existing `message-files` bucket, matching the original's `messages/${Math.random()}.${fileExt}` pattern (server-generates the random segment via `crypto.randomUUID()` instead of `Math.random()`, since this is new server code and `crypto.randomUUID()` is the correct tool already available in Node — this is a trivial, behavior-invisible improvement, not a scope change).

---

## Task 1: Port the Popover UI primitive

**Files:**
- Modify: `client/package.json` (add `@radix-ui/react-popover`)
- Create: `client/src/components/ui/popover.tsx`
- Test: `client/src/components/ui/popover.test.tsx`

**Interfaces:**
- Produces: `Popover`, `PopoverTrigger`, `PopoverContent`. Task 6's `Messages.tsx` imports all three.

- [ ] **Step 1: Add the dependency**

Edit `client/package.json` — add to `dependencies` (alphabetized, matching the version the root app already pins):

```json
    "@radix-ui/react-popover": "1.1.4",
```

- [ ] **Step 2: Install**

Run: `cd client && npm install`
Expected: installs cleanly

- [ ] **Step 3: Write the failing test**

```tsx
// client/src/components/ui/popover.test.tsx
import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { Popover, PopoverContent, PopoverTrigger } from "./popover"

describe("Popover", () => {
  it("renders its content when open", () => {
    render(
      <Popover open>
        <PopoverTrigger>Open</PopoverTrigger>
        <PopoverContent>Popover body text</PopoverContent>
      </Popover>
    )

    expect(screen.getByText("Popover body text")).toBeInTheDocument()
  })
})
```

Note: this test renders the `Popover` pre-opened via its own controlled `open` prop rather than simulating a click on the trigger — `@testing-library/user-event`'s `.click()` hangs indefinitely on Radix trigger components in jsdom (missing `Element.prototype.hasPointerCapture`/`setPointerCapture`), a known issue in this codebase already worked around the same way for `DropdownMenu` (see `client/src/components/ui/dropdown-menu.test.tsx`) and already polyfilled globally in `client/src/test-setup.ts` — the polyfill makes a real click-driven test *not hang*, but a controlled-`open` test remains simpler and faster, so use it here too.

- [ ] **Step 4: Run test to verify it fails**

Run: `cd client && npx vitest run src/components/ui/popover.test.tsx`
Expected: FAIL — `Cannot find module './popover'`

- [ ] **Step 5: Create `client/src/components/ui/popover.tsx`** (exact copy of `components/ui/popover.tsx`, no `"use client"`)

```tsx
import * as React from "react"
import * as PopoverPrimitive from "@radix-ui/react-popover"

import { cn } from "@/lib/utils"

const Popover = PopoverPrimitive.Root

const PopoverTrigger = PopoverPrimitive.Trigger

const PopoverContent = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(({ className, align = "center", sideOffset = 4, ...props }, ref) => (
  <PopoverPrimitive.Portal>
    <PopoverPrimitive.Content
      ref={ref}
      align={align}
      sideOffset={sideOffset}
      className={cn(
        "z-50 w-72 rounded-xl border bg-popover p-4 text-popover-foreground shadow-md outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
        className
      )}
      {...props}
    />
  </PopoverPrimitive.Portal>
))
PopoverContent.displayName = PopoverPrimitive.Content.displayName

export { Popover, PopoverTrigger, PopoverContent }
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd client && npx vitest run src/components/ui/popover.test.tsx`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add client/package.json client/package-lock.json client/src/components/ui/popover.tsx client/src/components/ui/popover.test.tsx
git commit -m "Port Popover UI primitive to client"
```

---

## Task 2: `GET /api/messages/conversations` server route

**Files:**
- Create: `server/src/routes/messages.ts`
- Test: `server/src/routes/messages.test.ts`
- Modify: `server/src/app.ts` (mount the new router)

**Interfaces:**
- Produces: `GET /api/messages/conversations` — response `{ conversations: ConversationSummary[] }` where `ConversationSummary = { id, last_message_at, participant: { id, full_name, avatar } }`. `participant` is always the *other* party relative to the caller. Task 5's `useConversationsQuery` consumes this shape exactly.

- [ ] **Step 1: Write the failing tests**

```ts
// server/src/routes/messages.test.ts
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd server && npx vitest run src/routes/messages.test.ts`
Expected: FAIL — `./messages.js` doesn't exist yet.

- [ ] **Step 3: Implement the route**

```ts
// server/src/routes/messages.ts
import { Router } from "express"
import { asyncHandler } from "../lib/http.js"
import { resolveAvatar } from "../lib/avatar.js"

const messagesRouter = Router()

messagesRouter.get(
  "/conversations",
  asyncHandler(async (req, res) => {
    const supabase = req.supabase!
    const userId = req.user!.id

    const { data: convs, error } = await supabase
      .from("conversations")
      .select("id, last_message_at, participant1_id, participant2_id")
      .or(`participant1_id.eq.${userId},participant2_id.eq.${userId}`)
      .order("last_message_at", { ascending: false, nullsFirst: false })

    if (error) {
      console.error("Error fetching conversations:", error)
      res.json({ conversations: [] })
      return
    }
    if (!convs || convs.length === 0) {
      res.json({ conversations: [] })
      return
    }

    const otherIds = convs.map((c: { participant1_id: string; participant2_id: string }) =>
      c.participant1_id === userId ? c.participant2_id : c.participant1_id
    )

    const [profilesResult, logosResult, imagesResult] = await Promise.all([
      supabase.from("profiles").select("id, full_name, account_type, company_name").in("id", otherIds),
      supabase.from("freelancer_logos").select("freelancer_id, logo_path, logo_data").in("freelancer_id", otherIds),
      supabase.from("agency_image").select("agency_id, image_path, image_data").in("agency_id", otherIds),
    ])

    const profileById: Record<string, { full_name: string; account_type: string; company_name: string | null }> = {}
    for (const p of profilesResult.data || []) profileById[p.id] = p

    const avatarById: Record<string, string> = {}
    for (const l of logosResult.data || []) avatarById[l.freelancer_id] = resolveAvatar(l)
    for (const i of imagesResult.data || []) avatarById[i.agency_id] = resolveAvatar(i)

    const conversations = convs.map((c: { id: string; last_message_at: string; participant1_id: string; participant2_id: string }) => {
      const otherId = c.participant1_id === userId ? c.participant2_id : c.participant1_id
      const profile = profileById[otherId]
      const displayName = profile ? profile.company_name || profile.full_name || "Unknown User" : "Unknown User"
      return {
        id: c.id,
        last_message_at: c.last_message_at,
        participant: { id: otherId, full_name: displayName, avatar: avatarById[otherId] || "" },
      }
    })

    res.json({ conversations })
  })
)

export default messagesRouter
```

- [ ] **Step 4: Mount the router**

In `server/src/app.ts`, add the import next to the other route imports:

```ts
import messagesRouter from "./routes/messages.js"
```

Add the mount line next to the other `app.use("/api/...", requireAuth, ...)` lines:

```ts
  app.use("/api/messages", requireAuth, messagesRouter)
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd server && npx vitest run src/routes/messages.test.ts`
Expected: PASS

- [ ] **Step 6: Run the full server test suite**

Run: `cd server && npx vitest run`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add server/src/routes/messages.ts server/src/routes/messages.test.ts server/src/app.ts
git commit -m "feat(server): add GET /api/messages/conversations"
```

---

## Task 3: `GET /api/messages/:conversationId` and `PATCH /api/messages/:conversationId/read` server routes

**Files:**
- Modify: `server/src/routes/messages.ts`
- Test: `server/src/routes/messages.test.ts`

**Interfaces:**
- Produces: `GET /api/messages/:conversationId` — response `{ messages: Message[] }` where `Message = { id, conversation_id, sender_id, receiver_id, message_text, file_url, file_name, file_type, file_size, is_read, created_at }`, ordered oldest-first.
- Produces: `PATCH /api/messages/:conversationId/read` — marks the caller's unread received messages in that conversation as read; response `{ success: true }`.

- [ ] **Step 1: Write the failing tests**

Add to `server/src/routes/messages.test.ts` (after the existing `describe("GET /conversations", ...)` block):

```ts
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd server && npx vitest run src/routes/messages.test.ts -t "conversationId"`
Expected: FAIL — neither route exists yet.

- [ ] **Step 3: Implement the routes**

Add to `server/src/routes/messages.ts` (after the `GET /conversations` block):

```ts
messagesRouter.get(
  "/:conversationId",
  asyncHandler(async (req, res) => {
    const { conversationId } = req.params

    const { data, error } = await req.supabase!
      .from("messages")
      .select("id, conversation_id, sender_id, receiver_id, message_text, file_url, file_name, file_type, file_size, is_read, created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })

    if (error) {
      console.error("Error fetching messages:", error)
      res.json({ messages: [] })
      return
    }

    res.json({ messages: data || [] })
  })
)

messagesRouter.patch(
  "/:conversationId/read",
  asyncHandler(async (req, res) => {
    const { conversationId } = req.params

    const { error } = await req.supabase!
      .from("messages")
      .update({ is_read: true })
      .eq("conversation_id", conversationId)
      .eq("receiver_id", req.user!.id)
      .eq("is_read", false)

    if (error) {
      console.error("Error marking messages read:", error)
      res.status(500).json({ success: false, error: error.message })
      return
    }

    res.json({ success: true })
  })
)
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd server && npx vitest run src/routes/messages.test.ts`
Expected: PASS (all tests in the file, old and new)

- [ ] **Step 5: Run the full server test suite**

Run: `cd server && npx vitest run`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add server/src/routes/messages.ts server/src/routes/messages.test.ts
git commit -m "feat(server): add GET /api/messages/:id and PATCH /api/messages/:id/read"
```

---

## Task 4: `POST /api/messages/:conversationId` and `POST /api/messages/:conversationId/file` server routes

**Files:**
- Modify: `server/src/routes/messages.ts`
- Test: `server/src/routes/messages.test.ts`

**Interfaces:**
- Produces: `POST /api/messages/:conversationId` — request body `{ message_text: string }`; response `{ success: true, message: Message } | { success: false, error: string }`.
- Produces: `POST /api/messages/:conversationId/file` — request body `{ data: string (base64), fileName: string, mimeType: string }`; response `{ success: true, message: Message } | { success: false, error: string }` or `400 { error: string }`.

- [ ] **Step 1: Write the failing tests**

Add to `server/src/routes/messages.test.ts` (after the `PATCH /:conversationId/read` block):

```ts
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd server && npx vitest run src/routes/messages.test.ts -t "send"`
Expected: FAIL — neither route exists yet.

- [ ] **Step 3: Implement the routes**

Add to `server/src/routes/messages.ts`. **Note:** `import type { SupabaseClient } from "@supabase/supabase-js"` and the `otherParticipantId()` helper already exist in this file — they were added ahead of schedule as a Task 3 fix (commit `9f52f4b`) for a background-security-review IDOR finding on the GET route (it had no participant-membership check). Do NOT redefine either; just call the existing `otherParticipantId()`.

Add one helper and the two routes (after the `PATCH /:conversationId/read` block):

```ts
const ALLOWED_MESSAGE_FILE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "application/pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
}

function messageFileUrl(path: string): string {
  const base = process.env.SUPABASE_URL || ""
  if (!base) return ""
  return `${base}/storage/v1/object/public/message-files/${path}`
}

messagesRouter.post(
  "/:conversationId",
  asyncHandler(async (req, res) => {
    const { conversationId } = req.params
    const { message_text } = req.body ?? {}
    if (typeof message_text !== "string" || !message_text.trim()) {
      res.status(400).json({ success: false, error: "message_text is required" })
      return
    }

    const supabase = req.supabase!
    const userId = req.user!.id
    const receiverId = await otherParticipantId(supabase, conversationId, userId)
    if (!receiverId) {
      res.status(404).json({ success: false, error: "Conversation not found" })
      return
    }

    const { data, error } = await supabase
      .from("messages")
      .insert({ conversation_id: conversationId, sender_id: userId, receiver_id: receiverId, message_text, is_read: false })
      .select()
      .single()

    if (error) {
      console.error("Error sending message:", error)
      res.status(500).json({ success: false, error: error.message })
      return
    }

    await supabase.from("conversations").update({ last_message_at: new Date().toISOString() }).eq("id", conversationId)

    res.json({ success: true, message: data })
  })
)

messagesRouter.post(
  "/:conversationId/file",
  asyncHandler(async (req, res) => {
    const { conversationId } = req.params
    const { data, fileName, mimeType } = req.body ?? {}
    if (typeof data !== "string" || typeof fileName !== "string" || typeof mimeType !== "string") {
      res.status(400).json({ error: "data, fileName, and mimeType are required" })
      return
    }

    const ext = ALLOWED_MESSAGE_FILE_TYPES[mimeType]
    if (!ext) {
      res.status(400).json({ error: "unsupported file type" })
      return
    }

    const supabase = req.supabase!
    const userId = req.user!.id
    const receiverId = await otherParticipantId(supabase, conversationId, userId)
    if (!receiverId) {
      res.status(404).json({ success: false, error: "Conversation not found" })
      return
    }

    const buffer = Buffer.from(data, "base64")
    const path = `messages/${crypto.randomUUID()}.${ext}`

    const { error: uploadError } = await supabase.storage.from("message-files").upload(path, buffer, { contentType: mimeType })
    if (uploadError) {
      console.error("Error uploading message file:", uploadError)
      res.status(500).json({ success: false, error: uploadError.message })
      return
    }

    const fileUrl = messageFileUrl(path)

    const { data: message, error } = await supabase
      .from("messages")
      .insert({
        conversation_id: conversationId,
        sender_id: userId,
        receiver_id: receiverId,
        message_text: `File: ${fileName}`,
        file_url: fileUrl,
        file_name: fileName,
        file_type: mimeType,
        file_size: buffer.length,
        is_read: false,
      })
      .select()
      .single()

    if (error) {
      console.error("Error saving file message:", error)
      res.status(500).json({ success: false, error: error.message })
      return
    }

    await supabase.from("conversations").update({ last_message_at: new Date().toISOString() }).eq("id", conversationId)

    res.json({ success: true, message })
  })
)
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd server && npx vitest run src/routes/messages.test.ts`
Expected: PASS (all tests in the file, old and new)

- [ ] **Step 5: Run the full server test suite**

Run: `cd server && npx vitest run`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add server/src/routes/messages.ts server/src/routes/messages.test.ts
git commit -m "feat(server): add POST /api/messages/:id and POST /api/messages/:id/file"
```

---

## Task 5: Client messaging query/mutation hooks + realtime subscription hook

**Files:**
- Create: `client/src/lib/queries/messages.ts`
- Test: `client/src/lib/queries/messages.test.tsx`

**Interfaces:**
- Consumes: `apiFetch` (`client/src/lib/api.ts`, existing); `supabase` (`client/src/lib/supabase.ts`, existing, for the realtime channel only).
- Produces: `ConversationSummary`, `Message` types; `useConversationsQuery()`, `useConversationMessagesQuery(conversationId)`, `useSendMessageMutation()`, `useSendFileMessageMutation()`, `useMarkReadMutation()`, `useRealtimeMessages(conversationId)`. Task 6's page consumes all six.

- [ ] **Step 1: Write the failing tests**

```tsx
// client/src/lib/queries/messages.test.tsx
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd client && npx vitest run src/lib/queries/messages.test.tsx`
Expected: FAIL — `client/src/lib/queries/messages.ts` doesn't exist yet.

- [ ] **Step 3: Implement the hooks**

```ts
// client/src/lib/queries/messages.ts
import { useEffect } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { apiFetch } from "../api"
import { supabase } from "../supabase"

export type ConversationSummary = {
  id: string
  last_message_at: string
  participant: { id: string; full_name: string; avatar: string }
}

export type Message = {
  id: string
  conversation_id: string
  sender_id: string
  receiver_id: string
  message_text: string | null
  file_url: string | null
  file_name: string | null
  file_type: string | null
  file_size: number | null
  is_read: boolean
  created_at: string
}

export function useConversationsQuery() {
  return useQuery({
    queryKey: ["messages", "conversations"],
    queryFn: () => apiFetch<{ conversations: ConversationSummary[] }>("/api/messages/conversations"),
  })
}

export function useConversationMessagesQuery(conversationId: string | null) {
  return useQuery({
    queryKey: ["messages", conversationId],
    queryFn: () => apiFetch<{ messages: Message[] }>(`/api/messages/${conversationId}`),
    enabled: !!conversationId,
  })
}

export function useSendMessageMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ conversationId, message_text }: { conversationId: string; message_text: string }) =>
      apiFetch<{ success: boolean; message?: Message; error?: string }>(`/api/messages/${conversationId}`, {
        method: "POST",
        body: JSON.stringify({ message_text }),
      }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["messages", "conversations"] })
      queryClient.invalidateQueries({ queryKey: ["messages", variables.conversationId] })
    },
  })
}

export function useSendFileMessageMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ conversationId, ...input }: { conversationId: string; data: string; fileName: string; mimeType: string }) =>
      apiFetch<{ success: boolean; message?: Message; error?: string }>(`/api/messages/${conversationId}/file`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["messages", "conversations"] })
      queryClient.invalidateQueries({ queryKey: ["messages", variables.conversationId] })
    },
  })
}

export function useMarkReadMutation() {
  return useMutation({
    mutationFn: (conversationId: string) =>
      apiFetch<{ success: boolean }>(`/api/messages/${conversationId}/read`, { method: "PATCH" }),
  })
}

export function useRealtimeMessages(conversationId: string | null) {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!conversationId) return

    const channel = supabase
      .channel(`messages_channel_${conversationId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
        (payload: { new: Message }) => {
          queryClient.setQueryData<{ messages: Message[] } | undefined>(["messages", conversationId], (old) => {
            if (!old) return old
            if (old.messages.some((m) => m.id === payload.new.id)) return old
            return { messages: [...old.messages, payload.new] }
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [conversationId, queryClient])
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd client && npx vitest run src/lib/queries/messages.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add client/src/lib/queries/messages.ts client/src/lib/queries/messages.test.tsx
git commit -m "feat(client): add messaging query/mutation hooks and realtime subscription"
```

---

## Task 6: `Messages` page (shared by both freelancer and agency)

**Files:**
- Create: `client/src/pages/shared/Messages.tsx`
- Test: `client/src/pages/shared/Messages.test.tsx`

**Interfaces:**
- Consumes: `useAuth` (`@/contexts/AuthContext`, existing); `useConversationsQuery`, `useConversationMessagesQuery`, `useSendMessageMutation`, `useSendFileMessageMutation`, `useMarkReadMutation`, `useRealtimeMessages` (Task 5); `fileToBase64` (`@/lib/file`, existing from Phase 2d); `Popover`/`PopoverTrigger`/`PopoverContent` (Task 1); `Card`/`CardHeader`/`CardContent`/`CardTitle`, `Avatar`/`AvatarFallback`/`AvatarImage`, `Input`, `Textarea`, `Button` (all already ported).
- Produces: default export `Messages`, mounted at both `/freelancer/messages` and `/agency/messages` in Task 7's `App.tsx`.

- [ ] **Step 1: Write the failing tests**

```tsx
// client/src/pages/shared/Messages.test.tsx
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd client && npx vitest run src/pages/shared/Messages.test.tsx`
Expected: FAIL — `Cannot find module './Messages'`

- [ ] **Step 3: Write `client/src/pages/shared/Messages.tsx`**

```tsx
import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Send, MessageSquare, User, Search, ArrowLeft, MoreVertical, Upload, File, ImageIcon, X } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import {
  useConversationsQuery,
  useConversationMessagesQuery,
  useSendMessageMutation,
  useSendFileMessageMutation,
  useMarkReadMutation,
  useRealtimeMessages,
  type ConversationSummary,
} from "@/lib/queries/messages"
import { fileToBase64 } from "@/lib/file"

const ALLOWED_FILE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]

export default function Messages() {
  const { user } = useAuth()
  const currentUserId = user?.id ?? null

  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null)
  const [newMessage, setNewMessage] = useState("")
  const [searchTerm, setSearchTerm] = useState("")
  const [showConversationList, setShowConversationList] = useState(true)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const didAutoSelect = useRef(false)

  const conversationsQuery = useConversationsQuery()
  const messagesQuery = useConversationMessagesQuery(selectedConversationId)
  const sendMessage = useSendMessageMutation()
  const sendFile = useSendFileMessageMutation()
  const markRead = useMarkReadMutation()
  useRealtimeMessages(selectedConversationId)

  const conversations = conversationsQuery.data?.conversations ?? []
  const messages = messagesQuery.data?.messages ?? []

  useEffect(() => {
    if (didAutoSelect.current) return
    if (conversations.length === 0) return
    didAutoSelect.current = true
    setSelectedConversationId(conversations[0].id)
  }, [conversations])

  useEffect(() => {
    if (selectedConversationId) markRead.mutate(selectedConversationId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedConversationId])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const filteredConversations = conversations.filter((c) =>
    searchTerm ? c.participant.full_name.toLowerCase().includes(searchTerm.toLowerCase()) : true
  )

  const selectedConversation = conversations.find((c) => c.id === selectedConversationId) ?? null

  const handleSelect = (conversation: ConversationSummary) => {
    setSelectedConversationId(conversation.id)
    setShowConversationList(false)
  }

  const handleSend = () => {
    if (!newMessage.trim() || !selectedConversationId) return
    sendMessage.mutate(
      { conversationId: selectedConversationId, message_text: newMessage },
      { onSuccess: () => setNewMessage("") }
    )
  }

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      alert("Please select only images (JPEG, PNG, GIF) or documents (PDF, DOC, DOCX)")
      return
    }
    setSelectedFile(file)
  }

  const handleSendFile = async () => {
    if (!selectedFile || !selectedConversationId) return
    const { data, mimeType } = await fileToBase64(selectedFile)
    sendFile.mutate(
      { conversationId: selectedConversationId, data, fileName: selectedFile.name, mimeType },
      {
        onSuccess: () => {
          setSelectedFile(null)
          if (fileInputRef.current) fileInputRef.current.value = ""
        },
      }
    )
  }

  if (conversationsQuery.isLoading) {
    return (
      <div data-testid="messages-skeleton" className="min-h-screen bg-surface">
        <div className="max-w-7xl mx-auto py-8 px-4">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-foreground/5 rounded w-1/4 mb-6" />
            <div className="h-32 bg-foreground/5 rounded" />
            <div className="h-20 bg-foreground/5 rounded" />
            <div className="h-20 bg-foreground/5 rounded" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-[calc(100svh-4rem)] bg-surface flex flex-col overflow-hidden">
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <Card
          className={`w-full flex-shrink-0 border-r rounded-none flex flex-col overflow-y-auto ${
            selectedConversation && !showConversationList ? "hidden sm:flex" : "flex"
          } sm:w-80 md:w-96 lg:w-[400px]`}
        >
          <CardHeader className="border-b">
            <div className="flex items-center gap-2 mb-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg font-semibold text-foreground">Messages</CardTitle>
            </div>
            <div className="relative mt-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search conversations..."
                className="pl-9"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </CardHeader>
          <CardContent className="flex-1 p-0">
            {filteredConversations.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground text-sm">No conversations found.</div>
            ) : (
              filteredConversations.map((conversation) => (
                <div
                  key={conversation.id}
                  className={`flex items-center gap-3 p-4 cursor-pointer border-b border-border last:border-b-0 transition-colors hover:bg-surface-2 ${
                    selectedConversationId === conversation.id ? "bg-surface-2" : ""
                  }`}
                  onClick={() => handleSelect(conversation)}
                >
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={conversation.participant.avatar || undefined} alt={conversation.participant.full_name} />
                    <AvatarFallback className="bg-primary text-white flex items-center justify-center">
                      {conversation.participant.full_name.charAt(0) || <User className="h-6 w-6" />}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">{conversation.participant.full_name}</p>
                    <p className="text-sm text-muted-foreground truncate mt-0.5">
                      {conversation.last_message_at
                        ? new Date(conversation.last_message_at).toLocaleDateString("en-US", { month: "numeric", day: "numeric", year: "numeric" })
                        : "No messages yet"}
                    </p>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <div className={`flex-1 min-w-0 min-h-0 flex flex-col bg-card ${selectedConversation && !showConversationList ? "flex" : "hidden"} sm:flex`}>
          <CardHeader className="border-b flex-shrink-0 py-3 px-4 sm:py-4 sm:px-6">
            {selectedConversation ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Button variant="ghost" size="icon" className="sm:hidden" onClick={() => setShowConversationList(true)}>
                    <ArrowLeft className="h-5 w-5" />
                    <span className="sr-only">Back to conversations</span>
                  </Button>
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={selectedConversation.participant.avatar || undefined} alt={selectedConversation.participant.full_name} />
                    <AvatarFallback className="bg-primary text-white flex items-center justify-center">
                      {selectedConversation.participant.full_name.charAt(0) || <User className="h-5 w-5" />}
                    </AvatarFallback>
                  </Avatar>
                  <CardTitle className="text-lg font-semibold">{selectedConversation.participant.full_name}</CardTitle>
                </div>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreVertical className="h-5 w-5" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto max-w-xs text-sm p-2">Always engage with agency on Google meets</PopoverContent>
                </Popover>
              </div>
            ) : (
              <CardTitle className="text-lg text-muted-foreground">No conversation selected</CardTitle>
            )}
          </CardHeader>

          <div className="flex-1 overflow-y-auto p-4">
            <div className="space-y-4">
              {messages.length === 0 && selectedConversation ? (
                <div className="text-center text-muted-foreground text-sm py-8">Start your conversation here!</div>
              ) : (
                messages.map((message) => (
                  <div key={message.id} className={`flex ${message.sender_id === currentUserId ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[85%] sm:max-w-[75%] md:max-w-[70%] p-2 sm:p-3 rounded-2xl ${
                        message.sender_id === currentUserId ? "bg-primary text-white" : "bg-surface-2 text-foreground"
                      }`}
                    >
                      {message.file_url ? (
                        message.file_type?.startsWith("image/") ? (
                          <div>
                            <img
                              src={message.file_url}
                              alt={message.file_name ?? ""}
                              className="max-w-[200px] sm:max-w-[250px] md:max-w-[300px] h-auto rounded-md cursor-pointer object-cover"
                              onClick={() => window.open(message.file_url ?? undefined, "_blank", "noopener,noreferrer")}
                            />
                            <p className="text-xs mt-1 opacity-75">{message.file_name}</p>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 p-2 bg-black/10 rounded max-w-[250px] sm:max-w-[280px]">
                            <File className="h-4 w-4" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{message.file_name}</p>
                              <p className="text-xs opacity-75">{((message.file_size ?? 0) / 1024).toFixed(1)} KB</p>
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 w-6 p-0"
                              onClick={() => window.open(message.file_url ?? undefined, "_blank", "noopener,noreferrer")}
                            >
                              <Upload className="h-3 w-3" />
                            </Button>
                          </div>
                        )
                      ) : (
                        <p className="text-sm whitespace-pre-wrap">{message.message_text}</p>
                      )}
                      <span className="block text-xs mt-1 opacity-75">
                        {new Date(message.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>

          <div className="p-4 border-t border-border bg-card flex-shrink-0">
            {selectedFile && (
              <div className="mb-3 p-3 bg-surface-2 rounded-lg flex items-center gap-2">
                {selectedFile.type.startsWith("image/") ? <ImageIcon className="h-4 w-4" /> : <File className="h-4 w-4" />}
                <span className="text-sm flex-1 truncate">{selectedFile.name}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 w-6 p-0"
                  onClick={() => {
                    setSelectedFile(null)
                    if (fileInputRef.current) fileInputRef.current.value = ""
                  }}
                >
                  <X className="h-3 w-3" />
                </Button>
                <Button size="sm" onClick={handleSendFile} disabled={sendFile.isPending}>
                  {sendFile.isPending ? "Uploading..." : "Send"}
                </Button>
              </div>
            )}
            <div className="flex items-end gap-2">
              <input ref={fileInputRef} type="file" accept="image/*,.pdf,.doc,.docx" onChange={handleFileSelect} className="hidden" />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => fileInputRef.current?.click()}
                disabled={!selectedConversationId}
                className="flex-shrink-0"
              >
                <Upload className="h-4 w-4" />
              </Button>
              <div className="flex-1 relative">
                <Textarea
                  placeholder="Type your message..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault()
                      handleSend()
                    }
                  }}
                  rows={1}
                  className="flex-1 resize-none min-h-[40px]"
                  disabled={!selectedConversationId}
                />
              </div>
              <Button
                onClick={handleSend}
                disabled={!newMessage.trim() || !selectedConversationId}
                className="flex-shrink-0 w-10 h-10 rounded-full p-0"
                aria-label="Send message"
              >
                <Send className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd client && npx vitest run src/pages/shared/Messages.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/shared/Messages.tsx client/src/pages/shared/Messages.test.tsx
git commit -m "Port shared messaging inbox page to client"
```

---

## Task 7: Wire the routes into `App.tsx`

**Files:**
- Modify: `client/src/App.tsx`
- Test: `client/src/App.test.tsx` (extend)

**Interfaces:** none new — this task wires Task 6's page into the existing route table at two paths.

- [ ] **Step 1: Write the failing tests**

Add to `client/src/App.test.tsx` (a new top-level `describe`, after the existing protected-route describes):

```tsx
describe("messages routes", () => {
  it("redirects /freelancer/messages to /login when signed out", async () => {
    renderAt("/freelancer/messages")
    await screen.findByRole("heading", { name: /Continue your work/i })
  })

  it("redirects /agency/messages to /login when signed out", async () => {
    renderAt("/agency/messages")
    await screen.findByRole("heading", { name: /Continue your work/i })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client && npx vitest run src/App.test.tsx -t "messages routes"`
Expected: FAIL — neither route is registered yet.

- [ ] **Step 3: Update `client/src/App.tsx`**

Read the current file first to find its import block and the existing routes, and add both alongside them (before the existing catch-all `<Route path="*">` route). Add the import:

```tsx
import Messages from "./pages/shared/Messages"
```

Add both routes (the same component, two paths — place each next to its respective role's other routes):

```tsx
            <Route
              path="/freelancer/messages"
              element={
                <RequireAuth>
                  <Messages />
                </RequireAuth>
              }
            />
```

```tsx
            <Route
              path="/agency/messages"
              element={
                <RequireAuth>
                  <Messages />
                </RequireAuth>
              }
            />
```

- [ ] **Step 4: Update `App.test.tsx`'s `renderAt` helper**

Add the same import and both routes to the helper's local `<Routes>` table, mirroring how every earlier phase added its own route(s) there.

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd client && npx vitest run src/App.test.tsx`
Expected: PASS

- [ ] **Step 6: Run the full client test suite**

Run: `cd client && npm test`
Expected: All tests PASS

- [ ] **Step 7: Commit**

```bash
git add client/src/App.tsx client/src/App.test.tsx
git commit -m "Wire freelancer/agency messages routes behind RequireAuth"
```

---

## Post-Phase-3b note

This plan completes Phase 3 (credits & realtime messaging) in full. Deliberately deferred: starting a *new* conversation from other pages (`FindFreelancers.tsx`'s "Contact" button, proposal-review "Message" actions, etc.) — those entry points remain unwired until a dedicated follow-up plan; this phase only ports the inbox for conversations that already exist. The two open financial-security findings from Phase 3a (payment-reference confusion, RLS bypass on `purchase_credits`) remain open and unrelated to this plan — see `docs/superpowers/plans/2026-09-21-react-node-migration-phase3-credits.md` and this session's memory for full detail. After this plan merges, the migration proceeds to Phase 4 (escrow & payments — gated on an external Supabase-side v2 migration), Phase 5 (admin/disputes/influencer portals), Phase 6 (testing & regression hardening), Phase 7 (deployment & cutover).
