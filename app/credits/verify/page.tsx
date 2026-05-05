"use client"

import { useEffect, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CheckCircle, XCircle, Loader2, Coins } from "lucide-react"

export default function CreditsVerifyPage() {
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading")
  const [message, setMessage] = useState("")
  const [creditsAdded, setCreditsAdded] = useState(0)
  const [amountPaid, setAmountPaid] = useState(0)
  const searchParams = useSearchParams()
  const router = useRouter()

  useEffect(() => {
    const reference = searchParams.get("reference")

    if (!reference) {
      setStatus("error")
      setMessage("Invalid payment reference")
      return
    }

    verifyPayment(reference)
  }, [searchParams])

  const verifyPayment = async (reference: string) => {
    try {
      console.log("🔍 Verifying credits payment - Reference:", reference)

      const response = await fetch(`/api/credits/verify-payment?reference=${reference}`)
      const data = await response.json()

      console.log("📥 Verification response:", data)

      if (response.ok && data.success) {
        setStatus("success")
        setMessage(data.message)
        setCreditsAdded(data.credits_added)
        setAmountPaid(data.amount_paid)
      } else {
        setStatus("error")
        setMessage(data.error || "Payment verification failed")
      }
    } catch (error) {
      console.error("💥 Verification error:", error)
      setStatus("error")
      setMessage("Failed to verify payment")
    }
  }

  const handleGoToBizpal = () => {
    router.push("/freelancer/bizpal")
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      

      <div className="max-w-2xl mx-auto py-16 px-4">
        <Card className="text-center">
          <CardContent className="p-8">
            {status === "loading" && (
              <div className="space-y-4">
                <div className="h-16 w-16 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center mx-auto">
                  <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
                </div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Verifying Payment</h1>
                <p className="text-slate-600 dark:text-slate-400">Please wait while we verify your credits purchase...</p>
              </div>
            )}

            {status === "success" && (
              <div className="space-y-6">
                <div className="h-16 w-16 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle className="h-8 w-8 text-green-600" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-green-600 mb-2">Credits Purchase Successful!</h1>
                  <p className="text-slate-600 dark:text-slate-400 mb-4">{message}</p>
                </div>

                <div className="bg-green-50 dark:bg-green-900/20 p-6 rounded-lg border border-green-200 dark:border-green-800">
                  <div className="flex items-center justify-center gap-2 mb-4">
                    <Coins className="h-6 w-6 text-green-600" />
                    <span className="text-lg font-semibold text-green-700 dark:text-green-300">Purchase Summary</span>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400">Credits Added:</span>
                      <span className="font-medium text-green-700 dark:text-green-300">
                        {creditsAdded.toLocaleString()} credits
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400">Amount Paid:</span>
                      <span className="font-medium text-green-700 dark:text-green-300">
                        ₦ {amountPaid.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between border-t border-green-200 dark:border-green-700 pt-2">
                      <span className="text-slate-600 dark:text-slate-400">Rate:</span>
                      <span className="font-medium text-green-700 dark:text-green-300">₦ 50 per credit</span>
                    </div>
                  </div>
                </div>

                <Button onClick={handleGoToBizpal} className="bg-green-600 hover:bg-green-700">
                  Go to Bizpal
                </Button>
              </div>
            )}

            {status === "error" && (
              <div className="space-y-6">
                <div className="h-16 w-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto">
                  <XCircle className="h-8 w-8 text-red-600" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-red-600 mb-2">Payment Verification Failed</h1>
                  <p className="text-slate-600 dark:text-slate-400 mb-4">{message}</p>
                </div>

                <div className="space-y-3">
                  <Button onClick={handleGoToBizpal} variant="outline">
                    Go to Bizpal
                  </Button>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    If you believe this is an error, please contact support.
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
