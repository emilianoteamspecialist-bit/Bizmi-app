import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { MapPin, ShieldCheck, X } from "lucide-react"
import { getCategoriesForSkills } from "@/lib/categories"
import type { FreelancerSearchResult } from "@/lib/queries/freelancers"

function trustBadge(verificationStatus: string | null, jobsCompleted: number) {
  if (verificationStatus === "verified" && jobsCompleted >= 5) {
    return { label: "Fully Verified", className: "bg-success/10 text-success" }
  }
  if (verificationStatus === "verified") {
    return { label: "Verified", className: "bg-primary/10 text-primary" }
  }
  return { label: "New", className: "bg-muted text-muted-foreground" }
}

export default function FreelancerProfileModal({
  freelancer,
  isOpen,
  onClose,
}: {
  freelancer: FreelancerSearchResult | null
  isOpen: boolean
  onClose: () => void
}) {
  if (!isOpen || !freelancer) return null

  const badge = trustBadge(freelancer.verification_status, freelancer.jobs_completed)
  const categories = getCategoriesForSkills(freelancer.skills)

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Avatar className="h-16 w-16">
                <AvatarImage src={freelancer.logo || undefined} alt={freelancer.full_name} />
                <AvatarFallback className="text-lg font-semibold bg-primary text-white">
                  {freelancer.full_name?.charAt(0).toUpperCase() || "F"}
                </AvatarFallback>
              </Avatar>
              <div>
                <div className="flex items-center gap-2">
                  <CardTitle className="text-xl">{freelancer.full_name}</CardTitle>
                  <Badge className={`text-xs border-0 ${badge.className}`}>
                    {badge.label !== "New" && <ShieldCheck className="h-3 w-3 mr-1" />}
                    {badge.label}
                  </Badge>
                </div>
                {freelancer.location && (
                  <p className="text-sm text-muted-foreground flex items-center mt-1">
                    <MapPin className="h-3 w-3 mr-1" />
                    {freelancer.location}
                  </p>
                )}
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {freelancer.bio && (
            <div>
              <h4 className="font-semibold mb-2">About</h4>
              <p className="text-sm text-muted-foreground">{freelancer.bio}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <h4 className="font-semibold mb-1">Jobs Completed</h4>
              <p className="text-sm text-muted-foreground">{freelancer.jobs_completed}</p>
            </div>
            <div>
              <h4 className="font-semibold mb-1">Member Since</h4>
              <p className="text-sm text-muted-foreground">{new Date(freelancer.created_at).getFullYear()}</p>
            </div>
          </div>

          {freelancer.skills.length > 0 && (
            <div>
              <h4 className="font-semibold mb-2">Skills</h4>
              <div className="flex flex-wrap gap-2">
                {freelancer.skills.map((skill) => (
                  <Badge key={skill} variant="secondary">
                    {skill}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {categories.length > 0 && (
            <div>
              <h4 className="font-semibold mb-2">Categories</h4>
              <div className="flex flex-wrap gap-2">
                {categories.map((cat) => (
                  <Badge key={cat} variant="outline">
                    {cat}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
