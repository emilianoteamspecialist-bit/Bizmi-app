import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, AlertCircle, Clock, ShieldCheck, ShieldX, BadgeCheck, Lock } from "lucide-react"
import { useVerificationQuery, useSubmitVerificationMutation } from "../../lib/queries/verification"

export default function Identity() {
  const verificationQuery = useVerificationQuery()
  const submitVerification = useSubmitVerificationMutation()
  const [nin, setNin] = useState("")
  const [error, setError] = useState("")

  if (verificationQuery.isLoading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const verification = verificationQuery.data
  // A rejected NIN can be resubmitted (the server replaces the rejected row).
  const isRejected = verification?.status === "rejected"

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (nin.length !== 11) {
      setError("NIN must be exactly 11 digits")
      return
    }
    submitVerification.mutate(
      { nin },
      {
        onError: (err) => setError(err instanceof Error ? err.message : "Failed to submit NIN"),
      }
    )
  }

  return (
    <div className="min-h-screen bg-surface pb-20">
      <div className="mx-auto max-w-xl px-4 sm:px-6 py-8 sm:py-12 space-y-6">
        <header className="space-y-1 text-center">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Verification</p>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Identity verification</h1>
          <p className="text-sm text-muted-foreground">A verified badge helps agencies trust and hire you faster.</p>
        </header>

        {verification?.status === "verified" ? (
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
              <span className="text-sm font-medium text-foreground tabular-nums">NIN {verification.nin}</span>
            </div>
          </div>
        ) : verification && !isRejected ? (
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
              <span className="text-sm font-medium text-foreground tabular-nums">NIN {verification.nin}</span>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-card p-8 text-center">
            {isRejected ? (
              <>
                <div className="mx-auto h-14 w-14 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center">
                  <ShieldX className="h-7 w-7" />
                </div>
                <h2 className="mt-5 text-lg font-semibold text-foreground">Verification unsuccessful</h2>
                <p className="mt-1 text-sm text-muted-foreground max-w-sm mx-auto">
                  We couldn&apos;t verify NIN <span className="tabular-nums">{verification.nin}</span>. Check the number
                  and submit it again.
                </p>
              </>
            ) : (
              <>
                <div className="mx-auto h-14 w-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                  <ShieldCheck className="h-7 w-7" />
                </div>
                <h2 className="mt-5 text-lg font-semibold text-foreground">Verify your identity</h2>
                <p className="mt-1 text-sm text-muted-foreground max-w-sm mx-auto">
                  Enter your 11-digit National Identity Number (NIN) to get verified.
                </p>
              </>
            )}

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
                    if (error) setError("")
                  }}
                  maxLength={11}
                  required
                  disabled={submitVerification.isPending}
                  className="h-12 text-center text-lg font-medium tracking-[0.3em] tabular-nums"
                />
                <p className="text-xs text-muted-foreground text-center">{nin.length}/11 digits</p>
              </div>

              {error && (
                <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                  <span className="text-sm text-destructive">{error}</span>
                </div>
              )}

              <Button type="submit" className="w-full h-11" disabled={submitVerification.isPending || nin.length !== 11}>
                {submitVerification.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Submitting…
                  </>
                ) : isRejected ? (
                  "Submit again"
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
