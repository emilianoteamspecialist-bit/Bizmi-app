"use client"

import { cn } from "@/lib/utils"
import React from "react"

interface SectionProps extends React.HTMLAttributes<HTMLElement> {
  containerClassName?: string
  variant?: "default" | "muted" | "primary" | "dark"
}

export function Section({ 
  children, 
  className, 
  containerClassName, 
  variant = "default",
  ...props 
}: SectionProps) {
  const variants = {
    default: "bg-transparent",
    muted: "bg-slate-50/50",
    primary: "bg-primary text-primary-foreground",
    dark: "bg-slate-900 text-white"
  }

  return (
    <section 
      className={cn("py-16 md:py-24", variants[variant], className)} 
      {...props}
    >
      <div className={cn("max-w-7xl mx-auto px-4 sm:px-6 lg:px-8", containerClassName)}>
        {children}
      </div>
    </section>
  )
}

export function PageHeader({ 
  title, 
  description, 
  children,
  className 
}: { 
  title: string; 
  description?: string; 
  children?: React.ReactNode;
  className?: string 
}) {
  return (
    <div className={cn("space-y-4 mb-8", className)}>
      <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
        {title}
      </h1>
      {description && (
        <p className="text-slate-500 font-bold text-lg max-w-2xl leading-relaxed">
          {description}
        </p>
      )}
      {children}
    </div>
  )
}
