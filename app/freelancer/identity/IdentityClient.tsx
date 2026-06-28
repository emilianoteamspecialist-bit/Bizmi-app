"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, AlertCircle, Clock, ShieldCheck, BadgeCheck, Lock } from "lucide-react"
import { supabase, handleSupabaseError } from "@/lib/supabase"
import { useAuth } from "@/contexts/AuthContext"

interface IdentityClientProps {
  initialVerification: {
    nin: string
    status: string
    created_at: string
  } | null
}

export default function IdentityClient({ initialVerification }: IdentityClientProps) {
  const { user } = useAuth()
  const [nin, setNin] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [existingVerification, setExistingVerification] = useState<{
    nin: string
    status: string
    created_at: string
  } | null>(initialVerification)
  const [checkingExisting, setCheckingExisting] = useState(false)
  const [status, setStatus] = useState<{
    type: "success" | "error" | null
    message: string
  }>({ type: null, message: "" })

  useEffect(() => {
    if (!user?.id) {
      return
    }
    // Initial verification data comes from the server (source of truth).
    // Only run the auto-verify timer for a pending record seeded from props.
    if (initialVerification?.status === "pending") {
      const createdAt = new Date(initialVerification.created_at)
      const now = new Date()
      const timeDiff = now.getTime() - createdAt.getTime()
      const oneMinute = 60 * 1000

      const verifyNow = async () => {
        const { error: updateError } = await supabase
          .from("freelancer_verification")
          .update({ status: "verified" })
          .eq("freelancer_id", user.id)

        if (!updateError) {
          setExistingVerification({ ...initialVerification, status: "verified" })
        }
      }

      if (timeDiff >= oneMinute) {
        verifyNow()
      } else {
        const remainingTime = oneMinute - timeDiff
        const timer = setTimeout(verifyNow, remainingTime)
        return () => clearTimeout(timer)
      }
    }
  }, [user?.id])

  const validateNin = (value: string) => {
    if (value.length !== 11) {
      return "NIN must be exactly 11 digits"
    }
    if (!/^\d+$/.test(value)) {
      return "NIN must contain only numbers"
    }
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setStatus({ type: null, message: "" })

    try {
      // Validate NIN
      const validationError = validateNin(nin)
      if (validationError) {
        setStatus({ type: "error", message: validationError })
        setIsLoading(false)
        return
      }

      if (!user) {
        setStatus({ type: "error", message: "Please log in to continue" })
        setIsLoading(false)
        return
      }

      // Check if NIN already exists in the system
      const { data: existingNin, error: checkError } = await supabase
        .from("freelancer_verification")
        .select("nin")
        .eq("nin", nin)
        .single()

      if (checkError && checkError.code !== "PGRST116") {
        console.error("Error checking NIN:", checkError)
        setStatus({ type: "error", message: "Error checking NIN. Please try again." })
        setIsLoading(false)
        return
      }

      if (existingNin) {
        setStatus({ type: "error", message: "NIN already exists in the system" })
        setIsLoading(false)
        return
      }

      // Insert NIN into freelancer_verification table
      const { error: insertError } = await supabase.from("freelancer_verification").insert({
        freelancer_id: user.id,
        nin: nin,
        status: "pending",
        created_at: new Date().toISOString(),
      })

      if (insertError) {
        console.error("Error inserting NIN:", insertError)
        const errorMessage = handleSupabaseError(insertError)
        setStatus({ type: "error", message: errorMessage })
      } else {
        setStatus({ type: "success", message: "NIN submitted successfully for verification!" })
        setNin("")

        const newVerification = {
          nin: nin,
          status: "pending",
          created_at: new Date().toISOString(),
        }
        setExistingVerification(newVerification)

        // Set timer to auto-verify after 1 minute
        setTimeout(async () => {
          const { error: updateError } = await supabase
            .from("freelancer_verification")
            .update({ status: "verified" })
            .eq("freelancer_id", user.id)

          if (!updateError) {
            setExistingVerification({ ...newVerification, status: "verified" })
          }
        }, 60000) // 1 minute
      }
    } catch (error) {
      console.error("Unexpected error:", error)
      setStatus({ type: "error", message: "An unexpected error occurred. Please try again." })
    } finally {
      setIsLoading(false)
    }
  }

  if (checkingExisting) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface pb-20">
      <div className="mx-auto max-w-xl px-4 sm:px-6 py-8 sm:py-12 space-y-6">
        {/* Header */}
        <header className="space-y-1 text-center">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Verification</p>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Identity verification</h1>
          <p className="text-sm text-muted-foreground">A verified badge helps agencies trust and hire you faster.</p>
        </header>

        {existingVerification?.status === "verified" ? (
          /* Verified */
          <div className="rounded-2xl border border-border bg-card p-8 text-center">
            <div className="mx-auto h-16 w-16 rounded-full bg-success/10 text-success flex items-center justify-center ring-8 ring-success/5">
              <ShieldCheck className="h-8 w-8" />
            </div>
            <h2 className="mt-5 text-lg font-semibold text-foreground">Identity verified</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              You&apos;re all set — bid and get hired with a verified badge on your profile.
            </p>
            <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-border bg-surface-2 px-4 py-2">
              <BadgeCheck className="h-4 w-4 text-success shrink-0" />
              <span className="text-sm font-medium text-foreground tabular-nums">NIN {existingVerification.nin}</span>
            </div>
          </div>
        ) : existingVerification ? (
          /* Pending */
          <div className="rounded-2xl border border-border bg-card p-8 text-center">
            <div className="mx-auto h-16 w-16 rounded-full bg-warning/10 text-warning flex items-center justify-center ring-8 ring-warning/5">
              <Clock className="h-8 w-8" />
            </div>
            <h2 className="mt-5 text-lg font-semibold text-foreground">Verification in progress</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              We&apos;re confirming your details — this usually takes a moment.
            </p>
            <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-border bg-surface-2 px-4 py-2">
              <Loader2 className="h-4 w-4 text-warning animate-spin shrink-0" />
              <span className="text-sm font-medium text-foreground tabular-nums">NIN {existingVerification.nin}</span>
            </div>
          </div>
        ) : (
          /* Form */
          <div className="rounded-2xl border border-border bg-card p-8 text-center">
            <div className="mx-auto h-14 w-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
              <ShieldCheck className="h-7 w-7" />
            </div>
            <h2 className="mt-5 text-lg font-semibold text-foreground">Verify your identity</h2>
            <p className="mt-1 text-sm text-muted-foreground max-w-sm mx-auto">
              Enter your 11-digit National Identity Number (NIN) to get verified.
            </p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4 text-left max-w-sm mx-auto">
              <div className="space-y-2">
                <Label htmlFor="nin" className="text-sm font-medium text-foreground">
                  National Identity Number (NIN)
                </Label>
                <Input
                  id="nin"
                  type="text"
                  inputMode="numeric"
                  placeholder="• • • • • • • • • • •"
                  value={nin}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, "").slice(0, 11)
                    setNin(value)
                    if (status.type === "error") {
                      setStatus({ type: null, message: "" })
                    }
                  }}
                  maxLength={11}
                  required
                  disabled={isLoading}
                  className="h-12 text-center text-lg font-medium tracking-[0.3em] tabular-nums"
                />
                <p className="text-xs text-muted-foreground text-center">{nin.length}/11 digits</p>
              </div>

              {status.type === "error" && (
                <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                  <span className="text-sm text-destructive">{status.message}</span>
                </div>
              )}

              <Button type="submit" className="w-full h-11" disabled={isLoading || nin.length !== 11}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Submitting…
                  </>
                ) : (
                  "Submit for verification"
                )}
              </Button>
            </form>

            <p className="mt-5 inline-flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
              <Lock className="h-3 w-3" /> Your NIN is encrypted and never shared.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
