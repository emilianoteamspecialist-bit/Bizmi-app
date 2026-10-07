import type React from "react"
import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Check, Eye, EyeOff, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { AuthShell, FormMessage } from "@/components/marketplace/AuthShell"
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
        setMessage("Password updated successfully. Taking you to sign in…")
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
      <AuthShell title="Set a new password">
        <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Checking your reset link…
        </p>
      </AuthShell>
    )
  }

  if (!isValidSession) {
    return (
      <AuthShell title="Set a new password">
        <div className="space-y-4">
          <FormMessage tone="error">{message}</FormMessage>
          <p className="text-sm text-muted-foreground">Reset links expire after a short time and work once. Request a new one from the sign-in page.</p>
          <Button onClick={() => navigate("/login")} className="w-full">
            Back to login
          </Button>
        </div>
      </AuthShell>
    )
  }

  const rules = [
    { label: "At least 8 characters", met: password.length >= 8 },
    { label: "An uppercase and a lowercase letter", met: /[a-z]/.test(password) && /[A-Z]/.test(password) },
    { label: "A number", met: /\d/.test(password) },
  ]

  return (
    <AuthShell title="Set a new password" description="Choose a password you haven't used on Bizimi before.">
      <form onSubmit={handleResetPassword} className="space-y-4">
        <PasswordInput id="password" label="New password" value={password} onChange={setPassword} shown={showPassword} onToggle={() => setShowPassword(!showPassword)} disabled={isLoading} />
        <ul className="space-y-1" aria-label="Password requirements">
          {rules.map((r) => (
            <li key={r.label} className={cn("flex items-center gap-1.5 text-xs", r.met ? "text-success" : "text-muted-foreground")}>
              <Check className={cn("h-3.5 w-3.5", !r.met && "opacity-30")} aria-hidden />
              {r.label}
              <span className="sr-only">{r.met ? " (met)" : " (not met)"}</span>
            </li>
          ))}
        </ul>
        <PasswordInput
          id="confirmPassword"
          label="Confirm new password"
          value={confirmPassword}
          onChange={setConfirmPassword}
          shown={showConfirmPassword}
          onToggle={() => setShowConfirmPassword(!showConfirmPassword)}
          disabled={isLoading}
        />

        {message && <FormMessage tone={isSuccess ? "success" : "error"}>{message}</FormMessage>}

        <Button type="submit" className="w-full" disabled={isLoading || !password || !confirmPassword}>
          {isLoading ? (
            <>
              <Loader2 className="animate-spin" /> Updating…
            </>
          ) : (
            "Update password"
          )}
        </Button>
        <Button type="button" variant="ghost" className="w-full" onClick={() => navigate("/login")} disabled={isLoading}>
          Back to login
        </Button>
      </form>
    </AuthShell>
  )
}

function PasswordInput({
  id,
  label,
  value,
  onChange,
  shown,
  onToggle,
  disabled,
}: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  shown: boolean
  onToggle: () => void
  disabled: boolean
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input id={id} type={shown ? "text" : "password"} autoComplete="new-password" value={value} onChange={(e) => onChange(e.target.value)} required disabled={disabled} className="pr-10" />
        <button
          type="button"
          className="absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded text-muted-foreground hover:text-foreground"
          onClick={onToggle}
          disabled={disabled}
          aria-label={shown ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
        >
          {shown ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  )
}
