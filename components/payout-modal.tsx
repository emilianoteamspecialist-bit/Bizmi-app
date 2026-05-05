"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, AlertCircle, CheckCircle, Wallet, Building2, User, Landmark, ShieldCheck, ArrowRight } from "lucide-react"

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

  useEffect(() => {
    if (isOpen) loadBanks()
  }, [isOpen])

  const loadBanks = async () => {
    try {
      setBanksLoading(true)
      const res = await fetch("/api/banks")
      const data = await res.json()
      if (data.status && data.data) setBanks(data.data)
      else setError("Failed to load banks")
    } catch (error) {
      setError("Failed to load banks")
    } finally {
      setBanksLoading(false)
    }
  }

  const handleBankSelect = (code: string) => {
    const bank = banks.find((b) => b.code === code)
    setFormData({ ...formData, bank_code: code, bank_name: bank?.name || "" })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")
    try {
      const res = await fetch("/api/payout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          account_number: formData.account_number,
          bank_code: formData.bank_code,
          amount: jobData.amount * 100,
          freelancer_name: formData.freelancer_name,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setSuccess(true)
        setTimeout(() => {
          onSuccess()
          onClose()
          resetForm()
        }, 2000)
      } else setError(data.error || "Payout failed")
    } catch (error) {
      setError("Something went wrong.")
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setFormData({ freelancer_name: "", account_number: "", bank_code: "", bank_name: "" })
    setError("")
    setSuccess(false)
  }

  const platformFee = jobData.amount * 0.15
  const payoutAmount = jobData.amount - platformFee

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg border-none rounded-[2.5rem] p-0 overflow-hidden bg-white shadow-2xl">
        <DialogHeader className="p-8 pb-4">
          <div className="space-y-1">
             <DialogTitle className="text-2xl font-black text-slate-900 flex items-center gap-2">
                <Wallet className="h-6 w-6 text-primary" />
                Withdraw Funds
             </DialogTitle>
             <DialogDescription className="font-medium text-slate-400">Request your earnings for the completed project.</DialogDescription>
          </div>
        </DialogHeader>

        <div className="p-8 pt-0 space-y-8">
          {success ? (
            <div className="py-12 text-center space-y-4">
              <div className="w-20 h-20 bg-green-50 rounded-[2rem] flex items-center justify-center mx-auto border border-green-100">
                <CheckCircle className="h-10 w-10 text-green-500" />
              </div>
              <div className="space-y-1">
                <h3 className="text-2xl font-black text-slate-900">Transfer Initiated</h3>
                <p className="text-slate-500 font-medium">Your payout of <span className="text-slate-900 font-bold">₦ {payoutAmount.toLocaleString()}</span> is being processed.</p>
              </div>
            </div>
          ) : (
            <>
              <div className="bg-slate-50 rounded-[2rem] p-6 border border-slate-100 space-y-4">
                 <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                       <div className="p-2 bg-white rounded-xl border border-slate-200">
                          <Building2 className="h-4 w-4 text-slate-400" />
                       </div>
                       <p className="text-sm font-bold text-slate-700">{jobData.agency_name}</p>
                    </div>
                    <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-none font-black text-[10px] uppercase tracking-wider">Completed</Badge>
                 </div>
                 <div className="space-y-1">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Project Title</p>
                    <p className="font-black text-slate-900 line-clamp-1">{jobData.job_title}</p>
                 </div>
                 <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-200/50">
                    <div className="space-y-1">
                       <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Escrow</p>
                       <p className="text-sm font-bold text-slate-900">₦ {jobData.amount.toLocaleString()}</p>
                    </div>
                    <div className="space-y-1">
                       <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Platform Fee (15%)</p>
                       <p className="text-sm font-bold text-red-500">- ₦ {platformFee.toLocaleString()}</p>
                    </div>
                 </div>
                 <div className="pt-3 bg-primary/10 -mx-6 -mb-6 px-6 py-4 flex items-center justify-between border-t border-orange-100">
                    <p className="text-xs font-black uppercase tracking-widest text-orange-800">You Receive</p>
                    <p className="text-xl font-black text-orange-900">₦ {payoutAmount.toLocaleString()}</p>
                 </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="font-bold text-slate-700">Account Holder Name</Label>
                    <div className="relative">
                       <User className="absolute left-4 top-3.5 h-5 w-5 text-slate-300" />
                       <Input
                         className="h-12 pl-11 rounded-xl border-slate-200"
                         value={formData.freelancer_name}
                         onChange={(e) => setFormData({ ...formData, freelancer_name: e.target.value })}
                         placeholder="Enter full name on account"
                         required
                         disabled={loading}
                       />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="font-bold text-slate-700">Select Bank</Label>
                      <Select value={formData.bank_code} onValueChange={handleBankSelect} disabled={loading || banksLoading}>
                        <SelectTrigger className="h-12 rounded-xl border-slate-200">
                          <SelectValue placeholder={banksLoading ? "Loading..." : "Choose Bank"} />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                          {banks.map((bank) => (
                            <SelectItem key={bank.code} value={bank.code}>{bank.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="font-bold text-slate-700">Account Number</Label>
                      <div className="relative">
                         <Landmark className="absolute left-4 top-3.5 h-5 w-5 text-slate-300" />
                         <Input
                           className="h-12 pl-11 rounded-xl border-slate-200"
                           value={formData.account_number}
                           onChange={(e) => setFormData({ ...formData, account_number: e.target.value })}
                           placeholder="0000000000"
                           required
                           maxLength={10}
                           disabled={loading}
                         />
                      </div>
                    </div>
                  </div>
                </div>

                {error && (
                  <Alert variant="destructive" className="rounded-2xl bg-red-50 border-red-100 text-red-800">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="font-bold">{error}</AlertDescription>
                  </Alert>
                )}

                <div className="bg-blue-50 rounded-2xl p-4 border border-blue-100 flex gap-3">
                   <ShieldCheck className="h-5 w-5 text-blue-600 shrink-0" />
                   <p className="text-[11px] font-medium text-blue-800 leading-relaxed">
                      Withdrawals are processed via <strong>Paystack</strong> and usually reflect in your bank account within minutes.
                   </p>
                </div>

                <div className="flex gap-3 pt-2">
                  <Button type="button" variant="outline" onClick={onClose} disabled={loading} className="flex-1 h-14 rounded-2xl font-bold bg-transparent">
                    Cancel
                  </Button>
                  <Button type="submit" disabled={loading || banksLoading || !formData.account_number} className="flex-1 h-14 rounded-2xl bg-primary hover:bg-primary-hover text-white font-black shadow-xl shadow-primary/25">
                    {loading ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <ArrowRight className="h-5 w-5 mr-2" />}
                    Withdraw Funds
                  </Button>
                </div>
              </form>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
