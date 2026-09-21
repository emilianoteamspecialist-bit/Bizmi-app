import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2 } from "lucide-react"
import { useVerifyCreditsMutation } from "@/lib/queries/credits"

const CREDITS_RATE = 50 // ₦50 per credit
const MIN_AMOUNT = 500 // ₦500 minimum (10 credits)

export default function TopUpCreditsModal({
  isOpen,
  onClose,
  onSuccess,
}: {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}) {
  const [amountPaid, setAmountPaid] = useState("")
  const [reference, setReference] = useState("")
  const [error, setError] = useState("")
  const verify = useVerifyCreditsMutation()

  const amount = Number.parseFloat(amountPaid) || 0
  const totalCredits = Math.floor(amount / CREDITS_RATE)

  const handleClose = () => {
    if (verify.isPending) return
    setAmountPaid("")
    setReference("")
    setError("")
    onClose()
  }

  const handleVerify = (event: React.FormEvent) => {
    event.preventDefault()
    setError("")

    if (!amount || amount < MIN_AMOUNT) {
      setError(`Minimum amount is ₦${MIN_AMOUNT.toLocaleString()}`)
      return
    }
    if (!reference.trim()) {
      setError("Reference ID is required")
      return
    }

    verify.mutate(
      { reference: reference.trim(), amount },
      {
        onSuccess: (result) => {
          if (!result.success) {
            setError(result.error || "Verification failed")
            return
          }
          onSuccess()
          handleClose()
        },
        onError: () => setError("Failed to verify payment"),
      }
    )
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="w-[95vw] max-w-md sm:max-w-lg mx-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>Top up credits</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleVerify} noValidate className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="amount-paid">Amount Paid (₦)</Label>
            <Input
              id="amount-paid"
              type="number"
              min={MIN_AMOUNT}
              step="0.01"
              value={amountPaid}
              onChange={(e) => setAmountPaid(e.target.value)}
              placeholder={`Minimum ₦${MIN_AMOUNT.toLocaleString()}`}
              disabled={verify.isPending}
              required
            />
            <p className="text-xs text-muted-foreground">Rate: 10 credits = ₦500 · Minimum: ₦{MIN_AMOUNT.toLocaleString()}</p>
          </div>

          {amount >= MIN_AMOUNT && (
            <div className="p-3 bg-primary/10 rounded-lg border border-border text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Amount Paid:</span>
                <span className="font-medium">₦{amount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between mt-2 pt-2 border-t border-border">
                <span className="font-medium text-primary">Total Credits:</span>
                <span className="font-bold text-primary">{totalCredits} credits</span>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="payment-reference">Payment Reference ID</Label>
            <Input
              id="payment-reference"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Enter your payment reference ID"
              disabled={verify.isPending}
              required
            />
            <p className="text-xs text-muted-foreground">Enter the reference ID from your payment confirmation</p>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" onClick={handleClose} disabled={verify.isPending} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" disabled={verify.isPending} className="flex-1">
              {verify.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verifying...
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
