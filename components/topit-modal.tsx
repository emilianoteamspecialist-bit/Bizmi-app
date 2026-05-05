"use client"

import { useState, useEffect } from "react"
import type React from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, AlertCircle, Coins, X, CheckCircle } from "lucide-react"
import { supabase } from "@/lib/supabase"

interface TopItModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export default function TopItModal({ isOpen, onClose, onSuccess }: TopItModalProps) {
  const [amountPaid, setAmountPaid] = useState("")
  const [reference, setReference] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [userId, setUserId] = useState<string | null>(null)

  const CREDITS_RATE = 50 // ₦50 per credit (10 credits = ₦500)
  const MIN_AMOUNT = 500 // Minimum ₦500 (10 credits)

  useEffect(() => {
    const getCurrentUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (user) {
        setUserId(user.id)
      }
    }

    if (isOpen) {
      getCurrentUser()
    }
  }, [isOpen])

  const calculateCredits = (amount: number) => {
    return Math.floor(amount / CREDITS_RATE)
  }

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setSuccess("")

    const amount = Number.parseFloat(amountPaid)

    if (!amount || amount < MIN_AMOUNT) {
      setError(`Minimum amount is ₦${MIN_AMOUNT.toLocaleString()}`)
      return
    }

    if (!reference.trim()) {
      setError("Reference ID is required")
      return
    }

    if (!userId) {
      setError("User not authenticated. Please refresh and try again.")
      return
    }

    setLoading(true)

    try {
      console.log("[v0] Checking if reference already exists:", reference)

      const [purchaseCheck, fundedJobsCheck] = await Promise.all([
        supabase.from("purchase_credits").select("id").eq("paystack_reference", reference).single(),
        supabase.from("Funded_jobs101").select("id").eq("reference_id", reference).single(),
      ])

      // Check if reference exists in purchase_credits table
      if (purchaseCheck.error && purchaseCheck.error.code !== "PGRST116") {
        console.error("[v0] Error checking purchase_credits reference:", purchaseCheck.error)
        throw new Error("Failed to check reference ID")
      }

      // Check if reference exists in Funded_jobs101 table
      if (fundedJobsCheck.error && fundedJobsCheck.error.code !== "PGRST116") {
        console.error("[v0] Error checking Funded_jobs101 reference:", fundedJobsCheck.error)
        throw new Error("Failed to check reference ID")
      }

      // If reference exists in either table, show error
      if (purchaseCheck.data || fundedJobsCheck.data) {
        setError("This reference ID has already been used and cannot be used again.")
        return
      }

      const credits_amount = calculateCredits(amount)

      console.log("[v0] Verifying payment with reference:", reference)
      const response = await fetch("/api/verify-transaction", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ user_id: userId, reference, credits_amount, amount }),
      })

      console.log("[v0] Verify response status:", response.status)

      const responseText = await response.text()
      console.log("[v0] Raw response:", responseText.substring(0, 500))

      if (!response.ok) {
        console.error("[v0] Verification failed with status:", response.status)
        console.error("[v0] Response text:", responseText)

        try {
          const errorData = JSON.parse(responseText)
          throw new Error(errorData.error || "Verification failed")
        } catch (parseError) {
          throw new Error(`Invalid ref ID or failed transactions.`)
        }
      }

      const data = JSON.parse(responseText)
      console.log("[v0] Verification successful:", data)

      if (data.success) {
        setSuccess(
          `Successfully verified! ${data.credits_added || calculateCredits(amount)} credits added to your account.`,
        )
        setTimeout(() => {
          onSuccess()
          handleClose()
        }, 2000)
      } else {
        throw new Error(data.error || "Verification failed")
      }
    } catch (error) {
      console.error("[v0] Verification error:", error)
      setError(error instanceof Error ? error.message : "Failed to verify payment")
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    if (!loading) {
      setAmountPaid("")
      setReference("")
      setError("")
      setSuccess("")
      onClose()
    }
  }

  const amount = Number.parseFloat(amountPaid) || 0
  const totalCredits = calculateCredits(amount)

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="w-[95vw] max-w-md sm:max-w-lg mx-auto p-4 sm:p-6">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Coins className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
              <span className="hidden sm:inline">Top It - Verify Credits</span>
              <span className="sm:hidden">Verify Credits</span>
            </DialogTitle>
            <Button variant="ghost" size="sm" onClick={handleClose} disabled={loading}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <form onSubmit={handleVerify} className="space-y-3 sm:space-y-4">
          <div className="space-y-2">
            <Label htmlFor="amount" className="text-sm sm:text-base">
              Amount Paid (₦)
            </Label>
            <Input
              id="amount"
              type="number"
              min={MIN_AMOUNT}
              step="0.01"
              value={amountPaid}
              onChange={(e) => setAmountPaid(e.target.value)}
              placeholder={`Minimum ₦ ${MIN_AMOUNT.toLocaleString()}`}
              disabled={loading}
              required
              className="text-sm sm:text-base h-10 sm:h-11"
            />
            <p className="text-xs sm:text-sm text-slate-500">
              Rate: 10 credits = ₦ 500 • Minimum: ₦ {MIN_AMOUNT.toLocaleString()}
            </p>
          </div>

          {amount >= MIN_AMOUNT && (
            <div className="p-3 sm:p-4 bg-primary/10 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800">
              <div className="space-y-2 text-xs sm:text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-600 dark:text-slate-400">Amount Paid:</span>
                  <span className="font-medium">₦ {amount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600 dark:text-slate-400">Rate:</span>
                  <span className="font-medium">10 credits = ₦ 500</span>
                </div>
                <div className="flex justify-between border-t border-orange-200 dark:border-orange-700 pt-2">
                  <span className="font-medium text-primary dark:text-orange-300">Total Credits:</span>
                  <span className="font-bold text-primary dark:text-orange-300">
                    {totalCredits.toLocaleString()} credits
                  </span>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="reference" className="text-sm sm:text-base">
              Payment Reference ID
            </Label>
            <Input
              id="reference"
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Enter your payment reference ID"
              disabled={loading}
              required
              className="text-sm sm:text-base h-10 sm:h-11"
            />
            <p className="text-xs sm:text-sm text-slate-500">Enter the reference ID from your payment confirmation</p>
          </div>

          {success && (
            <Alert className="border-green-200 bg-green-50 dark:bg-green-900/20">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-700 dark:text-green-300 text-sm sm:text-base">
                {success}
              </AlertDescription>
            </Alert>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-sm sm:text-base">{error}</AlertDescription>
            </Alert>
          )}

          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={loading}
              className="w-full sm:flex-1 bg-transparent h-10 sm:h-11 text-sm sm:text-base"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || amount < MIN_AMOUNT || !reference.trim()}
              className="w-full sm:flex-1 bg-primary hover:bg-primary-hover h-10 sm:h-11 text-sm sm:text-base"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-3 w-3 sm:h-4 sm:w-4 animate-spin" />
                  <span className="hidden sm:inline">Verifying...</span>
                  <span className="sm:hidden">Verifying</span>
                </>
              ) : (
                <>
                  <span className="hidden sm:inline">Verify Payment</span>
                  <span className="sm:hidden">Verify</span>
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
