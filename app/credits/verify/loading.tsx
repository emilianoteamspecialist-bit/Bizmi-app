import FreelancerNavbar from "@/components/freelancer-navbar"
import { Card, CardContent } from "@/components/ui/card"
import { Loader2 } from "lucide-react"

export default function CreditsVerifyLoading() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <FreelancerNavbar />

      <div className="max-w-2xl mx-auto py-16 px-4">
        <Card className="text-center">
          <CardContent className="p-8">
            <div className="space-y-4">
              <div className="h-16 w-16 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center mx-auto">
                <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Verifying Payment</h1>
              <p className="text-gray-600 dark:text-gray-400">Please wait while we verify your credits purchase...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
