"use client"

import { useState } from "react"
import { Play, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function FreelancerTutorial() {
  const [hoveredCard, setHoveredCard] = useState<number | null>(null)

  const tutorials = [
    {
      id: 1,
      title: "How to place a bid",
      description: "Learn the best practices for submitting competitive bids that win projects",
      thumbnail: "https://i.ibb.co/ZzLdP39W/Bizmi-freelancer.jpg",
      videoUrl: "https://youtu.be/DNJ5WnK1Ovw", // Replace with actual video URL
      duration: "5:15",
    },
    {
      id: 2,
      title: "How to receive a payout",
      description: "Step-by-step guide on setting up your payment details and receiving payments",
      thumbnail: "https://i.ibb.co/ZzLdP39W/Bizmi-freelancer.jpg",
      videoUrl: "https://youtu.be/V3vrl_SBebw", // Replace with actual video URL
      duration: "4:23",
    },
    {
      id: 3,
      title: "How to buy credits",
      description: "Discover how to buy credits",
      thumbnail: "https://i.ibb.co/ZzLdP39W/Bizmi-freelancer.jpg",
      videoUrl: "https://youtu.be/0pbkiwu2EyM", // Replace with actual video URL
      duration: "2:39",
    },
  ]

  const handleWatchVideo = (videoUrl: string) => {
    window.open(videoUrl, "_blank")
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header Section */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-4">Freelancer Video Tutorials</h1>
          <p className="text-xl text-slate-600 dark:text-gray-300 max-w-3xl mx-auto">
            Master the art of freelancing with our comprehensive video guides. Learn how to bid effectively, manage
            payments, and create winning proposals that get you hired.
          </p>
        </div>

        {/* Tutorial Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {tutorials.map((tutorial) => (
            <Card
              key={tutorial.id}
              className={`group cursor-pointer transition-all duration-300 hover:shadow-xl ${
                hoveredCard === tutorial.id ? "transform -translate-y-2" : ""
              }`}
              onMouseEnter={() => setHoveredCard(tutorial.id)}
              onMouseLeave={() => setHoveredCard(null)}
              onClick={() => handleWatchVideo(tutorial.videoUrl)}
            >
              <CardHeader className="p-0">
                <div className="relative overflow-hidden rounded-t-lg">
                  <img
                    src={tutorial.thumbnail || "/placeholder.svg"}
                    alt={tutorial.title}
                    className="w-full h-48 object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                  {/* Play Button Overlay */}
                  <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <div className="bg-primary rounded-full p-4 transform scale-75 group-hover:scale-100 transition-transform duration-300">
                      <Play className="h-8 w-8 text-white fill-current" />
                    </div>
                  </div>
                  {/* Duration Badge */}
                  <div className="absolute bottom-2 right-2 bg-black bg-opacity-75 text-white text-xs px-2 py-1 rounded">
                    {tutorial.duration}
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-6">
                <CardTitle className="text-xl font-semibold text-slate-900 dark:text-white mb-2 group-hover:text-primary transition-colors duration-300">
                  {tutorial.title}
                </CardTitle>
                <CardDescription className="text-slate-600 dark:text-gray-300 mb-4 line-clamp-2">
                  {tutorial.description}
                </CardDescription>

                <Button
                  className="w-full bg-primary hover:bg-primary-hover text-white transition-colors duration-300"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleWatchVideo(tutorial.videoUrl)
                  }}
                >
                  <Play className="h-4 w-4 mr-2" />
                  Watch Tutorial
                  <ExternalLink className="h-4 w-4 ml-2" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Additional Resources Section */}
        <div className="mt-12 text-center">
                 <div className="bg-white dark:bg-slate-800 rounded-lg p-8 shadow-sm border border-primary/20">
                   <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Need More Help?</h2>
                   <p className="text-muted-foreground mb-6">
                     Can't find what you're looking for? Our support team is here to help you succeed.
                   </p>
                   <Button
                     onClick={() => window.open("mailto:Bizimisocials12@gmail.com", "_blank")}
                     variant="outline"
                     className="border-primary text-primary hover:bg-primary hover:text-white transition-colors duration-300"
                   >
                     Contact Support
                   </Button>
                 </div>
               </div>
      </div>
    </div>
  )
}
