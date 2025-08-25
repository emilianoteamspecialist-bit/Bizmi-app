"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { X, DollarSign, User, Briefcase, AlertCircle, Loader2 } from "lucide-react"
import { toast } from "sonner"

interface PaymentModalProps {
  isOpen: boolean
  onClose: () => void
  jobData: {
    id: string
    title: string
    freelancer: {
      id: string
      name: string
      email: string
    }
    amount: number
  }
  onSuccess: () => void
}

export default function PaymentModal({ isOpen, onClose, jobData, onSuccess }: PaymentModalProps) {
  const [amount, setAmount] = useState("")
  const [referenceId, setReferenceId] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [isCheckingReference, setIsCheckingReference] = useState(false)
  const [referenceExists, setReferenceExists] = useState(false)
  const [referenceError, setReferenceError] = useState("")

  useEffect(() => {
    const getCurrentUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      setCurrentUser(user)
    }
    getCurrentUser()
  }, [])

  // Debounced reference ID check
  useEffect(() => {
    if (!referenceId.trim()) {
      setReferenceExists(false)
      setReferenceError("")
      return
    }

    const timeoutId = setTimeout(async () => {
      setIsCheckingReference(true)
      setReferenceError("")

      try {
        const { data, error } = await supabase
          .from("Funded_jobs101")
          .select("id")
          .eq("reference_id", referenceId.trim())
          .limit(1)

        if (error) {
          console.error("Error checking reference ID:", error)
          setReferenceError("Error checking reference ID")
          return
        }

        if (data && data.length > 0) {
          setReferenceExists(true)
          setReferenceError("This reference ID already exists. Please use a unique reference ID.")
        } else {
          setReferenceExists(false)
          setReferenceError("")
        }
      } catch (error) {
        console.error("Error checking reference ID:", error)
        setReferenceError("Error checking reference ID")
      } finally {
        setIsCheckingReference(false)
      }
    }, 500)

    return () => clearTimeout(timeoutId)
  }, [referenceId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!amount || !referenceId) {
      toast.error("Please fill in all fields")
      return
    }

    if (referenceExists) {
      toast.error("Please use a unique reference ID")
      return
    }

    if (isCheckingReference) {
      toast.error("Please wait while we verify the reference ID")
      return
    }

    setIsSubmitting(true)

    try {
      if (!currentUser) {
        toast.error("User not authenticated")
        return
      }

      // Get agency profile
      const { data: agencyProfile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", currentUser.id)
        .single()

      // Insert funded job record
      const { error: insertError } = await supabase.from("Funded_jobs101").insert({
        job_id: jobData.id,
        agency_id: currentUser.id,
        freelancer_id: jobData.freelancer.id,
        agency_name: agencyProfile?.full_name || "Unknown Agency",
        job_title: jobData.title,
        amount: Number.parseFloat(amount),
        reference_id: referenceId.trim(),
        status: "pending_verification",
        funded_at: new Date().toISOString(),
        job_confirmed: false,
        job_completed: false,
      })

      if (insertError) {
        console.error("Error inserting funded job:", insertError)
        toast.error("Failed to fund job")
        return
      }

      toast.success("Job funded successfully! Freelancer can now verify the payment.")
      onSuccess()
      onClose()

      // Reset form
      setAmount("")
      setReferenceId("")
    } catch (error) {
      console.error("Error funding job:", error)
      toast.error("Failed to fund job")
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md max-h-[90vh] overflow-y-auto">
        <CardHeader className="relative">
          <Button
            variant="ghost"
            size="sm"
            className="absolute right-2 top-2"
            onClick={onClose}
            disabled={isSubmitting}
          >
            <X className="h-4 w-4" />
          </Button>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-orange-500" />
            Fund Job
          </CardTitle>
          <CardDescription>Fund this job for the freelancer to start working</CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Job Details */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-gray-500" />
              <span className="font-medium">{jobData.title}</span>
            </div>
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-gray-500" />
              <span className="text-sm text-gray-600">
                {jobData.freelancer.name} ({jobData.freelancer.email})
              </span>
            </div>
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-gray-500" />
              <span className="text-sm text-gray-600">Suggested Amount: ₦{jobData.amount.toLocaleString()}</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Amount (₦)</Label>
              <Input
                id="amount"
                type="number"
                placeholder="Enter amount to fund"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                min="1"
                step="0.01"
                required
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="referenceId">Payment Reference ID</Label>
              <div className="relative">
                <Input
                  id="referenceId"
                  type="text"
                  placeholder="Enter payment reference ID"
                  value={referenceId}
                  onChange={(e) => setReferenceId(e.target.value)}
                  required
                  disabled={isSubmitting}
                  className={`${
                    referenceExists ? "border-red-500 focus:border-red-500" : ""
                  } ${isCheckingReference ? "pr-8" : ""}`}
                />
                {isCheckingReference && (
                  <Loader2 className="absolute right-2 top-1/2 transform -translate-y-1/2 h-4 w-4 animate-spin text-gray-400" />
                )}
              </div>
              {referenceError && (
                <div className="flex items-center gap-1 text-sm text-red-600">
                  <AlertCircle className="h-3 w-3" />
                  {referenceError}
                </div>
              )}
              {!referenceError && referenceId && !isCheckingReference && !referenceExists && (
                <div className="flex items-center gap-1 text-sm text-green-600">
                  <span>✓ Reference ID is available</span>
                </div>
              )}
            </div>

            <div className="bg-blue-50 p-3 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Note:</strong> Make sure you have completed the payment transaction and have the correct
                reference ID before submitting. The freelancer will verify this payment.
              </p>
            </div>

            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isSubmitting}
                className="flex-1 bg-transparent"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || referenceExists || isCheckingReference || !referenceId.trim()}
                className="flex-1 bg-orange-500 hover:bg-orange-600"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Funding...
                  </>
                ) : (
                  "Fund Job"
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
