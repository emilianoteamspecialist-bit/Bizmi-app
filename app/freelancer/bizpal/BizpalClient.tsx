"use client"
import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Coins, Filter, X, Mail, ArrowRight, Wallet } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/contexts/AuthContext"
import dynamic from "next/dynamic"

const TopItModal = dynamic(() => import("@/components/topit-modal"), { ssr: false })

interface CreditPurchase {
  id: string
  amount: number
  credits_amount: number
  status: string
  created_at: string
  paystack_reference: string
}

interface BizpalClientProps {
  initialCreditPurchases: CreditPurchase[]
  initialCurrentCredits: number
}

const payoutSteps = [
  "An agency funds a job.",
  "You click Verify to verify the payment.",
  "You click Confirm to confirm the job.",
  "You deliver the work successfully.",
  "The agency clicks Job done on their side.",
  "The Payout button becomes visible.",
  "Click Payout, enter your correct bank details, and withdraw.",
]

export default function BizpalClient({
  initialCreditPurchases,
  initialCurrentCredits,
}: BizpalClientProps) {
  const { user, loading: authLoading } = useAuth()
  const [creditPurchases, setCreditPurchases] = useState<CreditPurchase[]>(initialCreditPurchases)
  const [filteredCreditPurchases, setFilteredCreditPurchases] = useState<CreditPurchase[]>(initialCreditPurchases)
  const [currentCredits, setCurrentCredits] = useState(initialCurrentCredits)
  const [loading, setLoading] = useState(false)
  const [showTopItModal, setShowTopItModal] = useState(false)
  const [showDateFilter, setShowDateFilter] = useState(false)
  const [fromDate, setFromDate] = useState("")
  const [toDate, setToDate] = useState("")
  // Initial credit/purchase data is seeded from the server component props, so
  // skip the first mount fetch. Keep loadBizpalData() for refetches (e.g. after
  // a successful top-up).
  const didMountRef = useRef(false)

  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true
      return
    }
    if (authLoading) return
    if (!user?.id) {
      return
    }
    loadBizpalData()
  }, [user?.id, authLoading])

  useEffect(() => {
    filterCreditPurchases()
  }, [creditPurchases, fromDate, toDate])

  const loadBizpalData = async () => {
    try {
      if (!user) {
        setLoading(false)
        return
      }

      // Calculate total credits from completed purchases for this specific user only - Updated logic
      const { data: creditsData, error: creditsError } = await supabase
        .from("purchase_credits")
        .select("credits_amount, status")
        .eq("freelancer_id", user.id)
        .eq("status", "completed")

      if (creditsError) {
        console.error("Error loading credit purchases:", creditsError)
      } else if (creditsData) {
        // Calculate net credits (positive purchases minus negative deductions)
        const totalCreditsFromPurchases = creditsData.reduce((sum, purchase) => {
          return sum + (purchase.credits_amount || 0)
        }, 0)

        // Ensure credits don't go below 0
        const finalCredits = Math.max(0, totalCreditsFromPurchases)
        setCurrentCredits(finalCredits)
        console.log("Bizpal - Total credits calculated:", finalCredits)
      }

      // Load credit purchases history for display
      const { data: purchaseHistoryData, error: purchaseHistoryError } = await supabase
        .from("purchase_credits")
        .select("*")
        .eq("freelancer_id", user.id)
        .order("created_at", { ascending: false })

      if (purchaseHistoryError) {
        console.error("Error loading credit purchase history:", purchaseHistoryError)
      } else if (purchaseHistoryData) {
        setCreditPurchases(purchaseHistoryData)
      }
    } catch (error) {
      console.error("Error loading Bizpal data:", error)
    } finally {
      setLoading(false)
    }
  }

  const filterCreditPurchases = () => {
    let filtered = creditPurchases

    if (fromDate || toDate) {
      filtered = creditPurchases.filter((purchase) => {
        const purchaseDate = new Date(purchase.created_at)
        const from = fromDate ? new Date(fromDate) : null
        const to = toDate ? new Date(toDate) : null

        if (from && to) {
          return purchaseDate >= from && purchaseDate <= to
        } else if (from) {
          return purchaseDate >= from
        } else if (to) {
          return purchaseDate <= to
        }
        return true
      })
    }

    setFilteredCreditPurchases(filtered)
  }

  const clearDateFilter = () => {
    setFromDate("")
    setToDate("")
    setShowDateFilter(false)
  }

  const handleTopItSuccess = () => {
    loadBizpalData() // Reload data after successful purchase
  }

  const handleSubmitQuery = () => {
    window.location.href =
      "mailto:contact@bizimii.com?subject=Bizpal Query&body=Hello, I have a query regarding..."
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
      currencyDisplay: "symbol",
    })
      .format(amount)
      .replace(/NGN/, "₦")
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-surface">
        <div className="max-w-6xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-foreground/5 rounded w-1/4" />
            <div className="h-32 bg-card border border-border rounded-xl sm:max-w-sm" />
            <div className="grid lg:grid-cols-2 gap-6">
              <div className="h-64 bg-card border border-border rounded-xl" />
              <div className="h-64 bg-card border border-border rounded-xl" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface pb-20">
      <div className="max-w-6xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Wallet</p>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Bizpal</h1>
            <p className="text-sm text-muted-foreground">Manage your payments and credits.</p>
          </div>
          <Button
            onClick={() => window.open("https://paystack.shop/pay/m7uebavu00", "_blank")}
            className="h-10 px-4 rounded-lg shrink-0 w-full sm:w-auto"
          >
            Buy credits
          </Button>
        </header>

        {/* Available Credits Card */}
        {/* Balance banner */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-aubergine via-ink to-ink p-6 sm:p-8 text-white shadow-lg shadow-aubergine/20 mb-6">
          <div className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 rounded-full bg-primary/30 blur-3xl" aria-hidden />
          <div className="pointer-events-none absolute right-10 -bottom-6 opacity-[0.06]" aria-hidden>
            <Coins className="h-32 w-32" />
          </div>
          <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-white/10 flex items-center justify-center">
                  <Coins className="h-4 w-4 text-primary" />
                </div>
                <p className="text-[11px] font-medium uppercase tracking-[0.15em] text-white/60">Available credits</p>
              </div>
              <p className="mt-3 text-5xl font-semibold tracking-tight tabular-nums">{currentCredits.toLocaleString()}</p>
              <p className="mt-1 text-xs text-white/50">≈ ₦{(currentCredits * 50).toLocaleString()} · ₦50 per credit</p>
            </div>
            <div className="flex flex-col gap-2 sm:items-end">
              <Button
                onClick={() => setShowTopItModal(true)}
                className="bg-primary text-white hover:bg-primary-hover sm:px-8"
              >
                Top up credits
              </Button>
              <p className="text-[11px] text-white/40">Min: 10 credits (₦500)</p>
            </div>
          </div>
        </div>

        {/* History + how payout works */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Credits Purchase History */}
          <Card className="rounded-xl border border-border bg-card shadow-none">
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle className="flex items-center gap-2 text-base font-semibold">
                  <Coins className="h-5 w-5 text-primary" />
                  Credits Purchase History
                </CardTitle>
                <Button
                  onClick={() => setShowDateFilter(!showDateFilter)}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2"
                >
                  <Filter className="h-4 w-4" />
                  Filter
                </Button>
              </div>

              {/* Date Filter Section */}
              {showDateFilter && (
                <div className="mt-4 p-4 bg-surface-2 rounded-lg border border-border">
                  <div className="flex flex-col sm:flex-row gap-4">
                    <div className="flex-1">
                      <Label htmlFor="fromDate" className="text-sm font-medium">
                        From Date
                      </Label>
                      <Input
                        id="fromDate"
                        type="date"
                        value={fromDate}
                        onChange={(e) => setFromDate(e.target.value)}
                        className="mt-1"
                      />
                    </div>
                    <div className="flex-1">
                      <Label htmlFor="toDate" className="text-sm font-medium">
                        To Date
                      </Label>
                      <Input
                        id="toDate"
                        type="date"
                        value={toDate}
                        onChange={(e) => setToDate(e.target.value)}
                        className="mt-1"
                      />
                    </div>
                    <div className="flex items-end">
                      <Button
                        onClick={clearDateFilter}
                        variant="outline"
                        size="sm"
                        className="flex items-center gap-2 bg-transparent"
                      >
                        <X className="h-4 w-4" />
                        Clear
                      </Button>
                    </div>
                  </div>
                  {(fromDate || toDate) && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Showing {filteredCreditPurchases.length} of {creditPurchases.length} purchases
                    </p>
                  )}
                </div>
              )}
            </CardHeader>
            <CardContent>
              {filteredCreditPurchases.length === 0 ? (
                <div className="text-center py-12">
                  <div className="mx-auto h-11 w-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                    <Coins className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 text-sm font-semibold text-foreground">
                    {creditPurchases.length === 0 ? "No credits purchased yet" : "No purchases found"}
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground max-w-sm mx-auto">
                    {creditPurchases.length === 0
                      ? "Purchase credits to access premium features and services."
                      : "Try adjusting your date filter to see more results."}
                  </p>
                  {creditPurchases.length === 0 && (
                    <p className="mt-2 text-xs text-muted-foreground">Rate: 10 credits = ₦500 (₦50 per credit)</p>
                  )}
                </div>
              ) : (
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {filteredCreditPurchases.map((purchase) => (
                    <div
                      key={purchase.id}
                      className="flex items-center justify-between gap-3 p-4 border border-border rounded-lg transition-colors hover:bg-surface/60"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-10 w-10 shrink-0 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Coins className="h-5 w-5 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-sm font-medium text-foreground truncate">
                            {purchase.credits_amount > 0 ? "Credits purchase" : "Credits used (job bid)"}
                          </h4>
                          <p className="text-xs text-muted-foreground">
                            {Math.abs(purchase.credits_amount).toLocaleString()} credits
                          </p>
                          <p className="text-xs text-muted-foreground">{formatDate(purchase.created_at)}</p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p
                          className={`text-sm font-semibold tabular-nums ${purchase.credits_amount > 0 ? "text-foreground" : "text-destructive"}`}
                        >
                          {purchase.credits_amount > 0
                            ? formatCurrency(purchase.amount)
                            : `${purchase.credits_amount} credits`}
                        </p>
                        <span
                          className={`mt-1 inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${
                            purchase.status === "completed"
                              ? "bg-success/10 text-success"
                              : purchase.status === "pending"
                                ? "bg-warning/10 text-warning"
                                : "bg-destructive/10 text-destructive"
                          }`}
                        >
                          {purchase.status === "completed" ? "Completed" : purchase.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* How Payout Works */}
          <Card className="rounded-xl border border-border bg-card shadow-none">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <Wallet className="h-5 w-5 text-primary" />
                How payout works
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <ol className="relative">
                  {payoutSteps.map((step, i) => (
                    <li key={i} className="relative flex gap-4 pb-5 last:pb-0">
                      {i < payoutSteps.length - 1 && (
                        <span className="absolute left-4 top-8 bottom-0 w-px -translate-x-1/2 bg-border" aria-hidden />
                      )}
                      <span className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary text-xs font-semibold tabular-nums">
                        {i + 1}
                      </span>
                      <p className="pt-1.5 text-sm text-foreground">{step}</p>
                    </li>
                  ))}
                </ol>

                <div className="pt-4 border-t border-border">
                  <p className="text-sm text-muted-foreground mb-4">
                    Have questions about failed transactions or need support? Contact us directly.
                  </p>
                  <Button onClick={handleSubmitQuery} className="w-full gap-2">
                    <Mail className="h-4 w-4" />
                    Submit query
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Top It Modal */}
      <TopItModal isOpen={showTopItModal} onClose={() => setShowTopItModal(false)} onSuccess={handleTopItSuccess} />
    </div>
  )
}
