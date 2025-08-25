"use client"

import type React from "react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Eye, EyeOff, Loader2 } from "lucide-react"
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
      // Sign in with Supabase
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
        // Get user profile to determine account type
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

        // Store user data in localStorage
        localStorage.setItem("bizimee_user", JSON.stringify(profile))

        // Redirect based on account type
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-orange-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-orange-500">Bizimi</CardTitle>
          <CardDescription>Welcome back! Sign in to your account</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isLoading}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={isLoading}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            {/* Forgot Password Link */}
            <div className="text-right">
              <button
                type="button"
                onClick={() => setShowForgotModal(true)}
                className="text-sm text-orange-500 hover:text-orange-600 hover:underline"
              >
                Forgot password?
              </button>
            </div>

            <Button type="submit" className="w-full bg-orange-500 hover:bg-orange-600" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                "Sign In"
              )}
            </Button>
          </form>

          <div className="mt-4 text-center text-sm">
            <span className="text-muted-foreground">{"Don't have an account? "}</span>
            <Link href="/signup" className="text-orange-500 hover:underline">
              Sign up
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Forgot Password Modal */}
      <ForgotPasswordModal isOpen={showForgotModal} onClose={() => setShowForgotModal(false)} />
    </div>
  )
}
