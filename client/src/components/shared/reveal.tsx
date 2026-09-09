import { motion } from "framer-motion"
import type { ReactNode } from "react"

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
