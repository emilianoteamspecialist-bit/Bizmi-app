"use client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Play, ExternalLink } from "lucide-react"

export default function AgencyTutorial() {
  const tutorials = [
    {
      id: 1,
      title: "How to create a job post",
      description: "Learn how to create compelling job posts that attract the best freelancers",
      videoId: "S_-Ib5v5vX0", // Replace with actual YouTube video ID
      thumbnail: "https://i.ibb.co/DgRrMNcn/Bizmi-agency.jpg",
    },
    {
      id: 2,
      title: "How to accept freelancer proposals",
      description: "Discover the best practices for reviewing and accepting freelancer proposals",
      videoId: "z7ZoT4Pgf9Q", // Replace with actual YouTube video ID
      thumbnail: "https://i.ibb.co/DgRrMNcn/Bizmi-agency.jpg",
    },
    {
      id: 3,
      title: "How to make a deposit",
      description: "Step-by-step guide on funding your projects and managing your wallet",
      videoId: "bpY7CF90yn8", // Replace with actual YouTube video ID
      thumbnail: "https://i.ibb.co/DgRrMNcn/Bizmi-agency.jpg",
    },
  ]

  const openVideo = (videoId: string) => {
    window.open(`https://www.youtube.com/watch?v=${videoId}`, "_blank")
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">

      <div className="max-w-7xl mx-auto py-8 px-4">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-4">Agency Tutorial Center</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Master the platform with our comprehensive video tutorials. Learn how to maximize your success as an agency
            on Bizimi.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tutorials.map((tutorial) => (
            <Card
              key={tutorial.id}
              className="group hover:shadow-lg transition-all duration-300 border-2 hover:border-primary/20"
            >
              <CardHeader className="p-0">
                <div className="relative overflow-hidden rounded-t-lg">
                  <img
                    src={tutorial.thumbnail || "/placeholder.svg"}
                    alt={tutorial.title}
                    className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-black/40 group-hover:bg-black/30 transition-colors duration-300 flex items-center justify-center">
                    <div className="bg-primary rounded-full p-4 group-hover:scale-110 transition-transform duration-300">
                      <Play className="h-8 w-8 text-white fill-white" />
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <CardTitle className="text-xl font-bold text-slate-900 dark:text-white mb-3 group-hover:text-primary transition-colors duration-300">
                  {tutorial.title}
                </CardTitle>
                <p className="text-muted-foreground mb-4 line-clamp-3">{tutorial.description}</p>
                <Button
                  onClick={() => openVideo(tutorial.videoId)}
                  className="w-full bg-primary hover:bg-primary-hover text-white font-semibold py-2 px-4 rounded-lg transition-colors duration-300 flex items-center justify-center gap-2"
                >
                  <Play className="h-4 w-4" />
                  Watch Tutorial
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

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
