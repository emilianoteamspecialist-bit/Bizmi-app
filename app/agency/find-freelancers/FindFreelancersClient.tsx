"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Search,
  Filter,
  X,
  MapPin,
  Briefcase,
  ShieldCheck,
  MessageCircle,
  Loader2,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { resolveAvatar } from "@/lib/avatar-url"
import { ALL_CATEGORIES, getCategoriesForSkills, type Category } from "@/lib/categories"
import { useAuth } from "@/contexts/AuthContext"

export interface FreelancerProfile {
  id: string
  full_name: string
  bio: string | null
  location: string | null
  skills: string | null
  experience_level: string | null
  hourly_rate: number | null
  created_at: string
  logo: string | null
  verification_status: string | null
  jobs_completed: number
  categories: Category[]
}

export const FREELANCERS_PER_PAGE = 20

interface FindFreelancersClientProps {
  initialFreelancers: FreelancerProfile[]
  initialHasMore: boolean
}

export default function FindFreelancersClient({
  initialFreelancers,
  initialHasMore,
}: FindFreelancersClientProps) {
  const { user: authUser } = useAuth()
  const [freelancers, setFreelancers] = useState<FreelancerProfile[]>(initialFreelancers)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(initialHasMore)
  const [offset, setOffset] = useState(FREELANCERS_PER_PAGE)
  const [searchQuery, setSearchQuery] = useState("")
  const [showFilterModal, setShowFilterModal] = useState(false)
  const [selectedFreelancer, setSelectedFreelancer] = useState<FreelancerProfile | null>(null)
  const [filters, setFilters] = useState({
    category: "",
    keywords: "",
    trustLevel: "",
  })
  const router = useRouter()

  const getTrustBadge = (verificationStatus: string | null, jobsCompleted: number) => {
    if (verificationStatus === "verified" && jobsCompleted >= 5) {
      return { label: "Fully Verified", color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" }
    }
    if (verificationStatus === "verified") {
      return { label: "Verified", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" }
    }
    return { label: "New", color: "bg-slate-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300" }
  }

  const loadFreelancers = useCallback(
    async (currentOffset: number, append = false) => {
      if (append) {
        setLoadingMore(true)
      } else {
        setLoading(true)
      }

      try {
        // Build freelancer query
        let query = supabase
          .from("profiles")
          .select("id, full_name, bio, location, created_at", { count: "exact" })
          .eq("account_type", "freelancer")
          .order("created_at", { ascending: false })
          .range(currentOffset, currentOffset + FREELANCERS_PER_PAGE - 1)

        // Apply keyword search across name, bio
        const searchTerm = filters.keywords || searchQuery
        if (searchTerm) {
          query = query.or(
            `full_name.ilike.%${searchTerm}%,bio.ilike.%${searchTerm}%`,
          )
        }

        const { data: profilesData, error: profilesError, count } = await query

        if (profilesError) {
          console.error("Error loading freelancers:", profilesError)
          return
        }

        if (!profilesData || profilesData.length === 0) {
          if (!append) setFreelancers([])
          setHasMore(false)
          return
        }

        const freelancerIds = profilesData.map((p) => p.id)

        // Fetch logos, verification status, completed jobs count, and skills in parallel
        const [logosResult, verificationResult, completedJobsResult, skillsResult] = await Promise.all([
          supabase.from("freelancer_logos").select("freelancer_id, logo_path, logo_data").in("freelancer_id", freelancerIds),
          supabase
            .from("Freelancer_identitie")
            .select("user_id, verification_status")
            .in("user_id", freelancerIds),
          supabase
            .from("freelancer_proposal_status")
            .select("freelancer_id, status")
            .in("freelancer_id", freelancerIds)
            .eq("status", "completed"),
          supabase
            .from("freelancer_skills")
            .select("user_id, skill_name")
            .in("user_id", freelancerIds),
        ])

        // Build lookup maps
        const logoMap: Record<string, string> = {}
        logosResult.data?.forEach((l) => {
          logoMap[l.freelancer_id] = resolveAvatar(l)
        })

        const verificationMap: Record<string, string> = {}
        verificationResult.data?.forEach((v) => {
          verificationMap[v.user_id] = v.verification_status
        })

        // Count completed jobs per freelancer
        const completedCountMap: Record<string, number> = {}
        completedJobsResult.data?.forEach((j) => {
          completedCountMap[j.freelancer_id] = (completedCountMap[j.freelancer_id] || 0) + 1
        })

        // Group skills per freelancer
        const skillsMap: Record<string, string[]> = {}
        skillsResult.data?.forEach((s) => {
          if (!skillsMap[s.user_id]) skillsMap[s.user_id] = []
          skillsMap[s.user_id].push(s.skill_name)
        })

        // Transform data
        let transformed: FreelancerProfile[] = profilesData.map((profile) => {
          const skillsArray = skillsMap[profile.id] || []
          return {
            id: profile.id,
            full_name: profile.full_name,
            bio: profile.bio,
            location: profile.location,
            skills: skillsArray.join(", "),
            experience_level: "Expert", // Default fallback
            hourly_rate: 0, // Default fallback
            created_at: profile.created_at,
            logo: logoMap[profile.id] || null,
            verification_status: verificationMap[profile.id] || null,
            jobs_completed: completedCountMap[profile.id] || 0,
            categories: getCategoriesForSkills(skillsArray),
          }
        })

        // Client-side category filter (since categories are derived, not stored in DB)
        if (filters.category) {
          transformed = transformed.filter((f) =>
            f.categories.includes(filters.category as Category),
          )
        }

        // Client-side trust level filter
        if (filters.trustLevel) {
          transformed = transformed.filter((f) => {
            const badge = getTrustBadge(f.verification_status, f.jobs_completed)
            if (filters.trustLevel === "Fully Verified") return badge.label === "Fully Verified"
            if (filters.trustLevel === "Verified") return badge.label === "Verified" || badge.label === "Fully Verified"
            return true
          })
        }

        if (append) {
          setFreelancers((prev) => [...prev, ...transformed])
        } else {
          setFreelancers(transformed)
        }

        setHasMore(currentOffset + FREELANCERS_PER_PAGE < (count || 0))
        setOffset(currentOffset + FREELANCERS_PER_PAGE)
      } catch (error) {
        console.error("Error loading freelancers:", error)
      } finally {
        setLoading(false)
        setLoadingMore(false)
      }
    },
    [filters, searchQuery],
  )

  // Initial data is seeded from server-fetched props (source-of-truth pattern),
  // so skip the first mount fetch. Subsequent runs (when filters/searchQuery
  // change loadFreelancers) still refetch as before.
  const didMountRef = useRef(false)
  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true
      return
    }
    loadFreelancers(0)
  }, [loadFreelancers])

  const applyFilters = () => {
    setOffset(0)
    setHasMore(true)
    loadFreelancers(0)
    setShowFilterModal(false)
  }

  const resetFilters = () => {
    setFilters({ category: "", keywords: "", trustLevel: "" })
    setSearchQuery("")
    setOffset(0)
    setHasMore(true)
  }

  const handleSearch = () => {
    setOffset(0)
    setHasMore(true)
    loadFreelancers(0)
  }

  const handleContactFreelancer = async (freelancerId: string) => {
    const user = authUser
    if (!user) {
      router.push("/login")
      return
    }

    // Check for existing conversation
    const { data: existingConvo } = await supabase
      .from("conversations")
      .select("id")
      .or(
        `and(participant1_id.eq.${user.id},participant2_id.eq.${freelancerId}),and(participant1_id.eq.${freelancerId},participant2_id.eq.${user.id})`,
      )
      .single()

    if (existingConvo) {
      router.push("/agency/messages")
      return
    }

    // Create new conversation
    const { error } = await supabase.from("conversations").insert({
      participant1_id: user.id,
      participant2_id: freelancerId,
    })

    if (error) {
      console.error("Error creating conversation:", error)
      alert("Failed to start conversation. Please try again.")
      return
    }

    router.push("/agency/messages")
  }

  return (
    <div className="min-h-screen bg-surface pb-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Toolbar header */}
        <header className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Marketplace</p>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Find freelancers</h1>
          <p className="text-sm text-muted-foreground">Search and connect with vetted talent across Nigeria.</p>
        </header>

        {/* Search & Filter Bar */}
        <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, skills, or keywords..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSearch} className="h-10 px-4 rounded-lg gap-2">
                <Search className="h-4 w-4" />
                Search
              </Button>
              <Button variant="outline" className="h-10 px-4 rounded-lg gap-2" onClick={() => setShowFilterModal(true)}>
                <Filter className="h-4 w-4" />
                Filters
              </Button>
            </div>
          </div>
        </div>

        {/* Results */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">
              Freelancers <span className="font-normal text-muted-foreground">· {freelancers.length}</span>
            </h2>
            {(filters.category || filters.trustLevel || filters.keywords) && (
              <Button variant="ghost" size="sm" onClick={resetFilters} className="text-primary">
                Clear filters
              </Button>
            )}
          </div>

        {/* Freelancer Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-64 rounded-xl border border-border bg-card animate-pulse" />
            ))}
          </div>
        ) : freelancers.length === 0 ? (
          <div className="rounded-xl border border-border bg-card py-16 px-6 text-center">
            <div className="mx-auto h-11 w-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <Search className="h-5 w-5" />
            </div>
            <h3 className="mt-4 text-sm font-semibold text-foreground">No freelancers found</h3>
            <p className="mt-1 text-sm text-muted-foreground max-w-sm mx-auto">Try adjusting your search or filters.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {freelancers.map((freelancer) => {
                const trustBadge = getTrustBadge(freelancer.verification_status, freelancer.jobs_completed)
                const skillsArray = freelancer.skills
                  ? freelancer.skills.split(",").map((s) => s.trim()).filter(Boolean)
                  : []
                const mainSkill = skillsArray[0] || "Freelancer"

                return (
                  <Card
                    key={freelancer.id}
                    className="group overflow-hidden rounded-xl border border-border bg-card shadow-none hover:border-foreground/20 transition-colors"
                  >
                    <CardContent className="p-5">
                      {/* Header: Avatar + Name + Badge */}
                      <div className="flex items-start gap-4 mb-4">
                        <Avatar className="h-14 w-14 flex-shrink-0">
                          <AvatarImage src={freelancer.logo || undefined} alt={freelancer.full_name} />
                          <AvatarFallback className="bg-primary text-white text-lg font-semibold">
                            {freelancer.full_name?.charAt(0).toUpperCase() || "F"}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold text-foreground truncate">
                              {freelancer.full_name}
                            </h3>
                            <Badge className={`text-xs ${trustBadge.color} border-0`}>
                              {trustBadge.label === "Fully Verified" || trustBadge.label === "Verified" ? (
                                <ShieldCheck className="h-3 w-3 mr-1" />
                              ) : null}
                              {trustBadge.label}
                            </Badge>
                          </div>
                          <p className="text-sm text-primary font-medium mt-0.5">
                            {mainSkill}
                          </p>
                          {freelancer.location && (
                            <p className="text-xs text-muted-foreground flex items-center mt-1">
                              <MapPin className="h-3 w-3 mr-1" />
                              {freelancer.location}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Bio */}
                      {freelancer.bio && (
                        <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                          {freelancer.bio}
                        </p>
                      )}

                      {/* Skills Preview */}
                      <div className="flex flex-wrap gap-1.5 mb-4">
                        {skillsArray.slice(0, 4).map((skill, idx) => (
                          <span key={idx} className="px-2 py-0.5 rounded-md bg-surface-2 text-muted-foreground text-[11px]">
                            {skill}
                          </span>
                        ))}
                        {skillsArray.length > 4 && (
                          <span className="px-2 py-0.5 text-[11px] text-muted-foreground">
                            +{skillsArray.length - 4}
                          </span>
                        )}
                      </div>

                      {/* Stats Row */}
                      <div className="flex items-center justify-between text-xs text-muted-foreground mb-4 pb-4 border-b border-border">
                        <div className="flex items-center gap-1.5">
                          <Briefcase className="h-3.5 w-3.5" />
                          <span>{freelancer.jobs_completed} job{freelancer.jobs_completed !== 1 ? "s" : ""} done</span>
                        </div>
                        {freelancer.hourly_rate ? (
                          <span className="font-medium text-foreground tabular-nums">
                            ₦{freelancer.hourly_rate.toLocaleString()}/hr
                          </span>
                        ) : null}
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => setSelectedFreelancer(freelancer)}
                        >
                          View profile
                        </Button>
                        <Button
                          size="sm"
                          className="flex-1 gap-1.5"
                          onClick={() => handleContactFreelancer(freelancer.id)}
                        >
                          <MessageCircle className="h-4 w-4" />
                          Contact
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>

            {/* Load More */}
            {hasMore && (
              <div className="flex justify-center mt-6">
                <Button
                  variant="outline"
                  onClick={() => loadFreelancers(offset, true)}
                  disabled={loadingMore}
                >
                  {loadingMore ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    "Load more freelancers"
                  )}
                </Button>
              </div>
            )}
          </>
        )}
        </section>
      </div>

      {/* Filter Modal */}
      {showFilterModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Filter Freelancers</CardTitle>
                <Button variant="ghost" size="icon" onClick={() => setShowFilterModal(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Keywords</label>
                <Input
                  placeholder='e.g. "logo", "UI/UX", "WordPress"'
                  value={filters.keywords}
                  onChange={(e) => setFilters({ ...filters, keywords: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Skill Category</label>
                <Select value={filters.category} onValueChange={(value) => setFilters({ ...filters, category: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="All categories" />
                  </SelectTrigger>
                  <SelectContent>
                    {ALL_CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Trust Level</label>
                <Select value={filters.trustLevel} onValueChange={(value) => setFilters({ ...filters, trustLevel: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="All trust levels" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Verified">Verified & above</SelectItem>
                    <SelectItem value="Fully Verified">Fully Verified only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex space-x-2 pt-4">
                <Button variant="outline" className="flex-1 bg-transparent" onClick={() => {
                  setFilters({ category: "", keywords: "", trustLevel: "" })
                }}>
                  Reset
                </Button>
                <Button className="flex-1 bg-primary hover:bg-primary-hover" onClick={applyFilters}>
                  Apply Filters
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Freelancer Profile Modal */}
      {selectedFreelancer && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <Avatar className="h-16 w-16">
                    <AvatarImage src={selectedFreelancer.logo || undefined} alt={selectedFreelancer.full_name} />
                    <AvatarFallback className="text-lg font-semibold bg-primary text-white">
                      {selectedFreelancer.full_name?.charAt(0).toUpperCase() || "F"}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-xl">{selectedFreelancer.full_name}</CardTitle>
                      {(() => {
                        const badge = getTrustBadge(selectedFreelancer.verification_status, selectedFreelancer.jobs_completed)
                        return (
                          <Badge className={`text-xs ${badge.color} border-0`}>
                            {badge.label === "Fully Verified" || badge.label === "Verified" ? (
                              <ShieldCheck className="h-3 w-3 mr-1" />
                            ) : null}
                            {badge.label}
                          </Badge>
                        )
                      })()}
                    </div>
                    {selectedFreelancer.location && (
                      <p className="text-sm text-muted-foreground flex items-center mt-1">
                        <MapPin className="h-3 w-3 mr-1" />
                        {selectedFreelancer.location}
                      </p>
                    )}
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setSelectedFreelancer(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {selectedFreelancer.bio && (
                <div>
                  <h4 className="font-semibold mb-2">About</h4>
                  <p className="text-sm text-muted-foreground">{selectedFreelancer.bio}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="font-semibold mb-1">Experience</h4>
                  <p className="text-sm text-muted-foreground">{selectedFreelancer.experience_level || "Not specified"}</p>
                </div>
                <div>
                  <h4 className="font-semibold mb-1">Jobs Completed</h4>
                  <p className="text-sm text-muted-foreground">{selectedFreelancer.jobs_completed}</p>
                </div>
                {selectedFreelancer.hourly_rate && (
                  <div>
                    <h4 className="font-semibold mb-1">Hourly Rate</h4>
                    <p className="text-sm text-muted-foreground">₦{selectedFreelancer.hourly_rate.toLocaleString()}</p>
                  </div>
                )}
                <div>
                  <h4 className="font-semibold mb-1">Member Since</h4>
                  <p className="text-sm text-muted-foreground">
                    {new Date(selectedFreelancer.created_at).getFullYear()}
                  </p>
                </div>
              </div>

              {selectedFreelancer.skills && (
                <div>
                  <h4 className="font-semibold mb-2">Skills</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedFreelancer.skills.split(",").map((skill, idx) => (
                      <Badge key={idx} variant="secondary">{skill.trim()}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {selectedFreelancer.categories.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-2">Categories</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedFreelancer.categories.map((cat) => (
                      <Badge key={cat} className="bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400 border-0">
                        {cat}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-center gap-3 pt-4">
                <Button variant="outline" className="bg-transparent" onClick={() => setSelectedFreelancer(null)}>
                  Close
                </Button>
                <Button
                  className="bg-primary hover:bg-primary-hover"
                  onClick={() => {
                    setSelectedFreelancer(null)
                    handleContactFreelancer(selectedFreelancer.id)
                  }}
                >
                  <MessageCircle className="h-4 w-4 mr-2" />
                  Send Message
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
