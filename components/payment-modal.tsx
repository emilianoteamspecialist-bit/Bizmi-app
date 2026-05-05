"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { X, DollarSign, User, Briefcase, AlertCircle, Loader2, ShieldCheck, CreditCard } from "lucide-react"
import { toast } from "sonner"

interface PaymentModalProps {
  isOpen: boolean
  onClose: () => void
  jobData: {
    id: string
    title: string
    freelancer: {
      id: string
      name: string
      email: string
    }
    amount: number
  }
  onSuccess: () => void
}

export default function PaymentModal({ isOpen, onClose, jobData, onSuccess }: PaymentModalProps) {
  const [amount, setAmount] = useState("")
  const [referenceId, setReferenceId] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [isCheckingReference, setIsCheckingReference] = useState(false)
  const [referenceExists, setReferenceExists] = useState(false)
  const [referenceError, setReferenceError] = useState("")

  useEffect(() => {
    const getCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setCurrentUser(user)
    }
    getCurrentUser()
  }, [])

  useEffect(() => {
    if (!referenceId.trim()) {
      setReferenceExists(false)
      setReferenceError("")
      return
    }

    const timeoutId = setTimeout(async () => {
      setIsCheckingReference(true)
      setReferenceError("")
      try {
        const { data, error } = await supabase.from("Funded_jobs101").select("id").eq("reference_id", referenceId.trim()).limit(1)
        if (error && error.code !== "PGRST116") throw error
        if (data && data.length > 0) {
          setReferenceExists(true)
          setReferenceError("This reference ID has already been used.")
        } else {
          setReferenceExists(false)
        }
      } catch (error) {
        console.error("Reference check error:", error)
      } finally {
        setIsCheckingReference(false)
      }
    }, 500)
    return () => clearTimeout(timeoutId)
  }, [referenceId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!amount || !referenceId || referenceExists || isCheckingReference) return

    setIsSubmitting(true)
    try {
      if (!currentUser) throw new Error("Not authenticated")
      const { data: agencyProfile } = await supabase.from("profiles").select("full_name").eq("id", currentUser.id).single()

      const { error: insertError } = await supabase.from("Funded_jobs101").insert({
        job_id: jobData.id,
        agency_id: currentUser.id,
        freelancer_id: jobData.freelancer.id,
        agency_name: agencyProfile?.full_name || "Unknown Agency",
        job_title: jobData.title,
        amount: Number.parseFloat(amount),
        reference_id: referenceId.trim(),
        status: "pending_verification",
        funded_at: new Date().toISOString(),
      })

      if (insertError) throw insertError

      toast.success("Job funded successfully!")
      onSuccess()
      onClose()
      setAmount("")
      setReferenceId("")
    } catch (error) {
      console.error(error)
      toast.error("Failed to fund job")
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
      <Card className="w-full max-w-lg rounded-[2.5rem] border-none shadow-2xl overflow-hidden bg-white">
        <CardHeader className="p-8 pb-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="text-2xl font-black text-slate-900 flex items-center gap-2">
                <CreditCard className="h-6 w-6 text-primary" />
                Fund Project
              </CardTitle>
              <CardDescription className="font-medium text-slate-400">Lock funds in escrow to start the project.</CardDescription>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} disabled={isSubmitting} className="rounded-full">
              <X className="h-5 w-5" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-8 pt-0 space-y-8">
          {/* Project Summary */}
          <div className="bg-slate-50 rounded-[2rem] p-6 border border-slate-100 space-y-4">
            <div className="flex items-start gap-4">
               <div className="p-3 bg-white rounded-2xl border border-slate-200 shadow-sm">
                  <Briefcase className="h-5 w-5 text-primary" />
               </div>
               <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Project</p>
                  <p className="font-black text-slate-900">{jobData.title}</p>
               </div>
            </div>
            <div className="flex items-start gap-4">
               <div className="p-3 bg-white rounded-2xl border border-slate-200 shadow-sm">
                  <User className="h-5 w-5 text-blue-500" />
               </div>
               <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Freelancer</p>
                  <p className="font-black text-slate-900">{jobData.freelancer.name}</p>
                  <p className="text-xs text-slate-500 font-medium">{jobData.freelancer.email}</p>
               </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               <div className="space-y-2">
                 <Label htmlFor="amount" className="font-bold text-slate-700">Contract Amount (₦)</Label>
                 <Input
                   id="amount"
                   type="number"
                   placeholder={jobData.amount.toString()}
                   className="h-12 rounded-xl border-slate-200"
                   value={amount}
                   onChange={(e) => setAmount(e.target.value)}
                   required
                   disabled={isSubmitting}
                 />
                 <p className="text-[10px] font-medium text-slate-400 italic">Suggested: ₦ {jobData.amount.toLocaleString()}</p>               </div>

               <div className="space-y-2">
                 <Label htmlFor="referenceId" className="font-bold text-slate-700">Payment Reference</Label>
                 <div className="relative">
                   <Input
                     id="referenceId"
                     placeholder="Enter TXN ID"
                     className={`h-12 rounded-xl border-slate-200 ${referenceExists ? "border-red-500 bg-red-50" : ""}`}
                     value={referenceId}
                     onChange={(e) => setReferenceId(e.target.value)}
                     required
                     disabled={isSubmitting}
                   />
                   {isCheckingReference && <Loader2 className="absolute right-3 top-3 h-6 w-6 animate-spin text-slate-300" />}
                 </div>
                 {referenceError && <p className="text-[10px] font-bold text-red-500 uppercase tracking-tight">{referenceError}</p>}
               </div>
            </div>

            <div className="bg-primary/10 rounded-2xl p-4 border border-orange-100 flex gap-3">
               <ShieldCheck className="h-5 w-5 text-primary shrink-0" />
               <p className="text-[11px] font-medium text-orange-800 leading-relaxed">
                  Funds will be held in our secure <strong>Escrow System</strong>. They will only be released to the freelancer once you approve the final submission in the Workspace.
               </p>
            </div>

            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting} className="flex-1 h-14 rounded-2xl font-bold bg-transparent">
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || referenceExists || isCheckingReference || !referenceId.trim() || !amount}
                className="flex-1 h-14 rounded-2xl bg-primary hover:bg-primary-hover text-white font-black shadow-xl shadow-primary/25"
              >
                {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <DollarSign className="h-5 w-5 mr-2" />}
                Confirm Funding
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
