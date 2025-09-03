"use client"
import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Coins, Filter, X, Mail, ArrowRight } from "lucide-react"
import { supabase } from "@/lib/supabase"
import FreelancerNavbar from "@/components/freelancer-navbar"
import TopItModal from "@/components/topit-modal"

interface CreditPurchase {
  id: string
  amount: number
  credits_amount: number
  status: string
  created_at: string
  paystack_reference: string
}

export default function BizpalPage() {
  const [creditPurchases, setCreditPurchases] = useState<CreditPurchase[]>([])
  const [filteredCreditPurchases, setFilteredCreditPurchases] = useState<CreditPurchase[]>([])
  const [currentCredits, setCurrentCredits] = useState(0)
  const [loading, setLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [showTopItModal, setShowTopItModal] = useState(false)
  const [showDateFilter, setShowDateFilter] = useState(false)
  const [fromDate, setFromDate] = useState("")
  const [toDate, setToDate] = useState("")

  useEffect(() => {
    loadBizpalData()
  }, [])

  useEffect(() => {
    filterCreditPurchases()
  }, [creditPurchases, fromDate, toDate])

  const loadBizpalData = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        setLoading(false)
        return
      }

      setCurrentUserId(user.id)

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
      "mailto:Bizimisocials12@gmail.com?subject=Bizpal Query&body=Hello, I have a query regarding..."
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
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <FreelancerNavbar />
        <div className="max-w-6xl mx-auto py-8 px-4">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-300 rounded w-1/4 mb-6"></div>
            <div className="grid grid-cols-1 md:grid-cols-1 gap-6 mb-8">
              <div className="h-32 bg-gray-300 rounded"></div>
            </div>
            <div className="space-y-4">
              <div className="h-64 bg-gray-300 rounded"></div>
              <div className="h-64 bg-gray-300 rounded"></div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <FreelancerNavbar />

      <div className="max-w-6xl mx-auto py-8 px-4">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Bizpal</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">Manage your payments and credits</p>
          </div>
          <Button
            onClick={() => window.open("https://paystack.shop/pay/m7uebavu00", "_blank")}
            className="bg-orange-500 hover:bg-orange-600 border-orange-500 text-white"
          >
            Buy Credits
          </Button>
        </div>

        {/* Available Credits Card */}
        <div className="grid grid-cols-1 md:grid-cols-1 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Available Credits</p>
                  <p className="text-2xl font-bold text-orange-600">{currentCredits.toLocaleString()}</p>
                </div>
                <div className="h-12 w-12 bg-orange-100 dark:bg-orange-900/20 rounded-full flex items-center justify-center">
                  <Coins className="h-6 w-6 text-orange-600" />
                </div>
              </div>
              <Button
                onClick={() => setShowTopItModal(true)}
                size="sm"
                className="w-full mt-3 bg-orange-500 hover:bg-orange-600"
              >
                Top It
              </Button>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 text-center">Min: 10 credits (₦500)</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Credits Purchase History */}
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle className="flex items-center gap-2">
                  <Coins className="h-5 w-5 text-orange-500" />
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
                <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border">
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
                    <p className="text-xs text-gray-500 mt-2">
                      Showing {filteredCreditPurchases.length} of {creditPurchases.length} purchases
                    </p>
                  )}
                </div>
              )}
            </CardHeader>
            <CardContent>
              {filteredCreditPurchases.length === 0 ? (
                <div className="text-center py-8">
                  <Coins className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                    {creditPurchases.length === 0 ? "No credits purchased yet" : "No purchases found"}
                  </h3>
                  <p className="text-gray-500 dark:text-gray-400">
                    {creditPurchases.length === 0
                      ? "Purchase credits to access premium features and services."
                      : "Try adjusting your date filter to see more results."}
                  </p>
                  {creditPurchases.length === 0 && (
                    <p className="text-sm text-gray-400 mt-2">Rate: 10 credits = ₦500 (₦50 per credit)</p>
                  )}
                </div>
              ) : (
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {filteredCreditPurchases.map((purchase) => (
                    <div
                      key={purchase.id}
                      className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="h-10 w-10 bg-orange-100 dark:bg-orange-900/20 rounded-full flex items-center justify-center">
                          <Coins className="h-5 w-5 text-orange-600" />
                        </div>
                        <div>
                          <h4 className="font-medium text-gray-900 dark:text-white">
                            {purchase.credits_amount > 0 ? "Credits Purchase" : "Credits Used (Job Bid)"}
                          </h4>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {Math.abs(purchase.credits_amount).toLocaleString()} credits
                          </p>
                          <p className="text-xs text-gray-400">{formatDate(purchase.created_at)}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p
                          className={`font-semibold ${purchase.credits_amount > 0 ? "text-gray-900 dark:text-white" : "text-red-600"}`}
                        >
                          {purchase.credits_amount > 0
                            ? formatCurrency(purchase.amount)
                            : `${purchase.credits_amount} credits`}
                        </p>
                        <Badge
                          className={`${
                            purchase.status === "completed"
                              ? "bg-green-100 text-green-800"
                              : purchase.status === "pending"
                                ? "bg-orange-100 text-orange-800"
                                : "bg-red-100 text-red-800"
                          }`}
                        >
                          {purchase.status === "completed" ? "Completed" : purchase.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* How Payout Works */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5 text-orange-500" />
                How Payout Works
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-6 h-6 bg-orange-500 text-white rounded-full flex items-center justify-center text-sm font-semibold">
                      1
                    </div>
                    <p className="text-gray-700 dark:text-gray-300">Agency funds a job</p>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-6 h-6 bg-orange-500 text-white rounded-full flex items-center justify-center text-sm font-semibold">
                      2
                    </div>
                    <p className="text-gray-700 dark:text-gray-300">You click on 'verify' button, to verify payment</p>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-6 h-6 bg-orange-500 text-white rounded-full flex items-center justify-center text-sm font-semibold">
                      3
                    </div>
                
                    <p className="text-gray-700 dark:text-gray-300">    You click on the 'Biz' button for confirmation</p>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-6 h-6 bg-orange-500 text-white rounded-full flex items-center justify-center text-sm font-semibold">
                      4
                    </div>
                    <p className="text-gray-700 dark:text-gray-300">Upon successful job delivery</p>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-6 h-6 bg-orange-500 text-white rounded-full flex items-center justify-center text-sm font-semibold">
                      5
                    </div>
                    <p className="text-gray-700 dark:text-gray-300">Agency clicks on 'job done' on their side</p>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-6 h-6 bg-orange-500 text-white rounded-full flex items-center justify-center text-sm font-semibold">
                      6
                    </div>
                    <p className="text-gray-700 dark:text-gray-300">
                    'Payout' button becomes visible
                    </p>
                  </div>

                   <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-6 h-6 bg-orange-500 text-white rounded-full flex items-center justify-center text-sm font-semibold">
                      6
                    </div>
                    <p className="text-gray-700 dark:text-gray-300">
              Click on 'payout' button, fill in your correct bank details and withdraw
                    </p>
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    Have questions about failed transactions or need support? Contact us directly.
                  </p>
                  <Button
                    onClick={handleSubmitQuery}
                    className="w-full bg-orange-500 hover:bg-orange-600 text-white flex items-center justify-center gap-2"
                  >
                    <Mail className="h-4 w-4" />
                    Submit Query
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
