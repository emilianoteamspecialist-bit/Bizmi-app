import type React from "react"
import type { Metadata } from "next"
import { Inter, Sora, Instrument_Serif, Bricolage_Grotesque } from "next/font/google"
import "./globals.css"
import { AuthProvider } from "@/contexts/AuthContext"
import Script from "next/script"   // ✅ import Script from next

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
})

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-sora",
  display: "swap",
})

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-display",
  display: "swap",
})

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-bricolage",
  display: "swap",
})

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
  generator: "v0.app",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`scroll-smooth ${inter.variable} ${sora.variable} ${instrumentSerif.variable} ${bricolage.variable}`}>
      <head>
        {/* Flaticon UICONS — Regular Rounded */}
        <link
          rel="stylesheet"
          href="https://cdn-uicons.flaticon.com/uicons-regular-rounded/css/uicons-regular-rounded.css"
        />

        {/* ✅ Meta Pixel Code */}
        <Script id="fb-pixel" strategy="afterInteractive">
          {`
            !function(f,b,e,v,n,t,s)
            {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
            n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t,s)}(window, document,'script',
            'https://connect.facebook.net/en_US/fbevents.js');
            fbq('init', '1307800040205456');
            fbq('track', 'PageView');
          `}
        </Script>
      </head>
      <body suppressHydrationWarning>
        <AuthProvider>{children}</AuthProvider>

        {/* Paystack — loaded via next/script so it isn't reconciled into the
            React-managed <head>. A raw <script> there crashed React 19 on
            unmount/Fast Refresh ("Cannot read properties of null (reading 'removeChild')"). */}
        <Script src="https://js.paystack.co/v1/inline.js" strategy="lazyOnload" />

        {/* ✅ NoScript fallback */}
        <noscript>
          <img
            height="1"
            width="1"
            style={{ display: "none" }}
            src="https://www.facebook.com/tr?id=1307800040205456&ev=PageView&noscript=1"
          />
        </noscript>
      </body>
    </html>
  )
}
