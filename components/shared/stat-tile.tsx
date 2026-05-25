"use client"

import Link from "next/link"
import { TrendingUp, TrendingDown } from "lucide-react"
import { cn } from "@/lib/utils"

type StatTileSize = "sm" | "md" | "lg"
type StatTileVariant = "default" | "primary" | "dark"

interface StatTileProps {
  label: string
  value: string | number
  unit?: string
  caption?: string
  delta?: { value: string; direction?: "up" | "down" | "flat" }
  href?: string
  onClick?: () => void
  icon?: React.ReactNode
  size?: StatTileSize
  variant?: StatTileVariant
  spark?: number[]
  className?: string
  /** When true, this tile occupies 2 columns in the parent grid. */
  span2?: boolean
}

export function StatTile({
  label,
  value,
  unit,
  caption,
  delta,
  href,
  onClick,
  icon,
  size = "md",
  variant = "default",
  spark,
  className,
  span2,
}: StatTileProps) {
  const valueSize = size === "lg" ? "text-4xl" : size === "sm" ? "text-xl" : "text-2xl"
  const padding = size === "lg" ? "p-5" : size === "sm" ? "p-4" : "p-5"
  const variantClasses =
    variant === "primary"
      ? "bg-primary text-white"
      : variant === "dark"
      ? "bg-foreground text-white"
      : "bg-card text-foreground"

  const eyebrowClass = variant === "default" ? "eyebrow" : "text-[11px] uppercase tracking-[0.22em] font-medium text-white/55"
  const captionClass = variant === "default" ? "text-xs text-muted-foreground" : "text-xs text-white/70"
  const unitClass = variant === "default" ? "text-xs text-muted-foreground font-medium" : "text-xs text-white/55 font-medium"

  const content = (
    <div
      className={cn(
        "group relative rounded-2xl shadow-[var(--shadow-soft)] hover:shadow-[var(--shadow-grounded)] transition-shadow text-left w-full overflow-hidden h-full",
        padding,
        variantClasses,
        span2 && "col-span-2",
        className
      )}
    >
      {variant === "default" && (
        <div
          className="absolute -bottom-10 -right-10 w-40 h-40 bg-primary/5 rounded-full blur-2xl pointer-events-none"
          aria-hidden
        />
      )}
      <div className="relative flex items-start justify-between gap-3">
        <div className="space-y-2.5 min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            {icon && <span className={cn("shrink-0", variant === "default" ? "text-muted-foreground" : "text-white/70")}>{icon}</span>}
            <p className={eyebrowClass}>{label}</p>
          </div>
          <div className="flex items-baseline gap-1.5 flex-wrap">
            <span className={cn(valueSize, "font-semibold leading-none numeric")}>{value}</span>
            {unit && <span className={unitClass}>{unit}</span>}
            {delta && (
              <span
                className={cn(
                  "text-[10px] font-semibold inline-flex items-center gap-0.5",
                  delta.direction === "down"
                    ? "text-destructive"
                    : delta.direction === "flat"
                    ? variant === "default" ? "text-muted-foreground" : "text-white/55"
                    : "text-success"
                )}
              >
                {delta.direction === "down" ? (
                  <TrendingDown className="h-2.5 w-2.5" />
                ) : delta.direction === "flat" ? null : (
                  <TrendingUp className="h-2.5 w-2.5" />
                )}
                {delta.value}
              </span>
            )}
          </div>
          {caption && <p className={captionClass}>{caption}</p>}
        </div>
        {spark && spark.length > 0 && (
          <div className="flex items-end gap-1 h-10 shrink-0 pt-1">
            {spark.map((h, i) => (
              <span
                key={i}
                className={cn(
                  "w-1.5 rounded-full transition-colors duration-300",
                  variant === "default" ? "bg-primary/25 group-hover:bg-primary/55" : "bg-white/20 group-hover:bg-white/40"
                )}
                style={{ height: `${Math.max(8, Math.min(100, h))}%`, transitionDelay: `${i * 30}ms` }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )

  if (href) return <Link href={href} className={cn("block", span2 && "col-span-2")}>{content}</Link>
  if (onClick) return <button onClick={onClick} className={cn("block w-full text-left", span2 && "col-span-2")}>{content}</button>
  return content
}
