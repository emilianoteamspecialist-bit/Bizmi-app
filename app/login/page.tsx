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
        else if (profile.account_type === "influencer") router.push("/influencer/dashboard")
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
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] bg-cream font-sans">
      {/* LEFT — landing-style poster */}
      <aside className="relative hidden lg:flex flex-col justify-between p-12 xl:p-16 border-r border-ink/10">
        <Link
          href="/"
          className="inline-flex items-center gap-2 self-start text-sm font-bold text-ink/50 hover:text-ink transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to home
        </Link>

        <div className="max-w-lg space-y-6">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-10 h-10 bg-ink rounded-xl flex items-center justify-center">
              <span className="text-cream font-black text-lg font-heading">B</span>
            </div>
            <span className="text-2xl font-black tracking-tight text-ink font-heading">Bizimi</span>
          </Link>

          <p className="text-xs font-bold uppercase tracking-[0.2em] text-ink/40">
            Nigeria&apos;s freelance marketplace
          </p>

          <h1 className="text-5xl xl:text-6xl font-black font-heading text-ink leading-[0.95] tracking-[-0.04em]">
            Welcome{" "}
            <span className="relative inline-block">
              back.
              <svg
                className="absolute -bottom-2 left-0 w-full"
                viewBox="0 0 200 12"
                preserveAspectRatio="none"
                aria-hidden
              >
                <path d="M0 8 Q 50 0, 100 6 T 200 6" stroke="hsl(var(--primary))" strokeWidth="5" fill="none" strokeLinecap="round" />
              </svg>
            </span>
          </h1>

          <p className="text-lg text-ink/60 font-medium leading-relaxed max-w-md">
            The work hasn&apos;t stopped. Agencies have posted new briefs while you were away — let&apos;s get you to them.
          </p>
        </div>

        <p className="text-sm font-bold text-ink/40">Lagos · Abuja · Port Harcourt</p>
      </aside>

      {/* RIGHT — form */}
      <main className="flex flex-col justify-center bg-white p-8 sm:p-12 lg:p-16">
        <div className="w-full max-w-md mx-auto space-y-8">
          {/* mobile-only logo + back link */}
          <div className="flex items-center justify-between lg:hidden">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-10 h-10 bg-ink rounded-xl flex items-center justify-center">
                <span className="text-cream font-black text-lg font-heading">B</span>
              </div>
              <span className="text-xl font-black tracking-tight text-ink font-heading">Bizimi</span>
            </Link>
            <Link href="/" className="inline-flex items-center gap-1.5 text-sm font-bold text-ink/50 hover:text-ink">
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
                  onClick={() => setShowForgotModal(true)}
                  className="text-xs font-bold uppercase tracking-[0.15em] text-primary hover:text-primary-hover"
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

            <Button
              type="submit"
              className="group w-full h-14 rounded-2xl bg-ink text-white hover:bg-aubergine text-base font-bold mt-2"
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
                  <ArrowUpRight className="ml-1.5 h-4 w-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                </>
              )}
            </Button>
          </form>

          <div className="pt-6 border-t border-ink/10">
            <p className="text-sm font-medium text-ink/60">
              New to Bizimi?{" "}
              <Link
                href="/signup"
                className="text-primary font-bold hover:underline underline-offset-4"
              >
                Create an account
              </Link>
            </p>
          </div>

          <p className="text-xs font-medium text-ink/40">Encrypted in transit. Your credentials stay yours.</p>
        </div>
      </main>

      <ForgotPasswordModal isOpen={showForgotModal} onClose={() => setShowForgotModal(false)} />
    </div>
  )
}
