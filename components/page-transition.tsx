"use client"

import { motion } from "framer-motion"
import { usePathname } from "next/navigation"
import type { ReactNode } from "react"

/**
 * Fades each routed page in on navigation. Keyed by pathname so it replays on
 * every route change. Opacity only (no transform) on purpose — a lingering
 * `transform` on this wrapper would become the containing block for the
 * `position: fixed` modals inside the pages and break their full-screen layout.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  return (
    <motion.div
      key={pathname}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="min-w-0"
    >
      {children}
    </motion.div>
  )
}
