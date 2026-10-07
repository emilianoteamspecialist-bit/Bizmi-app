import type React from "react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2 } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { FormMessage } from "@/components/marketplace/AuthShell"
import { supabase } from "@/lib/supabase"

interface ForgotPasswordModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function ForgotPasswordModal({ isOpen, onClose }: ForgotPasswordModalProps) {
  const [email, setEmail] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState("")
  const [isSuccess, setIsSuccess] = useState(false)

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setMessage("")

    try {
      // The legacy modal redirected to /freelancer/reset-password; the SPA's
      // canonical recovery page is /reset-password (the legacy path is kept as
      // an alias in App.tsx for links already sent). The target must be listed
      // in Supabase Auth's allowed redirect URLs.
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })

      if (error) {
        setMessage(error.message)
        setIsSuccess(false)
      } else {
        setMessage("Password reset email sent. Check your inbox for the link.")
        setIsSuccess(true)
        setEmail("")
      }
    } catch (error) {
      console.error("Reset password error:", error)
      setMessage("An unexpected error occurred. Please try again.")
      setIsSuccess(false)
    } finally {
      setIsLoading(false)
    }
  }

  const handleClose = () => {
    setEmail("")
    setMessage("")
    setIsSuccess(false)
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="w-[95vw] max-w-md p-5 sm:p-6">
        <DialogHeader>
          <DialogTitle className="font-heading">Reset password</DialogTitle>
          <DialogDescription>Enter the email you signed up with and we'll send you a link to set a new password.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleResetPassword} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="reset-email">Email address</Label>
            <Input
              id="reset-email"
              type="email"
              autoComplete="email"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isLoading}
            />
          </div>

          {message && <FormMessage tone={isSuccess ? "success" : "error"}>{message}</FormMessage>}

          <div className="flex gap-2 pt-1">
            <Button type="button" variant="outline" onClick={handleClose} className="flex-1" disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={isLoading || !email}>
              {isLoading ? (
                <>
                  <Loader2 className="animate-spin" /> Sending…
                </>
              ) : (
                "Send reset link"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
