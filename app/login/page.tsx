"use client"

import type React from "react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Eye, EyeOff, Loader2, ArrowLeft, ShieldCheck } from "lucide-react"
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
        email: email,
        password: password,
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

        localStorage.setItem("bizimee_user", JSON.stringify(profile))

        if (profile.account_type === "agency") {
          router.push("/agency/dashboard")
        } else {
          router.push("/dashboard")
        }
      }
    } catch (error) {
      console.error("Login error:", error)
      alert("An unexpected error occurred. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4 selection:bg-orange-100 selection:text-orange-900">
      {/* Back to Home Link */}
      <Link 
        href="/" 
        className="absolute top-8 left-8 flex items-center text-sm font-bold text-slate-500 hover:text-orange-500"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Home
      </Link>

      <div className="w-full max-w-[440px] space-y-8">
        {/* Logo and Welcome */}
        <div className="text-center space-y-2">
          <Link href="/" className="inline-flex items-center space-x-2 group">
            <div className="w-12 h-12 bg-orange-500 rounded-2xl flex items-center justify-center shadow-lg shadow-orange-500/20">
              <span className="text-white font-bold text-2xl">B</span>
            </div>
          </Link>
          <h1 className="text-3xl font-black tracking-tight text-slate-900 pt-4">Welcome Back</h1>
          <p className="text-slate-500 font-medium">Continue your journey with Nigeria's best talent.</p>
        </div>

        <Card className="border-slate-200 shadow-2xl shadow-slate-200/50 rounded-[2rem] overflow-hidden bg-white">
          <CardHeader className="space-y-1 pb-4 pt-8 px-8">
            <CardTitle className="text-xl font-bold flex items-center gap-2">
              Sign In
            </CardTitle>
            <CardDescription className="text-slate-400 font-medium">Enter your credentials to access your dashboard.</CardDescription>
          </CardHeader>
          <CardContent className="px-8 pb-10">
            <form onSubmit={handleLogin} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-bold text-slate-700">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="name@example.com"
                  className="h-12 border-slate-200 rounded-xl focus:ring-orange-500 focus:border-orange-500"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-sm font-bold text-slate-700">Password</Label>
                  <button
                    type="button"
                    onClick={() => setShowForgotModal(true)}
                    className="text-xs font-bold text-orange-500 hover:text-orange-600"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    className="h-12 border-slate-200 rounded-xl focus:ring-orange-500 focus:border-orange-500 pr-12"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={isLoading}
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

              <Button 
                type="submit" 
                className="w-full bg-orange-500 hover:bg-orange-600 h-12 rounded-xl text-base font-bold shadow-lg shadow-orange-500/25 mt-2" 
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Authenticating...
                  </>
                ) : (
                  "Sign In to Dashboard"
                )}
              </Button>
            </form>

            <div className="mt-8 text-center">
              <p className="text-sm font-medium text-slate-500">
                New to Bizimi?{" "}
                <Link href="/signup" className="text-orange-500 font-bold hover:underline underline-offset-4">
                  Create an account
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>
        
        {/* Security Trust Footer */}
        <div className="flex items-center justify-center gap-2 text-slate-400">
          <ShieldCheck className="h-4 w-4" />
          <span className="text-xs font-bold uppercase tracking-widest">Secure SSL Encrypted Connection</span>
        </div>
      </div>

      {/* Forgot Password Modal */}
      <ForgotPasswordModal isOpen={showForgotModal} onClose={() => setShowForgotModal(false)} />
    </div>
  )
}
