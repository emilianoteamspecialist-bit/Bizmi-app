"use client"

import type React from "react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Eye, EyeOff, Loader2, ArrowLeft, ArrowUpRight } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import ForgotPasswordModal from "@/components/forgot-password-modal"

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [showForgotModal, setShowForgotModal] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

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

        if (profile.account_type === "admin") router.push("/admin/dashboard")
        else if (profile.account_type === "agency") router.push("/agency/dashboard")
        else router.push("/freelancer/dashboard")
      }
    } catch (error) {
      console.error("Unexpected login error:", error)
      alert("An unexpected error occurred. Please try again.")
    } finally {
      setTimeout(() => setIsLoading(false), 1000)
    }
  }

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-12 bg-surface">
      {/* LEFT — editorial poster */}
      <aside className="lg:col-span-7 grain surface-paper relative flex flex-col p-8 sm:p-12 lg:p-16 hairline-b lg:border-b-0 lg:border-r lg:border-border">
        <Link
          href="/"
          className="link-quiet self-start animate-fade-up"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to home
        </Link>

        <div className="flex-1 flex flex-col justify-center max-w-2xl space-y-5 py-12 lg:py-0 animate-fade-up delay-100">
          <p className="eyebrow">Bizimi · Nigeria's freelance marketplace</p>
          <h1 className="display-2xl">
            Welcome
            <span className="italic text-muted-foreground/60"> back.</span>
          </h1>
          <p className="lede">
            The work hasn't stopped. Agencies have posted new briefs while you were away — let's get you to them.
          </p>
        </div>

        <div className="flex items-center justify-between gap-4 animate-fade-up delay-200">
          <p className="marginalia">
            Edition · {new Date().toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" })}
          </p>
          <p className="caption">Lagos · Abuja · Port Harcourt</p>
        </div>
      </aside>

      {/* RIGHT — form */}
      <main className="lg:col-span-5 flex flex-col p-8 sm:p-12 lg:p-16 justify-center bg-card animate-fade-up delay-300">
        <div className="w-full max-w-md mx-auto space-y-8">
          <div className="space-y-2">
            <p className="eyebrow">Sign in</p>
            <h2 className="display-md">Continue your work.</h2>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email" className="eyebrow">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="name@example.com"
                className="h-11 bg-transparent border-0 border-b border-border rounded-none focus-visible:ring-0 px-0 shadow-none text-base"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="eyebrow">Password</Label>
                <button
                  type="button"
                  onClick={() => setShowForgotModal(true)}
                  className="text-[11px] uppercase tracking-[0.18em] font-medium text-primary hover:text-primary-hover"
                >
                  Forgot?
                </button>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  className="h-11 bg-transparent border-0 border-b border-border rounded-none focus-visible:ring-0 px-0 pr-9 shadow-none text-base"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isLoading}
                />
                <button
                  type="button"
                  className="absolute right-0 top-1/2 -translate-y-1/2 h-8 w-8 text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={isLoading}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-12 text-sm font-bold mt-2"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing you in…
                </>
              ) : (
                <>
                  Sign in
                  <ArrowUpRight className="ml-1.5 h-4 w-4" />
                </>
              )}
            </Button>
          </form>

          <div className="hairline pt-6">
            <p className="body-muted">
              New to Bizimi?{" "}
              <Link
                href="/signup"
                className="text-primary font-medium hover:underline underline-offset-4"
              >
                Create an account
              </Link>
            </p>
          </div>

          <p className="caption">Encrypted in transit. Your credentials stay yours.</p>
        </div>
      </main>

      <ForgotPasswordModal isOpen={showForgotModal} onClose={() => setShowForgotModal(false)} />
    </div>
  )
}
