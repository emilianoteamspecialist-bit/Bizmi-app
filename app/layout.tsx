import type React from "react"
import type { Metadata } from "next"
import { GeistSans } from "geist/font/sans"
import { GeistMono } from "geist/font/mono"
import "./globals.css"
import { AuthProvider } from "@/contexts/AuthContext"

export const metadata: Metadata = {
  title: "Bizimi - Connect with Top Freelancers & Find Quality Projects",
  description:
    "Bizimi is Nigeria's premier freelancer platform connecting businesses with skilled professionals. Find top talent, post projects, and grow your business with verified freelancers across various industries.",
  keywords:
    "freelancer platform, Nigeria freelancers, hire freelancers, remote work, project marketplace, skilled professionals, business services",
  authors: [{ name: "Bizimi Team" }],
  creator: "Bizimi",
  publisher: "Bizimi",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL("https://bizimee.com"),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Bizimi - Connect with Top Freelancers & Find Quality Projects",
    description:
      "Nigeria's premier freelancer platform connecting businesses with skilled professionals. Find top talent, post projects, and grow your business.",
    url: "https://bizimee.com",
    siteName: "Bizimi",
    locale: "en_NG",
    type: "website",
    images: [
      {
        url: "/favicon.ico",
        width: 1200,
        height: 630,
        alt: "Bizimi - Freelancer Platform",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Bizimi - Connect with Top Freelancers & Find Quality Projects",
    description: "Nigeria's premier freelancer platform connecting businesses with skilled professionals.",
    images: ["/favicon.ico"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  verification: {
    google: "your-google-verification-code",
  },
    generator: 'v0.app'
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <style>{`
html {
  font-family: ${GeistSans.style.fontFamily};
  --font-sans: ${GeistSans.variable};
  --font-mono: ${GeistMono.variable};
}
        `}</style>
        {/* ✅ Paystack Inline Script */}
        <script type="text/javascript" src="https://js.paystack.co/v1/inline.js" defer></script>
      </head>
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  )
}
