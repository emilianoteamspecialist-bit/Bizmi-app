import type React from "react"
import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Loader2 } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AuthShell, FormMessage } from "@/components/marketplace/AuthShell"

export default function AdminLogin() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password })

      if (authError) throw authError

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role, account_type")
        .eq("id", data.user!.id)
        .single()

      const isAdmin = profile?.role === "admin" || profile?.account_type === "admin"
      if (profileError || !isAdmin) {
        await supabase.auth.signOut()
        throw new Error("Access denied. Admin privileges required.")
      }

      navigate("/admin/dashboard")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell title="Admin sign in" description="For Bizimi staff. Admin actions are recorded in the audit log.">
      <form onSubmit={handleLogin} className="space-y-4" noValidate>
        {error && <FormMessage tone="error">{error}</FormMessage>}
        <div className="space-y-1.5">
          <Label htmlFor="email">Email address</Label>
          <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@bizimi.com" required disabled={loading} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required disabled={loading} />
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="animate-spin" /> Signing in…
            </>
          ) : (
            "Sign in"
          )}
        </Button>
      </form>
    </AuthShell>
  )
}
