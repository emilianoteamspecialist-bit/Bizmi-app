import * as React from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

interface ModalProps {
  title?: string
  description?: string
  // Screen-reader-only label used when no visible `title` is provided. Radix
  // requires every DialogContent to have an accessible name; defaults to
  // "Dialog" but consumers should pass something meaningful.
  srLabel?: string
  isOpen: boolean
  onClose: () => void
  children: React.ReactNode
  className?: string
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl" | "5xl"
}

export function Modal({
  title,
  description,
  srLabel,
  isOpen,
  onClose,
  children,
  className,
  maxWidth = "lg",
}: ModalProps) {
  const maxWidthClasses = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
    xl: "max-w-xl",
    "2xl": "max-w-2xl",
    "3xl": "max-w-3xl",
    "4xl": "max-w-4xl",
    "5xl": "max-w-5xl",
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className={cn(maxWidthClasses[maxWidth], className)}>
        {title || description ? (
          <DialogHeader className="space-y-2 pb-4">
            <DialogTitle
              className={cn(
                "text-2xl font-bold font-heading",
                !title && "sr-only",
              )}
            >
              {title ?? srLabel ?? "Dialog"}
            </DialogTitle>
            {description && (
              <DialogDescription className="text-muted-foreground font-medium">
                {description}
              </DialogDescription>
            )}
          </DialogHeader>
        ) : (
          <DialogTitle className="sr-only">{srLabel ?? "Dialog"}</DialogTitle>
        )}
        <div className="pt-2">{children}</div>
      </DialogContent>
    </Dialog>
  )
}
