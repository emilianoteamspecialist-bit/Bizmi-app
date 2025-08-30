"use client"

import { Mail, MessageCircle, Instagram, Facebook } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import AgencyNavbar from "@/components/agency-navbar"

export default function FreelancerContactPage() {
  const handleEmailClick = () => {
    window.open("mailto:Bizimisocials12@gmail.com", "_blank")
  }

  const handleWhatsAppClick = (phoneNumber: string, name: string) => {
    const message = encodeURIComponent(`Hello ${name}, I need assistance with Bizimi platform.`)
    window.open(`https://wa.me/${phoneNumber}?text=${message}`, "_blank")
  }

  const handleSocialClick = (url: string) => {
    window.open(url, "_blank")
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-white">
         <AgencyNavbar />
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">Contact Us</h1>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Need help or have questions? We're here to assist you. Reach out to us through any of the channels below.
            </p>
          </div>

          {/* Contact Cards */}
          <div className="grid md:grid-cols-3 gap-8 mb-12">
            {/* Email Contact */}
            <Card className="hover:shadow-lg transition-shadow duration-300 border-orange-200">
              <CardHeader className="text-center">
                <div className="mx-auto w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mb-4">
                  <Mail className="h-8 w-8 text-orange-500" />
                </div>
                <CardTitle className="text-xl text-gray-900">Email Support</CardTitle>
                <CardDescription>Send us an email and we'll get back to you within 24 hours</CardDescription>
              </CardHeader>
              <CardContent className="text-center">
                <Button onClick={handleEmailClick} className="w-full bg-orange-500 hover:bg-orange-600 text-white">
                  <Mail className="mr-2 h-4 w-4" />
                  Email Us
                </Button>
                <p className="text-sm text-gray-500 mt-2">Bizimisocials12@gmail.com</p>
              </CardContent>
            </Card>

            {/* WhatsApp Support */}
            <Card className="hover:shadow-lg transition-shadow duration-300 border-orange-200">
              <CardHeader className="text-center">
                <div className="mx-auto w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mb-4">
                  <MessageCircle className="h-8 w-8 text-orange-600" />
                </div>
                <CardTitle className="text-xl text-gray-900">WhatsApp Support</CardTitle>
                <CardDescription>Chat with us for immediate assistance</CardDescription>
              </CardHeader>
              <CardContent className="text-center">
                <Button
                  onClick={() => handleWhatsAppClick("+2347026875518", "Support")}
                  className="w-full bg-orange-600 hover:bg-orange-700 text-white"
                >
                  <MessageCircle className="mr-2 h-4 w-4" />
                  Chat with Us
                </Button>
                <p className="text-sm text-gray-500 mt-2">+2347026875518</p>
              </CardContent>
            </Card>

            {/* WhatsApp Community */}
            <Card className="hover:shadow-lg transition-shadow duration-300 border-orange-200">
              <CardHeader className="text-center">
                <div className="mx-auto w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mb-4">
                  <MessageCircle className="h-8 w-8 text-orange-400" />
                </div>
                <CardTitle className="text-xl text-gray-900">Join Community</CardTitle>
                <CardDescription>Connect with other freelancers and agencies</CardDescription>
              </CardHeader>
              <CardContent className="text-center">
                <Button
                  onClick={() => handleSocialClick("https://chat.whatsapp.com/H5yku22xKV35cAFDyinj6y?mode=ems_share_c")}
                  className="w-full bg-orange-400 hover:bg-orange-500 text-white"
                >
                  <MessageCircle className="mr-2 h-4 w-4" />
                  Join Community
                </Button>
                <p className="text-sm text-gray-500 mt-2">WhatsApp Group</p>
              </CardContent>
            </Card>
          </div>

            <div className="bg-white rounded-lg shadow-md p-8 border border-orange-200 mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-6 text-center">
              Follow Us on Social Media
            </h2>
            <div className="flex flex-col sm:flex-row justify-center gap-4 sm:gap-6">
              <Button
                onClick={() =>
                  handleSocialClick(
                    "https://www.instagram.com/bizimisocials12?igsh=cDNsNzNwd3h0ejI5"
                  )
                }
                className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 w-full sm:w-auto"
              >
                <Instagram className="mr-2 h-5 w-5" />
                Instagram
              </Button>
              <Button
                onClick={() =>
                  handleSocialClick("https://www.facebook.com/share/15CBRyPXjGf/")
                }
                className="bg-orange-600 hover:bg-orange-700 text-white px-6 py-3 w-full sm:w-auto"
              >
                <Facebook className="mr-2 h-5 w-5" />
                Facebook
              </Button>
              <Button
                onClick={() =>
                  handleSocialClick(
                    "https://www.tiktok.com/@bizimi0?_t=ZM-8zAXJDSR2d3&_r=1"
                  )
                }
                className="bg-orange-400 hover:bg-orange-500 text-white px-6 py-3 w-full sm:w-auto"
              >
                <svg
                  className="mr-2 h-5 w-5"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
                </svg>
                TikTok
              </Button>
            </div>
          </div>
          
          {/* Additional Info */}
          <div className="bg-white rounded-lg shadow-md p-8 border border-orange-200">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4 text-center">How We Can Help</h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-semibold text-orange-500 mb-2">For Freelancers</h3>
                <ul className="text-gray-600 space-y-1">
                  <li>• Account setup and verification</li>
                  <li>• Proposal submission help</li>
                  <li>• Payment and payout assistance</li>
                  <li>• Profile optimization tips</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibent text-orange-500 mb-2">For Agencies</h3>
                <ul className="text-gray-600 space-y-1">
                  <li>• Job posting guidance</li>
                  <li>• Freelancer selection process</li>
                  <li>• Payment and funding support</li>
                  <li>• Platform feature tutorials</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Response Time */}
          <div className="text-center mt-8">
            <p className="text-gray-600">
              <strong>Response Times:</strong> Email within 24 hours • WhatsApp within 2 hours during business hours
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}









