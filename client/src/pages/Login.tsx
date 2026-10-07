import type React from "react"
import { useState } from "react"
import { useNavigate, Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Eye, EyeOff, Loader2 } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { AuthShell, FormMessage } from "@/components/marketplace/AuthShell"
import ForgotPasswordModal from "../components/ForgotPasswordModal"

export default function Login() {
  const [showPassword, setShowPassword] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const navigate = useNavigate()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [showForgotModal, setShowForgotModal] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password })

      if (authError) {
        setError(
          authError.message.includes("Email not confirmed")
            ? "Confirm your email first: open the link we sent you, then sign in."
            : authError.message.includes("Invalid login credentials")
              ? "That email and password don't match. Check them and try again."
              : authError.message
        )
        setIsLoading(false)
        return
      }

      if (authData.user) {
        const { data: profile, error: profileError } = await supabase.from("profiles").select("*").eq("id", authData.user.id).single()

        if (profileError || !profile) {
          setError("We couldn't find a profile for this account. Contact support, or sign up again.")
          setIsLoading(false)
          return
        }

        if (profile.account_type === "admin") navigate("/admin/dashboard")
        else if (profile.account_type === "agency") navigate("/agency/dashboard")
        else if (profile.account_type === "influencer") navigate("/influencer/dashboard")
        else navigate("/freelancer/dashboard")
      }
    } catch (err) {
      console.error("Unexpected login error:", err)
      setError("Something went wrong signing you in. Check your connection and try again.")
    } finally {
      setTimeout(() => setIsLoading(false), 1000)
    }
  }

  return (
    <AuthShell
      title="Sign in to Bizimi"
      description="Pick up where you left off."
      topRight={
        <>
          New here?{" "}
          <Link to="/signup" className="font-medium text-primary hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={handleLogin} className="space-y-4">
        {error && <FormMessage tone="error">{error}</FormMessage>}

        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="name@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={isLoading}
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <button type="button" onClick={() => setShowForgotModal(true)} className="text-sm font-medium text-primary hover:underline">
              Forgot?
            </button>
          </div>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              className="pr-10"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isLoading}
            />
            <button
              type="button"
              className="absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded text-muted-foreground hover:text-foreground"
              onClick={() => setShowPassword(!showPassword)}
              disabled={isLoading}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="animate-spin" /> Signing in…
            </>
          ) : (
            "Sign in"
          )}
        </Button>
      </form>

      <ForgotPasswordModal isOpen={showForgotModal} onClose={() => setShowForgotModal(false)} />
    </AuthShell>
  )
}
