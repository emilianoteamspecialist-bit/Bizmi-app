import { useState } from "react"
import { Link, Navigate } from "react-router-dom"
import { Coins, Filter, Mail, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/contexts/AuthContext"
import { useDashboardQuery } from "@/lib/queries/user"
import { useCreditsHistoryQuery, type CreditPurchase } from "@/lib/queries/credits"
import { formatNaira } from "@/lib/format"
import { cn } from "@/lib/utils"
import { EmptyState, PageContainer, PageHeader, Panel, SkeletonBlock } from "@/components/marketplace/primitives"
import TopUpCreditsModal, { CREDITS_RATE } from "./TopUpCreditsModal"

const CREDIT_FACTS = [
  "You spend credits to send a bid. Each job shows its cost, between 5 and 20 credits.",
  `Credits cost ₦${CREDITS_RATE} each. The smallest top-up is 10 credits (₦${(CREDITS_RATE * 10).toLocaleString()}).`,
  "Credits pay for bids only. What you earn from a job is held in escrow and paid out from My jobs.",
]

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString("en-NG", { year: "numeric", month: "short", day: "numeric" })
}

function statusClass(status: string) {
  if (status === "completed") return "text-success"
  if (status === "pending") return "text-warning"
  return "text-destructive"
}

/** The freelancer's credits: balance, top-up, and every purchase and spend. */
export default function Bizpal() {
  const { profile } = useAuth()
  const dashboard = useDashboardQuery()
  const history = useCreditsHistoryQuery()
  const [showTopUpModal, setShowTopUpModal] = useState(false)
  const [showDateFilter, setShowDateFilter] = useState(false)
  const [fromDate, setFromDate] = useState("")
  const [toDate, setToDate] = useState("")

  if (profile && profile.account_type !== "freelancer") {
    return <Navigate to="/" replace />
  }

  if (dashboard.isLoading || history.isLoading) {
    return (
      <PageContainer>
        <div data-testid="bizpal-skeleton" className="space-y-6" aria-label="Loading credits">
          <SkeletonBlock className="h-8 w-48" />
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-5">
              <SkeletonBlock className="h-32" />
              <SkeletonBlock className="h-64" />
            </div>
            <SkeletonBlock className="h-64" />
          </div>
        </div>
      </PageContainer>
    )
  }

  const currentCredits = dashboard.data?.credits ?? 0
  const purchases: CreditPurchase[] = history.data?.purchases ?? []

  const filteredPurchases = purchases.filter((purchase) => {
    const purchaseDate = new Date(purchase.created_at)
    if (fromDate && purchaseDate < new Date(fromDate)) return false
    if (toDate && purchaseDate > new Date(toDate)) return false
    return true
  })

  const clearDateFilter = () => {
    setFromDate("")
    setToDate("")
    setShowDateFilter(false)
  }

  return (
    <PageContainer>
      <PageHeader title="Credits" description="Your balance, top-ups and the credits you've spent on bids." />

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-5">
          <section aria-label="Balance" className="flex flex-col gap-4 rounded-lg border border-border bg-card p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Available credits</p>
              <p className="mt-1 font-heading text-4xl font-semibold tabular-nums tracking-tight text-foreground">{currentCredits.toLocaleString()}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Enough for {Math.floor(currentCredits / 5)} bid{Math.floor(currentCredits / 5) === 1 ? "" : "s"} on a 5-credit job
              </p>
            </div>
            <Button onClick={() => setShowTopUpModal(true)} className="sm:px-6">
              <Coins /> Top up credits
            </Button>
          </section>

          <Panel
            title="History"
            action={
              <Button onClick={() => setShowDateFilter(!showDateFilter)} variant="ghost" size="sm" aria-expanded={showDateFilter}>
                <Filter /> Filter
              </Button>
            }
          >
            {showDateFilter && (
              <div className="mb-4 rounded-md border border-border bg-surface p-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                  <div className="flex-1">
                    <Label htmlFor="fromDate" className="text-xs font-medium">
                      From date
                    </Label>
                    <Input id="fromDate" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="mt-1" />
                  </div>
                  <div className="flex-1">
                    <Label htmlFor="toDate" className="text-xs font-medium">
                      To date
                    </Label>
                    <Input id="toDate" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="mt-1" />
                  </div>
                  <Button onClick={clearDateFilter} variant="outline" size="sm">
                    <X /> Clear
                  </Button>
                </div>
                {(fromDate || toDate) && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Showing {filteredPurchases.length} of {purchases.length}
                  </p>
                )}
              </div>
            )}

            {filteredPurchases.length === 0 ? (
              purchases.length === 0 ? (
                <EmptyState
                  className="border-0 py-8"
                  icon={<Coins className="h-5 w-5" />}
                  title="No credits purchased yet"
                  description="Top up to start bidding on jobs."
                />
              ) : (
                <EmptyState className="border-0 py-8" title="No purchases found" description="Try a wider date range." />
              )
            ) : (
              <ul className="-my-2 max-h-96 divide-y divide-border overflow-y-auto">
                {filteredPurchases.map((purchase) => {
                  const isSpend = purchase.credits_amount < 0
                  return (
                    <li key={purchase.id} className="flex items-center justify-between gap-3 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">{isSpend ? "Credits used (job bid)" : "Credits purchase"}</p>
                        <p className="text-xs text-muted-foreground">
                          <span className="tabular-nums">{Math.abs(purchase.credits_amount).toLocaleString()} credits</span> · {formatDate(purchase.created_at)}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className={cn("text-sm font-semibold tabular-nums", isSpend ? "text-muted-foreground" : "text-foreground")}>
                          {isSpend ? `${purchase.credits_amount} credits` : formatNaira(purchase.amount)}
                        </p>
                        <p className={cn("text-[11px] font-medium capitalize", statusClass(purchase.status))}>{purchase.status}</p>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </Panel>
        </div>

        <aside className="space-y-5" aria-label="About credits">
          <Panel title="How credits work">
            <ul className="space-y-3 text-sm text-foreground">
              {CREDIT_FACTS.map((fact) => (
                <li key={fact} className="flex gap-2">
                  <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-muted-foreground" aria-hidden />
                  {fact}
                </li>
              ))}
            </ul>
            <Button asChild variant="outline" className="mt-4 w-full">
              <Link to="/freelancer/funded-jobs">Go to my jobs and payouts</Link>
            </Button>
          </Panel>
          <Panel title="Payment problem?">
            <p className="text-sm text-muted-foreground">If a top-up didn't arrive or a payment failed, email us with your payment reference.</p>
            <Button asChild variant="ghost" className="mt-3 w-full">
              <a href="mailto:contact@bizimii.com?subject=Bizpal%20query">
                <Mail /> Email support
              </a>
            </Button>
          </Panel>
        </aside>
      </div>

      <TopUpCreditsModal isOpen={showTopUpModal} onClose={() => setShowTopUpModal(false)} onSuccess={() => setShowTopUpModal(false)} />
    </PageContainer>
  )
}
