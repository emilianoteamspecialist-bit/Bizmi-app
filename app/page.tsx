"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowRight, Users, Briefcase, Star, Shield, Zap, Globe, MessageCircle, Menu, X } from "lucide-react"
import Link from "next/link"
import { useState } from "react"

export default function LandingPage() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  const features = [
    {
      icon: <Users className="h-8 w-8 text-orange-500" />,
      title: "Find Top Talent",
      description: "Connect with skilled freelancers from around the world, vetted for quality and expertise.",
    },
    {
      icon: <Briefcase className="h-8 w-8 text-orange-500" />,
      title: "Secure Payments",
      description: "Safe and secure payment system with escrow protection for both clients and freelancers.",
    },
    {
      icon: <Shield className="h-8 w-8 text-orange-500" />,
      title: "Quality Assurance",
      description: "All freelancers are verified and rated by previous clients to ensure top-quality work.",
    },
    {
      icon: <Zap className="h-8 w-8 text-orange-500" />,
      title: "Fast Delivery",
      description: "Get your projects completed quickly with our efficient matching and communication system.",
    },
    {
      icon: <Globe className="h-8 w-8 text-orange-500" />,
      title: "Global Reach",
      description: "Access talent from around the world, working across different time zones and cultures.",
    },
    {
      icon: <MessageCircle className="h-8 w-8 text-orange-500" />,
      title: "24/7 Support",
      description: "Round-the-clock customer support to help you with any questions or issues.",
    },
  ]

  const stats = [
    { number: "50K+", label: "Active Freelancers" },
    { number: "10K+", label: "Projects Completed" },
    { number: "98%", label: "Client Satisfaction" },
    { number: "150+", label: "Countries" },
  ]

  const steps = [
    {
      step: "1",
      title: "Create Your Account",
      description: "Sign up as a freelancer or client in just a few minutes.",
    },
    {
      step: "2",
      title: "Post or Browse Projects",
      description: "Clients post projects, freelancers browse and submit proposals.",
    },
    {
      step: "3",
      title: "Work & Get Paid",
      description: "Complete the work, get approved, and receive secure payments.",
    },
  ]

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60 border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">B</span>
              </div>
              <span className="text-xl font-bold text-orange-500">Bizimi</span>
            </div>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-8">
              <Link href="#features" className="text-gray-600 hover:text-orange-500 transition-colors">
                Features
              </Link>
              <Link href="#how-it-works" className="text-gray-600 hover:text-orange-500 transition-colors">
                How it Works
              </Link>
              <Link href="/login" className="text-gray-600 hover:text-orange-500 transition-colors">
                Sign In
              </Link>
              <Link href="/signup">
                <Button className="bg-orange-500 hover:bg-orange-600">Get Started</Button>
              </Link>
            </div>

            {/* Mobile menu button */}
            <div className="md:hidden">
              <Button variant="ghost" size="icon" onClick={() => setIsMenuOpen(!isMenuOpen)}>
                {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </Button>
            </div>
          </div>

          {/* Mobile Navigation */}
          {isMenuOpen && (
            <div className="md:hidden py-4 border-t">
              <div className="flex flex-col space-y-4">
                <Link href="#features" className="text-gray-600 hover:text-orange-500 transition-colors">
                  Features
                </Link>
                <Link href="#how-it-works" className="text-gray-600 hover:text-orange-500 transition-colors">
                  How it Works
                </Link>
                <Link href="/login" className="text-gray-600 hover:text-orange-500 transition-colors">
                  Sign In
                </Link>
                <Link href="/signup">
                  <Button className="bg-orange-500 hover:bg-orange-600 w-full">Get Started</Button>
                </Link>
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-orange-50 to-white py-20 sm:py-32">
        <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))]"></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <Badge className="mb-4 bg-orange-100 text-orange-700 hover:bg-orange-200">
              🎉 Join 50,000+ freelancers and agencies
            </Badge>
            <h1 className="text-4xl sm:text-6xl font-bold text-gray-900 mb-6">
              Find the perfect
              <span className="text-orange-500"> freelancer </span>
              for your project
            </h1>
            <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
              Connect with top-rated freelancers and agencies from around the world. Get your projects done faster,
              better, and more affordably.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/signup">
                <Button size="lg" className="bg-orange-500 hover:bg-orange-600 text-lg px-8 py-3">
                  Get Started Free
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Button size="lg" variant="outline" className="text-lg px-8 py-3 bg-transparent">
                Browse Talent
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <div key={index} className="text-center">
                <div className="text-3xl sm:text-4xl font-bold text-orange-500 mb-2">{stat.number}</div>
                <div className="text-gray-600">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Partnership Section */}
      <section className="py-12 bg-orange-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h3 className="text-lg font-semibold text-gray-600 mb-6">Trusted Partner</h3>
            <div className="flex justify-center items-center">
              <div className="bg-white rounded-lg p-6 shadow-sm border">
                <svg width="120" height="48" viewBox="0 0 120 48" className="h-12 w-auto">
                  {/* Rounded square with "1" */}
                  <rect x="0" y="8" width="32" height="32" rx="8" fill="#f97316" />
                  <text
                    x="16"
                    y="30"
                    textAnchor="middle"
                    fill="white"
                    fontSize="20"
                    fontWeight="bold"
                    fontFamily="Arial, sans-serif"
                  >
                    1
                  </text>

                  {/* "APP" text */}
                  <text x="44" y="32" fill="#f97316" fontSize="24" fontWeight="bold" fontFamily="Arial, sans-serif">
                    APP
                  </text>
                </svg>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">Why choose Bizimi?</h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              We provide everything you need to successfully complete your projects and grow your business.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <Card key={index} className="border-0 shadow-lg hover:shadow-xl transition-shadow">
                <CardContent className="p-6">
                  <div className="mb-4">{feature.icon}</div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">{feature.title}</h3>
                  <p className="text-gray-600">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How it Works Section */}
      <section id="how-it-works" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">How it works</h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Getting started is simple. Follow these three easy steps to begin your journey.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {steps.map((step, index) => (
              <div key={index} className="text-center">
                <div className="w-16 h-16 bg-orange-500 text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                  {step.step}
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">{step.title}</h3>
                <p className="text-gray-600">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">What our users say</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                name: "Morounkeji Alabi",
                role: "Marketing Director",
                content:
                  "Bizimi helped me find the perfect developer for my project. The quality of work was exceptional!",
                rating: 5,
              },
              {
                name: "Ayodele Adeyemi",
                role: "Freelance Designer",
                content: "As a freelancer, Bizimi has been amazing for finding consistent, high-quality projects.",
                rating: 5,
              },
              {
                name: "Ifeanyi Eze",
                role: "Startup Founder",
                content: "The platform is intuitive and the talent pool is incredible. Highly recommend!",
                rating: 5,
              },
            ].map((testimonial, index) => (
              <Card key={index} className="border-0 shadow-lg">
                <CardContent className="p-6">
                  <div className="flex mb-4">
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <Star key={i} className="h-5 w-5 text-yellow-400 fill-current" />
                    ))}
                  </div>
                  <p className="text-gray-600 mb-4">"{testimonial.content}"</p>
                  <div>
                    <div className="font-semibold text-gray-900">{testimonial.name}</div>
                    <div className="text-sm text-gray-500">{testimonial.role}</div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-orange-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">Ready to get started?</h2>
          <p className="text-xl text-orange-100 mb-8 max-w-2xl mx-auto">
            Join thousands of freelancers and clients who trust Bizimi for their projects.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/signup">
              <Button size="lg" variant="secondary" className="text-lg px-8 py-3">
                Start as Freelancer
              </Button>
            </Link>
            <Link href="/signup">
              <Button
                size="lg"
                variant="outline"
                className="text-lg px-8 py-3 text-white border-white hover:bg-white hover:text-orange-500 bg-transparent"
              >
                Hire Talent
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center text-gray-400">
            <p>&copy; 2025 Bizimi. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
