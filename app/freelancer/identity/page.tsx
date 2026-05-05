"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, CheckCircle, AlertCircle, Clock } from "lucide-react"
import { supabase, handleSupabaseError } from "@/lib/supabase"

export default function IdentityPage() {
  const [nin, setNin] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [existingVerification, setExistingVerification] = useState<{
    nin: string
    status: string
    created_at: string
  } | null>(null)
  const [checkingExisting, setCheckingExisting] = useState(true)
  const [status, setStatus] = useState<{
    type: "success" | "error" | null
    message: string
  }>({ type: null, message: "" })

  useEffect(() => {
    checkExistingVerification()
  }, [])

  const checkExistingVerification = async () => {
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError || !user) {
        setCheckingExisting(false)
        return
      }

      // Check if user already has a verification record
      const { data: verification, error: checkError } = await supabase
        .from("freelancer_verification")
        .select("nin, status, created_at")
        .eq("freelancer_id", user.id)
        .single()

      if (checkError && checkError.code !== "PGRST116") {
        console.error("Error checking existing verification:", checkError)
        setCheckingExisting(false)
        return
      }

      if (verification) {
        setExistingVerification(verification)

        // If status is pending, check if 1 minute has passed
        if (verification.status === "pending") {
          const createdAt = new Date(verification.created_at)
          const now = new Date()
          const timeDiff = now.getTime() - createdAt.getTime()
          const oneMinute = 60 * 1000 // 1 minute in milliseconds

          if (timeDiff >= oneMinute) {
            // Update status to verified
            const { error: updateError } = await supabase
              .from("freelancer_verification")
              .update({ status: "verified" })
              .eq("freelancer_id", user.id)

            if (!updateError) {
              setExistingVerification({ ...verification, status: "verified" })
            }
          } else {
            // Set up timer to auto-verify after remaining time
            const remainingTime = oneMinute - timeDiff
            setTimeout(async () => {
              const { error: updateError } = await supabase
                .from("freelancer_verification")
                .update({ status: "verified" })
                .eq("freelancer_id", user.id)

              if (!updateError) {
                setExistingVerification({ ...verification, status: "verified" })
              }
            }, remainingTime)
          }
        }
      }
    } catch (error) {
      console.error("Error checking existing verification:", error)
    } finally {
      setCheckingExisting(false)
    }
  }

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

      // Get current user
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()
      if (userError || !user) {
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
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
        <div className="max-w-2xl mx-auto p-6 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">

      <div className="max-w-2xl mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-slate-900 dark:text-white">Identity Verification</CardTitle>
            <CardDescription>Please provide your National Identity Number (NIN) for verification</CardDescription>

            {existingVerification && (
              <div
                className={`rounded-lg p-4 mt-4 ${
                  existingVerification.status === "verified"
                    ? "bg-green-50 border border-green-200"
                    : "bg-yellow-50 border border-yellow-200"
                }`}
              >
                <div className="flex items-center gap-2">
                  {existingVerification.status === "verified" ? (
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  ) : (
                    <Clock className="h-5 w-5 text-yellow-600" />
                  )}
                  <div>
                    <p
                      className={`font-medium ${
                        existingVerification.status === "verified" ? "text-green-700" : "text-yellow-700"
                      }`}
                    >
                      {existingVerification.status === "verified" ? "Verification Complete" : "Verification Pending"}
                    </p>
                    <p
                      className={`text-sm ${
                        existingVerification.status === "verified" ? "text-green-600" : "text-yellow-600"
                      }`}
                    >
                      NIN: {existingVerification.nin}
                      {existingVerification.status === "pending" && " -In progress..."}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {status.type && (
              <div
                className={`rounded-lg p-3 flex items-start gap-2 mt-4 ${
                  status.type === "success" ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"
                }`}
              >
                {status.type === "success" && <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />}
                {status.type === "error" && <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />}
                <span className={`text-sm ${status.type === "success" ? "text-green-700" : "text-red-700"}`}>
                  {status.message}
                </span>
              </div>
            )}
          </CardHeader>

          <CardContent>
            {!existingVerification ? (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="nin">National Identity Number (NIN) *</Label>
                  <Input
                    id="nin"
                    type="text"
                    placeholder="Enter your 11-digit NIN"
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
                    className="text-lg tracking-wider"
                  />
                  <p className="text-sm text-slate-600">Your NIN must be exactly 11 digits</p>
                </div>

                <Button
                  type="submit"
                  className="w-full bg-primary hover:bg-primary-hover disabled:bg-gray-400"
                  disabled={isLoading || nin.length !== 11}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    "Submit for Verification"
                  )}
                </Button>
              </form>
            ) : (
              <div className="text-center py-8">
                <p className="text-slate-600">
                  {existingVerification.status === "verified"
                    ? "Your identity has been successfully verified."
                    : "Your NIN has been submitted and is being processed."}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
