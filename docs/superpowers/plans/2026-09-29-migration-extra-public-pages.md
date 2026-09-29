# Extra Public Pages Port Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the two remaining public routes from the legacy Next.js app — `/reset-password` and `/contact` — that have no escrow dependency and were surfaced as unstarted-but-unblocked by `docs/react-node-migration-parity-checklist.md`. This is the first of several sub-plans covering that checklist's 9 unblocked legacy pages, following the same slicing convention as Phase 2/5 of this migration.

**Architecture:** Both pages are pure client components with no server route needed. `/reset-password` calls `supabase.auth.getSession()`/`updateUser()` directly against the existing `client/src/lib/supabase.ts` client (mirroring `Login.tsx`'s own direct-Supabase-call pattern, not a server round-trip). `/contact` is entirely static — no state, no API calls, just a page of `mailto:`/`wa.me` links.

**Tech Stack:** Vite + React 19 + React Router (client), Vitest + Testing Library.

**Spec:** No dedicated spec section — these are pages listed in `docs/platform-routes.md` under "Public / General Routes" that were never included in any of Phases 1-5's sub-plans. Legacy source: `app/reset-password/page.tsx`, `app/contact/page.tsx`.

## Global Constraints

- Both pages are unauthenticated, mounted at the top level of `App.tsx`'s route table (not wrapped in `RequireAuth`), matching `/login`/`/signup`'s existing convention.
- Reuse existing `client/src/components/ui/{button,input,label,card}.tsx` — all already exist, no new primitives needed.
- The legacy `/reset-password/page.tsx` imports `useSearchParams` from `next/navigation` but never actually uses the resulting `searchParams` value anywhere in the component body (confirmed by reading the full file) — this is dead code in the legacy version. Do not port it; the new page has no `useSearchParams` import at all.
- `/contact`'s two WhatsApp numbers and the support email are literal, real contact details from the legacy page — copy them exactly, do not placeholder them.

## Review Focus

- An expired/invalid password-reset link (no active Supabase session) must show the "Invalid or expired reset link" message and a working "Back to Login" button, not crash or hang on the loading state forever.
- Password validation (length, uppercase/lowercase/digit) must reject a weak password with the exact same rules as the legacy page, before ever calling `supabase.auth.updateUser()`.
- A password/confirm-password mismatch must be caught client-side before the Supabase call.
- A successful password update must show the success message and navigate to `/login` after the delay — not immediately, and not without the message.
- `/contact`'s three action links (email, two WhatsApp numbers) must render as real, clickable `<a>` tags with the exact legacy `href`s (including the WhatsApp `wa.me` URL-encoded message text), not placeholder buttons.

---

### Task 1: `/reset-password` page

**Files:**
- Create: `client/src/pages/ResetPassword.tsx`
- Create: `client/src/pages/ResetPassword.test.tsx`
- Modify: `client/src/App.tsx`

**Interfaces:**
- Consumes: `supabase` from `client/src/lib/supabase.ts` (existing); `Button`/`Input`/`Label`/`Card`/`CardContent`/`CardDescription`/`CardHeader`/`CardTitle` from `client/src/components/ui/` (existing).
- Produces: `ResetPassword` default export, wired at `/reset-password` in `App.tsx` — no other task in this plan depends on it.

- [ ] **Step 1: Write the failing tests**

Create `client/src/pages/ResetPassword.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Routes, Route } from "react-router-dom"

const getSessionMock = vi.fn()
const updateUserMock = vi.fn()
vi.mock("../lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: (...args: unknown[]) => getSessionMock(...args),
      updateUser: (...args: unknown[]) => updateUserMock(...args),
    },
  },
}))

import ResetPassword from "./ResetPassword"

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/reset-password"]}>
      <Routes>
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/login" element={<div>Login page</div>} />
      </Routes>
    </MemoryRouter>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("ResetPassword", () => {
  it("shows the invalid-link message and a working Back to Login button when there is no active session", async () => {
    getSessionMock.mockResolvedValue({ data: { session: null } })
    const user = userEvent.setup()
    renderPage()

    expect(await screen.findByText(/invalid or expired reset link/i)).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: /back to login/i }))
    expect(screen.getByText("Login page")).toBeInTheDocument()
  })

  it("rejects a password shorter than 8 characters before calling updateUser", async () => {
    getSessionMock.mockResolvedValue({ data: { session: { user: { id: "u1" } } } })
    const user = userEvent.setup()
    renderPage()
    await screen.findByLabelText(/new password/i)

    await user.type(screen.getByLabelText(/new password/i), "Ab1")
    await user.type(screen.getByLabelText(/confirm new password/i), "Ab1")
    await user.click(screen.getByRole("button", { name: /update password/i }))

    expect(await screen.findByText(/at least 8 characters/i)).toBeInTheDocument()
    expect(updateUserMock).not.toHaveBeenCalled()
  })

  it("rejects mismatched passwords before calling updateUser", async () => {
    getSessionMock.mockResolvedValue({ data: { session: { user: { id: "u1" } } } })
    const user = userEvent.setup()
    renderPage()
    await screen.findByLabelText(/new password/i)

    await user.type(screen.getByLabelText(/new password/i), "GoodPass1")
    await user.type(screen.getByLabelText(/confirm new password/i), "GoodPass2")
    await user.click(screen.getByRole("button", { name: /update password/i }))

    expect(await screen.findByText(/passwords do not match/i)).toBeInTheDocument()
    expect(updateUserMock).not.toHaveBeenCalled()
  })

  it("updates the password, shows success, and navigates to /login after the delay", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    getSessionMock.mockResolvedValue({ data: { session: { user: { id: "u1" } } } })
    updateUserMock.mockResolvedValue({ error: null })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderPage()
    await screen.findByLabelText(/new password/i)

    await user.type(screen.getByLabelText(/new password/i), "GoodPass1")
    await user.type(screen.getByLabelText(/confirm new password/i), "GoodPass1")
    await user.click(screen.getByRole("button", { name: /update password/i }))

    expect(await screen.findByText(/password updated successfully/i)).toBeInTheDocument()
    expect(updateUserMock).toHaveBeenCalledWith({ password: "GoodPass1" })

    vi.advanceTimersByTime(2000)
    expect(await screen.findByText("Login page")).toBeInTheDocument()
    vi.useRealTimers()
  })

  it("shows the Supabase error message when updateUser fails", async () => {
    getSessionMock.mockResolvedValue({ data: { session: { user: { id: "u1" } } } })
    updateUserMock.mockResolvedValue({ error: { message: "Session expired" } })
    const user = userEvent.setup()
    renderPage()
    await screen.findByLabelText(/new password/i)

    await user.type(screen.getByLabelText(/new password/i), "GoodPass1")
    await user.type(screen.getByLabelText(/confirm new password/i), "GoodPass1")
    await user.click(screen.getByRole("button", { name: /update password/i }))

    expect(await screen.findByText("Session expired")).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client && npx vitest run src/pages/ResetPassword.test.tsx`
Expected: FAIL — `./ResetPassword` does not exist.

- [ ] **Step 3: Implement the page**

Create `client/src/pages/ResetPassword.tsx`:

```tsx
import type React from "react"
import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Eye, EyeOff, Lock, CheckCircle, AlertCircle, Loader2 } from "lucide-react"
import { supabase } from "@/lib/supabase"

export default function ResetPassword() {
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState("")
  const [isSuccess, setIsSuccess] = useState(false)
  const [isValidSession, setIsValidSession] = useState(false)

  const navigate = useNavigate()

  useEffect(() => {
    const checkSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (session) {
        setIsValidSession(true)
      } else {
        setMessage("Invalid or expired reset link. Please request a new password reset.")
        setIsSuccess(false)
      }
    }

    checkSession()
  }, [])

  const validatePassword = (password: string) => {
    if (password.length < 8) {
      return "Password must be at least 8 characters long"
    }
    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
      return "Password must contain at least one uppercase letter, one lowercase letter, and one number"
    }
    return null
  }

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setMessage("")

    const passwordError = validatePassword(password)
    if (passwordError) {
      setMessage(passwordError)
      setIsSuccess(false)
      setIsLoading(false)
      return
    }

    if (password !== confirmPassword) {
      setMessage("Passwords do not match")
      setIsSuccess(false)
      setIsLoading(false)
      return
    }

    try {
      const { error } = await supabase.auth.updateUser({
        password: password,
      })

      if (error) {
        setMessage(error.message)
        setIsSuccess(false)
      } else {
        setMessage("Password updated successfully! Redirecting to login...")
        setIsSuccess(true)

        setTimeout(() => {
          navigate("/login")
        }, 2000)
      }
    } catch (error) {
      console.error("Reset password error:", error)
      setMessage("An unexpected error occurred. Please try again.")
      setIsSuccess(false)
    } finally {
      setIsLoading(false)
    }
  }

  if (!isValidSession && !message) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
        <div className="flex items-center space-x-2">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="text-slate-600 font-medium">Verifying reset link...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4 py-8 selection:bg-primary/20 selection:text-primary">
      <div className="w-full max-w-[440px]">
        <Card className="border-slate-200 shadow-2xl shadow-slate-200/50 rounded-[2rem] overflow-hidden bg-white">
          <CardHeader className="text-center space-y-2 pt-10 px-8">
            <div className="mx-auto w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-2">
              <Lock className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-2xl font-black text-slate-900 tracking-tight">Reset Password</CardTitle>
            <CardDescription className="text-slate-500 font-medium">Create a new secure password for your account</CardDescription>
          </CardHeader>

          <CardContent className="px-8 pb-10 space-y-6">
            {!isValidSession ? (
              <div className="text-center space-y-6">
                <div className="p-4 bg-red-50 border border-red-100 rounded-2xl">
                  <div className="flex items-center justify-center space-x-2">
                    <AlertCircle className="h-5 w-5 text-red-500" />
                    <span className="text-red-700 font-bold text-sm">{message}</span>
                  </div>
                </div>
                <Button onClick={() => navigate("/login")} className="w-full h-12 rounded-xl text-base">
                  Back to Login
                </Button>
              </div>
            ) : (
              <form onSubmit={handleResetPassword} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm font-bold text-slate-700">
                    New Password
                  </Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter new password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      disabled={isLoading}
                      className="pr-12 h-12 border-slate-200 rounded-xl"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 text-slate-400 hover:text-slate-600 hover:bg-transparent"
                      onClick={() => setShowPassword(!showPassword)}
                      disabled={isLoading}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="text-sm font-bold text-slate-700">
                    Confirm New Password
                  </Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="Confirm new password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      disabled={isLoading}
                      className="pr-12 h-12 border-slate-200 rounded-xl"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 text-slate-400 hover:text-slate-600 hover:bg-transparent"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      disabled={isLoading}
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-xs text-slate-500 font-medium space-y-2">
                  <p className="font-bold text-slate-700">Password Requirements:</p>
                  <ul className="list-disc list-inside space-y-1 ml-1">
                    <li>At least 8 characters long</li>
                    <li>One uppercase letter</li>
                    <li>One lowercase letter</li>
                    <li>One number</li>
                  </ul>
                </div>

                {message && (
                  <div
                    className={`p-4 rounded-2xl text-sm font-bold flex items-center space-x-2 ${
                      isSuccess
                        ? "bg-green-50 text-green-700 border border-green-100"
                        : "bg-red-50 text-red-700 border border-red-100"
                    }`}
                  >
                    {isSuccess ? <CheckCircle className="h-5 w-5 flex-shrink-0" /> : <AlertCircle className="h-5 w-5 flex-shrink-0" />}
                    <span>{message}</span>
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full h-12 rounded-xl text-base shadow-lg shadow-primary/25"
                  disabled={isLoading || !password || !confirmPassword}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    "Update Password"
                  )}
                </Button>

                <div className="text-center pt-2">
                  <Button
                    type="button"
                    variant="link"
                    onClick={() => navigate("/login")}
                    className="text-primary font-bold hover:underline underline-offset-4"
                    disabled={isLoading}
                  >
                    Back to Login
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd client && npx vitest run src/pages/ResetPassword.test.tsx`
Expected: PASS (5/5).

- [ ] **Step 5: Wire the route into `App.tsx`**

Edit `client/src/App.tsx` — add the import near the other page imports:

```ts
import ResetPassword from "./pages/ResetPassword"
```

and add the route (unauthenticated, alongside `/login`/`/signup`, before the catch-all):

```tsx
            <Route path="/reset-password" element={<ResetPassword />} />
```

- [ ] **Step 6: Commit**

```bash
git add client/src/pages/ResetPassword.tsx client/src/pages/ResetPassword.test.tsx client/src/App.tsx
git commit -m "feat(client): port /reset-password"
```

---

### Task 2: `/contact` page

**Files:**
- Create: `client/src/pages/Contact.tsx`
- Create: `client/src/pages/Contact.test.tsx`
- Modify: `client/src/App.tsx`

**Interfaces:**
- Consumes: `Button`/`Card`/`CardContent`/`CardDescription`/`CardHeader`/`CardTitle` from `client/src/components/ui/` (existing).
- Produces: `Contact` default export, wired at `/contact` in `App.tsx`.

- [ ] **Step 1: Write the failing tests**

Create `client/src/pages/Contact.test.tsx`:

```tsx
import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import Contact from "./Contact"

function renderPage() {
  return render(
    <MemoryRouter>
      <Contact />
    </MemoryRouter>
  )
}

describe("Contact", () => {
  it("renders a mailto link to the support email", () => {
    renderPage()
    const link = screen.getByRole("link", { name: /email us/i })
    expect(link).toHaveAttribute("href", "mailto:bizimi@gmail.com")
  })

  it("renders WhatsApp links for both contacts with the correct numbers", () => {
    renderPage()
    const mubarack = screen.getByRole("link", { name: /chat with mubarack/i })
    expect(mubarack).toHaveAttribute("href", expect.stringContaining("https://wa.me/2347052345295"))

    const emiliano = screen.getByRole("link", { name: /chat with emiliano/i })
    expect(emiliano).toHaveAttribute("href", expect.stringContaining("https://wa.me/2347052345296"))
  })

  it("renders the page heading", () => {
    renderPage()
    expect(screen.getByRole("heading", { name: /contact us/i })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client && npx vitest run src/pages/Contact.test.tsx`
Expected: FAIL — `./Contact` does not exist.

- [ ] **Step 3: Implement the page**

Create `client/src/pages/Contact.tsx`:

```tsx
import { Mail, MessageCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function Contact() {
  const getWhatsAppHref = (phoneNumber: string, name: string) => {
    const message = encodeURIComponent(`Hello ${name}, I need assistance with Bizimi platform.`)
    return `https://wa.me/${phoneNumber}?text=${message}`
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 to-white">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-slate-900 mb-4">Contact Us</h1>
            <p className="text-xl text-slate-600 max-w-2xl mx-auto">
              Need help or have questions? We're here to assist you. Reach out to us through any of the channels below.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 mb-12">
            <Card className="hover:shadow-lg transition-shadow duration-300 border-primary/20">
              <CardHeader className="text-center">
                <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                  <Mail className="h-8 w-8 text-primary" />
                </div>
                <CardTitle className="text-xl text-slate-900">Email Support</CardTitle>
                <CardDescription>Send us an email and we'll get back to you within 24 hours</CardDescription>
              </CardHeader>
              <CardContent className="text-center">
                <Button asChild className="w-full bg-primary hover:bg-primary-hover text-white">
                  <a href="mailto:bizimi@gmail.com" target="_blank" rel="noopener noreferrer">
                    <Mail className="mr-2 h-4 w-4" />
                    Email Us
                  </a>
                </Button>
                <p className="text-sm text-slate-500 mt-2">bizimi@gmail.com</p>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow duration-300 border-primary/20">
              <CardHeader className="text-center">
                <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                  <MessageCircle className="h-8 w-8 text-green-500" />
                </div>
                <CardTitle className="text-xl text-slate-900">WhatsApp - Mubarack</CardTitle>
                <CardDescription>Chat with Mubarack for immediate assistance</CardDescription>
              </CardHeader>
              <CardContent className="text-center">
                <Button asChild className="w-full bg-green-500 hover:bg-green-600 text-white">
                  <a href={getWhatsAppHref("2347052345295", "Mubarack")} target="_blank" rel="noopener noreferrer">
                    <MessageCircle className="mr-2 h-4 w-4" />
                    Chat with Mubarack
                  </a>
                </Button>
                <p className="text-sm text-slate-500 mt-2">+234 705 234 5295</p>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow duration-300 border-primary/20">
              <CardHeader className="text-center">
                <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                  <MessageCircle className="h-8 w-8 text-green-500" />
                </div>
                <CardTitle className="text-xl text-slate-900">WhatsApp - Emiliano</CardTitle>
                <CardDescription>Chat with Emiliano for technical support</CardDescription>
              </CardHeader>
              <CardContent className="text-center">
                <Button asChild className="w-full bg-green-500 hover:bg-green-600 text-white">
                  <a href={getWhatsAppHref("2347052345296", "Emiliano")} target="_blank" rel="noopener noreferrer">
                    <MessageCircle className="mr-2 h-4 w-4" />
                    Chat with Emiliano
                  </a>
                </Button>
                <p className="text-sm text-slate-500 mt-2">+234 705 234 5296</p>
              </CardContent>
            </Card>
          </div>

          <div className="bg-white rounded-lg shadow-md p-8 border border-primary/20">
            <h2 className="text-2xl font-semibold text-slate-900 mb-4 text-center">How We Can Help</h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-semibold text-primary mb-2">For Freelancers</h3>
                <ul className="text-slate-600 space-y-1">
                  <li>• Account setup and verification</li>
                  <li>• Proposal submission help</li>
                  <li>• Payment and payout assistance</li>
                  <li>• Profile optimization tips</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold text-primary mb-2">For Agencies</h3>
                <ul className="text-slate-600 space-y-1">
                  <li>• Job posting guidance</li>
                  <li>• Freelancer selection process</li>
                  <li>• Payment and funding support</li>
                  <li>• Platform feature tutorials</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="text-center mt-8">
            <p className="text-slate-600">
              <strong>Response Times:</strong> Email within 24 hours • WhatsApp within 2 hours during business hours
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd client && npx vitest run src/pages/Contact.test.tsx`
Expected: PASS (3/3).

- [ ] **Step 5: Wire the route into `App.tsx`**

Edit `client/src/App.tsx` — add the import:

```ts
import Contact from "./pages/Contact"
```

and add the route:

```tsx
            <Route path="/contact" element={<Contact />} />
```

- [ ] **Step 6: Run the full client suite and typecheck**

Run: `cd client && npx vitest run` and `cd client && npx tsc --noEmit`
Expected: all tests pass, no type errors.

- [ ] **Step 7: Commit**

```bash
git add client/src/pages/Contact.tsx client/src/pages/Contact.test.tsx client/src/App.tsx
git commit -m "feat(client): port /contact"
```
