import * as React from "react"
import { cn } from "@/lib/utils"

interface AuberginePanelProps extends React.HTMLAttributes<HTMLDivElement> {
  shapes?: boolean
  rounded?: "lg" | "xl" | "2xl" | "3xl"
}

const radiusMap = {
  lg: "rounded-[1.25rem]",
  xl: "rounded-[1.5rem]",
  "2xl": "rounded-[2rem]",
  "3xl": "rounded-[3rem]",
} as const

export function AuberginePanel({
  className,
  children,
  shapes = true,
  rounded = "2xl",
  ...props
}: AuberginePanelProps) {
  return (
    <div
      className={cn(
        "relative bg-aubergine text-white overflow-hidden",
        radiusMap[rounded],
        className
      )}
      {...props}
    >
      {shapes && (
        <>
          <div className="pointer-events-none absolute -top-16 -right-12 w-48 h-48 bg-gold rounded-full opacity-95" />
          <div className="pointer-events-none absolute -bottom-10 -left-12 w-36 h-36 bg-primary rounded-full" />
          <div className="pointer-events-none absolute top-[55%] right-8 w-14 h-14 bg-jade rounded-2xl rotate-12" />
        </>
      )}
      <div className="relative z-10 h-full">{children}</div>
    </div>
  )
}
