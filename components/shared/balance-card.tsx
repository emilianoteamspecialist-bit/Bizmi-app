"use client"

import { useState } from "react"
import Link from "next/link"
import { Eye, EyeOff, ArrowUpRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface ActionConfig {
  label: string
  onClick?: () => void
  href?: string
}

interface BalanceCardProps {
  label: string
  amount: string | number
  currency?: string
  description?: string
  icon?: React.ReactNode
  variant?: "default" | "primary" | "dark"
  hideable?: boolean
  primaryAction?: ActionConfig
  secondaryAction?: ActionConfig
  className?: string
}

export function BalanceCard({
  label,
  amount,
  currency = "₦",
  description,
  icon,
  variant = "default",
  hideable,
  primaryAction,
  secondaryAction,
  className,
}: BalanceCardProps) {
  const [hidden, setHidden] = useState(false)
  const variantClasses =
    variant === "primary"
      ? "bg-primary text-white"
      : variant === "dark"
      ? "bg-foreground text-white"
      : "bg-card text-foreground"

  const display = hidden ? "••••" : typeof amount === "number" ? amount.toLocaleString() : amount

  const renderAction = (a: ActionConfig | undefined, primary: boolean) => {
    if (!a) return null
    const isInverted = variant !== "default"
    const btn = (
      <Button
        size="sm"
        variant={primary ? "default" : isInverted ? "ghost" : "outline"}
        onClick={a.onClick}
        className={cn(
          "flex-1",
          primary && variant === "primary" && "bg-white text-primary hover:bg-white/90",
          !primary && isInverted && "text-white/80 hover:text-white hover:bg-white/10",
          primary && "shadow-md"
        )}
      >
        {a.label} {primary && <ArrowUpRight className="h-3.5 w-3.5 ml-1" />}
      </Button>
    )
    return a.href ? (
      <Link href={a.href} className="flex-1">
        {btn}
      </Link>
    ) : (
      btn
    )
  }

  return (
    <div
      className={cn(
        "relative rounded-2xl p-5 shadow-[var(--shadow-grounded)] overflow-hidden",
        variantClasses,
        className
      )}
    >
      <div
        className="absolute -bottom-10 -right-10 w-40 h-40 bg-primary/20 rounded-full blur-3xl pointer-events-none"
        aria-hidden
      />
      <div className="relative space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {icon && (
              <span
                className={cn(
                  "h-8 w-8 rounded-lg flex items-center justify-center",
                  variant === "default" ? "bg-primary-soft text-primary" : "bg-white/10 text-primary"
                )}
              >
                {icon}
              </span>
            )}
            <p
              className={cn(
                "text-[11px] uppercase tracking-[0.22em] font-medium",
                variant === "default" ? "text-muted-foreground" : "text-white/55"
              )}
            >
              {label}
            </p>
          </div>
          {hideable && (
            <button
              onClick={() => setHidden(!hidden)}
              className={cn(
                "transition-colors",
                variant === "default"
                  ? "text-muted-foreground hover:text-foreground"
                  : "text-white/55 hover:text-white"
              )}
              aria-label={hidden ? "Show" : "Hide"}
            >
              {hidden ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
            </button>
          )}
        </div>
        <div className="flex items-baseline gap-1.5">
          <span
            className={cn(
              "text-xl",
              variant === "default" ? "text-muted-foreground" : "text-white/55"
            )}
          >
            {currency}
          </span>
          <span className="text-3xl font-semibold leading-none numeric">{display}</span>
        </div>
        {description && (
          <p
            className={cn(
              "text-xs leading-relaxed",
              variant === "default" ? "text-muted-foreground" : "text-white/70"
            )}
          >
            {description}
          </p>
        )}
        {(primaryAction || secondaryAction) && (
          <div className="flex gap-2 pt-1">
            {renderAction(primaryAction, true)}
            {renderAction(secondaryAction, false)}
          </div>
        )}
      </div>
    </div>
  )
}
