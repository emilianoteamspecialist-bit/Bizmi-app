import { cn } from "@/lib/utils"

interface MetricRingProps {
  value: number // 0-100
  label?: string
  description?: string
  size?: number
  stroke?: number
  className?: string
  tone?: "primary" | "success" | "warning"
  showLabel?: boolean
}

export function MetricRing({
  value,
  label,
  description,
  size = 64,
  stroke = 3,
  className,
  tone = "primary",
  showLabel = true,
}: MetricRingProps) {
  const radius = 18 - stroke / 2
  const circumference = 2 * Math.PI * radius
  const safe = Math.max(0, Math.min(100, value))
  const dash = (safe / 100) * circumference
  const colorClass =
    tone === "success" ? "text-success" : tone === "warning" ? "text-warning" : "text-primary"

  return (
    <div className={cn("flex items-center gap-4", className)}>
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg viewBox="0 0 36 36" className="-rotate-90" style={{ width: size, height: size }}>
          <circle
            cx="18"
            cy="18"
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={stroke}
            className="text-surface-2"
          />
          <circle
            cx="18"
            cy="18"
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circumference}`}
            className={cn(colorClass, "transition-all duration-700")}
          />
        </svg>
        {showLabel && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-sm font-semibold text-foreground numeric">
              {Math.round(safe)}%
            </span>
          </div>
        )}
      </div>
      {(label || description) && (
        <div className="min-w-0 flex-1">
          {label && <p className="text-xs font-semibold text-foreground">{label}</p>}
          {description && (
            <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">{description}</p>
          )}
        </div>
      )}
    </div>
  )
}
