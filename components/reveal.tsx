"use client"

import { motion } from "framer-motion"
import type { ReactNode } from "react"

/**
 * Fades + lifts its children into view as they scroll into the viewport.
 * Opacity + a small y only. Don't wrap elements that contain
 * `position: fixed` modals — a lingering transform would re-anchor them.
 *
 * - `repeat`: when true, the animation re-runs every time the element
 *   re-enters the viewport (instead of only the first time).
 */
export function Reveal({
  children,
  className,
  delay = 0,
  repeat = false,
}: {
  children: ReactNode
  className?: string
  delay?: number
  repeat?: boolean
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: !repeat, margin: "-60px" }}
      transition={{ duration: 0.45, ease: "easeOut", delay }}
    >
      {children}
    </motion.div>
  )
}
