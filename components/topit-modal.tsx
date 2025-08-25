"use client"

import { useState } from "react"
import type React from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, AlertCircle, Coins, X } from "lucide-react"

interface TopItModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export default function TopItModal({ isOpen, onClose, onSuccess }: TopItModalProps) {
  const [credits, setCredits] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const CREDITS_RATE = 50 // ₦50 per credit
  const MIN_CREDITS = 10 // Minimum 10 credits

  const calculateAmount = (creditsAmount: number) => {
    return creditsAmount * CREDITS_RATE
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    const creditsAmount = Number.parseInt(credits)

    if (!creditsAmount || creditsAmount < MIN_CREDITS) {
      setError(`Minimum purchase is ${MIN_CREDITS} credits`)
      return
    }

    setLoading(true)

    try {
      const amount = calculateAmount(creditsAmount)

      console.log("🚀 Initiating credits purchase:", { amount, credits_amount: creditsAmount })

      const response = await fetch("/api/credits/initialize-payment", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount,
          credits_amount: creditsAmount,
        }),
      })

      console.log("📥 Response status:", response.status)

      if (!response.ok) {
        const errorText = await response.text()
        console.error("❌ Response not ok:", errorText)

        try {
          const errorData = JSON.parse(errorText)
          throw new Error(errorData.error || "Failed to initialize payment")
        } catch (parseError) {
          throw new Error(`Server error: ${response.status}`)
        }
      }

      const data = await response.json()
      console.log("📥 Initialize payment response:", data)

      // Redirect to Paystack payment page
      if (data.success && data.authorization_url) {
        console.log("🔗 Redirecting to:", data.authorization_url)
        window.location.href = data.authorization_url
      } else {
        throw new Error(data.error || "No payment URL received")
      }
    } catch (error) {
      console.error("💥 Payment initialization error:", error)
      setError(error instanceof Error ? error.message : "Failed to initialize payment")
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    if (!loading) {
      setCredits("")
      setError("")
      onClose()
    }
  }

  const creditsAmount = Number.parseInt(credits) || 0
  const totalAmount = calculateAmount(creditsAmount)

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <Coins className="h-5 w-5 text-orange-500" />
              Top It - Buy Credits
            </DialogTitle>
            <Button variant="ghost" size="sm" onClick={handleClose} disabled={loading}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="credits">Number of Credits</Label>
            <Input
              id="credits"
              type="number"
              min={MIN_CREDITS}
              value={credits}
              onChange={(e) => setCredits(e.target.value)}
              placeholder={`Minimum ${MIN_CREDITS} credits`}
              disabled={loading}
              required
            />
            <p className="text-xs text-gray-500">
              Rate: ₦{CREDITS_RATE} per credit • Minimum: {MIN_CREDITS} credits
            </p>
          </div>

          {creditsAmount >= MIN_CREDITS && (
            <div className="p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Credits:</span>
                  <span className="font-medium">{creditsAmount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Rate:</span>
                  <span className="font-medium">₦{CREDITS_RATE} per credit</span>
                </div>
                <div className="flex justify-between border-t border-orange-200 dark:border-orange-700 pt-2">
                  <span className="font-medium text-orange-700 dark:text-orange-300">Total Amount:</span>
                  <span className="font-bold text-orange-700 dark:text-orange-300">
                    ₦{totalAmount.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
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
              disabled={loading || creditsAmount < MIN_CREDITS}
              className="flex-1 bg-orange-500 hover:bg-orange-600"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                "Buy Credits"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
