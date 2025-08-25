"use client"

import { Mail, MessageCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function ContactPage() {
  const handleEmailClick = () => {
    window.open("mailto:bizimi@gmail.com", "_blank")
  }

  const handleWhatsAppClick = (phoneNumber: string, name: string) => {
    const message = encodeURIComponent(`Hello ${name}, I need assistance with Bizimi platform.`)
    window.open(`https://wa.me/${phoneNumber}?text=${message}`, "_blank")
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-white">
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
                <p className="text-sm text-gray-500 mt-2">bizimi@gmail.com</p>
              </CardContent>
            </Card>

            {/* WhatsApp - Mubarack */}
            <Card className="hover:shadow-lg transition-shadow duration-300 border-orange-200">
              <CardHeader className="text-center">
                <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                  <MessageCircle className="h-8 w-8 text-green-500" />
                </div>
                <CardTitle className="text-xl text-gray-900">WhatsApp - Mubarack</CardTitle>
                <CardDescription>Chat with Mubarack for immediate assistance</CardDescription>
              </CardHeader>
              <CardContent className="text-center">
                <Button
                  onClick={() => handleWhatsAppClick("2347052345295", "Mubarack")}
                  className="w-full bg-green-500 hover:bg-green-600 text-white"
                >
                  <MessageCircle className="mr-2 h-4 w-4" />
                  Chat with Mubarack
                </Button>
                <p className="text-sm text-gray-500 mt-2">+234 705 234 5295</p>
              </CardContent>
            </Card>

            {/* WhatsApp - Emiliano */}
            <Card className="hover:shadow-lg transition-shadow duration-300 border-orange-200">
              <CardHeader className="text-center">
                <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                  <MessageCircle className="h-8 w-8 text-green-500" />
                </div>
                <CardTitle className="text-xl text-gray-900">WhatsApp - Emiliano</CardTitle>
                <CardDescription>Chat with Emiliano for technical support</CardDescription>
              </CardHeader>
              <CardContent className="text-center">
                <Button
                  onClick={() => handleWhatsAppClick("2347052345296", "Emiliano")}
                  className="w-full bg-green-500 hover:bg-green-600 text-white"
                >
                  <MessageCircle className="mr-2 h-4 w-4" />
                  Chat with Emiliano
                </Button>
                <p className="text-sm text-gray-500 mt-2">+234 705 234 5296</p>
              </CardContent>
            </Card>
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
                <h3 className="font-semibold text-orange-500 mb-2">For Agencies</h3>
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
