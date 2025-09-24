// lib/fbpixel.ts
export const fbq = (event: string, params?: Record<string, any>) => {
  if (typeof window !== "undefined" && (window as any).fbq) {
    ;(window as any).fbq("track", event, params)
  }
}

// Common event shortcuts
export const trackSignUp = () => fbq("CompleteRegistration")
export const trackPurchase = (value: number, currency = "USD") => fbq("Purchase", { value, currency })
export const trackLead = () => fbq("Lead")
