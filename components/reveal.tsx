"use client"

import { motion } from "framer-motion"
import type { ReactNode } from "react"

/**
 * Fades + lifts its children into view as they scroll into the viewport.
 * Opacity + a small y only; runs once. Don't wrap elements that contain
 * `position: fixed` modals — a lingering transform would re-anchor them.
 */
export function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode
  className?: string
  delay?: number
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.45, ease: "easeOut", delay }}
    >
      {children}
    </motion.div>
  )
}
