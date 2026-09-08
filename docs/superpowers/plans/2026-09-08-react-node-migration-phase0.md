# React + Node Migration — Phase 0 (Scaffold + First Vertical Slice) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up two new, self-contained folders — `client/` (Vite + React SPA) and `server/` (Express API) — beside the existing untouched Next.js app, wire Bearer-token auth end-to-end against the existing Supabase project (preserving RLS), and port the first vertical slice (landing page + login + signup) in the new UI direction, as a running proof of concept for the rest of the migration.

**Architecture:** `server/` exposes a small Express API; every user-facing request carries `Authorization: Bearer <supabase access token>`, and the server builds a per-request Supabase client scoped to that token (mirrors today's `lib/supabase-server.ts` pattern) so RLS applies exactly as it does now. `client/` is a Vite/React/TypeScript SPA using the Supabase JS client directly for auth (sign in/up) and the new `server/` API for everything else (starting with a single proof-of-concept endpoint, `GET /api/me`). Neither folder touches any existing root-level file.

**Tech Stack:** Vite, React 19, React Router, TypeScript, Tailwind CSS, shadcn/Radix primitives (ported), Framer Motion, `@supabase/supabase-js` — client side. Node.js, Express, TypeScript, `@supabase/supabase-js`, `cors` — server side. Vitest + React Testing Library (client), Vitest + Supertest (server).

**Spec:** `docs/superpowers/specs/2026-09-08-nextjs-to-react-node-migration-design.md`

## Global Constraints

- Existing root-level Next.js app (`app/`, `components/`, `lib/`, `middleware.ts`, `package.json`, etc.) is **never modified** by this plan.
- New folders are `client/` and `server/`, both root-level, each with its own `package.json`/`node_modules`/`.env` — fully self-contained.
- Auth is **Bearer-token**, not cookies — no CORS cookie/`SameSite` configuration needed, but CORS must allow the `Authorization` header from the client's origin.
- Service-role Supabase client is never used for user-facing paths — only the per-request JWT-scoped client (same boundary as `lib/supabase-server.ts` today).
- Same Supabase project/tables/RLS as the existing app — no schema changes in this plan.
- Dev ports: `server/` on **4000**, `client/` (Vite default) on **5173** — neither collides with the existing Next.js app's port 3000.
- Brand tokens (colors, radii, fonts) are ported verbatim from `app/globals.css` / `tailwind.config.ts` — no redesign of the color system in this slice.

---

## Task 1: Scaffold `server/` — Express + TypeScript, health check

**Files:**
- Create: `server/package.json`
- Create: `server/tsconfig.json`
- Create: `server/.gitignore`
- Create: `server/.env.example`
- Create: `server/src/app.ts`
- Create: `server/src/index.ts`
- Test: `server/src/app.test.ts`

**Interfaces:**
- Produces: `createApp(): express.Express` (exported from `server/src/app.ts`) — later tasks mount routes on the app this returns, before it's passed to `.listen()` in `index.ts`.

- [ ] **Step 1: Create `server/package.json`**

```json
{
  "name": "bizimi-server",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc -p tsconfig.json",
    "start": "node dist/index.js",
    "test": "vitest run"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.45.4",
    "cors": "^2.8.5",
    "dotenv": "^16.4.5",
    "express": "^4.21.1"
  },
  "devDependencies": {
    "@types/cors": "^2.8.17",
    "@types/express": "^4.17.21",
    "@types/node": "^22.7.5",
    "@types/supertest": "^6.0.2",
    "supertest": "^7.0.0",
    "tsx": "^4.19.1",
    "typescript": "^5.6.3",
    "vitest": "^2.1.2"
  }
}
```

- [ ] **Step 2: Create `server/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*.ts"]
}
```

- [ ] **Step 3: Create `server/.gitignore`**

```
node_modules/
dist/
.env
```

- [ ] **Step 4: Create `server/.env.example`**

```
PORT=4000
CLIENT_ORIGIN=http://localhost:5173
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

- [ ] **Step 5: Create `server/src/app.ts` with a health route**

```typescript
import express from "express"
import cors from "cors"

export function createApp() {
  const app = express()

  app.use(
    cors({
      origin: process.env.CLIENT_ORIGIN ?? "http://localhost:5173",
    })
  )
  app.use(express.json())

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" })
  })

  return app
}
```

- [ ] **Step 6: Create `server/src/index.ts`**

```typescript
import "dotenv/config"
import { createApp } from "./app.js"

const port = Number(process.env.PORT ?? 4000)
const app = createApp()

app.listen(port, () => {
  console.log(`server listening on http://localhost:${port}`)
})
```

- [ ] **Step 7: Write the failing test for the health route**

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
```

- [ ] **Step 8: Install dependencies and run the test**

Run: `cd server && npm install && npm test`
Expected: PASS (the health route already exists from Step 5, so this confirms the harness works — this is the one test in this plan written after its implementation, since it's establishing the test harness itself, not driving new behavior)

- [ ] **Step 9: Commit**

```bash
git add server/
git commit -m "Scaffold Express + TypeScript server with health check"
```

---

## Task 2: Supabase client factories (`server/src/lib/supabase.ts`)

**Files:**
- Create: `server/src/lib/supabase.ts`
- Test: `server/src/lib/supabase.test.ts`

**Interfaces:**
- Consumes: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` env vars.
- Produces: `createUserClient(accessToken: string): SupabaseClient` and `createServiceClient(): SupabaseClient`, both exported from `server/src/lib/supabase.ts` — Task 3's auth middleware imports `createUserClient`; any future webhook/admin route imports `createServiceClient`.

- [ ] **Step 1: Write the failing test**

```typescript
// server/src/lib/supabase.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest"

const createClientMock = vi.fn(() => ({ mocked: true }))
vi.mock("@supabase/supabase-js", () => ({
  createClient: createClientMock,
}))

beforeEach(() => {
  createClientMock.mockClear()
  process.env.SUPABASE_URL = "https://example.supabase.co"
  process.env.SUPABASE_ANON_KEY = "anon-key"
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key"
})

describe("createUserClient", () => {
  it("builds a client scoped to the given bearer token", async () => {
    const { createUserClient } = await import("./supabase.js")
    createUserClient("user-token-123")

    expect(createClientMock).toHaveBeenCalledWith(
      "https://example.supabase.co",
      "anon-key",
      expect.objectContaining({
        global: { headers: { Authorization: "Bearer user-token-123" } },
      })
    )
  })
})

describe("createServiceClient", () => {
  it("builds a client with the service-role key", async () => {
    const { createServiceClient } = await import("./supabase.js")
    createServiceClient()

    expect(createClientMock).toHaveBeenCalledWith(
      "https://example.supabase.co",
      "service-key",
      expect.objectContaining({
        auth: { persistSession: false, autoRefreshToken: false },
      })
    )
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx vitest run src/lib/supabase.test.ts`
Expected: FAIL — `Cannot find module './supabase.js'`

- [ ] **Step 3: Write the implementation**

```typescript
// server/src/lib/supabase.ts
import { createClient, type SupabaseClient } from "@supabase/supabase-js"

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing required env var: ${name}`)
  return value
}

// Per-request client scoped to the caller's access token — RLS applies
// exactly as it does for lib/supabase-server.ts in the Next.js app.
export function createUserClient(accessToken: string): SupabaseClient {
  const url = requireEnv("SUPABASE_URL")
  const anonKey = requireEnv("SUPABASE_ANON_KEY")
  return createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  })
}

// Bypasses RLS. Only for system paths (webhooks, admin, cron) — never
// for a route driven directly by a user request.
export function createServiceClient(): SupabaseClient {
  const url = requireEnv("SUPABASE_URL")
  const serviceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY")
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npx vitest run src/lib/supabase.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/src/lib/supabase.ts server/src/lib/supabase.test.ts
git commit -m "Add per-request and service-role Supabase client factories"
```

---

## Task 3: Auth middleware (`server/src/middleware/auth.ts`)

**Files:**
- Create: `server/src/types/express.d.ts`
- Create: `server/src/middleware/auth.ts`
- Test: `server/src/middleware/auth.test.ts`

**Interfaces:**
- Consumes: `createUserClient` from `server/src/lib/supabase.ts` (Task 2).
- Produces: `requireAuth(req, res, next)` Express middleware exported from `server/src/middleware/auth.ts`. On success it sets `req.user: { id: string; email?: string }` and `req.supabase: SupabaseClient`. Task 4's `/api/me` route consumes both.

- [ ] **Step 1: Declare the Express Request extension**

```typescript
// server/src/types/express.d.ts
import type { SupabaseClient } from "@supabase/supabase-js"

declare global {
  namespace Express {
    interface Request {
      user?: { id: string; email?: string }
      supabase?: SupabaseClient
    }
  }
}

export {}
```

- [ ] **Step 2: Write the failing test**

```typescript
// server/src/middleware/auth.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest"
import type { Request, Response } from "express"

const getUserMock = vi.fn()
vi.mock("../lib/supabase.js", () => ({
  createUserClient: vi.fn(() => ({
    auth: { getUser: getUserMock },
  })),
}))

function mockRes() {
  const res: Partial<Response> = {}
  res.status = vi.fn().mockReturnValue(res)
  res.json = vi.fn().mockReturnValue(res)
  return res as Response
}

beforeEach(() => {
  getUserMock.mockReset()
})

describe("requireAuth", () => {
  it("returns 401 when no Authorization header is present", async () => {
    const { requireAuth } = await import("./auth.js")
    const req = { headers: {} } as Request
    const res = mockRes()
    const next = vi.fn()

    await requireAuth(req, res, next)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(res.json).toHaveBeenCalledWith({ error: "Unauthorized" })
    expect(next).not.toHaveBeenCalled()
  })

  it("returns 401 when Supabase rejects the token", async () => {
    getUserMock.mockResolvedValue({ data: { user: null }, error: new Error("invalid") })
    const { requireAuth } = await import("./auth.js")
    const req = { headers: { authorization: "Bearer bad-token" } } as Request
    const res = mockRes()
    const next = vi.fn()

    await requireAuth(req, res, next)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(next).not.toHaveBeenCalled()
  })

  it("attaches req.user and req.supabase and calls next() on success", async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: "user-1", email: "a@b.com" } },
      error: null,
    })
    const { requireAuth } = await import("./auth.js")
    const req = { headers: { authorization: "Bearer good-token" } } as Request
    const res = mockRes()
    const next = vi.fn()

    await requireAuth(req, res, next)

    expect(req.user).toEqual({ id: "user-1", email: "a@b.com" })
    expect(req.supabase).toBeDefined()
    expect(next).toHaveBeenCalledOnce()
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd server && npx vitest run src/middleware/auth.test.ts`
Expected: FAIL — `Cannot find module './auth.js'`

- [ ] **Step 4: Write the implementation**

```typescript
// server/src/middleware/auth.ts
import type { Request, Response, NextFunction } from "express"
import { createUserClient } from "../lib/supabase.js"

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization
  const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : null

  if (!token) {
    res.status(401).json({ error: "Unauthorized" })
    return
  }

  const supabase = createUserClient(token)
  const { data, error } = await supabase.auth.getUser(token)

  if (error || !data.user) {
    res.status(401).json({ error: "Unauthorized" })
    return
  }

  req.user = { id: data.user.id, email: data.user.email }
  req.supabase = supabase
  next()
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd server && npx vitest run src/middleware/auth.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add server/src/types/express.d.ts server/src/middleware/auth.ts server/src/middleware/auth.test.ts
git commit -m "Add Bearer-token auth middleware"
```

---

## Task 4: `GET /api/me` route + mount on app

**Files:**
- Create: `server/src/routes/me.ts`
- Modify: `server/src/app.ts`
- Test: `server/src/routes/me.test.ts`

**Interfaces:**
- Consumes: `requireAuth` (Task 3), `req.user`/`req.supabase` it attaches.
- Produces: `meRouter` (default export from `server/src/routes/me.ts`), mounted at `/api/me` in `app.ts`. This is the first proven vertical slice of the "Express route → RLS-scoped query" pattern later phases repeat for every other resource.

- [ ] **Step 1: Write the failing test**

```typescript
// server/src/routes/me.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest"
import request from "supertest"

const getUserMock = vi.fn()
const singleMock = vi.fn()

vi.mock("../lib/supabase.js", () => ({
  createUserClient: vi.fn(() => ({
    auth: { getUser: getUserMock },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: singleMock,
        })),
      })),
    })),
  })),
}))

beforeEach(() => {
  getUserMock.mockReset()
  singleMock.mockReset()
  process.env.CLIENT_ORIGIN = "http://localhost:5173"
})

describe("GET /api/me", () => {
  it("returns 401 without a token", async () => {
    const { createApp } = await import("../app.js")
    const res = await request(createApp()).get("/api/me")
    expect(res.status).toBe(401)
  })

  it("returns the caller's profile when authenticated", async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: "user-1", email: "a@b.com" } },
      error: null,
    })
    singleMock.mockResolvedValue({
      data: { id: "user-1", full_name: "Jane Doe", account_type: "freelancer" },
      error: null,
    })

    const { createApp } = await import("../app.js")
    const res = await request(createApp())
      .get("/api/me")
      .set("Authorization", "Bearer good-token")

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ id: "user-1", full_name: "Jane Doe", account_type: "freelancer" })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx vitest run src/routes/me.test.ts`
Expected: FAIL — `Cannot find module '../routes/me.js'` (via app.ts not yet importing it) or 404 on `/api/me`

- [ ] **Step 3: Write the route implementation**

```typescript
// server/src/routes/me.ts
import { Router } from "express"
import { requireAuth } from "../middleware/auth.js"

const meRouter = Router()

meRouter.get("/", requireAuth, async (req, res) => {
  const { data, error } = await req.supabase!
    .from("profiles")
    .select("*")
    .eq("id", req.user!.id)
    .single()

  if (error || !data) {
    res.status(404).json({ error: "Profile not found" })
    return
  }

  res.json(data)
})

export default meRouter
```

- [ ] **Step 4: Mount the route in `server/src/app.ts`**

```typescript
// server/src/app.ts — add these two lines
import meRouter from "./routes/me.js"
// ...inside createApp(), after app.use(express.json()):
app.use("/api/me", meRouter)
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd server && npx vitest run src/routes/me.test.ts`
Expected: PASS

- [ ] **Step 6: Run the full server test suite**

Run: `cd server && npm test`
Expected: All tests PASS (health, supabase, auth, me)

- [ ] **Step 7: Commit**

```bash
git add server/src/routes/me.ts server/src/app.ts server/src/routes/me.test.ts
git commit -m "Add GET /api/me as the first RLS-scoped API route"
```

---

## Task 5: Scaffold `client/` — Vite + React + TypeScript

**Files:**
- Create: `client/package.json`
- Create: `client/tsconfig.json`
- Create: `client/tsconfig.node.json`
- Create: `client/vite.config.ts`
- Create: `client/index.html`
- Create: `client/.gitignore`
- Create: `client/.env.example`
- Create: `client/postcss.config.js`
- Create: `client/src/main.tsx`
- Create: `client/src/App.tsx`
- Create: `client/src/vite-env.d.ts`

**Interfaces:**
- Produces: `App` component (default export from `client/src/App.tsx`) that later tasks add routes to. `@/*` path alias resolves to `client/src/*` (configured in `vite.config.ts` and `tsconfig.json`) — matches the existing app's alias convention.

- [ ] **Step 1: Create `client/package.json`**

```json
{
  "name": "bizimi-client",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run"
  },
  "dependencies": {
    "@radix-ui/react-label": "^2.1.1",
    "@radix-ui/react-slot": "^1.1.1",
    "@supabase/supabase-js": "^2.45.4",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "framer-motion": "^12.38.0",
    "lucide-react": "^0.454.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "react-router-dom": "^6.28.0",
    "tailwind-merge": "^2.5.5"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.6.2",
    "@testing-library/react": "^16.0.1",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^4.3.2",
    "autoprefixer": "^10.4.20",
    "jsdom": "^25.0.1",
    "postcss": "^8.5.0",
    "tailwindcss": "^3.4.17",
    "tailwindcss-animate": "^1.0.7",
    "typescript": "^5.6.3",
    "vite": "^5.4.9",
    "vitest": "^2.1.2"
  }
}
```

- [ ] **Step 2: Create `client/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "Bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "react-jsx",
    "strict": true,
    "baseUrl": ".",
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

- [ ] **Step 3: Create `client/tsconfig.node.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "allowSyntheticDefaultImports": true
  },
  "include": ["vite.config.ts"]
}
```

- [ ] **Step 4: Create `client/vite.config.ts`**

```typescript
import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import path from "node:path"

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  server: { port: 5173 },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/test-setup.ts",
  },
})
```

- [ ] **Step 5: Create `client/src/test-setup.ts`**

```typescript
import "@testing-library/jest-dom/vitest"
```

- [ ] **Step 6: Create `client/index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Bizimi</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 7: Create `client/.gitignore`**

```
node_modules/
dist/
.env
```

- [ ] **Step 8: Create `client/.env.example`**

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_API_URL=http://localhost:4000
```

- [ ] **Step 9: Create `client/src/vite-env.d.ts`**

```typescript
/// <reference types="vite/client" />
```

- [ ] **Step 10: Create placeholder `client/src/App.tsx`**

```tsx
export default function App() {
  return <div>Bizimi</div>
}
```

- [ ] **Step 11: Create `client/src/main.tsx`**

```tsx
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import App from "./App"
import "./index.css"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
```

(`client/src/index.css` is created in Task 6 — `main.tsx` importing it now is intentional; Task 6 must land before this app runs, which it does since tasks execute in order.)

- [ ] **Step 12: Install dependencies**

Run: `cd client && npm install`
Expected: installs cleanly

- [ ] **Step 13: Commit**

```bash
git add client/
git commit -m "Scaffold Vite + React + TypeScript client"
```

---

## Task 6: Port design tokens (Tailwind config + global CSS)

**Files:**
- Create: `client/tailwind.config.ts`
- Create: `client/src/index.css`
- Create: `client/src/lib/utils.ts`
- Test: `client/src/lib/utils.test.ts`

**Interfaces:**
- Produces: `cn(...)` from `client/src/lib/utils.ts` (identical signature to the existing app's `lib/utils.ts`) — every UI component ported from here on imports it.

- [ ] **Step 1: Create `client/tailwind.config.ts`** (ported from root `tailwind.config.ts`, content globs adjusted)

```typescript
import type { Config } from "tailwindcss"

const config: Config = {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: { "2xl": "1400px" },
    },
    extend: {
      fontFamily: {
        sans: ["Inter", "sans-serif"],
        heading: ["Sora", "sans-serif"],
        display: ["ui-serif", "Georgia", "serif"],
        bricolage: ["ui-sans-serif", "system-ui", "sans-serif"],
      },
      colors: {
        border: "hsl(var(--border))",
        rule: "hsl(var(--rule))",
        divider: "hsl(var(--divider))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        paper: "hsl(var(--paper))",
        ink: "hsl(var(--ink))",
        oxblood: "hsl(var(--oxblood))",
        moss: "hsl(var(--moss))",
        surface: { DEFAULT: "hsl(var(--surface))", 2: "hsl(var(--surface-2))" },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
          hover: "hsl(var(--primary-hover))",
          soft: "hsl(var(--primary-soft))",
          border: "hsl(var(--primary-border))",
        },
        secondary: { DEFAULT: "hsl(var(--secondary))", foreground: "hsl(var(--secondary-foreground))" },
        success: { DEFAULT: "hsl(var(--success))", foreground: "hsl(var(--primary-foreground))" },
        warning: { DEFAULT: "hsl(var(--warning))", foreground: "hsl(var(--primary-foreground))" },
        info: { DEFAULT: "hsl(var(--info))", foreground: "hsl(var(--primary-foreground))" },
        destructive: { DEFAULT: "hsl(var(--destructive))", foreground: "hsl(var(--destructive-foreground))" },
        muted: { DEFAULT: "hsl(var(--muted))", foreground: "hsl(var(--muted-foreground))" },
        accent: { DEFAULT: "hsl(var(--accent))", foreground: "hsl(var(--accent-foreground))" },
        popover: { DEFAULT: "hsl(var(--popover))", foreground: "hsl(var(--popover-foreground))" },
        card: { DEFAULT: "hsl(var(--card))", foreground: "hsl(var(--card-foreground))" },
        aubergine: "hsl(var(--aubergine))",
        gold: "hsl(var(--gold))",
        jade: "hsl(var(--jade))",
        cream: "hsl(var(--cream))",
      },
      borderRadius: {
        "2xl": "var(--radius-2xl)",
        xl: "var(--radius-xl)",
        lg: "var(--radius-lg)",
        md: "var(--radius)",
        sm: "var(--radius-sm)",
      },
      keyframes: {
        marquee: { from: { transform: "translateX(0)" }, to: { transform: "translateX(-50%)" } },
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        marquee: "marquee 40s linear infinite",
        "fade-up": "fade-up 0.6s ease-out both",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config

export default config
```

- [ ] **Step 2: Create `client/postcss.config.js`**

```javascript
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
```

- [ ] **Step 3: Create `client/src/index.css`** (CSS custom properties ported verbatim from `app/globals.css`)

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --surface: 210 40% 98%;
    --surface-2: 210 40% 96.1%;
    --paper: 36 33% 97%;
    --ink: 0 0% 4%;
    --ink-deep: 220 13% 7%;
    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;
    --popover: 0 0% 100%;
    --popover-foreground: 222.2 84% 4.9%;
    --primary: 24.6 95% 53.1%;
    --primary-foreground: 0 0% 100%;
    --primary-hover: 20.1 89.1% 48.4%;
    --primary-soft: 33 100% 96.5%;
    --primary-border: 32 98% 83.3%;
    --oxblood: 358 50% 28%;
    --moss: 145 25% 30%;
    --secondary: 210 40% 96.1%;
    --secondary-foreground: 222.2 47.4% 11.2%;
    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --accent: 210 40% 96.1%;
    --accent-foreground: 222.2 47.4% 11.2%;
    --success: 142 71% 45%;
    --warning: 38 92% 50%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;
    --info: 221 83% 53%;
    --aubergine: 263 53% 12%;
    --gold: 43 96% 56%;
    --jade: 173 80% 26%;
    --cream: 32 67% 96%;
    --border: 220 13% 91%;
    --rule: 220 13% 85%;
    --divider: 215 14% 83%;
    --input: 220 13% 91%;
    --ring: 24.6 95% 53.1%;
    --radius-sm: 0.5rem;
    --radius: 0.75rem;
    --radius-lg: 1.25rem;
    --radius-xl: 1.5rem;
    --radius-2xl: 2rem;
  }

  * { @apply border-border; }
  body {
    @apply bg-background text-foreground antialiased selection:bg-primary/20 selection:text-primary;
    font-feature-settings: "ss01", "cv11";
  }
  :focus-visible {
    outline: 2px solid hsl(var(--ring));
    outline-offset: 2px;
    border-radius: 2px;
  }
}
```

(Dark-mode `.dark` overrides and the editorial `@layer components` utility classes from the original `app/globals.css` are intentionally deferred — they aren't used by the Landing/Login/Signup pages this slice ports. Port them when a later-phase page needs them, verbatim from `app/globals.css:90-114` and `:132-293`.)

- [ ] **Step 4: Write the failing test for `cn`**

```typescript
// client/src/lib/utils.test.ts
import { describe, it, expect } from "vitest"
import { cn } from "./utils"

describe("cn", () => {
  it("merges class names and resolves Tailwind conflicts", () => {
    expect(cn("px-2 py-1", "px-4")).toBe("py-1 px-4")
  })

  it("drops falsy values", () => {
    expect(cn("a", false, undefined, "b")).toBe("a b")
  })
})
```

- [ ] **Step 5: Run test to verify it fails**

Run: `cd client && npx vitest run src/lib/utils.test.ts`
Expected: FAIL — `Cannot find module './utils'`

- [ ] **Step 6: Create `client/src/lib/utils.ts`** (exact copy of `lib/utils.ts`)

```typescript
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

- [ ] **Step 7: Run test to verify it passes**

Run: `cd client && npx vitest run src/lib/utils.test.ts`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add client/tailwind.config.ts client/postcss.config.js client/src/index.css client/src/lib/utils.ts client/src/lib/utils.test.ts
git commit -m "Port design tokens and cn() utility to client"
```

---

## Task 7: Port shared UI primitives (Button, Input, Label, Card)

**Files:**
- Create: `client/src/components/ui/button.tsx`
- Create: `client/src/components/ui/input.tsx`
- Create: `client/src/components/ui/label.tsx`
- Create: `client/src/components/ui/card.tsx`
- Test: `client/src/components/ui/button.test.tsx`

**Interfaces:**
- Produces: `Button`, `Input`, `Label`, `Card`/`CardHeader`/`CardContent` — same names/props as the existing `components/ui/*`, imported by Login/Signup in Tasks 11–12.

- [ ] **Step 1: Create `client/src/components/ui/button.tsx`** (exact copy of `components/ui/button.tsx`)

```tsx
import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors active:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary-hover",
        ink: "bg-ink text-white hover:bg-foreground",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border border-border bg-card text-foreground hover:bg-paper hover:border-rule",
        secondary: "bg-surface-2 text-foreground hover:bg-muted",
        ghost: "text-foreground hover:bg-surface-2",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 px-5 py-2",
        sm: "h-9 px-3",
        lg: "h-12 px-7 text-sm",
        icon: "h-11 w-11",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
```

- [ ] **Step 2: Create `client/src/components/ui/input.tsx`** (exact copy of `components/ui/input.tsx`)

```tsx
import * as React from "react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-12 w-full rounded-md border border-input bg-transparent px-4 py-2 text-base font-medium shadow-sm transition-all file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/10 focus-visible:border-primary disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
```

- [ ] **Step 3: Create `client/src/components/ui/label.tsx`** (exact copy of `components/ui/label.tsx`, no `"use client"` directive — that's a Next.js-only marker and is dropped in every ported file from here on)

```tsx
import * as React from "react"
import * as LabelPrimitive from "@radix-ui/react-label"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const labelVariants = cva("text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70")

const Label = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root> & VariantProps<typeof labelVariants>
>(({ className, ...props }, ref) => (
  <LabelPrimitive.Root ref={ref} className={cn(labelVariants(), className)} {...props} />
))
Label.displayName = LabelPrimitive.Root.displayName

export { Label }
```

- [ ] **Step 4: Create `client/src/components/ui/card.tsx`** (exact copy of `components/ui/card.tsx`)

```tsx
import * as React from "react"

import { cn } from "@/lib/utils"

const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("rounded-lg border border-border bg-card text-card-foreground shadow-sm transition-all hover:shadow-md", className)} {...props} />
  )
)
Card.displayName = "Card"

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn("flex flex-col space-y-1.5 p-6", className)} {...props} />
)
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn("text-xl font-bold font-heading leading-none tracking-tight", className)} {...props} />
)
CardTitle.displayName = "CardTitle"

const CardDescription = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn("text-sm text-muted-foreground font-medium", className)} {...props} />
)
CardDescription.displayName = "CardDescription"

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
)
CardContent.displayName = "CardContent"

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn("flex items-center p-6 pt-0", className)} {...props} />
)
CardFooter.displayName = "CardFooter"

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter }
```

- [ ] **Step 5: Write a smoke test**

```tsx
// client/src/components/ui/button.test.tsx
import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { Button } from "./button"

describe("Button", () => {
  it("renders its children and applies the default variant class", () => {
    render(<Button>Click me</Button>)
    const btn = screen.getByRole("button", { name: "Click me" })
    expect(btn).toBeInTheDocument()
    expect(btn.className).toContain("bg-primary")
  })
})
```

- [ ] **Step 6: Run test**

Run: `cd client && npx vitest run src/components/ui/button.test.tsx`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add client/src/components/ui/
git commit -m "Port Button, Input, Label, Card UI primitives to client"
```

---

## Task 8: Supabase browser client + authenticated API fetch helper

**Files:**
- Create: `client/src/lib/supabase.ts`
- Create: `client/src/lib/api.ts`
- Test: `client/src/lib/api.test.ts`

**Interfaces:**
- Produces: `supabase` (Supabase JS client instance) from `client/src/lib/supabase.ts`; `apiFetch<T>(path: string, init?: RequestInit): Promise<T>` from `client/src/lib/api.ts`. Login/Signup (Tasks 11–12) use `supabase` directly for auth; any future page fetching from `server/` uses `apiFetch`.

- [ ] **Step 1: Create `client/src/lib/supabase.ts`**

```typescript
import { createClient } from "@supabase/supabase-js"

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)
```

- [ ] **Step 2: Write the failing test for `apiFetch`**

```typescript
// client/src/lib/api.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("./supabase", () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { access_token: "token-123" } },
      }),
    },
  },
}))

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ hello: "world" }),
    })
  )
})

describe("apiFetch", () => {
  it("attaches the session's bearer token and calls the API base URL", async () => {
    const { apiFetch } = await import("./api")
    const result = await apiFetch("/api/me")

    expect(fetch).toHaveBeenCalledWith(
      `${import.meta.env.VITE_API_URL}/api/me`,
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer token-123" }),
      })
    )
    expect(result).toEqual({ hello: "world" })
  })

  it("throws when the response is not ok", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 404, json: async () => ({ error: "Not found" }) })
    )
    const { apiFetch } = await import("./api")
    await expect(apiFetch("/api/me")).rejects.toThrow("Not found")
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd client && npx vitest run src/lib/api.test.ts`
Expected: FAIL — `Cannot find module './api'`

- [ ] **Step 4: Create `client/src/lib/api.ts`**

```typescript
import { supabase } from "./supabase"

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const {
    data: { session },
  } = await supabase.auth.getSession()

  const res = await fetch(`${import.meta.env.VITE_API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
      ...init.headers,
    },
  })

  const body = await res.json()

  if (!res.ok) {
    throw new Error(body.error ?? `Request to ${path} failed with ${res.status}`)
  }

  return body as T
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd client && npx vitest run src/lib/api.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add client/src/lib/supabase.ts client/src/lib/api.ts client/src/lib/api.test.ts
git commit -m "Add Supabase browser client and authenticated API fetch helper"
```

---

## Task 9: React Router shell

**Files:**
- Modify: `client/src/App.tsx`
- Test: `client/src/App.test.tsx`

**Interfaces:**
- Consumes: `Landing` (Task 10), `Login` (Task 11), `Signup` (Task 12) page components — this task wires the route table before those components exist, so it imports them by the paths those tasks will create (`./pages/Landing`, `./pages/Login`, `./pages/Signup`); this task is completed last among 9–12 in terms of running its test, or written now with the routes and left failing until Tasks 10–12 land. Follow project order: do Task 9's structure now, run its test after Task 12.

- [ ] **Step 1: Write `client/src/App.tsx` with the full route table**

```tsx
import { BrowserRouter, Routes, Route } from "react-router-dom"
import Landing from "./pages/Landing"
import Login from "./pages/Login"
import Signup from "./pages/Signup"

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
      </Routes>
    </BrowserRouter>
  )
}
```

- [ ] **Step 2: Write `client/src/App.test.tsx`**

```tsx
// client/src/App.test.tsx
import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { MemoryRouter, Routes, Route } from "react-router-dom"
import Landing from "./pages/Landing"
import Login from "./pages/Login"
import Signup from "./pages/Signup"

function renderAt(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
      </Routes>
    </MemoryRouter>
  )
}

describe("route table", () => {
  it("renders Landing at /", () => {
    renderAt("/")
    expect(screen.getByText(/Hire Nigeria's/i)).toBeInTheDocument()
  })

  it("renders Login at /login", () => {
    renderAt("/login")
    expect(screen.getByRole("heading", { name: /Continue your work/i })).toBeInTheDocument()
  })

  it("renders Signup at /signup", () => {
    renderAt("/signup")
    expect(screen.getByRole("heading", { name: /Start your journey/i })).toBeInTheDocument()
  })
})
```

This test can only pass once Tasks 10–12 exist — that's expected; leave it written now (App.tsx already imports the future page paths) and treat its green run as the acceptance check for Task 12, Step 6.

- [ ] **Step 3: Commit the route shell**

```bash
git add client/src/App.tsx client/src/App.test.tsx
git commit -m "Add React Router route table (Landing, Login, Signup)"
```

---

## Task 10: Landing page (Nav, Hero, FinalCTA, Footer)

**Files:**
- Create: `client/src/components/landing/Nav.tsx`
- Create: `client/src/components/landing/Hero.tsx`
- Create: `client/src/components/landing/FinalCTA.tsx`
- Create: `client/src/components/landing/LandingFooter.tsx`
- Create: `client/src/pages/Landing.tsx`
- Create: `client/public/images/avatars/avatar-1.jpg` … `avatar-4.jpg` (copy from `public/images/avatars/`)
- Create: `client/public/images/user.png` (copy from `public/images/user.png`)
- Test: `client/src/pages/Landing.test.tsx`

**Interfaces:**
- Produces: `Landing` default export from `client/src/pages/Landing.tsx`, consumed by `App.tsx` (Task 9).

**Note on scope:** the current landing page also has `StatsStrip`, `CategoriesMarquee`, `HowItWorks`, `FeaturedTalent`, `Testimonials`, `ForFreelancersBlock`, `LandingFAQ` sections (see `app/page.tsx:1-30`). Porting all of them isn't necessary to prove the architecture end-to-end — this task ports **Nav + Hero + FinalCTA + Footer** as a real, complete-feeling page, and the remaining sections are picked up in Phase 2 alongside the rest of the marketplace UI. This is a scope decision, not a placeholder — every file below is complete, working code.

- [ ] **Step 1: Copy image assets**

Run: `mkdir -p client/public/images/avatars` then copy `public/images/avatars/avatar-1.jpg` through `avatar-4.jpg` and `public/images/user.png` into the corresponding `client/public/images/` paths.

- [ ] **Step 2: Create `client/src/components/landing/Nav.tsx`** (ported from `components/landing/Nav.tsx`: `NextLink` → `Link` from `react-router-dom`, `href` → `to` on router links, `#anchor` links stay plain `<a>`)

```tsx
import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { Menu, X } from "lucide-react"

const links = [
  { href: "#how-it-works", label: "Hire talent" },
  { href: "#for-freelancers", label: "Find work" },
  { href: "#how-it-works", label: "How it works" },
]

export function Nav() {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  return (
    <nav
      className={`fixed top-0 w-full z-50 transition-all duration-300 ${
        scrolled || open
          ? "bg-cream/85 backdrop-blur-md border-b border-aubergine/5 py-3 shadow-sm"
          : "bg-transparent py-5"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
        <div className="flex items-center gap-10">
          <Link to="/" className="flex items-center space-x-2 group">
            <div className="w-10 h-10 bg-aubergine rounded-xl flex items-center justify-center shadow-lg shadow-aubergine/20">
              <span className="text-gold font-black text-xl font-heading">B</span>
            </div>
            <span className="text-2xl font-black tracking-tight text-ink font-heading">Bizimi</span>
          </Link>

          <div className="hidden md:flex items-center space-x-8">
            {links.map((l) => (
              <a key={l.label} href={l.href} className="text-sm font-bold text-ink/70 hover:text-primary transition-colors">
                {l.label}
              </a>
            ))}
            <Link to="/login" className="text-sm font-bold text-ink/70 hover:text-primary transition-colors">
              Sign in
            </Link>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/signup"
            className="hidden md:inline-flex bg-aubergine text-white rounded-full px-5 py-2.5 sm:px-6 sm:py-3 font-bold text-sm hover:bg-aubergine/90 transition-colors shadow-lg shadow-aubergine/20"
          >
            Get started →
          </Link>

          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label="Toggle menu"
            aria-expanded={open}
            className="md:hidden inline-flex items-center justify-center w-11 h-11 rounded-xl bg-aubergine text-white hover:bg-aubergine/90 transition-colors shadow-lg shadow-aubergine/20"
          >
            {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="md:hidden mx-4 mt-3 rounded-2xl border border-aubergine/10 bg-cream/95 backdrop-blur-md shadow-lg p-2">
          {links.map((l) => (
            <a
              key={l.label}
              href={l.href}
              onClick={() => setOpen(false)}
              className="block rounded-xl px-4 py-3 text-sm font-bold text-ink/80 hover:bg-aubergine/5 hover:text-primary transition-colors"
            >
              {l.label}
            </a>
          ))}
          <Link
            to="/login"
            onClick={() => setOpen(false)}
            className="block rounded-xl px-4 py-3 text-sm font-bold text-ink/80 hover:bg-aubergine/5 hover:text-primary transition-colors"
          >
            Sign in
          </Link>
          <Link
            to="/signup"
            onClick={() => setOpen(false)}
            className="mt-1 block rounded-xl bg-aubergine px-4 py-3 text-center text-sm font-bold text-white hover:bg-aubergine/90 transition-colors"
          >
            Get started →
          </Link>
        </div>
      )}
    </nav>
  )
}
```

- [ ] **Step 3: Create `client/src/components/landing/Hero.tsx`** (ported from `components/landing/Hero.tsx`: `NextLink` → `Link`, `next/image`'s `<Image fill>` → plain `<img className="absolute inset-0 h-full w-full object-contain ...">`, avatar `<Image>` → plain `<img>`)

```tsx
import { Link } from "react-router-dom"
import { motion } from "framer-motion"
import { ArrowRight, Lock, BadgeCheck } from "lucide-react"

export function Hero() {
  return (
    <section className="pt-32 pb-20 md:pt-40 md:pb-24 bg-cream overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-[1.1fr_0.9fr] gap-12 lg:gap-16 items-center">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
          className="space-y-8 text-center lg:text-left"
        >
          <div className="inline-flex items-center gap-2 bg-white border border-aubergine/15 px-4 py-1.5 rounded-full text-sm font-bold">
            <span className="w-2 h-2 bg-jade rounded-full" />
            <span className="text-ink">2,143 pros vetted this month</span>
          </div>

          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black font-heading text-ink leading-[0.95] tracking-[-0.04em]">
            Hire Nigeria's<br />best,{" "}
            <span className="relative inline-block">
              in hours.
              <svg className="absolute -bottom-2 left-0 w-full" viewBox="0 0 200 12" preserveAspectRatio="none" aria-hidden>
                <path d="M0 8 Q 50 0, 100 6 T 200 6" stroke="hsl(var(--primary))" strokeWidth="6" fill="none" strokeLinecap="round" />
              </svg>
            </span>
          </h1>

          <p className="text-lg sm:text-xl text-ink/70 font-medium leading-relaxed max-w-xl mx-auto lg:mx-0">
            Vetted designers, devs, writers and marketers — ready to start your project today. Payments held in secure escrow. Zero surprises.
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4 justify-center lg:justify-start">
            <Link to="/signup" className="group inline-flex items-center gap-2 bg-ink text-white rounded-2xl px-8 py-5 font-bold text-base hover:bg-aubergine transition-colors">
              Post a project
              <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link to="/freelancer/marketplace" className="inline-flex items-center gap-2 border-2 border-ink text-ink rounded-2xl px-8 py-5 font-bold text-base hover:bg-ink hover:text-white transition-colors">
              Browse talent
            </Link>
          </div>

          <div className="flex items-center gap-4 justify-center lg:justify-start pt-2">
            <div className="flex">
              {[1, 2, 3, 4].map((n, i) => (
                <img
                  key={n}
                  src={`/images/avatars/avatar-${n}.jpg`}
                  alt={`Bizimi member ${n}`}
                  width={40}
                  height={40}
                  className="w-10 h-10 rounded-full border-[3px] border-cream object-cover bg-cream"
                  style={{ marginLeft: i === 0 ? 0 : -10, zIndex: 4 - i }}
                />
              ))}
            </div>
            <p className="text-sm font-bold text-ink/60">
              <span className="text-gold">★★★★★</span> 4.9 from 1,200+ agencies
            </p>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="relative hidden lg:block"
        >
          <div className="relative h-[560px]">
            <div className="pointer-events-none absolute -top-10 -right-8 w-44 h-44 bg-gold rounded-full opacity-95" />
            <div className="pointer-events-none absolute -bottom-6 -left-8 w-40 h-40 bg-primary rounded-full" />
            <div className="pointer-events-none absolute top-[40%] right-[30%] w-20 h-20 bg-jade rounded-2xl rotate-12" />
            <div className="absolute inset-0 z-10 flex items-end justify-center -translate-y-8">
              <img
                src="/images/user.png"
                alt="Featured Bizimi freelancer"
                className="absolute inset-0 h-full w-full object-contain object-bottom scale-[1.3]"
                style={{
                  maskImage: "linear-gradient(to bottom, black 78%, transparent 100%)",
                  WebkitMaskImage: "linear-gradient(to bottom, black 78%, transparent 100%)",
                }}
              />
            </div>
          </div>

          <motion.div
            animate={{ y: [0, -12, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            className="absolute -left-8 -bottom-4 z-20 bg-white rounded-2xl p-4 w-[18rem] shadow-2xl shadow-aubergine/25"
          >
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-primary/30 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-extrabold text-ink">Emeka O.</span>
                  <BadgeCheck className="h-4 w-4 text-jade flex-shrink-0" />
                </div>
                <div className="text-xs text-ink/60 truncate">UI/UX Designer · Lagos</div>
              </div>
            </div>
            <div className="flex gap-1.5 mt-3">
              <span className="text-[11px] bg-cream text-aubergine px-2 py-0.5 rounded-md font-bold">Figma</span>
              <span className="text-[11px] bg-cream text-aubergine px-2 py-0.5 rounded-md font-bold">Webflow</span>
              <span className="text-[11px] bg-cream text-aubergine px-2 py-0.5 rounded-md font-bold">Brand</span>
            </div>
            <div className="flex justify-between items-center mt-3 pt-3 border-t border-ink/5">
              <div className="text-sm font-black text-ink">₦18k/hr</div>
              <div className="text-[11px] text-jade font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-jade rounded-full" /> Available now
              </div>
            </div>
          </motion.div>

          <motion.div
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut", delay: 0.8 }}
            className="absolute -right-4 top-12 z-20 bg-white rounded-2xl p-4 shadow-2xl shadow-aubergine/25 flex items-center gap-3"
          >
            <div className="w-10 h-10 bg-jade rounded-xl flex items-center justify-center">
              <Lock className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="text-xs font-extrabold text-ink">Escrow secured</div>
              <div className="text-[11px] text-ink/60">₦450,000 held</div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  )
}
```

- [ ] **Step 4: Create `client/src/components/landing/FinalCTA.tsx`** (ported from `components/landing/FinalCTA.tsx`: `NextLink` → `Link`)

```tsx
import { Link } from "react-router-dom"
import { ArrowRight } from "lucide-react"

export function FinalCTA() {
  return (
    <section className="bg-cream pb-24 md:pb-32">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative bg-white rounded-[2.5rem] md:rounded-[3rem] border border-aubergine/10 overflow-hidden text-center px-6 py-16 md:py-24">
          <div className="pointer-events-none absolute -top-10 -left-10 w-32 h-32 bg-gold rounded-full opacity-50" />
          <div className="pointer-events-none absolute -bottom-12 -right-8 w-28 h-28 bg-primary rounded-full opacity-50" />
          <div className="pointer-events-none absolute top-1/3 right-16 w-10 h-10 bg-jade rounded-xl rotate-12 opacity-60" />

          <div className="relative z-10 max-w-2xl mx-auto">
            <h2 className="font-heading font-black text-4xl md:text-6xl text-ink tracking-tight leading-[0.95]">
              Your next great hire is waiting.
            </h2>
            <p className="text-ink/60 font-medium text-lg leading-relaxed mt-6">
              Post a project free. Browse 2,000+ vetted Nigerian pros. Pay only when work ships.
            </p>
            <Link to="/signup" className="group inline-flex items-center gap-2 bg-ink text-white rounded-2xl px-8 py-5 font-black text-base hover:bg-aubergine transition-colors mt-8">
              Get started
              <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 5: Create `client/src/components/landing/LandingFooter.tsx`** (ported from `components/landing/LandingFooter.tsx`: `NextLink` → `Link`)

```tsx
import { Link } from "react-router-dom"
import { Globe, MessageCircle, ArrowUpRight } from "lucide-react"

export function LandingFooter() {
  return (
    <footer className="bg-cream border-t border-aubergine/10 py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-12">
        <div className="col-span-2 space-y-6">
          <Link to="/" className="flex items-center space-x-2">
            <div className="w-10 h-10 bg-aubergine rounded-xl flex items-center justify-center shadow-lg shadow-aubergine/20">
              <span className="text-gold font-black text-xl font-heading">B</span>
            </div>
            <span className="text-2xl font-black tracking-tight text-ink font-heading">Bizimi</span>
          </Link>
          <p className="text-ink/60 font-medium max-w-xs leading-relaxed">
            Nigeria's premier marketplace for elite freelancers and forward-thinking agencies.
          </p>
          <div className="flex gap-3">
            <div className="w-11 h-11 rounded-full bg-white border border-aubergine/10 flex items-center justify-center text-ink/60 hover:bg-aubergine hover:text-white hover:border-aubergine transition-all cursor-pointer">
              <Globe className="h-5 w-5" />
            </div>
            <div className="w-11 h-11 rounded-full bg-white border border-aubergine/10 flex items-center justify-center text-ink/60 hover:bg-aubergine hover:text-white hover:border-aubergine transition-all cursor-pointer">
              <MessageCircle className="h-5 w-5" />
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <h4 className="font-black text-ink uppercase tracking-widest text-xs">Categories</h4>
          <div className="space-y-3 font-bold text-sm">
            <Link to="#" className="block text-ink/60 hover:text-primary transition-colors">Programming</Link>
            <Link to="#" className="block text-ink/60 hover:text-primary transition-colors">Design</Link>
            <Link to="#" className="block text-ink/60 hover:text-primary transition-colors">Writing</Link>
            <Link to="#" className="block text-ink/60 hover:text-primary transition-colors">Marketing</Link>
          </div>
        </div>

        <div className="space-y-6">
          <h4 className="font-black text-ink uppercase tracking-widest text-xs">Company</h4>
          <div className="space-y-3 font-bold text-sm">
            <Link to="#" className="block text-ink/60 hover:text-primary transition-colors">About Us</Link>
            <Link to="#" className="block text-ink/60 hover:text-primary transition-colors">Careers</Link>
            <Link to="#" className="block text-ink/60 hover:text-primary transition-colors">Terms</Link>
            <Link to="#" className="block text-ink/60 hover:text-primary transition-colors">Privacy</Link>
          </div>
        </div>

        <div className="col-span-2 bg-white p-8 rounded-3xl border border-aubergine/10 space-y-5">
          <h4 className="font-black text-ink uppercase tracking-widest text-xs">Newsletter</h4>
          <p className="text-sm font-medium text-ink/60 leading-relaxed">
            Get the latest project opportunities and platform updates.
          </p>
          <div className="flex gap-2">
            <input
              type="email"
              className="flex-1 bg-cream border-none rounded-xl px-4 text-sm font-bold focus:ring-2 focus:ring-aubergine/20 outline-none h-11"
              placeholder="Email address"
            />
            <button type="button" className="bg-aubergine text-white rounded-xl px-4 h-11 flex items-center justify-center hover:bg-aubergine/90 transition-colors" aria-label="Subscribe">
              <ArrowUpRight className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-16 pt-8 border-t border-aubergine/10 text-center">
        <p className="text-sm font-bold text-ink/50">
          © {new Date().getFullYear()} Bizimi. All rights reserved. Built for the Nigerian creator economy.
        </p>
      </div>
    </footer>
  )
}
```

- [ ] **Step 6: Create `client/src/pages/Landing.tsx`**

```tsx
import { Nav } from "@/components/landing/Nav"
import { Hero } from "@/components/landing/Hero"
import { FinalCTA } from "@/components/landing/FinalCTA"
import { LandingFooter } from "@/components/landing/LandingFooter"

export default function Landing() {
  return (
    <div className="min-h-screen bg-cream font-sans selection:bg-primary/20 selection:text-primary">
      <Nav />
      <Hero />
      <FinalCTA />
      <LandingFooter />
    </div>
  )
}
```

- [ ] **Step 7: Write `client/src/pages/Landing.test.tsx`**

```tsx
import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import Landing from "./Landing"

describe("Landing", () => {
  it("renders the hero headline and primary CTAs", () => {
    render(
      <MemoryRouter>
        <Landing />
      </MemoryRouter>
    )
    expect(screen.getByText(/Hire Nigeria's/i)).toBeInTheDocument()
    expect(screen.getAllByRole("link", { name: /Get started/i }).length).toBeGreaterThan(0)
    expect(screen.getByRole("link", { name: /Sign in/i })).toHaveAttribute("href", "/login")
  })
})
```

- [ ] **Step 8: Run test**

Run: `cd client && npx vitest run src/pages/Landing.test.tsx`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add client/src/components/landing/ client/src/pages/Landing.tsx client/src/pages/Landing.test.tsx client/public/images/
git commit -m "Port landing page (Nav, Hero, FinalCTA, Footer) to client"
```

---

## Task 11: Login page

**Files:**
- Create: `client/src/pages/Login.tsx`
- Test: `client/src/pages/Login.test.tsx`

**Interfaces:**
- Consumes: `supabase` (Task 8), `Button`/`Input`/`Label` (Task 7).
- Produces: `Login` default export, consumed by `App.tsx` (Task 9).

**Note on scope:** ported from `app/login/page.tsx:1-223`. The "Forgot?" password flow (`components/forgot-password-modal.tsx`) is **not** ported in this task — it's a real feature this slice intentionally defers, not a simplification of what it does port. The button is kept but disabled with a tooltip-free `title` attribute pointing at that gap, so nothing dead-clicks silently.

- [ ] **Step 1: Write `client/src/pages/Login.tsx`** (ported from `app/login/page.tsx`: `next/link` → `react-router-dom` Link, `next/navigation`'s `useRouter().push` → `useNavigate()`, `"use client"` dropped, `ForgotPasswordModal` deferred per note above)

```tsx
import type React from "react"
import { useState } from "react"
import { useNavigate, Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Eye, EyeOff, Loader2, ArrowLeft, ArrowUpRight } from "lucide-react"
import { supabase } from "@/lib/supabase"

export default function Login() {
  const [showPassword, setShowPassword] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const navigate = useNavigate()
  const [isLoading, setIsLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password })

      if (authError) {
        if (authError.message.includes("Email not confirmed")) {
          alert("Please check your email and click the confirmation link before signing in.")
        } else {
          alert(`Login error: ${authError.message}`)
        }
        setIsLoading(false)
        return
      }

      if (authData.user) {
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", authData.user.id)
          .single()

        if (profileError || !profile) {
          alert("Profile not found. Please contact support or try signing up again.")
          setIsLoading(false)
          return
        }

        if (profile.account_type === "admin") navigate("/admin/dashboard")
        else if (profile.account_type === "agency") navigate("/agency/dashboard")
        else if (profile.account_type === "influencer") navigate("/influencer/dashboard")
        else navigate("/freelancer/dashboard")
      }
    } catch (error) {
      console.error("Unexpected login error:", error)
      alert("An unexpected error occurred. Please try again.")
    } finally {
      setTimeout(() => setIsLoading(false), 1000)
    }
  }

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] bg-cream font-sans">
      <aside className="relative hidden lg:flex flex-col justify-between p-12 xl:p-16 border-r border-ink/10">
        <Link to="/" className="inline-flex items-center gap-2 self-start text-sm font-bold text-ink/50 hover:text-ink transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Back to home
        </Link>

        <div className="max-w-lg space-y-6">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-10 h-10 bg-ink rounded-xl flex items-center justify-center">
              <span className="text-cream font-black text-lg font-heading">B</span>
            </div>
            <span className="text-2xl font-black tracking-tight text-ink font-heading">Bizimi</span>
          </Link>

          <p className="text-xs font-bold uppercase tracking-[0.2em] text-ink/40">Nigeria's freelance marketplace</p>

          <h1 className="text-5xl xl:text-6xl font-black font-heading text-ink leading-[0.95] tracking-[-0.04em]">
            Welcome{" "}
            <span className="relative inline-block">
              back.
              <svg className="absolute -bottom-2 left-0 w-full" viewBox="0 0 200 12" preserveAspectRatio="none" aria-hidden>
                <path d="M0 8 Q 50 0, 100 6 T 200 6" stroke="hsl(var(--primary))" strokeWidth="5" fill="none" strokeLinecap="round" />
              </svg>
            </span>
          </h1>

          <p className="text-lg text-ink/60 font-medium leading-relaxed max-w-md">
            The work hasn't stopped. Agencies have posted new briefs while you were away — let's get you to them.
          </p>
        </div>

        <p className="text-sm font-bold text-ink/40">Lagos · Abuja · Port Harcourt</p>
      </aside>

      <main className="flex flex-col justify-center bg-white p-8 sm:p-12 lg:p-16">
        <div className="w-full max-w-md mx-auto space-y-8">
          <div className="flex items-center justify-between lg:hidden">
            <Link to="/" className="flex items-center gap-2">
              <div className="w-10 h-10 bg-ink rounded-xl flex items-center justify-center">
                <span className="text-cream font-black text-lg font-heading">B</span>
              </div>
              <span className="text-xl font-black tracking-tight text-ink font-heading">Bizimi</span>
            </Link>
            <Link to="/" className="inline-flex items-center gap-1.5 text-sm font-bold text-ink/50 hover:text-ink">
              <ArrowLeft className="h-4 w-4" /> Home
            </Link>
          </div>

          <div className="space-y-2">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-ink/40">Sign in</span>
            <h2 className="text-4xl font-black font-heading text-ink tracking-[-0.03em]">Continue your work.</h2>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-xs font-bold uppercase tracking-[0.15em] text-ink/50">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="name@example.com"
                className="h-14 rounded-2xl border-2 border-ink/10 bg-white px-4 text-base shadow-none focus-visible:border-ink focus-visible:ring-0"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-xs font-bold uppercase tracking-[0.15em] text-ink/50">Password</Label>
                <button
                  type="button"
                  disabled
                  title="Password recovery is not yet available in this preview — deferred from Phase 0"
                  className="text-xs font-bold uppercase tracking-[0.15em] text-ink/30 cursor-not-allowed"
                >
                  Forgot?
                </button>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  className="h-14 rounded-2xl border-2 border-ink/10 bg-white px-4 pr-12 text-base shadow-none focus-visible:border-ink focus-visible:ring-0"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isLoading}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 h-8 w-8 text-ink/40 hover:text-ink transition-colors flex items-center justify-center"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={isLoading}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button type="submit" className="group w-full h-14 rounded-2xl bg-ink text-white hover:bg-aubergine text-base font-bold mt-2" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing you in…
                </>
              ) : (
                <>
                  Sign in
                  <ArrowUpRight className="ml-1.5 h-4 w-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                </>
              )}
            </Button>
          </form>

          <div className="pt-6 border-t border-ink/10">
            <p className="text-sm font-medium text-ink/60">
              New to Bizimi?{" "}
              <Link to="/signup" className="text-primary font-bold hover:underline underline-offset-4">
                Create an account
              </Link>
            </p>
          </div>

          <p className="text-xs font-medium text-ink/40">Encrypted in transit. Your credentials stay yours.</p>
        </div>
      </main>
    </div>
  )
}
```

- [ ] **Step 2: Write `client/src/pages/Login.test.tsx`**

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"

const navigateMock = vi.fn()
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom")
  return { ...actual, useNavigate: () => navigateMock }
})

const signInMock = vi.fn()
const singleMock = vi.fn()
vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: { signInWithPassword: signInMock },
    from: vi.fn(() => ({
      select: vi.fn(() => ({ eq: vi.fn(() => ({ single: singleMock })) })),
    })),
  },
}))

beforeEach(() => {
  navigateMock.mockClear()
  signInMock.mockReset()
  singleMock.mockReset()
})

describe("Login", () => {
  it("navigates to the agency dashboard after a successful agency sign-in", async () => {
    signInMock.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null })
    singleMock.mockResolvedValue({ data: { account_type: "agency" }, error: null })

    const { default: Login } = await import("./Login")
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    )

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "a@b.com" } })
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "secret123" } })
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }))

    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith("/agency/dashboard"))
  })
})
```

- [ ] **Step 3: Run test**

Run: `cd client && npx vitest run src/pages/Login.test.tsx`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/Login.tsx client/src/pages/Login.test.tsx
git commit -m "Port login page to client (password recovery deferred)"
```

---

## Task 12: Signup page

**Files:**
- Create: `client/src/lib/categories.ts` (copy of `lib/categories.ts`)
- Create: `client/src/lib/fbpixel.ts` (copy of `lib/fbpixel.ts`)
- Create: `client/src/pages/Signup.tsx`
- Test: `client/src/pages/Signup.test.tsx`

**Interfaces:**
- Consumes: `supabase` (Task 8), `Button`/`Input`/`Label`/`Card*` (Task 7), `ALL_SKILLS` from `client/src/lib/categories.ts`, `trackSignUp` from `client/src/lib/fbpixel.ts`.
- Produces: `Signup` default export, consumed by `App.tsx` (Task 9) — completes the route table, so this task's final step is running `App.test.tsx` (Task 9) green.

- [ ] **Step 1: Create `client/src/lib/categories.ts`** (exact copy of `lib/categories.ts` — 111 lines, no Next-specific code, copy verbatim)

Copy the full contents of `lib/categories.ts` (the `CATEGORIES` object, `Category` type, `ALL_CATEGORIES`, `getCategoryForSkill`, `getCategoriesForSkills`, `getSkillsForCategory`, `ALL_SKILLS`) unchanged into `client/src/lib/categories.ts`.

- [ ] **Step 2: Create `client/src/lib/fbpixel.ts`** (exact copy of `lib/fbpixel.ts`)

```typescript
export const fbq = (event: string, params?: Record<string, any>) => {
  if (typeof window !== "undefined" && (window as any).fbq) {
    ;(window as any).fbq("track", event, params)
  }
}

export const trackSignUp = () => fbq("CompleteRegistration")
export const trackPurchase = (value: number, currency = "USD") => fbq("Purchase", { value, currency })
export const trackLead = () => fbq("Lead")
```

- [ ] **Step 3: Create `client/src/pages/Signup.tsx`** (ported from `app/signup/page.tsx:1-493`: `next/link` → `react-router-dom` Link, `next/image` → plain `<img>`, `next/navigation`'s `useRouter` import removed — `router` was unused for navigation in the original beyond the import, confirm by keeping post-signup behavior identical: it shows a success message in place, no redirect, matching the original's actual runtime behavior)

```tsx
import type React from "react"
import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Eye, EyeOff, User, Building2, Loader2, CheckCircle, AlertCircle, X,
  ArrowLeft, ShieldCheck, Sparkles, Search, ChevronRight, ChevronLeft,
} from "lucide-react"
import { supabase } from "@/lib/supabase"
import { trackSignUp } from "@/lib/fbpixel"
import { ALL_SKILLS } from "@/lib/categories"

type AccountType = "freelancer" | "agency"

function handleSupabaseError(error: any): string {
  if (error.code === "PGRST116") return "Table does not exist. Please contact support."
  if (error.code === "23505") return "This email or username is already taken."
  if (error.code === "23503") return "Database constraint error. Please try again."
  if (error.code === "42501" || error.message?.includes("row-level security policy")) return "Permission denied. Please try again."
  return error.message || "An unexpected error occurred."
}

export default function Signup() {
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [accountType, setAccountType] = useState<AccountType>("freelancer")
  const [currentStep, setCurrentStep] = useState(1)
  const [isLoading, setIsLoading] = useState(false)

  const [signupStatus, setSignupStatus] = useState<{ type: "success" | "error" | "info" | null; message: string }>({
    type: null,
    message: "",
  })

  const [formData, setFormData] = useState({
    fullName: "", email: "", password: "", confirmPassword: "",
    username: "", companyName: "", companySize: "", socialHandle: "",
  })

  const [selectedSkills, setSelectedSkills] = useState<string[]>([])
  const [skillSearchTerm, setSkillSearchTerm] = useState("")
  const [refCode, setRefCode] = useState<string | null>(null)

  useEffect(() => {
    try {
      const fromUrl = new URLSearchParams(window.location.search).get("ref")
      const stored = sessionStorage.getItem("bizimi_ref")
      const code = (fromUrl || stored || "").trim()
      if (code) {
        setRefCode(code)
        sessionStorage.setItem("bizimi_ref", code)
      }
    } catch {
      /* sessionStorage / URL unavailable */
    }
  }, [])

  const handleSkillToggle = (skill: string) => {
    if (selectedSkills.includes(skill)) {
      setSelectedSkills(selectedSkills.filter((s) => s !== skill))
    } else if (selectedSkills.length < 10) {
      setSelectedSkills([...selectedSkills, skill])
    }
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    if (signupStatus.type === "error") setSignupStatus({ type: null, message: "" })
  }

  const steps = accountType === "freelancer" ? ["Account Type", "Details", "Skills", "Security"] : ["Account Type", "Details", "Security"]

  const validateCurrentStep = () => {
    if (currentStep === 1) return true

    if (currentStep === 2) {
      if (!formData.fullName.trim()) return false
      if (!formData.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) return false
      if (accountType === "freelancer" && !formData.username.trim()) return false
      if (accountType === "agency" && (!formData.companyName.trim() || !formData.companySize)) return false
      return true
    }

    if (accountType === "freelancer" && currentStep === 3) return selectedSkills.length > 0

    return formData.password.length >= 6 && formData.password === formData.confirmPassword
  }

  const handleNext = () => {
    if (validateCurrentStep()) {
      setCurrentStep((prev) => prev + 1)
      setSignupStatus({ type: null, message: "" })
    } else {
      setSignupStatus({ type: "error", message: "Please complete all required fields correctly." })
    }
  }

  const handleBack = () => {
    setCurrentStep((prev) => prev - 1)
    setSignupStatus({ type: null, message: "" })
  }

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateCurrentStep()) {
      setSignupStatus({ type: "error", message: "Please ensure your passwords match and are at least 6 characters." })
      return
    }

    setIsLoading(true)
    setSignupStatus({ type: "info", message: "Creating your account..." })

    try {
      const userMetadata = {
        full_name: formData.fullName.trim(),
        account_type: accountType,
        ...(accountType === "freelancer" && { username: formData.username.trim(), skills: selectedSkills }),
        ...(accountType === "agency" && { company_name: formData.companyName.trim(), company_size: formData.companySize }),
        ...(refCode ? { ref_code: refCode } : {}),
      }

      const redirectUrl = `${window.location.origin}/auth/callback`

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email.trim(),
        password: formData.password,
        options: { emailRedirectTo: redirectUrl, data: userMetadata },
      })

      if (authError) {
        let errorMessage = handleSupabaseError(authError)
        if (
          authError.message?.includes("User already registered") ||
          authError.message?.includes("email") ||
          authError.message?.includes("already") ||
          (authError as any).code === "user_already_exists"
        ) {
          errorMessage = "Sorry, email already registered"
        }
        setSignupStatus({ type: "error", message: errorMessage })
      } else if (authData.user) {
        trackSignUp()
        const successMessage =
          accountType === "freelancer"
            ? "🎉 Account created successfully! You've received 80 free credits! Please check your email to activate."
            : "✅ Account created successfully! Please check your email to activate your account."
        setSignupStatus({ type: "success", message: successMessage })
      }
    } catch (error) {
      console.error("💥 Unexpected signup error:", error)
      setSignupStatus({ type: "error", message: "An unexpected error occurred. Please try again." })
    } finally {
      setIsLoading(false)
    }
  }

  const filteredSkills = ALL_SKILLS.filter(
    (skill) => skill.toLowerCase().includes(skillSearchTerm.toLowerCase()) && !selectedSkills.includes(skill)
  )

  const isFinalStep = currentStep === steps.length

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-surface p-4 py-12 sm:py-16 selection:bg-primary/20 selection:text-primary">
      <Link to="/" className="fixed top-6 left-6 z-50 flex items-center text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to home
      </Link>

      <div className="w-full max-w-3xl space-y-6">
        <div className="space-y-2 text-center">
          <Link to="/" className="inline-flex items-center justify-center">
            <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl">
              <img src="/favicon.ico" alt="Bizimi Logo" width={48} height={48} className="h-full w-full object-contain" />
            </div>
          </Link>
          <h1 className="pt-2 text-3xl font-semibold tracking-tight text-foreground">Start your journey</h1>
          <p className="mx-auto max-w-md text-sm text-muted-foreground">
            Join the most secure marketplace for high-impact Nigerian talent.
          </p>
        </div>

        <Card className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
          <CardHeader className="px-6 sm:px-8 pt-8 pb-0">
            <div className="flex gap-2 mb-7">
              {steps.map((step, idx) => {
                const isActive = currentStep >= idx + 1
                return (
                  <div key={step} className="flex-1">
                    <div className={`h-1.5 rounded-full transition-colors duration-300 ${isActive ? "bg-primary" : "bg-surface-2"}`} />
                    <p className={`mt-2 text-[10px] font-semibold uppercase tracking-wider transition-colors duration-300 ${isActive ? "text-primary" : "text-muted-foreground"}`}>
                      {step}
                    </p>
                  </div>
                )
              })}
            </div>

            {signupStatus.type && (
              <div
                className={`mb-6 flex items-start gap-3 rounded-xl border p-3.5 text-left ${
                  signupStatus.type === "success"
                    ? "bg-success/10 border-success/20 text-success"
                    : signupStatus.type === "error"
                      ? "bg-destructive/10 border-destructive/20 text-destructive"
                      : "bg-primary/10 border-primary/20 text-primary"
                }`}
              >
                {signupStatus.type === "success" && <CheckCircle className="h-5 w-5 flex-shrink-0" />}
                {signupStatus.type === "error" && <AlertCircle className="h-5 w-5 flex-shrink-0" />}
                {signupStatus.type === "info" && <Loader2 className="h-5 w-5 flex-shrink-0 animate-spin" />}
                <p className="text-sm font-medium leading-snug">{signupStatus.message}</p>
              </div>
            )}
          </CardHeader>

          <CardContent className="px-6 sm:px-8 py-8">
            <form onSubmit={handleSignUp} className="space-y-8">
              {currentStep === 1 && (
                <div className="space-y-4">
                  <div className="space-y-1 mb-5">
                    <h2 className="text-xl font-semibold text-foreground">Choose account type</h2>
                    <p className="text-sm text-muted-foreground">How do you want to use Bizimi?</p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setAccountType("freelancer")}
                      className={`relative p-5 rounded-xl border text-left transition-all ${accountType === "freelancer" ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}
                    >
                      <div className={`mb-4 flex h-10 w-10 items-center justify-center rounded-xl ${accountType === "freelancer" ? "bg-primary text-white" : "bg-surface-2 text-muted-foreground"}`}>
                        <User className="h-5 w-5" />
                      </div>
                      <p className="font-semibold text-foreground">Freelancer</p>
                      <p className="mt-1 text-xs text-muted-foreground">I want to work and earn.</p>
                      {accountType === "freelancer" && (
                        <div className="absolute top-3.5 right-3.5 rounded-full bg-primary p-1 text-white">
                          <CheckCircle className="h-3 w-3" />
                        </div>
                      )}
                      <div className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-success/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-success">
                        <Sparkles className="h-3 w-3" />
                        80 Free Credits
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setAccountType("agency")}
                      className={`relative p-5 rounded-xl border text-left transition-all ${accountType === "agency" ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}
                    >
                      <div className={`mb-4 flex h-10 w-10 items-center justify-center rounded-xl ${accountType === "agency" ? "bg-primary text-white" : "bg-surface-2 text-muted-foreground"}`}>
                        <Building2 className="h-5 w-5" />
                      </div>
                      <p className="font-semibold text-foreground">Agency</p>
                      <p className="mt-1 text-xs text-muted-foreground">I want to hire talent.</p>
                      {accountType === "agency" && (
                        <div className="absolute top-3.5 right-3.5 rounded-full bg-primary p-1 text-white">
                          <CheckCircle className="h-3 w-3" />
                        </div>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {currentStep === 2 && (
                <div className="space-y-4">
                  <div className="space-y-1 mb-5">
                    <h2 className="text-xl font-semibold text-foreground">Personal details</h2>
                    <p className="text-sm text-muted-foreground">Tell us a bit about yourself.</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="fullName" className="text-sm font-medium text-foreground">Full name</Label>
                      <Input id="fullName" placeholder="John Doe" className="h-11" value={formData.fullName} onChange={(e) => handleInputChange("fullName", e.target.value)} required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-sm font-medium text-foreground">Email address</Label>
                      <Input id="email" type="email" placeholder="john@example.com" className="h-11" value={formData.email} onChange={(e) => handleInputChange("email", e.target.value)} required />
                    </div>
                  </div>

                  {accountType === "freelancer" && (
                    <div className="space-y-2">
                      <Label htmlFor="username" className="text-sm font-medium text-foreground">Username</Label>
                      <Input id="username" placeholder="johndoe_creative" className="h-11" value={formData.username} onChange={(e) => handleInputChange("username", e.target.value)} required />
                    </div>
                  )}

                  {accountType === "agency" && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="companyName" className="text-sm font-medium text-foreground">Company name</Label>
                        <Input id="companyName" placeholder="Bizimi Creative" className="h-11" value={formData.companyName} onChange={(e) => handleInputChange("companyName", e.target.value)} required />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="companySize" className="text-sm font-medium text-foreground">Company size</Label>
                        <select
                          id="companySize"
                          className="h-11 w-full rounded-md border border-border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                          value={formData.companySize}
                          onChange={(e) => handleInputChange("companySize", e.target.value)}
                          required
                        >
                          <option value="">Select size</option>
                          <option value="1-10">1-10 Employees</option>
                          <option value="11-50">11-50 Employees</option>
                          <option value="51-200">51-200 Employees</option>
                          <option value="200+">200+ Employees</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {currentStep === 3 && accountType === "freelancer" && (
                <div className="space-y-4">
                  <div className="space-y-1 mb-5">
                    <h2 className="text-xl font-semibold text-foreground">Your expertise</h2>
                    <p className="text-sm text-muted-foreground">Select up to 10 skills that define your work.</p>
                  </div>

                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Selected skills</Label>
                    <span className="text-xs font-semibold text-primary tabular-nums">{selectedSkills.length}/10</span>
                  </div>

                  <div className="flex min-h-[60px] flex-wrap gap-2 rounded-xl border border-border bg-surface-2 p-3">
                    {selectedSkills.length === 0 && <span className="m-2 text-xs italic text-muted-foreground">No skills selected yet.</span>}
                    {selectedSkills.map((skill) => (
                      <span key={skill} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-foreground">
                        {skill}
                        <button type="button" onClick={() => handleSkillToggle(skill)} className="text-muted-foreground transition-colors hover:text-destructive">
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>

                  <div className="relative">
                    <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input type="text" placeholder="Search skills (e.g. Web Development)" className="h-11 pl-10" value={skillSearchTerm} onChange={(e) => setSkillSearchTerm(e.target.value)} />
                  </div>

                  <div className="grid max-h-[160px] grid-cols-2 gap-2 overflow-y-auto rounded-xl border border-border bg-surface-2/60 p-2">
                    {filteredSkills.slice(0, 20).map((skill) => (
                      <button
                        key={skill}
                        type="button"
                        onClick={() => handleSkillToggle(skill)}
                        disabled={selectedSkills.length >= 10}
                        className="rounded-lg border border-border bg-card px-3 py-2 text-left text-xs font-medium transition-all hover:border-primary hover:text-primary disabled:opacity-40"
                      >
                        {skill}
                      </button>
                    ))}
                    {filteredSkills.length === 0 && (
                      <p className="col-span-2 py-4 text-center text-xs italic text-muted-foreground">No skills found matching your search</p>
                    )}
                  </div>
                </div>
              )}

              {isFinalStep && (
                <div className="space-y-4">
                  <div className="space-y-1 mb-5">
                    <h2 className="text-xl font-semibold text-foreground">Secure your account</h2>
                    <p className="text-sm text-muted-foreground">Choose a strong password to protect your data.</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="password" className="text-sm font-medium text-foreground">Password</Label>
                      <div className="relative">
                        <Input id="password" type={showPassword ? "text" : "password"} className="h-11 pr-11" value={formData.password} onChange={(e) => handleInputChange("password", e.target.value)} required minLength={6} />
                        <button type="button" className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setShowPassword(!showPassword)}>
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirmPassword" className="text-sm font-medium text-foreground">Confirm password</Label>
                      <div className="relative">
                        <Input id="confirmPassword" type={showConfirmPassword ? "text" : "password"} className="h-11 pr-11" value={formData.confirmPassword} onChange={(e) => handleInputChange("confirmPassword", e.target.value)} required />
                        <button type="button" className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setShowConfirmPassword(!showConfirmPassword)}>
                          {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-3 border-t border-border pt-5 mt-6">
                {currentStep > 1 && (
                  <Button type="button" variant="outline" onClick={handleBack} className="h-12 rounded-xl px-5 font-medium" disabled={isLoading || signupStatus.type === "success"}>
                    <ChevronLeft className="mr-1 h-4 w-4" /> Back
                  </Button>
                )}

                {!isFinalStep ? (
                  <Button type="button" onClick={handleNext} className="h-12 flex-1 rounded-xl bg-foreground text-base font-semibold text-background hover:bg-foreground/90" disabled={!validateCurrentStep()}>
                    Next step <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                ) : (
                  <Button type="submit" className="h-12 flex-1 rounded-xl bg-primary text-base font-semibold hover:bg-primary-hover" disabled={isLoading || !validateCurrentStep() || signupStatus.type === "success"}>
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Processing…
                      </>
                    ) : (
                      "Complete signup"
                    )}
                  </Button>
                )}
              </div>
            </form>

            <div className="mt-7 text-center">
              <p className="text-sm text-muted-foreground">
                Already have an account?{" "}
                <Link to="/login" className="font-medium text-primary hover:underline underline-offset-4">
                  Sign in instead
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center justify-center gap-2 pb-10 text-muted-foreground">
          <ShieldCheck className="h-4 w-4" />
          <span className="text-xs font-medium uppercase tracking-wide">Secure platform certification</span>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Write `client/src/pages/Signup.test.tsx`**

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"

vi.mock("@/lib/supabase", () => ({
  supabase: { auth: { signUp: vi.fn() } },
}))
vi.mock("@/lib/fbpixel", () => ({ trackSignUp: vi.fn() }))

beforeEach(() => {
  window.sessionStorage.clear()
})

describe("Signup", () => {
  it("starts on the account-type step and advances to details on Next", async () => {
    const { default: Signup } = await import("./Signup")
    render(
      <MemoryRouter>
        <Signup />
      </MemoryRouter>
    )

    expect(screen.getByRole("heading", { name: /Choose account type/i })).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: /Next step/i }))

    expect(screen.getByRole("heading", { name: /Personal details/i })).toBeInTheDocument()
  })

  it("shows the skills step for freelancers after details are valid", async () => {
    const { default: Signup } = await import("./Signup")
    render(
      <MemoryRouter>
        <Signup />
      </MemoryRouter>
    )

    fireEvent.click(screen.getByRole("button", { name: /Next step/i }))
    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: "Jane Doe" } })
    fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: "jane@example.com" } })
    fireEvent.change(screen.getByLabelText(/username/i), { target: { value: "janedoe" } })
    fireEvent.click(screen.getByRole("button", { name: /Next step/i }))

    expect(screen.getByRole("heading", { name: /Your expertise/i })).toBeInTheDocument()
  })
})
```

- [ ] **Step 5: Run test**

Run: `cd client && npx vitest run src/pages/Signup.test.tsx`
Expected: PASS

- [ ] **Step 6: Run the full client test suite, including the route table from Task 9**

Run: `cd client && npm test`
Expected: All tests PASS, including `src/App.test.tsx` (now that `Landing`, `Login`, `Signup` all exist)

- [ ] **Step 7: Commit**

```bash
git add client/src/lib/categories.ts client/src/lib/fbpixel.ts client/src/pages/Signup.tsx client/src/pages/Signup.test.tsx
git commit -m "Port signup wizard to client, completing the route table"
```

---

## Task 13: Wire environment files and verify end-to-end

**Files:**
- Create: `client/.env` (not committed — from `client/.env.example`)
- Create: `server/.env` (not committed — from `server/.env.example`)
- Create: `client/README.md`
- Create: `server/README.md`

**Interfaces:** none — this task is manual verification and documentation, no new code interfaces.

- [ ] **Step 1: Populate `server/.env`**

Copy `server/.env.example` to `server/.env`. Fill `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` with the same values already present in the root `.env.local` (`NEXT_PUBLIC_SUPABASE_URL` → `SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` → `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` → `SUPABASE_SERVICE_ROLE_KEY`). Leave `PORT=4000` and `CLIENT_ORIGIN=http://localhost:5173` as-is.

- [ ] **Step 2: Populate `client/.env`**

Copy `client/.env.example` to `client/.env`. Fill `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` with the same values as the root `.env.local`'s `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY`. Leave `VITE_API_URL=http://localhost:4000` as-is.

- [ ] **Step 3: Start both dev servers**

Run (two terminals): `cd server && npm run dev` and `cd client && npm run dev`
Expected: server logs `server listening on http://localhost:4000`; Vite logs the app is available at `http://localhost:5173`.

- [ ] **Step 4: Manual smoke test — landing, login, and the auth+RLS path**

1. Open `http://localhost:5173/` — landing page renders with Nav, Hero, FinalCTA, Footer.
2. Click "Sign in" — lands on `/login`.
3. Sign in with an existing account from the current app (same Supabase project, so existing users work).
4. Confirm the browser redirects per `account_type` (e.g. a freelancer account lands the app on `/freelancer/dashboard` — that route doesn't exist yet in `client/`, so this will 404 in the SPA; the important thing to verify is that the sign-in succeeded and the intended path is correct, not that the destination page renders — later phases add it).
5. In the browser console (still on the client app, now signed in), run:
   ```js
   const { data: { session } } = await window.supabase?.auth.getSession() // if not exposed, re-derive via the Network tab
   ```
   Simpler: open a new tab to confirm the token directly — run `fetch("http://localhost:4000/api/me", { headers: { Authorization: \`Bearer ${TOKEN}\` } }).then(r => r.json()).then(console.log)` in the DevTools console with the access token copied from `localStorage` (`sb-<project-ref>-auth-token`), and confirm it returns the signed-in user's `profiles` row — this is the proof that Bearer-token auth + the RLS-scoped Supabase client on the server work end-to-end.
6. Confirm `GET http://localhost:4000/api/me` with **no** `Authorization` header returns `401`.

- [ ] **Step 5: Create `server/README.md`**

```markdown
# Bizimi API (Node/Express)

New backend for the Bizimi React migration. Sits in front of the same Supabase project as the existing Next.js app — same tables, same RLS.

## Run

\`\`\`
cp .env.example .env   # fill in Supabase keys
npm install
npm run dev            # http://localhost:4000
\`\`\`

## Test

\`\`\`
npm test
\`\`\`

See `docs/superpowers/specs/2026-09-08-nextjs-to-react-node-migration-design.md` in the repo root for the full migration plan.
```

- [ ] **Step 6: Create `client/README.md`**

```markdown
# Bizimi Client (Vite + React)

New frontend for the Bizimi React migration. Talks to `server/` for data and directly to Supabase for auth.

## Run

\`\`\`
cp .env.example .env   # fill in Supabase keys + API URL
npm install
npm run dev             # http://localhost:5173
\`\`\`

## Test

\`\`\`
npm test
\`\`\`

See `docs/superpowers/specs/2026-09-08-nextjs-to-react-node-migration-design.md` in the repo root for the full migration plan.
```

- [ ] **Step 7: Commit the READMEs**

```bash
git add client/README.md server/README.md
git commit -m "Add run instructions for client and server"
```

(`.env` files are git-ignored per Tasks 1 and 5 — nothing to commit there.)

---

## Post-Phase-0 note

This plan covers Phase 0 only (spec's Section 7, row 0). Phases 1–7 — backend foundation for the rest of `app/actions/`, freelancer/agency core, credits/realtime, escrow (gated on the Supabase-side v2 migration finishing), admin/disputes/influencer, testing hardening, and deployment/cutover — each get their own implementation plan when picked up, following the same spec.
