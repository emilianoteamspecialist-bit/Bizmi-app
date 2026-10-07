import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, AlertCircle, Clock, ShieldCheck, ShieldX, BadgeCheck, Lock } from "lucide-react"
import { useVerificationQuery, useSubmitVerificationMutation } from "../../lib/queries/verification"
import { PageContainer, SkeletonBlock } from "@/components/marketplace/primitives"

export default function Identity() {
  const verificationQuery = useVerificationQuery()
  const submitVerification = useSubmitVerificationMutation()
  const [nin, setNin] = useState("")
  const [error, setError] = useState("")

  if (verificationQuery.isLoading) {
    return (
      <PageContainer width="narrow">
        <div className="mx-auto max-w-xl space-y-4" aria-label="Loading verification">
          <SkeletonBlock className="h-8 w-64" />
          <SkeletonBlock className="h-64" />
        </div>
      </PageContainer>
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
    <PageContainer width="narrow">
      <div className="mx-auto max-w-xl space-y-6">
        <header className="space-y-1">
          <h1 className="font-heading text-xl font-semibold tracking-tight text-foreground sm:text-2xl">Identity verification</h1>
          <p className="text-sm text-muted-foreground">Agencies see a verified badge on your profile and bids once your NIN is confirmed.</p>
        </header>

        {verification?.status === "verified" ? (
          <div className="rounded-lg border border-border bg-card p-6 text-center sm:p-8">
            <div className="mx-auto h-12 w-12 rounded-full bg-success/10 text-success flex items-center justify-center">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <h2 className="mt-5 text-lg font-semibold text-foreground">Identity verified</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              You're all set. Your profile and bids now show the verified badge.
            </p>
            <div className="mt-5 inline-flex items-center gap-2 rounded-md border border-border bg-surface-2 px-3 py-1.5">
              <BadgeCheck className="h-4 w-4 text-success shrink-0" />
              <span className="text-sm font-medium text-foreground tabular-nums">NIN {verification.nin}</span>
            </div>
          </div>
        ) : verification && !isRejected ? (
          <div className="rounded-lg border border-border bg-card p-6 text-center sm:p-8">
            <div className="mx-auto h-12 w-12 rounded-full bg-warning/10 text-warning flex items-center justify-center">
              <Clock className="h-6 w-6" />
            </div>
            <h2 className="mt-5 text-lg font-semibold text-foreground">Verification in progress</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              We're confirming your NIN with the verification service. This page updates when it's done.
            </p>
            <div className="mt-5 inline-flex items-center gap-2 rounded-md border border-border bg-surface-2 px-3 py-1.5">
              <Loader2 className="h-4 w-4 text-warning animate-spin shrink-0" />
              <span className="text-sm font-medium text-foreground tabular-nums">NIN {verification.nin}</span>
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-border bg-card p-6 text-center sm:p-8">
            {isRejected ? (
              <>
                <div className="mx-auto h-12 w-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center">
                  <ShieldX className="h-6 w-6" />
                </div>
                <h2 className="mt-5 text-lg font-semibold text-foreground">Verification unsuccessful</h2>
                <p className="mt-1 text-sm text-muted-foreground max-w-sm mx-auto">
                  We couldn&apos;t verify NIN <span className="tabular-nums">{verification.nin}</span>. Check the number
                  and submit it again.
                </p>
              </>
            ) : (
              <>
                <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                  <ShieldCheck className="h-6 w-6" />
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

              <Button type="submit" className="w-full" disabled={submitVerification.isPending || nin.length !== 11}>
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
              <Lock className="h-3 w-3" /> Your NIN is only used to confirm who you are. Agencies never see it.
            </p>
          </div>
        )}
      </div>
    </PageContainer>
  )
}
