import { Card, CardContent, CardHeader } from "@/components/ui/card"

export default function AgencyPostsLoading() {
  return (
    <div className="flex flex-col min-h-screen bg-slate-50 dark:bg-slate-900">
      <main className="flex-1 p-4 sm:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-primaryxl font-bold text-slate-900 dark:text-gray-50 mb-6">Manage Job Posts</h1>

          <div className="mb-6">
            <div className="relative">
              <div className="h-10 w-full rounded-xl bg-slate-200 dark:bg-gray-700 animate-pulse"></div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader>
                  <div className="h-6 bg-slate-200 dark:bg-gray-700 rounded w-3/4 mb-2"></div>
                  <div className="h-4 bg-slate-200 dark:bg-gray-700 rounded w-1/2"></div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="h-4 bg-slate-200 dark:bg-gray-700 rounded"></div>
                  <div className="h-4 bg-slate-200 dark:bg-gray-700 rounded w-5/6"></div>
                  <div className="h-4 bg-slate-200 dark:bg-gray-700 rounded w-2/3"></div>
                  <div className="h-8 bg-slate-200 dark:bg-gray-700 rounded w-full mt-4"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
