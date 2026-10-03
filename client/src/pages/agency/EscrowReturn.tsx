import { useEffect, useRef } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { CheckCircle, Loader2, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useVerifyEscrowMutation } from "@/lib/queries/escrow"

// Paystack redirects here after checkout (callback_url set by
// POST /api/escrow/initialize) with ?reference=... appended. The webhook is
// the primary confirmation; verifying here just gives the agency an immediate
// answer, and is idempotent with the webhook.
export default function EscrowReturn() {
  const [params] = useSearchParams()
  const reference = params.get("reference") ?? params.get("trxref") ?? ""
  const verify = useVerifyEscrowMutation()
  const started = useRef(false)

  useEffect(() => {
    if (started.current || !reference.startsWith("escrow_")) return
    started.current = true
    verify.mutate(reference)
  }, [reference, verify])

  const funded = verify.data?.status === "funded" || verify.data?.status === "released" || verify.data?.status === "paid_out"

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-8 text-center space-y-4">
        {!reference.startsWith("escrow_") ? (
          <>
            <XCircle className="mx-auto h-10 w-10 text-destructive" />
            <h1 className="text-lg font-semibold text-foreground">No payment to confirm</h1>
            <p className="text-sm text-muted-foreground">This page is reached after paying into escrow.</p>
          </>
        ) : verify.isPending || verify.isIdle ? (
          <>
            <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary" />
            <h1 className="text-lg font-semibold text-foreground">Confirming your payment…</h1>
          </>
        ) : funded ? (
          <>
            <CheckCircle className="mx-auto h-10 w-10 text-success" />
            <h1 className="text-lg font-semibold text-foreground">Job funded</h1>
            <p className="text-sm text-muted-foreground">The money is held in escrow. The freelancer can start work, and is paid only when you approve it.</p>
          </>
        ) : (
          <>
            <XCircle className="mx-auto h-10 w-10 text-destructive" />
            <h1 className="text-lg font-semibold text-foreground">Payment not confirmed</h1>
            <p className="text-sm text-muted-foreground">
              {verify.error instanceof Error ? verify.error.message : "We couldn't confirm this payment yet."} If you were charged, it will update automatically once Paystack confirms it.
            </p>
          </>
        )}
        <Button asChild variant="outline">
          <Link to="/agency/wallet">Go to wallet</Link>
        </Button>
      </div>
    </div>
  )
}
