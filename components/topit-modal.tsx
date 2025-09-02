"use client"

import { useState } from "react"
import type React from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, AlertCircle, Coins, X, CheckCircle } from "lucide-react"

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

  const CREDITS_RATE = 50 // ₦50 per credit (10 credits = ₦500)
  const MIN_AMOUNT = 500 // Minimum ₦500 (10 credits)

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

    setLoading(true)

    try {
      console.log("[v0] Verifying payment with reference:", reference)

      const response = await fetch(
        `/api/credits/verify-credits?reference=${encodeURIComponent(reference)}&amount=${amount}`,
        {
          method: "GET",
          credentials: "include",
        },
      )

      console.log("[v0] Verify response status:", response.status)

      if (!response.ok) {
        const errorText = await response.text()
        console.error("[v0] Verification failed:", errorText)

        try {
          const errorData = JSON.parse(errorText)
          throw new Error(errorData.error || "Verification failed")
        } catch (parseError) {
          throw new Error(`Verification failed: ${response.status}`)
        }
      }

      const data = await response.json()
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <Coins className="h-5 w-5 text-orange-500" />
              Top It - Verify Credits
            </DialogTitle>
            <Button variant="ghost" size="sm" onClick={handleClose} disabled={loading}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <form onSubmit={handleVerify} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="amount">Amount Paid (₦)</Label>
            <Input
              id="amount"
              type="number"
              min={MIN_AMOUNT}
              step="0.01"
              value={amountPaid}
              onChange={(e) => setAmountPaid(e.target.value)}
              placeholder={`Minimum ₦${MIN_AMOUNT.toLocaleString()}`}
              disabled={loading}
              required
            />
            <p className="text-xs text-gray-500">Rate: 10 credits = ₦500 • Minimum: ₦{MIN_AMOUNT.toLocaleString()}</p>
          </div>

          {amount >= MIN_AMOUNT && (
            <div className="p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Amount Paid:</span>
                  <span className="font-medium">₦{amount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Rate:</span>
                  <span className="font-medium">10 credits = ₦500</span>
                </div>
                <div className="flex justify-between border-t border-orange-200 dark:border-orange-700 pt-2">
                  <span className="font-medium text-orange-700 dark:text-orange-300">Total Credits:</span>
                  <span className="font-bold text-orange-700 dark:text-orange-300">
                    {totalCredits.toLocaleString()} credits
                  </span>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="reference">Payment Reference ID</Label>
            <Input
              id="reference"
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Enter your payment reference ID"
              disabled={loading}
              required
            />
            <p className="text-xs text-gray-500">Enter the reference ID from your payment confirmation</p>
          </div>

          {success && (
            <Alert className="border-green-200 bg-green-50 dark:bg-green-900/20">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-700 dark:text-green-300">{success}</AlertDescription>
            </Alert>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={loading}
              className="flex-1 bg-transparent"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || amount < MIN_AMOUNT || !reference.trim()}
              className="flex-1 bg-orange-500 hover:bg-orange-600"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                "Verify Payment"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
