import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const statBadgeVariants = cva(
  "inline-flex items-center rounded-md border px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider transition-colors",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary/10 text-primary",
        success: "border-transparent bg-success/10 text-success",
        warning: "border-transparent bg-warning/10 text-warning",
        info: "border-transparent bg-info/10 text-info",
        destructive: "border-transparent bg-destructive/10 text-destructive",
        muted: "border-transparent bg-surface-2 text-muted-foreground",
        outline: "border-border bg-transparent text-muted-foreground",
        dark: "border-transparent bg-slate-900 text-white",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface StatBadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof statBadgeVariants> {
  icon?: React.ReactNode
}

function StatBadge({ className, variant, icon, children, ...props }: StatBadgeProps) {
  return (
    <div className={cn(statBadgeVariants({ variant }), className)} {...props}>
      {icon && <span className="mr-1.5">{icon}</span>}
      {children}
    </div>
  )
}

export { StatBadge, statBadgeVariants }
