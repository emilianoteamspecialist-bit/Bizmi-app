"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, AlertCircle, CheckCircle } from "lucide-react"

interface Bank {
  id: number
  name: string
  code: string
  slug: string
}

interface PayoutModalProps {
  isOpen: boolean
  onClose: () => void
  jobData: {
    id: string
    job_title: string
    amount: number
    agency_name: string
  }
  onSuccess: () => void
}

export default function PayoutModal({ isOpen, onClose, jobData, onSuccess }: PayoutModalProps) {
  const [banks, setBanks] = useState<Bank[]>([])
  const [loading, setLoading] = useState(false)
  const [banksLoading, setBanksLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)

  const [formData, setFormData] = useState({
    freelancer_name: "",
    account_number: "",
    bank_code: "",
    bank_name: "",
  })

  // Load banks when modal opens
  useEffect(() => {
    if (isOpen) {
      loadBanks()
    }
  }, [isOpen])

  const loadBanks = async () => {
    try {
      setBanksLoading(true)
      const response = await fetch("/api/banks")
      const data = await response.json()

      if (data.status && data.data) {
        setBanks(data.data)
      } else {
        setError("Failed to load banks")
      }
    } catch (error) {
      console.error("Error loading banks:", error)
      setError("Failed to load banks")
    } finally {
      setBanksLoading(false)
    }
  }

  const handleBankSelect = (bankCode: string) => {
    const selectedBank = banks.find((bank) => bank.code === bankCode)
    setFormData({
      ...formData,
      bank_code: bankCode,
      bank_name: selectedBank?.name || "",
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    try {
      const response = await fetch("/api/payout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          account_number: formData.account_number,
          bank_code: formData.bank_code,
          amount: jobData.amount * 100, // Convert to kobo
          freelancer_name: formData.freelancer_name,
        }),
      })

      const data = await response.json()

      if (data.success) {
        setSuccess(true)
        setTimeout(() => {
          onSuccess()
          onClose()
          resetForm()
        }, 2000)
      } else {
        setError(data.error || "Payout failed")
      }
    } catch (error) {
      console.error("Payout error:", error)
      setError("Something went wrong. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setFormData({
      freelancer_name: "",
      account_number: "",
      bank_code: "",
      bank_name: "",
    })
    setError("")
    setSuccess(false)
  }

  const handleClose = () => {
    if (!loading) {
      onClose()
      resetForm()
    }
  }

  const platformFee = jobData.amount * 0.15
  const payoutAmount = jobData.amount - platformFee

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Payout Request</DialogTitle>
        </DialogHeader>

        {success ? (
          <div className="text-center py-6">
            <CheckCircle className="mx-auto h-12 w-12 text-green-500 mb-4" />
            <h3 className="text-lg font-semibold text-green-600 mb-2">Payout Successful!</h3>
            <p className="text-gray-600">Your payout has been processed successfully.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Job Details */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-semibold text-gray-900 mb-2">Job Details</h4>
              <p className="text-sm text-gray-600 mb-1">
                <strong>Job:</strong> {jobData.job_title}
              </p>
              <p className="text-sm text-gray-600 mb-1">
                <strong>Agency:</strong> {jobData.agency_name}
              </p>
              <p className="text-sm text-gray-600 mb-1">
                <strong>Total Amount:</strong> ₦{jobData.amount.toLocaleString()}
              </p>
              <p className="text-sm text-gray-600 mb-1">
                <strong>Platform Fee (15%):</strong> ₦{platformFee.toLocaleString()}
              </p>
              <p className="text-sm font-semibold text-green-600">
                <strong>You'll Receive:</strong> ₦{payoutAmount.toLocaleString()}
              </p>
            </div>

            {/* Form Fields */}
            <div className="space-y-4">
              <div>
                <Label htmlFor="freelancer_name">Full Name</Label>
                <Input
                  id="freelancer_name"
                  type="text"
                  value={formData.freelancer_name}
                  onChange={(e) => setFormData({ ...formData, freelancer_name: e.target.value })}
                  placeholder="Enter your full name"
                  required
                  disabled={loading}
                />
              </div>

              <div>
                <Label htmlFor="bank">Select Bank</Label>
                <Select value={formData.bank_code} onValueChange={handleBankSelect} disabled={loading || banksLoading}>
                  <SelectTrigger>
                    <SelectValue placeholder={banksLoading ? "Loading banks..." : "Select your bank"} />
                  </SelectTrigger>
                  <SelectContent>
                    {banks.map((bank) => (
                      <SelectItem key={bank.code} value={bank.code}>
                        {bank.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {formData.bank_code && (
                <div>
                  <Label htmlFor="bank_code_display">Bank Code</Label>
                  <Input
                    id="bank_code_display"
                    type="text"
                    value={formData.bank_code}
                    placeholder="Bank code will appear here"
                    disabled
                    className="bg-gray-100"
                  />
                </div>
              )}

              <div>
                <Label htmlFor="account_number">Account Number</Label>
                <Input
                  id="account_number"
                  type="text"
                  value={formData.account_number}
                  onChange={(e) => setFormData({ ...formData, account_number: e.target.value })}
                  placeholder="Enter your account number"
                  required
                  disabled={loading}
                />
              </div>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={loading}
                className="flex-1 bg-transparent"
              >
                Cancel
              </Button>
              <Button type="submit" disabled={loading || banksLoading} className="flex-1">
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  `Withdraw ₦${payoutAmount.toLocaleString()}`
                )}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
