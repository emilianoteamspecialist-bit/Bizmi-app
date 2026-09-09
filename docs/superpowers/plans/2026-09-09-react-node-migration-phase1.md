# React + Node Migration — Phase 1 (Backend Foundation) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the backend-foundation pieces called for in the migration spec's Phase 1 row — an admin-role middleware and shared error/response conventions — then port `app/actions/jobs.ts`, `app/actions/user.ts`, and `app/actions/proposals.ts` (plus their `lib/avatar-url.ts`, `lib/email.ts`, `lib/notifications.ts` dependencies) from Next.js Server Actions to Express routes in `server/`, with no money/payment code involved.

**Architecture:** Every ported function becomes an Express route mounted behind the `requireAuth` middleware built in Phase 0, using the per-request RLS-scoped Supabase client Phase 0 already attaches to `req.supabase`. Route files mirror their source `app/actions/*.ts` file one-to-one (`routes/jobs.ts` ↔ `jobs.ts`, `routes/user.ts` ↔ `user.ts`, `routes/proposals.ts` ↔ `proposals.ts`) so the port is traceable against the source, even where a function's domain would otherwise suggest a different grouping. A new `lib/http.ts` supplies `HttpError` + `asyncHandler` + a single `errorHandler` mounted last in `app.ts`, giving every route the same JSON error shape. `client/` is not touched in this phase — these routes have no caller yet; that wiring happens per-vertical in later phases.

**Tech Stack:** Same as Phase 0 — Express, TypeScript, `@supabase/supabase-js`, Vitest + Supertest — plus `resend` (already a root-app dependency, added to `server/` for the ported email/notification code).

**Spec:** `docs/superpowers/specs/2026-09-08-nextjs-to-react-node-migration-design.md` (Section 7, Phase 1 row)

## Global Constraints

- Every new route in this plan is mounted behind `requireAuth` (built in Phase 0) — no route added here is public except the pre-existing `/api/me` and `/health`.
- No money/payment code in this phase, per the spec's Phase 1 row ("no money involved"). `submitProposal`'s credit deduction via the pre-existing `place_bid` Postgres RPC is in scope — it's an existing DB-side balance check the current app already relies on, not new payment code.
- Response shape convention: successful reads return `{ <name>: value }` (e.g. `{ credits: 400 }`, `{ profile: {...} }`). The existing discriminated-union mutations (`createJob`, `updateJob`, `submitProposal`, `respondToProposal`) keep their original `{ success, error?, code? }` shape verbatim, always via HTTP 200 — HTTP status codes are reserved for auth/authorization/unexpected-error cases (401 via `requireAuth`, 403 via `requireAdmin`, 500 via the default error handler), never for business-rule outcomes like "insufficient credits."
- `getCurrentUser()`'s "no user" fallback branches from the original Next.js functions are dropped when porting — `requireAuth` already guarantees `req.user` is set before any handler runs, so those branches are unreachable in the new architecture.
- New routers apply `requireAuth` once at the `app.use()` mount point in `app.ts` (e.g. `app.use("/api/jobs", requireAuth, jobsRouter)`), not per-route — every route in `user.ts`/`jobs.ts`/`proposals.ts` needs it, so mounting it once is DRY. This differs from Phase 0's `me.ts`, which applies `requireAuth` per-route; `me.ts` is left as-is, this is the convention going forward.
- `lib/notifications.ts`'s `APP_URL` reuses the existing `CLIENT_ORIGIN` env var (both mean "the deployed client's base URL") instead of introducing a duplicate env var.
- `SUPABASE_SERVICE_ROLE_KEY` usage stays confined to `createServiceClient()` (built in Phase 0) — only `lib/notifications.ts` uses it in this phase, for cross-party lookups (e.g. looking up the *other* party's email address, which the caller's own RLS-scoped client can't see). No route handler uses the service client directly.
- Brand colors/HTML in the ported `lib/email.ts` are copied verbatim from `lib/email.ts` in the root app — no redesign of transactional emails in this phase.

---

## Task 1: Base HTTP error/response conventions (`server/src/lib/http.ts`)

**Files:**
- Create: `server/src/lib/http.ts`
- Test: `server/src/lib/http.test.ts`

**Interfaces:**
- Produces: `HttpError` class (`new HttpError(status: number, message: string, code?: string)`), `asyncHandler(fn: (req, res) => Promise<void>): RequestHandler`, `errorHandler(err, req, res, next)` Express error-handling middleware — all exported from `server/src/lib/http.ts`. Tasks 6–8's routers wrap every handler in `asyncHandler`; Task 9 mounts `errorHandler` last in `app.ts`.

- [ ] **Step 1: Write the failing test**

```typescript
// server/src/lib/http.test.ts
import { describe, it, expect } from "vitest"
import express from "express"
import request from "supertest"
import { HttpError, asyncHandler, errorHandler } from "./http.js"

function testApp() {
  const app = express()

  app.get(
    "/known-error",
    asyncHandler(async () => {
      throw new HttpError(404, "Not found", "not_found")
    })
  )

  app.get(
    "/unknown-error",
    asyncHandler(async () => {
      throw new Error("boom")
    })
  )

  app.get(
    "/ok",
    asyncHandler(async (_req, res) => {
      res.json({ ok: true })
    })
  )

  app.use(errorHandler)
  return app
}

describe("asyncHandler + errorHandler", () => {
  it("passes through successful handlers unaffected", async () => {
    const res = await request(testApp()).get("/ok")
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ ok: true })
  })

  it("maps a thrown HttpError to its status, message, and code", async () => {
    const res = await request(testApp()).get("/known-error")
    expect(res.status).toBe(404)
    expect(res.body).toEqual({ error: "Not found", code: "not_found" })
  })

  it("maps any other thrown error to a generic 500", async () => {
    const res = await request(testApp()).get("/unknown-error")
    expect(res.status).toBe(500)
    expect(res.body).toEqual({ error: "Internal server error" })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx vitest run src/lib/http.test.ts`
Expected: FAIL — `Cannot find module './http.js'`

- [ ] **Step 3: Write the implementation**

```typescript
// server/src/lib/http.ts
import type { Request, Response, NextFunction, RequestHandler } from "express"

export class HttpError extends Error {
  status: number
  code?: string
  constructor(status: number, message: string, code?: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

export function asyncHandler(
  fn: (req: Request, res: Response) => Promise<void>
): RequestHandler {
  return (req, res, next) => {
    fn(req, res).catch(next)
  }
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message, ...(err.code ? { code: err.code } : {}) })
    return
  }
  console.error("Unhandled error:", err)
  res.status(500).json({ error: "Internal server error" })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npx vitest run src/lib/http.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/src/lib/http.ts server/src/lib/http.test.ts
git commit -m "Add shared HttpError/asyncHandler/errorHandler conventions"
```

---

## Task 2: Admin-role middleware (`server/src/middleware/admin.ts`)

**Files:**
- Create: `server/src/middleware/admin.ts`
- Test: `server/src/middleware/admin.test.ts`

**Interfaces:**
- Consumes: `req.user`/`req.supabase` (set by Phase 0's `requireAuth`).
- Produces: `requireAdmin(req, res, next)` Express middleware, exported from `server/src/middleware/admin.ts`. Mount order is always `requireAuth, requireAdmin` — `requireAdmin` assumes `req.user`/`req.supabase` are already set. No route in this plan uses it yet (no admin-scoped function exists in `jobs.ts`/`user.ts`/`proposals.ts`); a later phase (Admin/disputes portal) mounts it.

- [ ] **Step 1: Write the failing test**

```typescript
// server/src/middleware/admin.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest"
import type { Request, Response } from "express"

function mockRes() {
  const res: Partial<Response> = {}
  res.status = vi.fn().mockReturnValue(res)
  res.json = vi.fn().mockReturnValue(res)
  return res as Response
}

function mockReq(user: { id: string } | undefined, maybeSingleResult: { data: any; error: any }) {
  const maybeSingle = vi.fn().mockResolvedValue(maybeSingleResult)
  const eq = vi.fn(() => ({ maybeSingle }))
  const select = vi.fn(() => ({ eq }))
  const supabase = { from: vi.fn(() => ({ select })) }
  return { req: { user, supabase } as unknown as Request, supabase }
}

describe("requireAdmin", () => {
  it("returns 401 when req.user is missing", async () => {
    const { requireAdmin } = await import("./admin.js")
    const { req } = mockReq(undefined, { data: null, error: null })
    const res = mockRes()
    const next = vi.fn()

    await requireAdmin(req, res, next)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(next).not.toHaveBeenCalled()
  })

  it("returns 403 when neither role nor account_type is admin", async () => {
    const { requireAdmin } = await import("./admin.js")
    const { req } = mockReq(
      { id: "user-1" },
      { data: { role: "freelancer", account_type: "freelancer" }, error: null }
    )
    const res = mockRes()
    const next = vi.fn()

    await requireAdmin(req, res, next)

    expect(res.status).toHaveBeenCalledWith(403)
    expect(next).not.toHaveBeenCalled()
  })

  it("calls next() when role is admin", async () => {
    const { requireAdmin } = await import("./admin.js")
    const { req } = mockReq({ id: "user-1" }, { data: { role: "admin", account_type: "freelancer" }, error: null })
    const res = mockRes()
    const next = vi.fn()

    await requireAdmin(req, res, next)

    expect(next).toHaveBeenCalledOnce()
    expect(res.status).not.toHaveBeenCalled()
  })

  it("calls next() when account_type is admin (role isn't)", async () => {
    const { requireAdmin } = await import("./admin.js")
    const { req } = mockReq({ id: "user-1" }, { data: { role: "user", account_type: "admin" }, error: null })
    const res = mockRes()
    const next = vi.fn()

    await requireAdmin(req, res, next)

    expect(next).toHaveBeenCalledOnce()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx vitest run src/middleware/admin.test.ts`
Expected: FAIL — `Cannot find module './admin.js'`

- [ ] **Step 3: Write the implementation**

```typescript
// server/src/middleware/admin.ts
import type { Request, Response, NextFunction } from "express"

// Accepts either `role` or `account_type` equal to "admin" — the codebase
// uses these two fields inconsistently (see middleware.ts in the Next.js app),
// so admin checks anywhere must accept either rather than risk locking out a
// legitimate admin.
export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user || !req.supabase) {
    res.status(401).json({ error: "Unauthorized" })
    return
  }

  const { data: profile, error } = await req.supabase
    .from("profiles")
    .select("role, account_type")
    .eq("id", req.user.id)
    .maybeSingle()

  const isAdmin = profile?.role === "admin" || profile?.account_type === "admin"

  if (error || !isAdmin) {
    res.status(403).json({ error: "Forbidden" })
    return
  }

  next()
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npx vitest run src/middleware/admin.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/src/middleware/admin.ts server/src/middleware/admin.test.ts
git commit -m "Add admin-role middleware (accepts role or account_type)"
```

---

## Task 3: Port avatar resolution helper (`server/src/lib/avatar.ts`)

**Files:**
- Create: `server/src/lib/avatar.ts`
- Test: `server/src/lib/avatar.test.ts`

**Interfaces:**
- Consumes: `SUPABASE_URL` env var (already required by `server/src/lib/supabase.ts` since Phase 0).
- Produces: `getAvatarUrl(path)`, `resolveAvatar(row)` from `server/src/lib/avatar.ts`. Task 6's `routes/user.ts` imports `resolveAvatar`.

- [ ] **Step 1: Write the failing test**

```typescript
// server/src/lib/avatar.test.ts
import { describe, it, expect, beforeEach } from "vitest"
import { getAvatarUrl, resolveAvatar } from "./avatar.js"

beforeEach(() => {
  process.env.SUPABASE_URL = "https://example.supabase.co"
})

describe("getAvatarUrl", () => {
  it("builds a public storage URL for a given path", () => {
    expect(getAvatarUrl("user-1/logo.png")).toBe(
      "https://example.supabase.co/storage/v1/object/public/avatars/user-1/logo.png"
    )
  })

  it("returns an empty string for a missing path", () => {
    expect(getAvatarUrl(null)).toBe("")
    expect(getAvatarUrl(undefined)).toBe("")
  })
})

describe("resolveAvatar", () => {
  it("prefers logo_path over logo_data", () => {
    expect(resolveAvatar({ logo_path: "a/b.png", logo_data: "data:image/png;base64,xyz" })).toBe(
      "https://example.supabase.co/storage/v1/object/public/avatars/a/b.png"
    )
  })

  it("falls back to image_data when no path is present", () => {
    expect(resolveAvatar({ image_data: "data:image/png;base64,xyz" })).toBe("data:image/png;base64,xyz")
  })

  it("returns an empty string for a null row", () => {
    expect(resolveAvatar(null)).toBe("")
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx vitest run src/lib/avatar.test.ts`
Expected: FAIL — `Cannot find module './avatar.js'`

- [ ] **Step 3: Write the implementation**

```typescript
// server/src/lib/avatar.ts
const BUCKET = "avatars"

function supabaseBaseUrl(): string {
  return process.env.SUPABASE_URL || ""
}

export function getAvatarUrl(path: string | null | undefined): string {
  if (!path) return ""
  const base = supabaseBaseUrl()
  if (!base) return ""
  return `${base}/storage/v1/object/public/${BUCKET}/${path}`
}

export function resolveAvatar(
  row:
    | {
        logo_path?: string | null
        image_path?: string | null
        logo_data?: string | null
        image_data?: string | null
      }
    | null
    | undefined
): string {
  if (!row) return ""
  const path = row.logo_path || row.image_path
  if (path) return getAvatarUrl(path)
  return row.logo_data || row.image_data || ""
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npx vitest run src/lib/avatar.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/src/lib/avatar.ts server/src/lib/avatar.test.ts
git commit -m "Port avatar URL resolution helper to server"
```

---

## Task 4: Port transactional email sender (`server/src/lib/email.ts`)

**Files:**
- Create: `server/src/lib/email.ts`
- Test: `server/src/lib/email.test.ts`
- Modify: `server/package.json` (add `resend` dependency)
- Modify: `server/.env.example` (add `RESEND_API_KEY`, `EMAIL_FROM`)

**Interfaces:**
- Consumes: `RESEND_API_KEY`, `EMAIL_FROM` env vars.
- Produces: `sendEmail({ to, subject, html, text?, replyTo? })` and `emailLayout({ heading, body, cta? })` from `server/src/lib/email.ts`. Task 5's `lib/notifications.ts` imports both.

- [ ] **Step 1: Add the `resend` dependency**

Edit `server/package.json` — add to `dependencies` (matching the version already used at the repo root, per `package.json`):

```json
    "resend": "^6.16.0",
```

(Keep the existing `dependencies` alphabetized: `@supabase/supabase-js`, `cors`, `dotenv`, `express`, `resend`.)

- [ ] **Step 2: Add env vars to `server/.env.example`**

```
RESEND_API_KEY=
EMAIL_FROM=
```

- [ ] **Step 3: Install the new dependency**

Run: `cd server && npm install`
Expected: installs cleanly, `resend` added to `server/package-lock.json`

- [ ] **Step 4: Write the failing test**

```typescript
// server/src/lib/email.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest"

const sendMock = vi.fn()
vi.mock("resend", () => ({
  Resend: vi.fn().mockImplementation(() => ({ emails: { send: sendMock } })),
}))

beforeEach(() => {
  vi.resetModules()
  sendMock.mockReset()
  delete process.env.RESEND_API_KEY
  delete process.env.EMAIL_FROM
})

describe("sendEmail", () => {
  it("skips sending and returns { skipped: true } when RESEND_API_KEY is unset", async () => {
    const { sendEmail } = await import("./email.js")
    const result = await sendEmail({ to: "a@b.com", subject: "Hi", html: "<p>hi</p>" })

    expect(result).toEqual({ skipped: true })
    expect(sendMock).not.toHaveBeenCalled()
  })

  it("sends via Resend with the configured from address when the key is set", async () => {
    process.env.RESEND_API_KEY = "re_test_key"
    process.env.EMAIL_FROM = "Bizimi Team <team@bizimii.com>"
    sendMock.mockResolvedValue({ data: { id: "email-1" }, error: null })

    const { sendEmail } = await import("./email.js")
    const result = await sendEmail({ to: "a@b.com", subject: "Hi", html: "<p>hi</p>" })

    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "Bizimi Team <team@bizimii.com>",
        to: "a@b.com",
        subject: "Hi",
        html: "<p>hi</p>",
      })
    )
    expect(result).toEqual({ id: "email-1" })
  })
})

describe("emailLayout", () => {
  it("HTML-escapes the heading and embeds the body and CTA", async () => {
    process.env.RESEND_API_KEY = "re_test_key"
    const { emailLayout } = await import("./email.js")
    const html = emailLayout({
      heading: "You've got <mail>",
      body: "Some <strong>body</strong> html",
      cta: { label: "Open", url: "https://example.com" },
    })

    expect(html).toContain("You&#39;ve got &lt;mail&gt;")
    expect(html).toContain("Some <strong>body</strong> html")
    expect(html).toContain('href="https://example.com"')
    expect(html).toContain(">Open<")
  })
})
```

- [ ] **Step 5: Run test to verify it fails**

Run: `cd server && npx vitest run src/lib/email.test.ts`
Expected: FAIL — `Cannot find module './email.js'`

- [ ] **Step 6: Write the implementation**

```typescript
// server/src/lib/email.ts
import { Resend } from "resend"

// Resend wrapper — ported verbatim from lib/email.ts in the Next.js app.
// Every send is fail-soft: a missing key or a Resend error is logged and
// swallowed so a notification can never break the action that triggered it.

const RESEND_API_KEY = process.env.RESEND_API_KEY
const FROM = process.env.EMAIL_FROM || "Bizimi Team <onboarding@resend.dev>"

const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null

type SendArgs = {
  to: string | string[]
  subject: string
  html: string
  text?: string
  replyTo?: string
}

export async function sendEmail({ to, subject, html, text, replyTo }: SendArgs) {
  if (!resend) {
    console.warn(`[email] RESEND_API_KEY not set — skipped: "${subject}"`)
    return { skipped: true as const }
  }
  const recipients = Array.isArray(to) ? to.filter(Boolean) : to
  if (!recipients || (Array.isArray(recipients) && recipients.length === 0)) {
    return { skipped: true as const }
  }
  try {
    const { data, error } = await resend.emails.send({
      from: FROM,
      to: recipients,
      subject,
      html,
      text: text ?? htmlToText(html),
      replyTo,
    })
    if (error) {
      console.error(`[email] send failed ("${subject}"):`, error)
      return { error }
    }
    return { id: data?.id }
  } catch (e) {
    console.error(`[email] send threw ("${subject}"):`, e)
    return { error: e }
  }
}

const escHtml = (s: unknown) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")

function htmlToText(html: string) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<\/(p|div|tr|h1|h2|td)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<a [^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, "$2 ($1)")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+\n/g, "\n")
    .trim()
}

const BRAND = {
  cream: "#fcf5ee",
  card: "#ffffff",
  border: "#efe7dd",
  hair: "#f1eae2",
  ink: "#1b1020",
  body: "#5b5160",
  muted: "#9a8f99",
  aubergine: "#1b0e2f",
  gold: "#fbbd23",
  orange: "#f97316",
}
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"

const LOGO = `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0">
    <tr>
      <td width="40" height="40" align="center" valign="middle" bgcolor="${BRAND.aubergine}" style="border-radius:11px;font-family:Georgia,'Times New Roman',serif;font-size:23px;font-weight:700;color:${BRAND.gold};line-height:40px;">B</td>
      <td width="10" style="font-size:0;line-height:0;">&nbsp;</td>
      <td valign="middle" style="font-family:${FONT};font-size:19px;font-weight:800;letter-spacing:-0.02em;color:${BRAND.aubergine};">Bizimi</td>
    </tr>
  </table>`

export function emailLayout(opts: { heading: string; body: string; cta?: { label: string; url: string } }) {
  const { heading, body, cta } = opts
  const url = cta ? escHtml(cta.url) : ""
  const label = cta ? escHtml(cta.label) : ""

  const button = cta
    ? `
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 4px;">
                <tr>
                  <td bgcolor="${BRAND.orange}" style="border-radius:9999px;box-shadow:0 2px 6px rgba(249,115,22,0.30);">
                    <!--[if mso]>
                    <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${url}" style="height:44px;v-text-anchor:middle;width:220px;" arcsize="50%" fillcolor="${BRAND.orange}" stroke="f">
                      <w:anchorlock/>
                      <center style="color:#ffffff;font-family:${FONT};font-size:15px;font-weight:bold;">${label}</center>
                    </v:roundrect>
                    <![endif]-->
                    <!--[if !mso]><!-->
                    <a href="${url}" style="display:inline-block;background:${BRAND.orange};color:#ffffff;text-decoration:none;font-family:${FONT};font-weight:700;font-size:15px;line-height:44px;padding:0 30px;border-radius:9999px;">${label}</a>
                    <!--<![endif]-->
                  </td>
                </tr>
              </table>`
    : ""

  return `<!doctype html>
<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <!--[if mso]><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml><![endif]-->
  <title>Bizimi</title>
</head>
<body style="margin:0;padding:0;background:${BRAND.cream};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${BRAND.cream};">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="width:560px;max-width:560px;background:${BRAND.card};border:1px solid ${BRAND.border};border-radius:18px;overflow:hidden;">
          <tr><td style="height:4px;line-height:4px;font-size:0;background:${BRAND.orange};">&nbsp;</td></tr>
          <tr>
            <td style="padding:26px 32px 22px;border-bottom:1px solid ${BRAND.hair};">${LOGO}</td>
          </tr>
          <tr>
            <td style="padding:34px 32px 36px;font-family:${FONT};">
              <h1 style="margin:0 0 14px;font-size:22px;line-height:1.3;color:${BRAND.ink};font-weight:800;letter-spacing:-0.01em;">${escHtml(heading)}</h1>
              <p style="margin:0 0 8px;font-size:15px;line-height:1.65;color:${BRAND.body};">${body}</p>
              ${button}
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px;border-top:1px solid ${BRAND.hair};background:${BRAND.cream};font-family:${FONT};">
              <p style="margin:0 0 4px;font-size:13px;font-weight:700;color:${BRAND.aubergine};">Bizimi</p>
              <p style="margin:0;font-size:12px;line-height:1.6;color:${BRAND.muted};">Hire vetted Nigerian talent, with payments held safely in escrow.<br>You're receiving this because you have a Bizimi account.</p>
            </td>
          </tr>
        </table>
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="width:560px;max-width:560px;">
          <tr><td align="center" style="padding:16px 8px 0;font-family:${FONT};font-size:11px;color:${BRAND.muted};">© Bizimi · Lagos, Nigeria</td></tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}
```

- [ ] **Step 7: Run test to verify it passes**

Run: `cd server && npx vitest run src/lib/email.test.ts`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add server/package.json server/package-lock.json server/.env.example server/src/lib/email.ts server/src/lib/email.test.ts
git commit -m "Port transactional email sender (Resend) to server"
```

---

## Task 5: Port notification senders (`server/src/lib/notifications.ts`)

**Files:**
- Create: `server/src/lib/notifications.ts`
- Test: `server/src/lib/notifications.test.ts`

**Interfaces:**
- Consumes: `createServiceClient` (Phase 0, `server/src/lib/supabase.ts`), `sendEmail`/`emailLayout` (Task 4), `CLIENT_ORIGIN` env var.
- Produces: `notifyAgencyNewProposal(jobId, freelancerName?)`, `notifyFreelancerProposalDecision(proposalId, action)`, `notifyFreelancerPayout(freelancerId, jobId, amountNaira)` from `server/src/lib/notifications.ts`. Task 7's `routes/proposals.ts` imports the first two; `notifyFreelancerPayout` is ported now (same file, same dependencies) but has no caller until the Phase 4 escrow/payouts work.

- [ ] **Step 1: Write the failing test**

```typescript
// server/src/lib/notifications.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest"

const maybeSingleMock = vi.fn()
const fromMock = vi.fn(() => ({
  select: vi.fn(() => ({
    eq: vi.fn(() => ({
      maybeSingle: maybeSingleMock,
    })),
  })),
}))
vi.mock("./supabase.js", () => ({
  createServiceClient: vi.fn(() => ({ from: fromMock })),
}))

const sendEmailMock = vi.fn()
vi.mock("./email.js", () => ({
  sendEmail: sendEmailMock,
  emailLayout: vi.fn((opts: { heading: string }) => `<html>${opts.heading}</html>`),
}))

beforeEach(() => {
  vi.clearAllMocks()
  process.env.CLIENT_ORIGIN = "http://localhost:5173"
})

describe("notifyAgencyNewProposal", () => {
  it("emails the agency that owns the job", async () => {
    maybeSingleMock
      .mockResolvedValueOnce({ data: { title: "Build a website", agency_id: "agency-1" }, error: null })
      .mockResolvedValueOnce({ data: { email: "agency@example.com" }, error: null })

    const { notifyAgencyNewProposal } = await import("./notifications.js")
    await notifyAgencyNewProposal("job-1", "Jane Doe")

    expect(sendEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({ to: "agency@example.com", subject: expect.stringContaining("Build a website") })
    )
  })

  it("does nothing when the job has no agency_id", async () => {
    maybeSingleMock.mockResolvedValueOnce({ data: null, error: null })

    const { notifyAgencyNewProposal } = await import("./notifications.js")
    await notifyAgencyNewProposal("job-missing", "Jane Doe")

    expect(sendEmailMock).not.toHaveBeenCalled()
  })

  it("swallows errors instead of throwing (fail-soft)", async () => {
    maybeSingleMock.mockRejectedValueOnce(new Error("db down"))

    const { notifyAgencyNewProposal } = await import("./notifications.js")
    await expect(notifyAgencyNewProposal("job-1", "Jane Doe")).resolves.toBeUndefined()
  })
})

describe("notifyFreelancerProposalDecision", () => {
  it("emails the freelancer who submitted the proposal", async () => {
    maybeSingleMock
      .mockResolvedValueOnce({
        data: { freelancer_id: "freelancer-1", jobs: { title: "Build a website" } },
        error: null,
      })
      .mockResolvedValueOnce({ data: { email: "freelancer@example.com" }, error: null })

    const { notifyFreelancerProposalDecision } = await import("./notifications.js")
    await notifyFreelancerProposalDecision("proposal-1", "accept")

    expect(sendEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({ to: "freelancer@example.com", subject: expect.stringContaining("accepted") })
    )
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx vitest run src/lib/notifications.test.ts`
Expected: FAIL — `Cannot find module './notifications.js'`

- [ ] **Step 3: Write the implementation**

```typescript
// server/src/lib/notifications.ts
import { createServiceClient } from "./supabase.js"
import { sendEmail, emailLayout } from "./email.js"

// Transactional email senders, one per event. Each resolves its own recipient
// + context from the DB (service-role, so RLS never blocks a cross-party
// lookup) and is fully fail-soft: any error is logged and swallowed so the
// triggering action (placing a bid, a payout, etc.) is never affected.

const APP_URL = (process.env.CLIENT_ORIGIN || "https://bizimii.com").replace(/\/$/, "")

const naira = (n: number) => `₦${Number(n || 0).toLocaleString()}`

const esc = (s: unknown) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")

/** A freelancer submitted a proposal → tell the agency that owns the job. */
export async function notifyAgencyNewProposal(jobId: string, freelancerName?: string | null) {
  try {
    const service = createServiceClient()
    const { data: job } = await service.from("jobs").select("title, agency_id").eq("id", jobId).maybeSingle()
    if (!job?.agency_id) return

    const { data: agency } = await service.from("profiles").select("email").eq("id", job.agency_id).maybeSingle()
    if (!agency?.email) return

    await sendEmail({
      to: agency.email,
      subject: `New proposal on "${job.title}"`,
      html: emailLayout({
        heading: "You have a new proposal",
        body: `${esc(freelancerName || "A freelancer")} just submitted a proposal on your job <strong>${esc(job.title)}</strong>. Review it and respond from your dashboard.`,
        cta: { label: "Review proposals", url: `${APP_URL}/agency/dashboard` },
      }),
    })
  } catch (e) {
    console.error("[notify] notifyAgencyNewProposal failed:", e)
  }
}

/** Agency accepted/rejected a proposal → tell the freelancer who submitted it. */
export async function notifyFreelancerProposalDecision(proposalId: string, action: "accept" | "reject") {
  try {
    const service = createServiceClient()
    const { data: proposal } = await service
      .from("proposals")
      .select("freelancer_id, jobs(title)")
      .eq("id", proposalId)
      .maybeSingle()
    if (!proposal?.freelancer_id) return

    const { data: freelancer } = await service
      .from("profiles")
      .select("email")
      .eq("id", proposal.freelancer_id)
      .maybeSingle()
    if (!freelancer?.email) return

    const jobTitle = (proposal as any).jobs?.title || "a job"
    const accepted = action === "accept"

    await sendEmail({
      to: freelancer.email,
      subject: accepted ? `Your proposal was accepted 🎉` : `Update on your proposal`,
      html: emailLayout({
        heading: accepted ? "Your proposal was accepted" : "Your proposal wasn't selected",
        body: accepted
          ? `Great news — the agency accepted your proposal on <strong>${esc(jobTitle)}</strong>. Once they fund the job into escrow, you can verify it and start work.`
          : `The agency has moved forward with another freelancer on <strong>${esc(jobTitle)}</strong>. Keep applying — new jobs are posted every day.`,
        cta: { label: "Open dashboard", url: `${APP_URL}/freelancer/proposals` },
      }),
    })
  } catch (e) {
    console.error("[notify] notifyFreelancerProposalDecision failed:", e)
  }
}

/** A payout was initiated to a freelancer → send them a confirmation. */
export async function notifyFreelancerPayout(freelancerId: string, jobId: string, amountNaira: number) {
  try {
    const service = createServiceClient()
    const [{ data: freelancer }, { data: job }] = await Promise.all([
      service.from("profiles").select("email").eq("id", freelancerId).maybeSingle(),
      service.from("jobs").select("title").eq("id", jobId).maybeSingle(),
    ])
    if (!freelancer?.email) return

    await sendEmail({
      to: freelancer.email,
      subject: `Your payout of ${naira(amountNaira)} is on its way`,
      html: emailLayout({
        heading: "Payout initiated",
        body: `Your payout of <strong>${naira(amountNaira)}</strong> for <strong>${esc(job?.title || "your job")}</strong> has been initiated to your saved bank account. It usually arrives within 24–48 hours.`,
        cta: { label: "View funded jobs", url: `${APP_URL}/freelancer/funded-jobs` },
      }),
    })
  } catch (e) {
    console.error("[notify] notifyFreelancerPayout failed:", e)
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npx vitest run src/lib/notifications.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/src/lib/notifications.ts server/src/lib/notifications.test.ts
git commit -m "Port proposal/payout notification emails to server"
```

---

## Task 6: Port `user.ts` → `server/src/routes/user.ts`

**Files:**
- Create: `server/src/routes/user.ts`
- Test: `server/src/routes/user.test.ts`

**Interfaces:**
- Consumes: `asyncHandler` (Task 1), `resolveAvatar` (Task 3), `req.user`/`req.supabase` (Phase 0).
- Produces: `userRouter` (default export), mounted at `/api/user` behind `requireAuth` in Task 9's `app.ts`.
- Test approach: router-only tests build a minimal Express app that injects `req.user`/`req.supabase` directly via a fake middleware (bypassing real `requireAuth`/Supabase), since these tests are about the route logic, not auth — Task 9 separately verifies the full app rejects unauthenticated requests.

- [ ] **Step 1: Write the failing tests**

```typescript
// server/src/routes/user.test.ts
import { describe, it, expect, vi } from "vitest"
import express from "express"
import request from "supertest"
import userRouter from "./user.js"

function appWith(user: { id: string }, supabase: any) {
  const app = express()
  app.use(express.json())
  app.use((req: any, _res, next) => {
    req.user = user
    req.supabase = supabase
    next()
  })
  app.use("/", userRouter)
  return app
}

describe("GET /credits", () => {
  it("sums completed purchase credits for the authenticated user", async () => {
    const supabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn().mockResolvedValue({ data: [{ credits_amount: 10 }, { credits_amount: 5 }], error: null }),
          })),
        })),
      })),
    }
    const res = await request(appWith({ id: "user-1" }, supabase)).get("/credits")
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ credits: 15 })
  })

  it("looks up purchase_credits for the userId query param, not the caller, when provided", async () => {
    const eqUserId = vi.fn().mockResolvedValue({ data: [], error: null })
    const eqStatus = vi.fn(() => ({ eq: eqUserId }))
    const supabase = { from: vi.fn(() => ({ select: vi.fn(() => ({ eq: eqStatus })) })) }

    await request(appWith({ id: "user-1" }, supabase)).get("/credits?userId=user-2")

    expect(supabase.from).toHaveBeenCalledWith("purchase_credits")
  })
})

describe("GET /profile", () => {
  it("returns the caller's profile", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: { id: "user-1", full_name: "Jane" }, error: null })
    const supabase = { from: vi.fn(() => ({ select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle })) })) })) }

    const res = await request(appWith({ id: "user-1" }, supabase)).get("/profile")

    expect(res.body).toEqual({ profile: { id: "user-1", full_name: "Jane" } })
  })
})

describe("GET /balance", () => {
  it("sums verified, unpaid Funded_jobs101 rows", async () => {
    const supabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn().mockResolvedValue({
            data: [
              { amount: 5000, status: "verified", payout_successful: false },
              { amount: 3000, status: "verified", payout_successful: true },
              { amount: 1000, status: "pending", payout_successful: false },
            ],
            error: null,
          }),
        })),
      })),
    }
    const res = await request(appWith({ id: "user-1" }, supabase)).get("/balance")
    expect(res.body).toEqual({ balance: 5000 })
  })
})

describe("GET /nin-verified", () => {
  it("returns true when a verified freelancer_verification row exists", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: { status: "verified" }, error: null })
    const supabase = {
      from: vi.fn(() => ({ select: vi.fn(() => ({ eq: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle })) })) })) })),
    }
    const res = await request(appWith({ id: "user-1" }, supabase)).get("/nin-verified")
    expect(res.body).toEqual({ verified: true })
  })
})

describe("GET /dashboard", () => {
  it("uses the get_freelancer_dashboard RPC when it succeeds", async () => {
    const supabase = {
      rpc: vi.fn().mockResolvedValue({
        data: { profile: { id: "user-1" }, credits: 100, balance: 5000, is_verified: true },
        error: null,
      }),
    }
    const res = await request(appWith({ id: "user-1" }, supabase)).get("/dashboard")
    expect(res.body).toEqual({ profile: { id: "user-1" }, credits: 100, balance: 5000, isVerified: true })
  })

  it("falls back to parallel queries when the RPC errors", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: { id: "user-1" }, error: null })
    const eqChain = vi.fn().mockResolvedValue({ data: [], error: null })
    const supabase = {
      rpc: vi.fn().mockResolvedValue({ data: null, error: { message: "not deployed" } }),
      from: vi.fn(() => ({
        select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle, eq: eqChain })) })),
      })),
    }
    const res = await request(appWith({ id: "user-1" }, supabase)).get("/dashboard")
    expect(res.status).toBe(200)
    expect(res.body.profile).toEqual({ id: "user-1" })
  })
})

describe("POST /freelancer-logos", () => {
  it("returns a map of freelancer_id to resolved avatar", async () => {
    process.env.SUPABASE_URL = "https://example.supabase.co"
    const inMock = vi.fn().mockResolvedValue({
      data: [{ freelancer_id: "f1", logo_path: "f1/logo.png", logo_data: null }],
      error: null,
    })
    const supabase = { from: vi.fn(() => ({ select: vi.fn(() => ({ in: inMock })) })) }

    const res = await request(appWith({ id: "user-1" }, supabase))
      .post("/freelancer-logos")
      .send({ freelancerIds: ["f1"] })

    expect(res.body).toEqual({
      logos: { f1: "https://example.supabase.co/storage/v1/object/public/avatars/f1/logo.png" },
    })
  })

  it("returns an empty map without querying when freelancerIds is empty", async () => {
    const supabase = { from: vi.fn() }
    const res = await request(appWith({ id: "user-1" }, supabase))
      .post("/freelancer-logos")
      .send({ freelancerIds: [] })

    expect(res.body).toEqual({ logos: {} })
    expect(supabase.from).not.toHaveBeenCalled()
  })
})

describe("GET /agency-image", () => {
  it("returns the resolved agency image for the caller", async () => {
    process.env.SUPABASE_URL = "https://example.supabase.co"
    const maybeSingle = vi.fn().mockResolvedValue({ data: { image_path: "a1/logo.png" }, error: null })
    const supabase = { from: vi.fn(() => ({ select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle })) })) })) }

    const res = await request(appWith({ id: "agency-1" }, supabase)).get("/agency-image")

    expect(res.body).toEqual({
      image: "https://example.supabase.co/storage/v1/object/public/avatars/a1/logo.png",
    })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd server && npx vitest run src/routes/user.test.ts`
Expected: FAIL — `Cannot find module './user.js'`

- [ ] **Step 3: Write the implementation**

```typescript
// server/src/routes/user.ts
import { Router } from "express"
import type { SupabaseClient } from "@supabase/supabase-js"
import { asyncHandler } from "../lib/http.js"
import { resolveAvatar } from "../lib/avatar.js"

const userRouter = Router()

function targetUserId(req: any): string {
  return (req.query.userId as string) || req.user!.id
}

async function fetchCredits(supabase: SupabaseClient, userId: string): Promise<number> {
  const { data, error } = await supabase
    .from("purchase_credits")
    .select("credits_amount")
    .eq("freelancer_id", userId)
    .eq("status", "completed")

  if (error) {
    console.error("Error fetching credits:", error)
    return 0
  }

  const totalCredits = data?.reduce((sum: number, purchase: any) => sum + (purchase.credits_amount || 0), 0) || 0
  return Math.max(0, totalCredits)
}

async function fetchProfile(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle()
  if (error) {
    console.error("Error fetching profile:", error)
    return null
  }
  return data
}

async function fetchBalance(supabase: SupabaseClient, userId: string): Promise<number> {
  const { data, error } = await supabase
    .from("Funded_jobs101")
    .select("amount, status, payout_successful")
    .eq("freelancer_id", userId)

  if (error) {
    console.error("Error fetching balance:", error)
    return 0
  }

  return (
    data
      ?.filter((job: any) => job.status === "verified" && !job.payout_successful)
      .reduce((sum: number, job: any) => sum + Number(job.amount), 0) || 0
  )
}

async function fetchNinVerified(supabase: SupabaseClient, userId: string): Promise<boolean> {
  const { data } = await supabase
    .from("freelancer_verification")
    .select("status")
    .eq("freelancer_id", userId)
    .eq("status", "verified")
    .maybeSingle()

  return !!data
}

userRouter.get(
  "/credits",
  asyncHandler(async (req, res) => {
    const credits = await fetchCredits(req.supabase!, targetUserId(req))
    res.json({ credits })
  })
)

userRouter.get(
  "/profile",
  asyncHandler(async (req, res) => {
    const profile = await fetchProfile(req.supabase!, targetUserId(req))
    res.json({ profile })
  })
)

userRouter.get(
  "/balance",
  asyncHandler(async (req, res) => {
    const balance = await fetchBalance(req.supabase!, targetUserId(req))
    res.json({ balance })
  })
)

userRouter.get(
  "/nin-verified",
  asyncHandler(async (req, res) => {
    const verified = await fetchNinVerified(req.supabase!, targetUserId(req))
    res.json({ verified })
  })
)

userRouter.get(
  "/dashboard",
  asyncHandler(async (req, res) => {
    const userId = req.user!.id
    const supabase = req.supabase!

    const { data, error } = await supabase.rpc("get_freelancer_dashboard")
    if (!error && data) {
      const d = data as { profile?: any; credits?: number; balance?: number; is_verified?: boolean }
      res.json({
        profile: d.profile ?? null,
        credits: d.credits ?? 0,
        balance: Number(d.balance ?? 0),
        isVerified: !!d.is_verified,
      })
      return
    }

    const [profile, credits, balance, isVerified] = await Promise.all([
      fetchProfile(supabase, userId),
      fetchCredits(supabase, userId),
      fetchBalance(supabase, userId),
      fetchNinVerified(supabase, userId),
    ])

    res.json({ profile, credits, balance, isVerified })
  })
)

userRouter.post(
  "/freelancer-logos",
  asyncHandler(async (req, res) => {
    const freelancerIds: string[] = Array.isArray(req.body?.freelancerIds) ? req.body.freelancerIds : []
    if (freelancerIds.length === 0) {
      res.json({ logos: {} })
      return
    }

    const { data, error } = await req.supabase!
      .from("freelancer_logos")
      .select("freelancer_id, logo_path, logo_data")
      .in("freelancer_id", freelancerIds)

    if (error) {
      console.error("Error fetching freelancer logos:", error)
      res.json({ logos: {} })
      return
    }

    const logos: Record<string, string> = {}
    for (const item of data || []) logos[item.freelancer_id] = resolveAvatar(item)
    res.json({ logos })
  })
)

userRouter.get(
  "/agency-image",
  asyncHandler(async (req, res) => {
    const { data, error } = await req.supabase!
      .from("agency_image")
      .select("image_path, image_data")
      .eq("agency_id", req.user!.id)
      .maybeSingle()

    if (error || !data) {
      res.json({ image: null })
      return
    }

    res.json({ image: resolveAvatar(data) })
  })
)

export default userRouter
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd server && npx vitest run src/routes/user.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/src/routes/user.ts server/src/routes/user.test.ts
git commit -m "Port app/actions/user.ts to server/src/routes/user.ts"
```

---

## Task 7: Port `proposals.ts` (+ `getFreelancerProposals`) → `server/src/routes/proposals.ts`

**Files:**
- Create: `server/src/routes/proposals.ts`
- Test: `server/src/routes/proposals.test.ts`

**Interfaces:**
- Consumes: `asyncHandler` (Task 1), `notifyAgencyNewProposal`/`notifyFreelancerProposalDecision` (Task 5).
- Produces: `proposalsRouter` (default export), mounted at `/api/proposals` behind `requireAuth` in Task 9. Includes `getFreelancerProposals` (originally in `app/actions/jobs.ts`) as `GET /mine`, grouped here by resource per this plan's Global Constraints note on that function.

- [ ] **Step 1: Write the failing tests**

```typescript
// server/src/routes/proposals.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest"
import express from "express"
import request from "supertest"

const notifyAgencyNewProposalMock = vi.fn()
const notifyFreelancerProposalDecisionMock = vi.fn()
vi.mock("../lib/notifications.js", () => ({
  notifyAgencyNewProposal: notifyAgencyNewProposalMock,
  notifyFreelancerProposalDecision: notifyFreelancerProposalDecisionMock,
}))

import proposalsRouter from "./proposals.js"

function appWith(user: { id: string }, supabase: any) {
  const app = express()
  app.use(express.json())
  app.use((req: any, _res, next) => {
    req.user = user
    req.supabase = supabase
    next()
  })
  app.use("/", proposalsRouter)
  return app
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("POST /:proposalId/respond", () => {
  it("accepts a proposal owned by the calling agency and notifies the freelancer", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: { id: "p1", jobs: { agency_id: "agency-1" } }, error: null })
    const updateEq = vi.fn().mockResolvedValue({ error: null })
    const supabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle })) })),
        update: vi.fn(() => ({ eq: updateEq })),
      })),
    }

    const res = await request(appWith({ id: "agency-1" }, supabase)).post("/p1/respond").send({ action: "accept" })

    expect(res.body).toEqual({ success: true })
    expect(notifyFreelancerProposalDecisionMock).toHaveBeenCalledWith("p1", "accept")
  })

  it("returns success:false Forbidden when the proposal's job belongs to a different agency", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: { id: "p1", jobs: { agency_id: "agency-other" } }, error: null })
    const supabase = { from: vi.fn(() => ({ select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle })) })) })) }

    const res = await request(appWith({ id: "agency-1" }, supabase)).post("/p1/respond").send({ action: "accept" })

    expect(res.body).toEqual({ success: false, error: "Forbidden" })
  })
})

describe("POST /jobs/:jobId", () => {
  it("rejects a non-positive budget without calling the RPC", async () => {
    const supabase = { rpc: vi.fn() }

    const res = await request(appWith({ id: "freelancer-1" }, supabase))
      .post("/jobs/job-1")
      .send({ proposal_text: "hi", timeline: "1 week", budget: "0" })

    expect(res.body).toEqual({ success: false, error: "Please enter a valid budget.", code: "invalid_budget" })
    expect(supabase.rpc).not.toHaveBeenCalled()
  })

  it("submits via place_bid and notifies the agency on success", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: { full_name: "Jane" }, error: null })
    const supabase = {
      rpc: vi.fn().mockResolvedValue({ data: { ok: true }, error: null }),
      from: vi.fn(() => ({ select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle })) })) })),
    }

    const res = await request(appWith({ id: "freelancer-1" }, supabase))
      .post("/jobs/job-1")
      .send({ proposal_text: "hi", timeline: "1 week", budget: "5000", creditCost: 2 })

    expect(res.body).toEqual({ success: true, alreadySubmitted: false })
    expect(notifyAgencyNewProposalMock).toHaveBeenCalledWith("job-1", "Jane")
  })

  it("surfaces insufficient_credits without notifying anyone", async () => {
    const supabase = { rpc: vi.fn().mockResolvedValue({ data: { ok: false, code: "insufficient_credits" }, error: null }) }

    const res = await request(appWith({ id: "freelancer-1" }, supabase))
      .post("/jobs/job-1")
      .send({ proposal_text: "hi", timeline: "1 week", budget: "5000", creditCost: 2 })

    expect(res.body).toEqual({
      success: false,
      error: "Insufficient credits to place this bid.",
      code: "insufficient_credits",
    })
    expect(notifyAgencyNewProposalMock).not.toHaveBeenCalled()
  })
})

describe("GET /mine", () => {
  it("returns the freelancer's proposals enriched with job/funding/status info", async () => {
    const proposalsRange = vi.fn().mockResolvedValue({
      data: [{ id: "prop-1", job_id: "job-1" }],
      error: null,
    })
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "proposals") {
          return { select: vi.fn(() => ({ eq: vi.fn(() => ({ order: vi.fn(() => ({ range: proposalsRange })) })) })) }
        }
        if (table === "jobs") {
          return { select: vi.fn(() => ({ in: vi.fn().mockResolvedValue({ data: [{ id: "job-1", title: "Build a site", agency_id: "agency-1" }] }) })) }
        }
        if (table === "job_funding_status") {
          return { select: vi.fn(() => ({ in: vi.fn().mockResolvedValue({ data: [{ job_id: "job-1", funding_status: "funded", job_status: "in_progress" }] }) })) }
        }
        if (table === "freelancer_proposal_status") {
          return { select: vi.fn(() => ({ in: vi.fn().mockResolvedValue({ data: [{ proposal_id: "prop-1", freelancer_status: "accepted" }] }) })) }
        }
        if (table === "profiles") {
          return { select: vi.fn(() => ({ in: vi.fn().mockResolvedValue({ data: [{ id: "agency-1", full_name: "Jane", company_name: "Jane Co" }] }) })) }
        }
        throw new Error(`unexpected table ${table}`)
      }),
    }

    const res = await request(appWith({ id: "freelancer-1" }, supabase)).get("/mine")

    expect(res.body.proposals).toEqual([
      expect.objectContaining({
        id: "prop-1",
        job_title: "Build a site",
        agency_name: "Jane Co",
        funding_status: "funded",
        freelancer_status: "accepted",
      }),
    ])
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd server && npx vitest run src/routes/proposals.test.ts`
Expected: FAIL — `Cannot find module './proposals.js'`

- [ ] **Step 3: Write the implementation**

```typescript
// server/src/routes/proposals.ts
import { Router } from "express"
import { asyncHandler } from "../lib/http.js"
import { notifyAgencyNewProposal, notifyFreelancerProposalDecision } from "../lib/notifications.js"

const proposalsRouter = Router()

proposalsRouter.post(
  "/:proposalId/respond",
  asyncHandler(async (req, res) => {
    const { proposalId } = req.params
    const action = req.body?.action

    if (action !== "accept" && action !== "reject") {
      res.json({ success: false, error: "action must be 'accept' or 'reject'" })
      return
    }

    const supabase = req.supabase!
    const { data: proposal, error: lookupError } = await supabase
      .from("proposals")
      .select("id, jobs!inner(agency_id)")
      .eq("id", proposalId)
      .maybeSingle()

    if (lookupError) {
      res.json({ success: false, error: lookupError.message })
      return
    }
    if (!proposal) {
      res.json({ success: false, error: "Proposal not found" })
      return
    }
    if ((proposal as any).jobs?.agency_id !== req.user!.id) {
      res.json({ success: false, error: "Forbidden" })
      return
    }

    const { error } = await supabase
      .from("proposals")
      .update({ status: action === "accept" ? "accepted" : "rejected", updated_at: new Date().toISOString() })
      .eq("id", proposalId)

    if (error) {
      res.json({ success: false, error: error.message })
      return
    }

    await notifyFreelancerProposalDecision(proposalId, action)

    res.json({ success: true })
  })
)

proposalsRouter.post(
  "/jobs/:jobId",
  asyncHandler(async (req, res) => {
    const { jobId } = req.params
    const { proposal_text, timeline, budget, attachments, creditCost } = req.body ?? {}
    const supabase = req.supabase!
    const user = req.user!

    const parsedBudget = Number(budget)
    if (!Number.isFinite(parsedBudget) || parsedBudget <= 0) {
      res.json({ success: false, error: "Please enter a valid budget.", code: "invalid_budget" })
      return
    }

    const { data, error } = await supabase.rpc("place_bid", {
      p_job_id: jobId,
      p_proposal_text: proposal_text,
      p_timeline: timeline,
      p_budget: parsedBudget,
      p_credit_cost: creditCost,
      p_attachments: attachments ?? null,
    })

    if (error) {
      console.error("place_bid RPC error:", error)
      res.json({ success: false, error: error.message, code: error.code })
      return
    }

    const result = (data ?? {}) as { ok?: boolean; code?: string }

    if (result.ok) {
      if (result.code !== "already_submitted") {
        const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle()
        await notifyAgencyNewProposal(jobId, profile?.full_name)
      }
      res.json({ success: true, alreadySubmitted: result.code === "already_submitted" })
      return
    }

    switch (result.code) {
      case "insufficient_credits":
        res.json({ success: false, error: "Insufficient credits to place this bid.", code: result.code })
        return
      case "unauthorized":
        res.json({ success: false, error: "Unauthorized", code: result.code })
        return
      default:
        res.json({ success: false, error: "Could not submit proposal. Please try again.", code: result.code })
    }
  })
)

proposalsRouter.get(
  "/mine",
  asyncHandler(async (req, res) => {
    const supabase = req.supabase!
    const user = req.user!
    const limit = Number(req.query.limit ?? 15)
    const offset = Number(req.query.offset ?? 0)
    const searchTerm = typeof req.query.searchTerm === "string" ? req.query.searchTerm.trim() : undefined

    let jobIdsToFilter: string[] | undefined
    if (searchTerm) {
      const { data: searchedJobs, error: searchError } = await supabase
        .from("jobs")
        .select("id")
        .or(`title.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`)
      if (searchError) {
        console.error("Error searching jobs:", searchError)
        res.json({ proposals: [], hasMore: false })
        return
      }
      jobIdsToFilter = (searchedJobs || []).map((j: any) => j.id)
      if (jobIdsToFilter.length === 0) {
        res.json({ proposals: [], hasMore: false })
        return
      }
    }

    let proposalsQuery = supabase
      .from("proposals")
      .select("*")
      .eq("freelancer_id", user.id)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1)
    if (jobIdsToFilter !== undefined) {
      proposalsQuery = proposalsQuery.in("job_id", jobIdsToFilter)
    }

    const { data: proposalsData, error: proposalsError } = await proposalsQuery
    if (proposalsError || !proposalsData || proposalsData.length === 0) {
      if (proposalsError) console.error("Error loading proposals:", proposalsError.message)
      res.json({ proposals: [], hasMore: false })
      return
    }

    const jobIds = Array.from(new Set(proposalsData.map((p: any) => p.job_id).filter(Boolean)))
    const proposalIds = proposalsData.map((p: any) => p.id).filter(Boolean)

    const [jobsRes, fundingRes, statusRes] = await Promise.all([
      jobIds.length
        ? supabase
            .from("jobs")
            .select("id, title, description, budget_min, budget_max, job_type, duration, location, skills, agency_id")
            .in("id", jobIds)
        : Promise.resolve({ data: [] as any[] }),
      jobIds.length
        ? supabase.from("job_funding_status").select("job_id, funding_status, job_status").in("job_id", jobIds)
        : Promise.resolve({ data: [] as any[] }),
      proposalIds.length
        ? supabase.from("freelancer_proposal_status").select("proposal_id, freelancer_status").in("proposal_id", proposalIds)
        : Promise.resolve({ data: [] as any[] }),
    ])

    const jobById: Record<string, any> = {}
    for (const j of (jobsRes.data as any[]) || []) jobById[j.id] = j
    const fundingByJobId: Record<string, any> = {}
    for (const f of (fundingRes.data as any[]) || []) fundingByJobId[f.job_id] = f
    const statusByProposalId: Record<string, any> = {}
    for (const s of (statusRes.data as any[]) || []) statusByProposalId[s.proposal_id] = s

    const agencyIds = Array.from(new Set(Object.values(jobById).map((j: any) => j?.agency_id).filter(Boolean)))
    const agencyById: Record<string, any> = {}
    if (agencyIds.length > 0) {
      const { data: agencies } = await supabase.from("profiles").select("id, full_name, company_name").in("id", agencyIds)
      for (const a of (agencies as any[]) || []) agencyById[a.id] = a
    }

    const proposals = proposalsData.map((proposal: any) => {
      const job = jobById[proposal.job_id]
      const agency = job ? agencyById[job.agency_id] : null
      const funding = fundingByJobId[proposal.job_id]
      const fStatus = statusByProposalId[proposal.id]
      return {
        ...proposal,
        job_title: job?.title || "Unknown Job",
        job_description: job?.description || "No description available",
        job_budget_min: job?.budget_min || 0,
        job_budget_max: job?.budget_max || 0,
        job_type: job?.job_type || "Not specified",
        job_duration: job?.duration || "Not specified",
        job_location: job?.location || "Not specified",
        skills: job?.skills || [],
        agency_name: agency?.company_name || agency?.full_name || "Unknown Agency",
        funding_status: funding?.funding_status || "pending",
        job_status: funding?.job_status || "open",
        freelancer_status: fStatus?.freelancer_status || "pending",
      }
    })

    res.json({ proposals, hasMore: proposalsData.length === limit })
  })
)

export default proposalsRouter
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd server && npx vitest run src/routes/proposals.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/src/routes/proposals.ts server/src/routes/proposals.test.ts
git commit -m "Port app/actions/proposals.ts (+ getFreelancerProposals) to server/src/routes/proposals.ts"
```

---

## Task 8: Port `jobs.ts` → `server/src/routes/jobs.ts`

**Files:**
- Create: `server/src/routes/jobs.ts`
- Test: `server/src/routes/jobs.test.ts`

**Interfaces:**
- Consumes: `asyncHandler` (Task 1).
- Produces: `jobsRouter` (default export), mounted at `/api/jobs` behind `requireAuth` in Task 9. Excludes `getFreelancerProposals` (ported in Task 7 instead, see that task's Interfaces note).

- [ ] **Step 1: Write the failing tests**

```typescript
// server/src/routes/jobs.test.ts
import { describe, it, expect, vi } from "vitest"
import express from "express"
import request from "supertest"
import jobsRouter from "./jobs.js"

function appWith(user: { id: string }, supabase: any) {
  const app = express()
  app.use(express.json())
  app.use((req: any, _res, next) => {
    req.user = user
    req.supabase = supabase
    next()
  })
  app.use("/", jobsRouter)
  return app
}

describe("GET /", () => {
  it("calls get_jobs_with_details and attaches has_applied", async () => {
    const supabase = {
      rpc: vi.fn().mockResolvedValue({ data: [{ id: "job-1", total_count: 1 }], error: null }),
      from: vi.fn(() => ({
        select: vi.fn(() => ({ eq: vi.fn(() => ({ in: vi.fn().mockResolvedValue({ data: [{ job_id: "job-1" }] }) })) })),
      })),
    }
    const res = await request(appWith({ id: "freelancer-1" }, supabase)).get("/?searchQuery=react&limit=5")

    expect(supabase.rpc).toHaveBeenCalledWith(
      "get_jobs_with_details",
      expect.objectContaining({ p_user_id: "freelancer-1", p_search_query: "react", p_limit: 5 })
    )
    expect(res.body).toEqual({ jobs: [{ id: "job-1", total_count: 1, has_applied: true }], totalCount: 1 })
  })
})

describe("GET /saved", () => {
  it("enriches saved jobs with agency info and job counts", async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "saved_jobs") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                order: vi.fn().mockResolvedValue({
                  data: [
                    {
                      created_at: "2026-01-01T00:00:00Z",
                      jobs: { id: "job-1", agency_id: "agency-1", budget_min: 1000, budget_max: 2000, created_at: "2026-01-01T00:00:00Z", proposals: [{ count: 3 }] },
                    },
                  ],
                  error: null,
                }),
              })),
            })),
          }
        }
        if (table === "profiles") {
          return { select: vi.fn(() => ({ in: vi.fn().mockResolvedValue({ data: [{ id: "agency-1", company_name: "Acme" }] }) })) }
        }
        if (table === "jobs") {
          return { select: vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ count: 4 }) })) }
        }
        throw new Error(`unexpected table ${table}`)
      }),
    }
    const res = await request(appWith({ id: "freelancer-1" }, supabase)).get("/saved")

    expect(res.body.jobs[0]).toEqual(
      expect.objectContaining({ id: "job-1", isBookmarked: true, agencyInfo: expect.objectContaining({ name: "Acme", totalJobs: 4 }) })
    )
  })
})

describe("POST /:jobId/bookmark", () => {
  it("deletes the saved_jobs row when isBookmarked is true", async () => {
    const eqEq = vi.fn().mockResolvedValue({ error: null })
    const supabase = { from: vi.fn(() => ({ delete: vi.fn(() => ({ eq: vi.fn(() => ({ eq: eqEq })) })) })) }

    const res = await request(appWith({ id: "freelancer-1" }, supabase))
      .post("/job-1/bookmark")
      .send({ isBookmarked: true })

    expect(res.body).toEqual({ success: true })
  })

  it("inserts a saved_jobs row when isBookmarked is false", async () => {
    const insert = vi.fn().mockResolvedValue({ error: null })
    const supabase = { from: vi.fn(() => ({ insert })) }

    const res = await request(appWith({ id: "freelancer-1" }, supabase))
      .post("/job-1/bookmark")
      .send({ isBookmarked: false })

    expect(insert).toHaveBeenCalledWith([{ freelancer_id: "freelancer-1", job_id: "job-1" }])
    expect(res.body).toEqual({ success: true })
  })
})

describe("GET /agency", () => {
  it("returns the agency's own jobs with proposal counts", async () => {
    const supabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({ order: vi.fn().mockResolvedValue({ data: [{ id: "job-1", proposals: [{ count: 2 }] }], error: null }) })),
        })),
      })),
    }
    const res = await request(appWith({ id: "agency-1" }, supabase)).get("/agency")
    expect(res.body).toEqual({ jobs: [{ id: "job-1", proposals: 2 }] })
  })
})

describe("PATCH /:jobId/status", () => {
  it("updates the job status", async () => {
    const eq = vi.fn().mockResolvedValue({ error: null })
    const supabase = { from: vi.fn(() => ({ update: vi.fn(() => ({ eq })) })) }

    const res = await request(appWith({ id: "agency-1" }, supabase))
      .patch("/job-1/status")
      .send({ status: "closed" })

    expect(res.body).toEqual({ success: true })
  })
})

describe("POST / (createJob)", () => {
  it("creates a job for the calling agency", async () => {
    const insert = vi.fn().mockResolvedValue({ error: null })
    const supabase = { from: vi.fn(() => ({ insert })) }

    const res = await request(appWith({ id: "agency-1" }, supabase))
      .post("/")
      .send({ title: "Build a site", idempotencyKey: "key-1" })

    expect(insert).toHaveBeenCalledWith([expect.objectContaining({ title: "Build a site", agency_id: "agency-1", status: "active" })])
    expect(res.body).toEqual({ success: true })
  })

  it("treats a unique_violation on idempotency_key as a successful dedupe", async () => {
    const insert = vi.fn().mockResolvedValue({ error: { code: "23505", message: "duplicate key" } })
    const supabase = { from: vi.fn(() => ({ insert })) }

    const res = await request(appWith({ id: "agency-1" }, supabase))
      .post("/")
      .send({ title: "Build a site", idempotencyKey: "key-1" })

    expect(res.body).toEqual({ success: true, deduped: true })
  })
})

describe("PUT /:jobId (updateJob)", () => {
  it("updates a job scoped to the calling agency", async () => {
    const eqAgency = vi.fn().mockResolvedValue({ error: null })
    const eqId = vi.fn(() => ({ eq: eqAgency }))
    const supabase = { from: vi.fn(() => ({ update: vi.fn(() => ({ eq: eqId })) })) }

    const res = await request(appWith({ id: "agency-1" }, supabase))
      .put("/job-1")
      .send({ title: "Updated title" })

    expect(res.body).toEqual({ success: true })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd server && npx vitest run src/routes/jobs.test.ts`
Expected: FAIL — `Cannot find module './jobs.js'`

- [ ] **Step 3: Write the implementation**

```typescript
// server/src/routes/jobs.ts
import { Router } from "express"
import { asyncHandler } from "../lib/http.js"

const jobsRouter = Router()

function toStringArray(value: unknown): string[] | undefined {
  if (value === undefined) return undefined
  return Array.isArray(value) ? value.map(String) : [String(value)]
}

jobsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const supabase = req.supabase!
    const user = req.user!
    const q = req.query

    const { data, error } = await supabase.rpc("get_jobs_with_details", {
      p_user_id: user.id,
      p_search_query: (q.searchQuery as string) || "",
      p_offset: Number(q.offset ?? 0),
      p_limit: Number(q.limit ?? 10),
      p_from_date: (q.fromDate as string) || null,
      p_to_date: (q.toDate as string) || null,
      p_max_credits: q.maxCredits ? Number(q.maxCredits) : null,
      p_job_type: (q.jobType as string) || null,
      p_category_skills: toStringArray(q.categorySkills) || null,
    })

    if (error) {
      console.error("Error fetching jobs:", error)
      res.json({ jobs: [], totalCount: 0, error: error.message })
      return
    }

    const jobs = data || []
    let jobsWithApplied = jobs
    if (jobs.length > 0) {
      const jobIds = jobs.map((j: any) => j.id)
      const { data: applied } = await supabase
        .from("proposals")
        .select("job_id")
        .eq("freelancer_id", user.id)
        .in("job_id", jobIds)
      const appliedSet = new Set((applied || []).map((p: any) => p.job_id))
      jobsWithApplied = jobs.map((j: any) => ({ ...j, has_applied: appliedSet.has(j.id) }))
    }

    res.json({ jobs: jobsWithApplied, totalCount: data?.[0]?.total_count || 0 })
  })
)

jobsRouter.get(
  "/saved",
  asyncHandler(async (req, res) => {
    const supabase = req.supabase!
    const user = req.user!

    const { data: savedJobsData, error } = await supabase
      .from("saved_jobs")
      .select(`*, jobs!saved_jobs_job_id_fkey (*, proposals(count))`)
      .eq("freelancer_id", user.id)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Error loading saved jobs:", error)
      res.json({ jobs: [] })
      return
    }

    const agencyIds = [...new Set((savedJobsData || []).map((item: any) => item.jobs?.agency_id).filter(Boolean))]

    const profilesById: Record<string, any> = {}
    if (agencyIds.length > 0) {
      const { data: agencyProfiles } = await supabase
        .from("profiles")
        .select("id, full_name, company_name, company_size, bio, location, phone, website, email, created_at")
        .in("id", agencyIds)
      for (const p of agencyProfiles || []) profilesById[(p as any).id] = p
    }

    const agencyJobCounts: Record<string, number> = {}
    for (const agencyId of agencyIds) {
      const { count } = await supabase.from("jobs").select("*", { count: "exact", head: true }).eq("agency_id", agencyId)
      agencyJobCounts[agencyId as string] = count || 0
    }

    const jobs = (savedJobsData || []).map((item: any) => {
      const job = item.jobs
      const profile = profilesById[job?.agency_id] || null
      return {
        ...job,
        savedAt: new Date(item.created_at).toLocaleDateString(),
        budget: `₦ ${job.budget_min?.toLocaleString()} - ₦ ${job.budget_max?.toLocaleString()}`,
        postedDate: new Date(job.created_at).toLocaleDateString(),
        proposals: job.proposals?.[0]?.count || 0,
        isBookmarked: true,
        agencyInfo: {
          id: profile?.id,
          name: profile?.company_name || profile?.full_name || "Unknown Agency",
          location: profile?.location || "Nigeria",
          employees: profile?.company_size || "10-50",
          description: profile?.bio || "Professional agency providing quality services.",
          memberSince: profile?.created_at ? new Date(profile.created_at).getFullYear().toString() : "2020",
          phone: profile?.phone,
          website: profile?.website,
          email: profile?.email,
          fullName: profile?.full_name,
          companyName: profile?.company_name,
          totalJobs: agencyJobCounts[job?.agency_id] || 0,
        },
      }
    })

    res.json({ jobs })
  })
)

jobsRouter.post(
  "/:jobId/bookmark",
  asyncHandler(async (req, res) => {
    const { jobId } = req.params
    const isBookmarked = !!req.body?.isBookmarked
    const supabase = req.supabase!
    const user = req.user!

    if (isBookmarked) {
      const { error } = await supabase.from("saved_jobs").delete().eq("freelancer_id", user.id).eq("job_id", jobId)
      if (error) throw error
    } else {
      const { error } = await supabase.from("saved_jobs").insert([{ freelancer_id: user.id, job_id: jobId }])
      if (error) throw error
    }

    res.json({ success: true })
  })
)

jobsRouter.get(
  "/agency",
  asyncHandler(async (req, res) => {
    const supabase = req.supabase!
    const user = req.user!

    const { data, error } = await supabase
      .from("jobs")
      .select("*, proposals(count)")
      .eq("agency_id", user.id)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Error fetching agency jobs:", error)
      res.json({ jobs: [] })
      return
    }

    const jobs = data?.map((job: any) => ({ ...job, proposals: job.proposals?.[0]?.count || 0 })) || []
    res.json({ jobs })
  })
)

jobsRouter.patch(
  "/:jobId/status",
  asyncHandler(async (req, res) => {
    const { jobId } = req.params
    const { status } = req.body ?? {}
    const { error } = await req.supabase!
      .from("jobs")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", jobId)

    if (error) throw error
    res.json({ success: true })
  })
)

jobsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const { idempotencyKey, ...input } = req.body ?? {}
    const supabase = req.supabase!
    const user = req.user!

    const { error } = await supabase.from("jobs").insert([
      { ...input, agency_id: user.id, status: "active", created_at: new Date().toISOString(), idempotency_key: idempotencyKey },
    ])

    if (error) {
      if (error.code === "23505") {
        res.json({ success: true, deduped: true })
        return
      }
      console.error("createJob error:", error)
      res.json({ success: false, error: error.message, code: error.code })
      return
    }

    res.json({ success: true })
  })
)

jobsRouter.put(
  "/:jobId",
  asyncHandler(async (req, res) => {
    const { jobId } = req.params
    const input = req.body ?? {}
    const supabase = req.supabase!
    const user = req.user!

    const { error } = await supabase
      .from("jobs")
      .update({ ...input, updated_at: new Date().toISOString() })
      .eq("id", jobId)
      .eq("agency_id", user.id)

    if (error) {
      console.error("updateJob error:", error)
      res.json({ success: false, error: error.message, code: error.code })
      return
    }

    res.json({ success: true })
  })
)

export default jobsRouter
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd server && npx vitest run src/routes/jobs.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/src/routes/jobs.ts server/src/routes/jobs.test.ts
git commit -m "Port app/actions/jobs.ts to server/src/routes/jobs.ts"
```

---

## Task 9: Wire everything into `app.ts`

**Files:**
- Modify: `server/src/app.ts`
- Test: `server/src/app.test.ts` (extend)

**Interfaces:** none new — this task only wires Tasks 1, 6, 7, 8 together.

- [ ] **Step 1: Write the failing tests**

Replace `server/src/app.test.ts` with:

```typescript
// server/src/app.test.ts
import { describe, it, expect } from "vitest"
import request from "supertest"
import { createApp } from "./app.js"

describe("GET /health", () => {
  it("returns status ok", async () => {
    const app = createApp()
    const res = await request(app).get("/health")
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ status: "ok" })
  })
})

describe("auth gate on Phase 1 routers", () => {
  it("requires auth on /api/user", async () => {
    const res = await request(createApp()).get("/api/user/credits")
    expect(res.status).toBe(401)
  })

  it("requires auth on /api/jobs", async () => {
    const res = await request(createApp()).get("/api/jobs")
    expect(res.status).toBe(401)
  })

  it("requires auth on /api/proposals", async () => {
    const res = await request(createApp()).get("/api/proposals/mine")
    expect(res.status).toBe(401)
  })
})
```

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `cd server && npx vitest run src/app.test.ts`
Expected: FAIL — the three new routes 404 (nothing mounted at those paths yet), not 401

- [ ] **Step 3: Update `server/src/app.ts`**

```typescript
// server/src/app.ts
import express from "express"
import cors from "cors"
import meRouter from "./routes/me.js"
import userRouter from "./routes/user.js"
import jobsRouter from "./routes/jobs.js"
import proposalsRouter from "./routes/proposals.js"
import { requireAuth } from "./middleware/auth.js"
import { errorHandler } from "./lib/http.js"

export function createApp() {
  const app = express()

  app.use(
    cors({
      origin: process.env.CLIENT_ORIGIN ?? "http://localhost:5173",
    })
  )
  app.use(express.json())

  app.use("/api/me", meRouter)
  app.use("/api/user", requireAuth, userRouter)
  app.use("/api/jobs", requireAuth, jobsRouter)
  app.use("/api/proposals", requireAuth, proposalsRouter)

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" })
  })

  app.use(errorHandler)

  return app
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd server && npx vitest run src/app.test.ts`
Expected: PASS

- [ ] **Step 5: Run the full server test suite**

Run: `cd server && npm test`
Expected: All tests PASS (health, http, admin, avatar, email, notifications, me, user, jobs, proposals, app)

- [ ] **Step 6: Commit**

```bash
git add server/src/app.ts server/src/app.test.ts
git commit -m "Mount user/jobs/proposals routers and the shared error handler"
```

---

## Post-Phase-1 note

This plan covers Phase 1 only (spec's Section 7, row 1) — backend routes with no `client/` caller yet. Phase 2 (freelancer + agency core: marketplace, jobs, proposals, saved jobs, profiles, find-freelancers) is where `client/` actually calls these new endpoints via `apiFetch`, replacing the placeholder pages built in Phase 0. Phase 3 (credits & realtime) and Phase 4 (escrow & payments, gated on the Supabase-side escrow v2 migration) remain out of scope here, per this plan's Global Constraints.
