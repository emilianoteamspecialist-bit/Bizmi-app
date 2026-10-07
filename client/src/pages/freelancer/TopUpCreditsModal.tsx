import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ExternalLink, Loader2 } from "lucide-react"
import { useVerifyCreditsMutation } from "@/lib/queries/credits"

export const CREDITS_RATE = 50 // ₦50 per credit
// Paystack payment page for credits; the reference it returns is verified below.
const PAYSTACK_PAY_URL = "https://paystack.shop/pay/m7uebavu00"
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
        onError: (err) => setError(err instanceof Error && err.message ? err.message : "Failed to verify payment"),
      }
    )
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="w-[95vw] max-w-md p-5 sm:p-6">
        <DialogHeader>
          <DialogTitle className="font-heading">Top up credits</DialogTitle>
          <DialogDescription>
            Pay on Paystack, then enter the amount and reference here. Credits are added once Paystack confirms the payment.
          </DialogDescription>
        </DialogHeader>

        <ol className="space-y-5">
          <li className="flex gap-3">
            <Step n={1} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">Pay on Paystack</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                ₦{CREDITS_RATE} per credit · minimum ₦{MIN_AMOUNT.toLocaleString()} ({MIN_AMOUNT / CREDITS_RATE} credits)
              </p>
              <Button asChild variant="outline" size="sm" className="mt-2">
                <a href={PAYSTACK_PAY_URL} target="_blank" rel="noopener noreferrer">
                  <ExternalLink /> Open Paystack
                </a>
              </Button>
            </div>
          </li>
          <li className="flex gap-3">
            <Step n={2} />
            <form onSubmit={handleVerify} noValidate className="min-w-0 flex-1 space-y-4">
              <p className="text-sm font-medium text-foreground">Confirm your payment</p>
              <div className="space-y-1.5">
                <Label htmlFor="amount-paid">Amount paid (₦)</Label>
                <Input
                  id="amount-paid"
                  type="number"
                  inputMode="numeric"
                  min={MIN_AMOUNT}
                  step="0.01"
                  value={amountPaid}
                  onChange={(e) => setAmountPaid(e.target.value)}
                  placeholder={`Minimum ₦${MIN_AMOUNT.toLocaleString()}`}
                  disabled={verify.isPending}
                  required
                />
                {amount >= MIN_AMOUNT && (
                  <p className="text-xs text-muted-foreground">
                    You'll get <span className="font-semibold text-foreground">{totalCredits} credits</span>
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="payment-reference">Payment reference</Label>
                <Input
                  id="payment-reference"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="From your Paystack receipt"
                  disabled={verify.isPending}
                  required
                />
              </div>

              {error && (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              )}

              <div className="flex gap-2 pt-1">
                <Button type="button" variant="outline" onClick={handleClose} disabled={verify.isPending} className="flex-1">
                  Cancel
                </Button>
                <Button type="submit" disabled={verify.isPending} className="flex-1">
                  {verify.isPending ? (
                    <>
                      <Loader2 className="animate-spin" /> Verifying...
                    </>
                  ) : (
                    "Verify payment"
                  )}
                </Button>
              </div>
            </form>
          </li>
        </ol>
      </DialogContent>
    </Dialog>
  )
}

function Step({ n }: { n: number }) {
  return (
    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border text-xs font-semibold text-muted-foreground" aria-hidden>
      {n}
    </span>
  )
}
