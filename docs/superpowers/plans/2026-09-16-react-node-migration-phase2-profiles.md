# React + Node Migration — Phase 2d (Profile Editors) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port `/freelancer/profile` and `/agency/profile` — the self-service editors freelancers and agencies use to manage the information the other side sees (bio, skills, rate, location, contact; company info for agencies) plus their avatar/logo — to `client/`.

**Architecture:** Two new server routes cover everything these pages need: `PATCH /api/user/profile` (whitelisted update of the caller's own `profiles` row — both account types share one endpoint since each page only ever sends its own fields) and `POST /api/user/avatar` (replaces the original's direct browser-to-Supabase-Storage upload; the client base64-encodes the selected image and the server uploads it via `req.supabase` and upserts into `freelancer_logos` or `agency_image` depending on the caller's `account_type`). Client-side, each page is a single file sourcing its form state from `useAuth().profile` (already fetched app-wide by `AuthContext`) and calling `refreshProfile()` after a successful save, mirroring the read/guard pattern `Dashboard.tsx`/`AgencyDashboard` already use.

**Tech Stack:** Same as prior Phase 2 slices (`client/`: React 19, TanStack Query, react-router, shadcn/Radix `Select`; `server/`: Express + `req.supabase`). No new dependencies — avatar upload goes over JSON (base64), not multipart, since the server has no `multer` today and avatars are small enough that adding a dependency for it isn't justified.

**Spec:** `docs/superpowers/specs/2026-09-08-nextjs-to-react-node-migration-design.md` (Section 7, Phase 2 row)

## Global Constraints

- **`PATCH /api/user/profile` uses a fixed field whitelist**, never a body spread — the migration has an open, tracked mass-assignment gap on `updateJob`/`createJob` (raw `req.body` spread into the DB write); this route must not repeat it. Only `full_name`, `bio`, `location`, `phone`, `website`, `hourly_rate`, `skills`, `experience_level`, `company_name`, `company_size` are ever written, and the write is always scoped with `.eq("id", req.user!.id)`.
- **No `multer`/multipart.** `POST /api/user/avatar` accepts `{ data: string (base64), fileName: string, mimeType: string }` as JSON. `server/src/app.ts`'s `express.json()` needs its size limit raised from Express's 100kb default (a base64-encoded image is ~33% larger than the original file) — raise it to `"8mb"`, which comfortably covers the client's 5MB file-size cap.
- **Storage path convention is unchanged:** `avatars/{user_id}/avatar.{ext}`, matching `scripts/storage-migration-setup.sql`'s RLS policies (`(storage.foldername(name))[1] = auth.uid()::text`). Since `req.supabase` is scoped to the caller's own JWT (same as the browser client the original code used), no policy changes are needed.
- **Avatar/logo storage tables are reused as-is** (`freelancer_logos` keyed by `freelancer_id`+`logo_path`, `agency_image` keyed by `agency_id`+`image_path`) — no schema changes. The upload route deletes any existing row for the caller before inserting the new one, matching the original's delete-then-insert behavior.
- **No new "own avatar" GET route.** The freelancer profile page reuses the existing `POST /api/user/freelancer-logos` (batch) with `[user.id]`; the agency profile page reuses the existing `GET /api/agencies/:agencyId/image` with the caller's own id — both already exist from Phase 2a/2c.
- **Guard pattern matches `Dashboard.tsx`/`AgencyDashboard`:** `const { profile } = useAuth(); if (profile && profile.account_type !== "<role>") return <Navigate to="/" replace />`. Bake this in from the start and cover it with a test — a prior phase's review had to fix a missing version of this check after the fact.
- **Visual style follows the plainer card style already established** by `AgencyProfileClient`-derived pages (`Dashboard.tsx`, `AgencyDashboard`, `SavedJobs.tsx`) — `rounded-xl border border-border bg-card`, `text-muted-foreground`, semantic tokens — not the original Next.js freelancer `ProfileClient.tsx`'s bespoke "editorial" typography classes (`display-xl`, `eyebrow`, `lede`, etc.), which don't exist in `client/`'s Tailwind setup.
- **KYC/NIN status is out of scope** — neither original profile page shows it, and the migration memory confirms there's no in-repo KYC logic to build.
- Every data need funnels through a query/mutation hook in `client/src/lib/queries/*.ts` — no page calls `apiFetch` directly.

---

## Task 1: `PATCH /api/user/profile` server route

**Files:**
- Modify: `server/src/routes/user.ts`
- Test: `server/src/routes/user.test.ts`

**Interfaces:**
- Produces: `PATCH /api/user/profile` — request body is a partial object of any of `full_name, bio, location, phone, website, hourly_rate, skills, experience_level, company_name, company_size`; response `{ success: true } | { success: false, error: string }`.

- [ ] **Step 1: Write the failing tests**

Add to `server/src/routes/user.test.ts` (after the existing `describe("GET /profile", ...)` block):

```ts
describe("PATCH /profile", () => {
  it("writes only whitelisted fields, scoped to the caller's own id", async () => {
    const eqMock = vi.fn().mockResolvedValue({ error: null })
    const updateMock = vi.fn(() => ({ eq: eqMock }))
    const supabase = { from: vi.fn(() => ({ update: updateMock })) }

    const res = await request(appWith({ id: "user-1" }, supabase))
      .patch("/profile")
      .send({
        full_name: "Jane Doe",
        bio: "A bio",
        hourly_rate: 5000,
        skills: ["React", "Node"],
        role: "admin", // not whitelisted — must be dropped
        id: "someone-else", // not whitelisted — must be dropped
      })

    expect(res.body).toEqual({ success: true })
    expect(supabase.from).toHaveBeenCalledWith("profiles")
    const writtenFields = updateMock.mock.calls[0][0]
    expect(writtenFields).toMatchObject({
      full_name: "Jane Doe",
      bio: "A bio",
      hourly_rate: 5000,
      skills: ["React", "Node"],
    })
    expect(writtenFields).not.toHaveProperty("role")
    expect(writtenFields).not.toHaveProperty("id")
    expect(eqMock).toHaveBeenCalledWith("id", "user-1")
  })

  it("returns success: false with the DB error message when the update fails", async () => {
    const eqMock = vi.fn().mockResolvedValue({ error: { message: "constraint violation" } })
    const supabase = { from: vi.fn(() => ({ update: vi.fn(() => ({ eq: eqMock })) })) }

    const res = await request(appWith({ id: "user-1" }, supabase))
      .patch("/profile")
      .send({ full_name: "Jane Doe" })

    expect(res.body).toEqual({ success: false, error: "constraint violation" })
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd server && npx vitest run src/routes/user.test.ts -t "PATCH /profile"`
Expected: FAIL — `PATCH /profile` doesn't exist yet (404 from the router, so `res.body` won't match).

- [ ] **Step 3: Implement the route**

In `server/src/routes/user.ts`, add near the top (after the existing helper functions, before the route definitions):

```ts
const PROFILE_FIELDS = [
  "full_name",
  "bio",
  "location",
  "phone",
  "website",
  "hourly_rate",
  "skills",
  "experience_level",
  "company_name",
  "company_size",
] as const
```

Add the route (after the existing `GET /profile` block):

```ts
userRouter.patch(
  "/profile",
  asyncHandler(async (req, res) => {
    const body = req.body ?? {}
    const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
    for (const field of PROFILE_FIELDS) {
      if (field in body) update[field] = body[field]
    }

    const { error } = await req.supabase!.from("profiles").update(update).eq("id", req.user!.id)

    if (error) {
      console.error("updateProfile error:", error)
      res.json({ success: false, error: error.message })
      return
    }

    res.json({ success: true })
  })
)
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd server && npx vitest run src/routes/user.test.ts -t "PATCH /profile"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/src/routes/user.ts server/src/routes/user.test.ts
git commit -m "feat(server): add PATCH /api/user/profile with a whitelisted field update"
```

---

## Task 2: `POST /api/user/avatar` server route + JSON body limit

**Files:**
- Modify: `server/src/app.ts`
- Modify: `server/src/routes/user.ts`
- Test: `server/src/app.test.ts`
- Test: `server/src/routes/user.test.ts`

**Interfaces:**
- Consumes: `fetchProfile(supabase, userId)` (already defined in `user.ts`, Task 1's file).
- Produces: `POST /api/user/avatar` — request body `{ data: string, fileName: string, mimeType: string }`; response `{ success: true, avatar: string } | { success: false, error: string } | 400 { error: string }`.

- [ ] **Step 1: Write the failing body-size-limit test**

Add to `server/src/app.test.ts` (a new top-level `describe`, after the existing `describe("error propagation through errorHandler", ...)` block):

```ts
describe("JSON body size limit", () => {
  it("accepts a JSON body larger than Express's 100kb default (raised for avatar uploads)", async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: "user-1", email: "a@b.com" } },
      error: null,
    })
    singleMock.mockResolvedValue({
      data: { id: "user-1", full_name: "Jane Doe", account_type: "agency" },
      error: null,
    })

    const res = await request(createApp())
      .patch("/api/jobs/some-id/status")
      .set("Authorization", "Bearer valid-token")
      .send({ status: "x".repeat(150_000) })

    expect(res.status).not.toBe(413)
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd server && npx vitest run src/app.test.ts -t "JSON body size limit"`
Expected: FAIL with status `413` (Express's default `100kb` `express.json()` limit rejects the ~150KB body).

- [ ] **Step 3: Raise the body size limit**

In `server/src/app.ts`, change:

```ts
  app.use(express.json())
```

to:

```ts
  app.use(express.json({ limit: "8mb" }))
```

- [ ] **Step 4: Run it to verify it passes**

Run: `cd server && npx vitest run src/app.test.ts -t "JSON body size limit"`
Expected: PASS (status is `500`, from the existing mocked "DB error" on the jobs update chain — the assertion only checks it isn't `413`).

- [ ] **Step 5: Write the failing route tests**

Add to `server/src/routes/user.test.ts` (after the `PATCH /profile` block from Task 1):

```ts
describe("POST /avatar", () => {
  it("uploads to storage and upserts freelancer_logos for a freelancer caller", async () => {
    process.env.SUPABASE_URL = "https://example.supabase.co"
    const uploadMock = vi.fn().mockResolvedValue({ error: null })
    const deleteEq = vi.fn().mockResolvedValue({ error: null })
    const insertMock = vi.fn().mockResolvedValue({ error: null })

    const supabase = {
      storage: { from: vi.fn(() => ({ upload: uploadMock })) },
      from: vi.fn((table: string) => {
        if (table === "profiles") {
          return { select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn().mockResolvedValue({ data: { account_type: "freelancer" }, error: null }) })) })) }
        }
        if (table === "freelancer_logos") {
          return { delete: vi.fn(() => ({ eq: deleteEq })), insert: insertMock }
        }
        throw new Error(`unexpected table ${table}`)
      }),
    }

    const res = await request(appWith({ id: "user-1" }, supabase))
      .post("/avatar")
      .send({ data: Buffer.from("hello").toString("base64"), fileName: "photo.png", mimeType: "image/png" })

    expect(supabase.storage.from).toHaveBeenCalledWith("avatars")
    expect(uploadMock).toHaveBeenCalledWith(
      "user-1/avatar.png",
      Buffer.from("hello"),
      { contentType: "image/png", upsert: true }
    )
    expect(deleteEq).toHaveBeenCalledWith("freelancer_id", "user-1")
    expect(insertMock).toHaveBeenCalledWith({
      freelancer_id: "user-1",
      logo_path: "user-1/avatar.png",
      file_name: "photo.png",
      file_size: 5,
      mime_type: "image/png",
    })
    expect(res.body).toEqual({
      success: true,
      avatar: "https://example.supabase.co/storage/v1/object/public/avatars/user-1/avatar.png",
    })
  })

  it("upserts agency_image instead when the caller's account_type is agency", async () => {
    process.env.SUPABASE_URL = "https://example.supabase.co"
    const uploadMock = vi.fn().mockResolvedValue({ error: null })
    const insertMock = vi.fn().mockResolvedValue({ error: null })

    const supabase = {
      storage: { from: vi.fn(() => ({ upload: uploadMock })) },
      from: vi.fn((table: string) => {
        if (table === "profiles") {
          return { select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn().mockResolvedValue({ data: { account_type: "agency" }, error: null }) })) })) }
        }
        if (table === "agency_image") {
          return { delete: vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: null }) })), insert: insertMock }
        }
        throw new Error(`unexpected table ${table}`)
      }),
    }

    await request(appWith({ id: "agency-1" }, supabase))
      .post("/avatar")
      .send({ data: Buffer.from("hi").toString("base64"), fileName: "logo.jpg", mimeType: "image/jpeg" })

    expect(insertMock).toHaveBeenCalledWith({
      agency_id: "agency-1",
      image_path: "agency-1/avatar.jpg",
      file_name: "logo.jpg",
      file_size: 2,
      mime_type: "image/jpeg",
    })
  })

  it("returns 400 when data, fileName, or mimeType is missing", async () => {
    const supabase = { from: vi.fn() }
    const res = await request(appWith({ id: "user-1" }, supabase)).post("/avatar").send({ fileName: "a.png" })
    expect(res.status).toBe(400)
    expect(supabase.from).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 6: Run the tests to verify they fail**

Run: `cd server && npx vitest run src/routes/user.test.ts -t "POST /avatar"`
Expected: FAIL — route doesn't exist yet.

- [ ] **Step 7: Implement the route**

In `server/src/routes/user.ts`, update the import line at the top from:

```ts
import { resolveAvatar } from "../lib/avatar.js"
```

to:

```ts
import { resolveAvatar, getAvatarUrl } from "../lib/avatar.js"
```

Add the route (after the `PATCH /profile` block from Task 1):

```ts
userRouter.post(
  "/avatar",
  asyncHandler(async (req, res) => {
    const { data, fileName, mimeType } = req.body ?? {}
    if (typeof data !== "string" || typeof fileName !== "string" || typeof mimeType !== "string") {
      res.status(400).json({ error: "data, fileName, and mimeType are required" })
      return
    }

    const supabase = req.supabase!
    const userId = req.user!.id
    const profile = await fetchProfile(supabase, userId)
    const isAgency = profile?.account_type === "agency"

    const ext = fileName.split(".").pop()?.toLowerCase() || "png"
    const path = `${userId}/avatar.${ext}`
    const buffer = Buffer.from(data, "base64")

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, buffer, { contentType: mimeType, upsert: true })

    if (uploadError) {
      console.error("avatar upload error:", uploadError)
      res.json({ success: false, error: uploadError.message })
      return
    }

    const table = isAgency ? "agency_image" : "freelancer_logos"
    const idColumn = isAgency ? "agency_id" : "freelancer_id"
    const pathColumn = isAgency ? "image_path" : "logo_path"

    await supabase.from(table).delete().eq(idColumn, userId)
    const { error: insertError } = await supabase.from(table).insert({
      [idColumn]: userId,
      [pathColumn]: path,
      file_name: fileName,
      file_size: buffer.length,
      mime_type: mimeType,
    })

    if (insertError) {
      console.error("avatar record insert error:", insertError)
      res.json({ success: false, error: insertError.message })
      return
    }

    res.json({ success: true, avatar: getAvatarUrl(path) })
  })
)
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `cd server && npx vitest run src/routes/user.test.ts -t "POST /avatar"`
Expected: PASS

- [ ] **Step 9: Run the full server test suite**

Run: `cd server && npx vitest run`
Expected: PASS (all existing tests still pass alongside the new ones)

- [ ] **Step 10: Commit**

```bash
git add server/src/app.ts server/src/app.test.ts server/src/routes/user.ts server/src/routes/user.test.ts
git commit -m "feat(server): add POST /api/user/avatar and raise the JSON body limit for it"
```

---

## Task 3: `fileToBase64` client helper

**Files:**
- Create: `client/src/lib/file.ts`
- Test: `client/src/lib/file.test.ts`

**Interfaces:**
- Produces: `fileToBase64(file: File): Promise<{ dataUrl: string; data: string; mimeType: string; fileName: string }>` — used by Task 5/6's pages.

- [ ] **Step 1: Write the failing test**

```ts
// client/src/lib/file.test.ts
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
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd client && npx vitest run src/lib/file.test.ts`
Expected: FAIL — `client/src/lib/file.ts` doesn't exist yet.

- [ ] **Step 3: Implement the helper**

```ts
// client/src/lib/file.ts
export type FileBase64 = {
  dataUrl: string
  data: string
  mimeType: string
  fileName: string
}

export function fileToBase64(file: File): Promise<FileBase64> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      const data = dataUrl.slice(dataUrl.indexOf(",") + 1)
      resolve({ dataUrl, data, mimeType: file.type, fileName: file.name })
    }
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read file"))
    reader.readAsDataURL(file)
  })
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `cd client && npx vitest run src/lib/file.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add client/src/lib/file.ts client/src/lib/file.test.ts
git commit -m "feat(client): add fileToBase64 helper for avatar uploads"
```

---

## Task 4: Client query/mutation hooks

**Files:**
- Modify: `client/src/lib/queries/user.ts`
- Test: `client/src/lib/queries/user.test.tsx`

**Interfaces:**
- Consumes: `apiFetch` (`client/src/lib/api.ts`, existing).
- Produces: `useUpdateProfileMutation()`, `useUploadAvatarMutation()` — used by Task 5/6's pages.

- [ ] **Step 1: Write the failing tests**

Add to `client/src/lib/queries/user.test.tsx` (after the existing `describe("useFreelancerLogosQuery", ...)` block):

```tsx
describe("useUpdateProfileMutation", () => {
  it("PATCHes /api/user/profile with the given input", async () => {
    apiFetchMock.mockResolvedValue({ success: true })
    const { useUpdateProfileMutation } = await import("./user")

    const { result } = renderHook(() => useUpdateProfileMutation(), { wrapper })
    result.current.mutate({ full_name: "Jane Doe" })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(apiFetchMock).toHaveBeenCalledWith("/api/user/profile", {
      method: "PATCH",
      body: JSON.stringify({ full_name: "Jane Doe" }),
    })
  })
})

describe("useUploadAvatarMutation", () => {
  it("POSTs /api/user/avatar with the given payload", async () => {
    apiFetchMock.mockResolvedValue({ success: true, avatar: "https://example.com/a.png" })
    const { useUploadAvatarMutation } = await import("./user")

    const { result } = renderHook(() => useUploadAvatarMutation(), { wrapper })
    result.current.mutate({ data: "aGVsbG8=", fileName: "a.png", mimeType: "image/png" })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(apiFetchMock).toHaveBeenCalledWith("/api/user/avatar", {
      method: "POST",
      body: JSON.stringify({ data: "aGVsbG8=", fileName: "a.png", mimeType: "image/png" }),
    })
    expect(result.current.data?.avatar).toBe("https://example.com/a.png")
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd client && npx vitest run src/lib/queries/user.test.tsx -t "useUpdateProfileMutation|useUploadAvatarMutation"`
Expected: FAIL — neither hook is exported yet.

- [ ] **Step 3: Implement the hooks**

Add to `client/src/lib/queries/user.ts` (the file already imports `useQuery` from `@tanstack/react-query`; update that import line to also bring in `useMutation` and `useQueryClient`):

```ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
```

Then append:

```ts
export function useUpdateProfileMutation() {
  return useMutation({
    mutationFn: (input: Record<string, unknown>) =>
      apiFetch<{ success: boolean; error?: string }>("/api/user/profile", {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
  })
}

export function useUploadAvatarMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { data: string; fileName: string; mimeType: string }) =>
      apiFetch<{ success: boolean; avatar?: string; error?: string }>("/api/user/avatar", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agencies"] })
      queryClient.invalidateQueries({ queryKey: ["user", "freelancer-logos"] })
    },
  })
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd client && npx vitest run src/lib/queries/user.test.tsx`
Expected: PASS (all tests in the file, old and new)

- [ ] **Step 5: Commit**

```bash
git add client/src/lib/queries/user.ts client/src/lib/queries/user.test.tsx
git commit -m "feat(client): add useUpdateProfileMutation and useUploadAvatarMutation"
```

---

## Task 5: Freelancer profile page

**Files:**
- Create: `client/src/pages/freelancer/Profile.tsx`
- Test: `client/src/pages/freelancer/Profile.test.tsx`
- Modify: `client/src/App.tsx`

**Interfaces:**
- Consumes: `useAuth()` (`client/src/contexts/AuthContext.tsx` — `user`, `profile`, `refreshProfile`), `useFreelancerLogosQuery` (`client/src/lib/queries/user.ts`, existing), `useUpdateProfileMutation`/`useUploadAvatarMutation` (Task 4), `fileToBase64` (Task 3).

- [ ] **Step 1: Write the failing tests**

```tsx
// client/src/pages/freelancer/Profile.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor, fireEvent } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Routes, Route } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

const useAuthMock = vi.fn()
vi.mock("../../contexts/AuthContext", () => ({ useAuth: () => useAuthMock() }))

const useFreelancerLogosQueryMock = vi.fn()
const updateProfileMutate = vi.fn()
const uploadAvatarMutate = vi.fn()
vi.mock("../../lib/queries/user", () => ({
  useFreelancerLogosQuery: (...args: unknown[]) => useFreelancerLogosQueryMock(...args),
  useUpdateProfileMutation: () => ({ mutate: updateProfileMutate, isPending: false }),
  useUploadAvatarMutation: () => ({ mutate: uploadAvatarMutate, isPending: false }),
}))

import FreelancerProfile from "./Profile"

function renderProfile() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/freelancer/profile"]}>
        <Routes>
          <Route path="/" element={<div>home</div>} />
          <Route path="/freelancer/profile" element={<FreelancerProfile />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  useAuthMock.mockReturnValue({
    user: { id: "freelancer-1" },
    profile: { full_name: "Jane Doe", bio: "A bio", account_type: "freelancer", skills: ["React"] },
    refreshProfile: vi.fn(),
  })
  useFreelancerLogosQueryMock.mockReturnValue({ data: { logos: {} } })
})

describe("FreelancerProfile", () => {
  it("redirects home when the signed-in user's account_type isn't freelancer", async () => {
    useAuthMock.mockReturnValue({
      user: { id: "agency-1" },
      profile: { account_type: "agency" },
      refreshProfile: vi.fn(),
    })
    renderProfile()
    await waitFor(() => expect(screen.getByText("home")).toBeInTheDocument())
  })

  it("renders the current profile read-only, then reveals form fields in edit mode", async () => {
    renderProfile()
    expect(screen.getByText("Jane Doe")).toBeInTheDocument()
    expect(screen.getByDisplayValue("A bio")).toBeInTheDocument()
    expect(screen.queryByLabelText("Full name")).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole("button", { name: /edit profile/i }))

    expect(screen.getByLabelText("Full name")).toHaveValue("Jane Doe")
  })

  it("saves whitelisted fields and refreshes the profile on success", async () => {
    const refreshProfile = vi.fn()
    useAuthMock.mockReturnValue({
      user: { id: "freelancer-1" },
      profile: { full_name: "Jane Doe", account_type: "freelancer" },
      refreshProfile,
    })
    updateProfileMutate.mockImplementation((_input, { onSuccess }) => onSuccess({ success: true }))
    renderProfile()

    await userEvent.click(screen.getByRole("button", { name: /edit profile/i }))
    await userEvent.clear(screen.getByLabelText("Full name"))
    await userEvent.type(screen.getByLabelText("Full name"), "Jane Smith")
    await userEvent.click(screen.getByRole("button", { name: /save changes/i }))

    expect(updateProfileMutate.mock.calls[0][0]).toMatchObject({ full_name: "Jane Smith" })
    await waitFor(() => expect(refreshProfile).toHaveBeenCalled())
  })

  it("uploads a selected avatar image", async () => {
    uploadAvatarMutate.mockImplementation(() => {})
    renderProfile()
    await userEvent.click(screen.getByRole("button", { name: /edit profile/i }))

    const file = new File(["hello"], "avatar.png", { type: "image/png" })
    const input = document.getElementById("avatar-upload") as HTMLInputElement
    fireEvent.change(input, { target: { files: [file] } })

    await waitFor(() =>
      expect(uploadAvatarMutate).toHaveBeenCalledWith(
        expect.objectContaining({ fileName: "avatar.png", mimeType: "image/png" }),
        expect.anything()
      )
    )
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd client && npx vitest run src/pages/freelancer/Profile.test.tsx`
Expected: FAIL — `client/src/pages/freelancer/Profile.tsx` doesn't exist yet.

- [ ] **Step 3: Implement the page**

```tsx
// client/src/pages/freelancer/Profile.tsx
import { useState, type ChangeEvent } from "react"
import { Navigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Camera, Edit } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { useFreelancerLogosQuery, useUpdateProfileMutation, useUploadAvatarMutation } from "@/lib/queries/user"
import { fileToBase64 } from "@/lib/file"

const MAX_AVATAR_BYTES = 5 * 1024 * 1024

function toFormData(profile: any) {
  return {
    full_name: profile?.full_name || "",
    bio: profile?.bio || "",
    location: profile?.location || "",
    phone: profile?.phone || "",
    website: profile?.website || "",
    hourly_rate: profile?.hourly_rate ? String(profile.hourly_rate) : "",
    skills: Array.isArray(profile?.skills) ? profile.skills.join(", ") : "",
    experience_level: profile?.experience_level || "",
  }
}

export default function FreelancerProfile() {
  const { user, profile, refreshProfile } = useAuth()
  const logosQuery = useFreelancerLogosQuery(user?.id ? [user.id] : [])
  const updateProfile = useUpdateProfileMutation()
  const uploadAvatar = useUploadAvatarMutation()

  const [isEditing, setIsEditing] = useState(false)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [formData, setFormData] = useState(toFormData(profile))

  if (profile && profile.account_type !== "freelancer") {
    return <Navigate to="/" replace />
  }

  const startEditing = () => {
    setFormData(toFormData(profile))
    setIsEditing(true)
  }

  const handleAvatarSelect = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (file.size > MAX_AVATAR_BYTES) {
      alert("Image must be 5MB or smaller.")
      return
    }
    const { dataUrl, data, mimeType, fileName } = await fileToBase64(file)
    setAvatarPreview(dataUrl)
    uploadAvatar.mutate(
      { data, fileName, mimeType },
      { onError: () => alert("Error uploading photo") }
    )
  }

  const handleSave = () => {
    updateProfile.mutate(
      {
        full_name: formData.full_name,
        bio: formData.bio || null,
        location: formData.location || null,
        phone: formData.phone || null,
        website: formData.website || null,
        hourly_rate: formData.hourly_rate ? Number.parseInt(formData.hourly_rate, 10) : null,
        skills: formData.skills
          ? formData.skills.split(",").map((s) => s.trim()).filter((s) => s.length > 0)
          : null,
        experience_level: formData.experience_level || null,
      },
      {
        onSuccess: async (result: { success: boolean; error?: string }) => {
          if (!result.success) {
            alert(result.error || "Error saving profile")
            return
          }
          await refreshProfile()
          setIsEditing(false)
        },
        onError: () => alert("Error saving profile"),
      }
    )
  }

  const avatarSrc = avatarPreview ?? logosQuery.data?.logos?.[user?.id ?? ""] ?? undefined
  const skillsList = formData.skills ? formData.skills.split(",").map((s) => s.trim()).filter(Boolean) : []

  return (
    <div className="min-h-screen bg-surface pb-20">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="flex items-center gap-4 min-w-0">
            <div className="relative group shrink-0">
              <Avatar className="h-20 w-20 rounded-2xl border border-border">
                <AvatarImage src={avatarSrc} className="object-cover" />
                <AvatarFallback className="bg-foreground text-white text-2xl font-semibold rounded-2xl">
                  {(formData.full_name?.charAt(0) || "?").toUpperCase()}
                </AvatarFallback>
              </Avatar>
              {isEditing && (
                <label
                  htmlFor="avatar-upload"
                  className="absolute inset-0 bg-foreground/60 rounded-2xl flex items-center justify-center cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Camera className="text-white h-6 w-6" />
                  <input type="file" accept="image/*" onChange={handleAvatarSelect} className="hidden" id="avatar-upload" />
                </label>
              )}
            </div>
            <div className="space-y-1 min-w-0">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Freelancer profile</p>
              <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-foreground truncate">
                {formData.full_name || "Your name"}
              </h1>
              <p className="text-sm text-muted-foreground">{formData.location || "Location not set"}</p>
            </div>
          </div>
          <div className="w-full sm:w-auto sm:shrink-0">
            {!isEditing ? (
              <Button onClick={startEditing} className="h-10 px-4 rounded-lg gap-2 w-full sm:w-auto justify-center">
                <Edit className="h-4 w-4" /> Edit profile
              </Button>
            ) : (
              <div className="flex gap-2 w-full sm:w-auto">
                <Button variant="outline" onClick={() => setIsEditing(false)} className="h-10 px-4 rounded-lg flex-1 sm:flex-none justify-center">
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={updateProfile.isPending} className="h-10 px-4 rounded-lg flex-1 sm:flex-none justify-center">
                  {updateProfile.isPending ? "Saving…" : "Save changes"}
                </Button>
              </div>
            )}
          </div>
        </header>

        <div className="rounded-xl border border-border bg-card">
          <div className="p-6 pb-4">
            <h2 className="text-base font-semibold text-foreground">About</h2>
            <p className="text-sm text-muted-foreground mt-0.5">What agencies see when reviewing your proposals.</p>
          </div>
          <div className="p-6 pt-0 space-y-6">
            <div className="space-y-2">
              <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Bio</Label>
              <Textarea
                rows={6}
                className="min-h-[140px] resize-none"
                placeholder="Tell agencies about your background, expertise, and what you deliver…"
                value={formData.bio}
                onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                disabled={!isEditing}
              />
            </div>

            {isEditing && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
                <div className="space-y-2">
                  <Label htmlFor="full_name" className="text-sm font-medium text-foreground">Full name</Label>
                  <Input id="full_name" value={formData.full_name} onChange={(e) => setFormData({ ...formData, full_name: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="hourly_rate" className="text-sm font-medium text-foreground">Hourly rate (₦)</Label>
                  <Input id="hourly_rate" type="number" value={formData.hourly_rate} onChange={(e) => setFormData({ ...formData, hourly_rate: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="location" className="text-sm font-medium text-foreground">Location</Label>
                  <Input id="location" value={formData.location} onChange={(e) => setFormData({ ...formData, location: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-foreground">Experience level</Label>
                  <Select value={formData.experience_level} onValueChange={(v) => setFormData({ ...formData, experience_level: v })}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select level" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="beginner">Beginner (0–1 yrs)</SelectItem>
                      <SelectItem value="intermediate">Intermediate (2–4 yrs)</SelectItem>
                      <SelectItem value="expert">Expert (5+ yrs)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-sm font-medium text-foreground">Phone</Label>
                  <Input id="phone" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="website" className="text-sm font-medium text-foreground">Website</Label>
                  <Input id="website" value={formData.website} onChange={(e) => setFormData({ ...formData, website: e.target.value })} />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="skills" className="text-sm font-medium text-foreground">Skills</Label>
                  <Textarea
                    id="skills"
                    rows={2}
                    placeholder="React, Node.js, UI design, marketing strategy…"
                    value={formData.skills}
                    onChange={(e) => setFormData({ ...formData, skills: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">Separate with commas.</p>
                </div>
              </div>
            )}

            {!isEditing && (
              <div className="space-y-2">
                <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Skills</Label>
                {skillsList.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {skillsList.map((skill) => (
                      <span key={skill} className="px-3 py-1.5 bg-surface-2 text-foreground text-xs font-medium rounded-md border border-border">
                        {skill}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic">No skills listed yet.</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd client && npx vitest run src/pages/freelancer/Profile.test.tsx`
Expected: PASS

- [ ] **Step 5: Wire the route into `App.tsx`**

In `client/src/App.tsx`, add the import:

```tsx
import FreelancerProfile from "./pages/freelancer/Profile"
```

Add the route (next to the other `/freelancer/*` routes):

```tsx
            <Route
              path="/freelancer/profile"
              element={
                <RequireAuth>
                  <FreelancerProfile />
                </RequireAuth>
              }
            />
```

- [ ] **Step 6: Run the full client test suite**

Run: `cd client && npx vitest run`
Expected: PASS (all existing tests still pass alongside the new ones)

- [ ] **Step 7: Commit**

```bash
git add client/src/pages/freelancer/Profile.tsx client/src/pages/freelancer/Profile.test.tsx client/src/App.tsx
git commit -m "feat(client): port /freelancer/profile to the new client"
```

---

## Task 6: Agency profile page

**Files:**
- Create: `client/src/pages/agency/Profile.tsx`
- Test: `client/src/pages/agency/Profile.test.tsx`
- Modify: `client/src/App.tsx`

**Interfaces:**
- Consumes: `useAuth()` (existing), `useAgencyImageQuery` (`client/src/lib/queries/agencies.ts`, existing), `useUpdateProfileMutation`/`useUploadAvatarMutation` (Task 4), `fileToBase64` (Task 3).

- [ ] **Step 1: Write the failing tests**

```tsx
// client/src/pages/agency/Profile.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor, fireEvent } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Routes, Route } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

const useAuthMock = vi.fn()
vi.mock("../../contexts/AuthContext", () => ({ useAuth: () => useAuthMock() }))

const useAgencyImageQueryMock = vi.fn()
vi.mock("../../lib/queries/agencies", () => ({
  useAgencyImageQuery: (...args: unknown[]) => useAgencyImageQueryMock(...args),
}))

const updateProfileMutate = vi.fn()
const uploadAvatarMutate = vi.fn()
vi.mock("../../lib/queries/user", () => ({
  useUpdateProfileMutation: () => ({ mutate: updateProfileMutate, isPending: false }),
  useUploadAvatarMutation: () => ({ mutate: uploadAvatarMutate, isPending: false }),
}))

import AgencyProfile from "./Profile"

function renderProfile() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/agency/profile"]}>
        <Routes>
          <Route path="/" element={<div>home</div>} />
          <Route path="/agency/profile" element={<AgencyProfile />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  useAuthMock.mockReturnValue({
    user: { id: "agency-1" },
    profile: { company_name: "Acme Co", full_name: "Point Contact", bio: "We build things", account_type: "agency" },
    refreshProfile: vi.fn(),
  })
  useAgencyImageQueryMock.mockReturnValue({ data: { image: null } })
})

describe("AgencyProfile", () => {
  it("redirects home when the signed-in user's account_type isn't agency", async () => {
    useAuthMock.mockReturnValue({
      user: { id: "freelancer-1" },
      profile: { account_type: "freelancer" },
      refreshProfile: vi.fn(),
    })
    renderProfile()
    await waitFor(() => expect(screen.getByText("home")).toBeInTheDocument())
  })

  it("renders the current profile read-only, then reveals form fields in edit mode", async () => {
    renderProfile()
    expect(screen.getByText("Acme Co")).toBeInTheDocument()
    expect(screen.getByDisplayValue("We build things")).toBeInTheDocument()
    expect(screen.queryByLabelText("Company name")).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole("button", { name: /edit profile/i }))

    expect(screen.getByLabelText("Company name")).toHaveValue("Acme Co")
  })

  it("saves whitelisted fields and refreshes the profile on success", async () => {
    const refreshProfile = vi.fn()
    useAuthMock.mockReturnValue({
      user: { id: "agency-1" },
      profile: { company_name: "Acme Co", account_type: "agency" },
      refreshProfile,
    })
    updateProfileMutate.mockImplementation((_input, { onSuccess }) => onSuccess({ success: true }))
    renderProfile()

    await userEvent.click(screen.getByRole("button", { name: /edit profile/i }))
    await userEvent.clear(screen.getByLabelText("Company name"))
    await userEvent.type(screen.getByLabelText("Company name"), "Acme Corp")
    await userEvent.click(screen.getByRole("button", { name: /save changes/i }))

    expect(updateProfileMutate.mock.calls[0][0]).toMatchObject({ company_name: "Acme Corp" })
    await waitFor(() => expect(refreshProfile).toHaveBeenCalled())
  })

  it("uploads a selected logo image", async () => {
    uploadAvatarMutate.mockImplementation(() => {})
    renderProfile()
    await userEvent.click(screen.getByRole("button", { name: /edit profile/i }))

    const file = new File(["hello"], "logo.jpg", { type: "image/jpeg" })
    const input = document.getElementById("avatar-upload") as HTMLInputElement
    fireEvent.change(input, { target: { files: [file] } })

    await waitFor(() =>
      expect(uploadAvatarMutate).toHaveBeenCalledWith(
        expect.objectContaining({ fileName: "logo.jpg", mimeType: "image/jpeg" }),
        expect.anything()
      )
    )
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd client && npx vitest run src/pages/agency/Profile.test.tsx`
Expected: FAIL — `client/src/pages/agency/Profile.tsx` doesn't exist yet.

- [ ] **Step 3: Implement the page**

```tsx
// client/src/pages/agency/Profile.tsx
import { useState, type ChangeEvent } from "react"
import { Navigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Camera, Edit, MapPin } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { useAgencyImageQuery } from "@/lib/queries/agencies"
import { useUpdateProfileMutation, useUploadAvatarMutation } from "@/lib/queries/user"
import { fileToBase64 } from "@/lib/file"

const MAX_AVATAR_BYTES = 5 * 1024 * 1024

function toFormData(profile: any) {
  return {
    full_name: profile?.full_name || "",
    company_name: profile?.company_name || "",
    company_size: profile?.company_size || "",
    bio: profile?.bio || "",
    location: profile?.location || "",
    phone: profile?.phone || "",
    website: profile?.website || "",
  }
}

export default function AgencyProfile() {
  const { user, profile, refreshProfile } = useAuth()
  const imageQuery = useAgencyImageQuery(user?.id, !!user?.id)
  const updateProfile = useUpdateProfileMutation()
  const uploadAvatar = useUploadAvatarMutation()

  const [isEditing, setIsEditing] = useState(false)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [formData, setFormData] = useState(toFormData(profile))

  if (profile && profile.account_type !== "agency") {
    return <Navigate to="/" replace />
  }

  const startEditing = () => {
    setFormData(toFormData(profile))
    setIsEditing(true)
  }

  const handleAvatarSelect = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (file.size > MAX_AVATAR_BYTES) {
      alert("Image must be 5MB or smaller.")
      return
    }
    const { dataUrl, data, mimeType, fileName } = await fileToBase64(file)
    setAvatarPreview(dataUrl)
    uploadAvatar.mutate(
      { data, fileName, mimeType },
      { onError: () => alert("Error uploading logo") }
    )
  }

  const handleSave = () => {
    updateProfile.mutate(
      {
        full_name: formData.full_name || null,
        company_name: formData.company_name || null,
        company_size: formData.company_size || null,
        bio: formData.bio || null,
        location: formData.location || null,
        phone: formData.phone || null,
        website: formData.website || null,
      },
      {
        onSuccess: async (result: { success: boolean; error?: string }) => {
          if (!result.success) {
            alert(result.error || "Error saving profile")
            return
          }
          await refreshProfile()
          setIsEditing(false)
        },
        onError: () => alert("Error saving profile"),
      }
    )
  }

  const avatarSrc = avatarPreview ?? imageQuery.data?.image ?? undefined

  return (
    <div className="min-h-screen bg-surface pb-20">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="flex items-center gap-4 min-w-0">
            <div className="relative group shrink-0">
              <Avatar className="h-20 w-20 rounded-2xl border border-border">
                <AvatarImage src={avatarSrc} className="object-cover" />
                <AvatarFallback className="bg-foreground text-white text-2xl font-semibold uppercase rounded-2xl">
                  {formData.company_name?.charAt(0) || formData.full_name?.charAt(0) || "A"}
                </AvatarFallback>
              </Avatar>
              {isEditing && (
                <label
                  htmlFor="avatar-upload"
                  className="absolute inset-0 bg-foreground/60 rounded-2xl flex items-center justify-center cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Camera className="text-white h-6 w-6" />
                  <input type="file" accept="image/*" onChange={handleAvatarSelect} className="hidden" id="avatar-upload" />
                </label>
              )}
            </div>
            <div className="space-y-1 min-w-0">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Agency profile</p>
              <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-foreground truncate">
                {formData.company_name || formData.full_name || "New agency"}
              </h1>
              <p className="text-sm text-muted-foreground flex items-center gap-1.5 min-w-0">
                <MapPin className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{formData.location || "Location not set"}</span>
              </p>
            </div>
          </div>
          <div className="w-full sm:w-auto sm:shrink-0">
            {!isEditing ? (
              <Button onClick={startEditing} className="h-10 px-4 rounded-lg gap-2 w-full sm:w-auto justify-center">
                <Edit className="h-4 w-4" /> Edit profile
              </Button>
            ) : (
              <div className="flex gap-2 w-full sm:w-auto">
                <Button variant="outline" onClick={() => setIsEditing(false)} className="h-10 px-4 rounded-lg flex-1 sm:flex-none justify-center">
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={updateProfile.isPending} className="h-10 px-4 rounded-lg flex-1 sm:flex-none justify-center">
                  {updateProfile.isPending ? "Saving…" : "Save changes"}
                </Button>
              </div>
            )}
          </div>
        </header>

        <div className="rounded-xl border border-border bg-card">
          <div className="p-6 pb-4">
            <h2 className="text-base font-semibold text-foreground">About agency</h2>
            <p className="text-sm text-muted-foreground mt-0.5">Information visible to freelancers you hire.</p>
          </div>
          <div className="p-6 pt-0 space-y-6">
            <div className="space-y-2">
              <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Agency bio / about</Label>
              <Textarea
                rows={6}
                className="min-h-[140px] resize-none"
                placeholder="Describe your company, what you do, and what you look for in talent…"
                value={formData.bio}
                onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                disabled={!isEditing}
              />
            </div>

            {isEditing && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
                <div className="space-y-2">
                  <Label htmlFor="company_name" className="text-sm font-medium text-foreground">Company name</Label>
                  <Input id="company_name" value={formData.company_name} onChange={(e) => setFormData({ ...formData, company_name: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="full_name" className="text-sm font-medium text-foreground">Point of contact</Label>
                  <Input id="full_name" value={formData.full_name} onChange={(e) => setFormData({ ...formData, full_name: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="location" className="text-sm font-medium text-foreground">Location</Label>
                  <Input id="location" value={formData.location} onChange={(e) => setFormData({ ...formData, location: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-foreground">Company size</Label>
                  <Select value={formData.company_size} onValueChange={(v) => setFormData({ ...formData, company_size: v })}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select size" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1-10">1-10 employees</SelectItem>
                      <SelectItem value="11-50">11-50 employees</SelectItem>
                      <SelectItem value="51-200">51-200 employees</SelectItem>
                      <SelectItem value="200+">200+ employees</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-sm font-medium text-foreground">Phone</Label>
                  <Input id="phone" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="website" className="text-sm font-medium text-foreground">Website</Label>
                  <Input id="website" value={formData.website} onChange={(e) => setFormData({ ...formData, website: e.target.value })} />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd client && npx vitest run src/pages/agency/Profile.test.tsx`
Expected: PASS

- [ ] **Step 5: Wire the route into `App.tsx`**

In `client/src/App.tsx`, add the import:

```tsx
import AgencyProfile from "./pages/agency/Profile"
```

Add the route (next to the other `/agency/*` routes):

```tsx
            <Route
              path="/agency/profile"
              element={
                <RequireAuth>
                  <AgencyProfile />
                </RequireAuth>
              }
            />
```

- [ ] **Step 6: Run the full client test suite**

Run: `cd client && npx vitest run`
Expected: PASS (all existing tests still pass alongside the new ones)

- [ ] **Step 7: Run the client production build**

Run: `cd client && npm run build`
Expected: builds cleanly

- [ ] **Step 8: Commit**

```bash
git add client/src/pages/agency/Profile.tsx client/src/pages/agency/Profile.test.tsx client/src/App.tsx
git commit -m "feat(client): port /agency/profile to the new client"
```
