import * as React from "react"
import { cn } from "@/lib/utils"

interface SectionProps extends React.HTMLAttributes<HTMLElement> {
  container?: boolean
  spacing?: "none" | "sm" | "md" | "lg" | "xl"
}

const Section = React.forwardRef<HTMLElement, SectionProps>(
  ({ className, container = true, spacing = "md", children, ...props }, ref) => {
    const spacingClasses = {
      none: "",
      sm: "py-8 md:py-12",
      md: "py-12 md:py-20",
      lg: "py-20 md:py-32",
      xl: "py-32 md:py-48",
    }

    return (
      <section
        ref={ref}
        className={cn(spacingClasses[spacing], className)}
        {...props}
      >
        {container ? (
          <div className="container mx-auto px-4 md:px-6 max-w-7xl">
            {children}
          </div>
        ) : (
          children
        )}
      </section>
    )
  }
)
Section.displayName = "Section"

export { Section }
