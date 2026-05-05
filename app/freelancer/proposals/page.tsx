"use client"

import type React from "react"
import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  CalendarDays,
  DollarSign,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  FileText,
  Search,
  MapPin,
} from "lucide-react"
import { supabase } from "@/lib/supabase"
import { Input } from "@/components/ui/input"

interface Proposal {
  id: string
  job_id: string
  freelancer_id: string
  proposal_text: string
  timeline: string | null
  budget: string | null
  attachments: string[] | null
  status: "pending" | "accepted" | "rejected"
  created_at: string
  updated_at: string
  job_title?: string
  job_description?: string
  job_budget_min?: number
  job_budget_max?: number
  job_type?: string
  job_duration?: string
  job_location?: string
  skills?: string[]
  agency_name?: string
  funding_status?: string
  job_status?: string
  freelancer_status?: string
}

export default function ProposalsPage() {
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [offset, setOffset] = useState(0)
  const [searchTerm, setSearchTerm] = useState("")
  const LIMIT = 15

  const loadProposals = useCallback(
    async (isLoadMore = false, currentSearchTerm = searchTerm) => {
      try {
        if (!isLoadMore) {
          setLoading(true)
        } else {
          setLoadingMore(true)
        }

        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
          console.log("No user found")
          setProposals([])
          setLoading(false)
          setLoadingMore(false)
          setHasMore(false)
          return
        }

        let jobIdsToFilter: string[] | undefined = undefined
        if (currentSearchTerm) {
          const { data: searchedJobs, error: searchJobsError } = await supabase
            .from("jobs")
            .select("id")
            .or(`title.ilike.%${currentSearchTerm}%,description.ilike.%${currentSearchTerm}%`)

          if (searchJobsError) {
            console.error("Error searching jobs:", searchJobsError)
            setProposals([])
            setHasMore(false)
            setLoading(false)
            setLoadingMore(false)
            return
          } else if (searchedJobs) {
            jobIdsToFilter = searchedJobs.map((job) => job.id)
            if (jobIdsToFilter.length === 0) {
              setProposals([])
              setHasMore(false)
              setLoading(false)
              setLoadingMore(false)
              return
            }
          }
        }

        let proposalsQuery = supabase
          .from("proposals")
          .select(`
            *,
            jobs!proposals_job_id_fkey (
              title,
              description,
              budget_min,
              budget_max,
              job_type,
              duration,
              location,
              skills,
              agency_id,
              job_funding_status(funding_status, job_status)
            ),
            freelancer_proposal_status(freelancer_status)
          `)
          .eq("freelancer_id", user.id)
          .order("created_at", { ascending: false })
          .range(isLoadMore ? offset : 0, (isLoadMore ? offset : 0) + LIMIT - 1)

        if (jobIdsToFilter !== undefined) {
          proposalsQuery = proposalsQuery.in("job_id", jobIdsToFilter)
        }

        const { data: proposalsData, error: proposalsError } = await proposalsQuery

        if (proposalsError) {
          console.error("Error loading proposals:", proposalsError)
          setLoading(false)
          setLoadingMore(false)
          return
        }

        if (!proposalsData || proposalsData.length === 0) {
          if (!isLoadMore) {
            setProposals([])
          }
          setHasMore(false)
          setLoading(false)
          setLoadingMore(false)
          return
        }

        // Get agency data
        const agencyIds = proposalsData.map((p) => p.jobs?.agency_id).filter(Boolean)
        let agencyData: any[] = []
        if (agencyIds.length > 0) {
          const { data: agencies, error: agencyError } = await supabase
            .from("profiles")
            .select("id, full_name, company_name")
            .in("id", agencyIds)
          agencyData = agencies || []
        }

        const enrichedProposals = proposalsData.map((proposal) => {
          const job = proposal.jobs
          const agency = agencyData.find((a) => a.id === job?.agency_id)
          return {
            ...proposal,
            job_title: job?.title || "Unknown Job",
            job_description: job?.description || "No description available",
            job_budget_min: job?.budget_min || 0,
            job_budget_max: job?.budget_max || 0,
            job_type: job?.job_type || "Not specified",
            job_duration: job?.duration || "Not specified",
            job_location: job?.location || "Not specified",
            skills: job?.skills || [],
            agency_name: agency?.company_name || agency?.full_name || "Unknown Agency",
            funding_status: job?.job_funding_status?.[0]?.funding_status || "pending",
            job_status: job?.job_funding_status?.[0]?.job_status || "open",
            freelancer_status: proposal.freelancer_proposal_status?.[0]?.freelancer_status || "pending",
          }
        })

        if (isLoadMore) {
          setProposals((prev) => [...prev, ...enrichedProposals])
          setOffset((prev) => prev + proposalsData.length)
        } else {
          setProposals(enrichedProposals)
          setOffset(proposalsData.length)
        }
        setHasMore(proposalsData.length === LIMIT)
      } catch (error) {
        console.error("Error:", error)
      } finally {
        setLoading(false)
        setLoadingMore(false)
      }
    },
    [searchTerm],
  )

  useEffect(() => {
    setOffset(0)
    setHasMore(true)
    loadProposals(false, searchTerm)
  }, [searchTerm])

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value)
  }

  const handleStartWork = async (proposalId: string, jobId: string) => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      const { error } = await supabase.from("freelancer_proposal_status").upsert({
        proposal_id: proposalId,
        job_id: jobId,
        freelancer_id: user.id,
        freelancer_status: "started",
        started_at: new Date().toISOString(),
      })

      if (error) {
        console.error("Error starting work:", error)
        alert("Error starting work")
        return
      }

      alert("Work started successfully!")
      loadProposals(false, searchTerm) // Reload to update status
    } catch (error) {
      console.error("Error starting work:", error)
      alert("Error starting work. Please try again.")
    }
  }

  const handleCompleteWork = async (proposalId: string, jobId: string) => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      // Get freelancer bank details
      const { data: bankDetails, error: bankError } = await supabase
        .from("freelancer_bank_details")
        .select("account_number, bank_code")
        .eq("freelancer_id", user.id)
        .single()

      if (bankError || !bankDetails) {
        alert("Please add your bank details in Bizpal before completing work")
        return
      }

      // Get job budget for payout calculation
      const { data: jobData, error: jobError } = await supabase
        .from("jobs")
        .select("budget_max, budget_min")
        .eq("id", jobId)
        .single()

      if (jobError || !jobData) {
        alert("Error fetching job details")
        return
      }

      const amount = jobData.budget_max || jobData.budget_min || 0

      // Call payout-freelancer API
      const response = await fetch("/api/paystack/payout-freelancer", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount,
          account_number: bankDetails.account_number,
          bank_code: bankDetails.bank_code,
          jobId,
          freelancerId: user.id,
        }),
      })

      const data = await response.json()

      if (response.ok && data.success) {
        alert(`Work completed successfully! Payout of ₦ ${data.payout_amount?.toLocaleString()} initiated.`)

        // Update local status
        await supabase.from("freelancer_proposal_status").upsert({
          proposal_id: proposalId,
          job_id: jobId,
          freelancer_id: user.id,
          freelancer_status: "completed",
          completed_at: new Date().toISOString(),
        })

        loadProposals(false, searchTerm) // Reload to update status
      } else {
        alert("Error processing payout: " + (data.error || "Unknown error"))
      }
    } catch (error) {
      console.error("Error completing work:", error)
      alert("Error completing work. Please try again.")
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "accepted":
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case "rejected":
        return <XCircle className="h-4 w-4 text-red-500" />
      default:
        return <AlertCircle className="h-4 w-4 text-primary" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "accepted":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
      case "rejected":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
      default:
        return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200"
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }

  if (loading && proposals.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
        <div className="max-w-full sm:max-w-6xl lg:max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 xl:px-8 py-4 sm:py-6 lg:py-8">
          <div className="mb-4 sm:mb-6 lg:mb-8">
            <div className="h-8 bg-slate-200 dark:bg-gray-700 rounded w-64 mb-2 animate-pulse"></div>
            <div className="h-4 bg-slate-200 dark:bg-gray-700 rounded w-96 animate-pulse"></div>
            <div className="relative mt-4">
              <div className="h-10 bg-slate-200 dark:bg-gray-700 rounded animate-pulse"></div>
            </div>
          </div>
          <div className="animate-pulse space-y-6">
            {[...Array(LIMIT)].map((_, i) => (
              <Card key={i}>
                <CardHeader>
                  <div className="h-6 bg-slate-200 dark:bg-gray-700 rounded w-3/4"></div>
                  <div className="h-4 bg-slate-200 dark:bg-gray-700 rounded w-1/2"></div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="h-4 bg-slate-200 dark:bg-gray-700 rounded"></div>
                    <div className="h-4 bg-slate-200 dark:bg-gray-700 rounded w-5/6"></div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <div className="max-w-full sm:max-w-6xl lg:max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 xl:px-8 py-4 sm:py-6 lg:py-8">
        <div className="mb-4 sm:mb-6 lg:mb-8">
          <h1 className="text-xl sm:text-2xl lg:text-primaryxl font-bold text-slate-900 dark:text-white">My Proposals</h1>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 mt-1 sm:mt-2">
            Track the status of your job applications
          </p>
          <div className="relative mt-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              type="text"
              placeholder="Search proposals by job title or description..."
              className="pl-10 pr-4 py-2 w-full rounded-xl border border-slate-300 dark:border-gray-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-primary focus:border-primary"
              value={searchTerm}
              onChange={handleSearchChange}
            />
          </div>
        </div>

        {proposals.length === 0 && !loading ? (
          <Card>
            <CardContent className="text-center py-12">
              <div className="mx-auto w-24 h-24 bg-primary/10 dark:bg-orange-900/20 rounded-full flex items-center justify-center mb-4">
                <FileText className="h-12 w-12 text-primary" />
              </div>
              <h3 className="text-base sm:text-lg font-medium text-slate-900 dark:text-white mb-2">
                {searchTerm ? "No matching proposals found" : "No proposals yet"}
              </h3>
              <p className="text-sm sm:text-base text-slate-500 dark:text-slate-400 mb-6">
                {searchTerm
                  ? "Try a different search term or clear the search."
                  : "Start applying to jobs to see your proposals here."}
              </p>
              {!searchTerm && (
                <Button
                  onClick={() => (window.location.href = "/dashboard")}
                  className="bg-primary hover:bg-primary-hover text-white"
                >
                  Browse Jobs
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {proposals.map((proposal) => (
              <Card
                key={proposal.id}
                className="border-l-4 border-primary shadow-sm hover:shadow-md transition-all duration-200"
              >
                <CardHeader className="p-4 sm:p-6 pb-0">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex-1">
                      <CardTitle className="text-lg sm:text-xl font-semibold text-slate-900 dark:text-white line-clamp-2">
                        {proposal.job_title}
                      </CardTitle>
                      <div className="flex items-center text-sm text-slate-600 dark:text-slate-400 mt-1">
                        <Avatar className="h-6 w-6 mr-2">
                          <AvatarFallback className="text-xs bg-orange-100 text-primary">
                            {proposal.agency_name?.charAt(0) || "A"}
                          </AvatarFallback>
                        </Avatar>
                        <span className="truncate">{proposal.agency_name}</span>
                        <span className="mx-2">•</span>
                        <CalendarDays className="h-4 w-4 mr-1 text-primary" />
                        <span>Applied {formatDate(proposal.created_at)}</span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <Badge className={`${getStatusColor(proposal.status)} text-sm px-3 py-1 flex items-center gap-1`}>
                        {getStatusIcon(proposal.status)}
                        {proposal.status.charAt(0).toUpperCase() + proposal.status.slice(1)}
                      </Badge>
                      {proposal.status === "accepted" && proposal.funding_status === "funded" && (
                        <Badge className="text-sm px-3 py-1 bg-green-100 text-green-800">✅ Funded</Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-4 sm:p-6 pt-4">
                  <p className="text-sm text-slate-700 dark:text-gray-300 mb-4 line-clamp-3">
                    {proposal.job_description}
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4 border-t border-b border-slate-200 dark:border-gray-700 py-4">
                    <div className="flex items-center">
                      <DollarSign className="h-4 w-4 text-primary mr-2 flex-shrink-0" />
                      <div>
                        <p className="text-xs text-slate-600 dark:text-slate-400">Your Budget</p>
                        <p className="font-medium text-sm text-slate-900 dark:text-white truncate">
                          {proposal.budget || "Not specified"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center">
                      <DollarSign className="h-4 w-4 text-primary mr-2 flex-shrink-0" />
                      <div>
                        <p className="text-xs text-slate-600 dark:text-slate-400">Client Budget</p>
                        <p className="font-medium text-sm text-slate-900 dark:text-white truncate">
                          ₦ {proposal.job_budget_min?.toLocaleString()} - ₦ {proposal.job_budget_max?.toLocaleString()}                        </p>
                      </div>
                    </div>
                    <div className="flex items-center">
                      <Clock className="h-4 w-4 text-primary mr-2 flex-shrink-0" />
                      <div>
                        <p className="text-xs text-slate-600 dark:text-slate-400">Your Timeline</p>
                        <p className="font-medium text-sm text-slate-900 dark:text-white truncate">
                          {proposal.timeline || "Not specified"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center">
                      <Clock className="h-4 w-4 text-primary mr-2 flex-shrink-0" />
                      <div>
                        <p className="text-xs text-slate-600 dark:text-slate-400">Job Duration</p>
                        <p className="font-medium text-sm text-slate-900 dark:text-white truncate">
                          {proposal.job_duration || "Not specified"}
                        </p>
                      </div>
                    </div>
                  </div>

                  {proposal.job_location && (
                    <div className="flex items-center text-sm text-slate-600 dark:text-slate-400 mb-4">
                      <MapPin className="h-4 w-4 mr-2 text-primary" />
                      <span>
                        Location:{" "}
                        <span className="font-medium text-slate-900 dark:text-white">{proposal.job_location}</span>
                      </span>
                    </div>
                  )}

                  <div className="mb-4">
                    <p className="text-sm font-medium text-slate-900 dark:text-white mb-2">Skills:</p>
                    <div className="flex flex-wrap gap-2">
                      {proposal.skills?.map((skill, index) => (
                        <Badge
                          key={index}
                          variant="secondary"
                          className="text-xs bg-primary/10 text-primary dark:bg-orange-900/20 dark:text-orange-300"
                        >
                          {skill}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="bg-primary/10 dark:bg-orange-900/10 p-4 rounded-lg border border-orange-200 dark:border-orange-800">
                    <p className="text-sm font-medium text-slate-900 dark:text-white mb-2">Your Proposal:</p>
                    <p className="text-sm text-slate-700 dark:text-gray-300 whitespace-pre-wrap">
                      {proposal.proposal_text}
                    </p>
                  </div>

                  {proposal.attachments && proposal.attachments.length > 0 && (
                    <div className="mt-4">
                      <p className="text-sm font-medium text-slate-900 dark:text-white mb-2">Attachments:</p>
                      <div className="flex flex-wrap gap-2">
                        {proposal.attachments.map((attachment, index) => (
                          <Badge key={index} variant="outline" className="text-sm">
                            📎 {attachment}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Freelancer Action Buttons */}
                  {proposal.status === "accepted" && proposal.funding_status === "funded" && (
                    <div className="mt-4 border-t pt-4 space-y-2">
                      {proposal.freelancer_status === "pending" && (
                        <Button
                          onClick={() => handleStartWork(proposal.id, proposal.job_id)}
                          className="w-full bg-blue-500 hover:bg-blue-600"
                        >
                          🚀 Bix (Start Work)
                        </Button>
                      )}
                      {proposal.freelancer_status === "started" && proposal.job_status === "completed" && (
                        <Button
                          onClick={() => handleCompleteWork(proposal.id, proposal.job_id)}
                          className="w-full bg-green-500 hover:bg-green-600"
                        >
                          ✅ Complete Work
                        </Button>
                      )}
                      {proposal.freelancer_status === "started" && proposal.job_status !== "completed" && (
                        <div className="w-full p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-center">
                          <p className="text-sm text-yellow-800">
                            Work in progress... Waiting for agency to mark job as done
                          </p>
                        </div>
                      )}
                      {proposal.freelancer_status === "completed" && (
                        <div className="w-full p-3 bg-green-50 border border-green-200 rounded-lg text-center">
                          <p className="text-sm text-green-800">✅ Work completed successfully!</p>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}

            {hasMore && proposals.length > 0 && (
              <div className="text-center py-6">
                <Button
                  onClick={() => loadProposals(true)}
                  disabled={loadingMore}
                  variant="outline"
                  className="min-w-32 border-primary text-primary hover:bg-primary/10 dark:hover:bg-orange-900/20"
                >
                  {loadingMore ? (
                    <div className="flex items-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary mr-2"></div>
                      Loading...
                    </div>
                  ) : (
                    "Load More"
                  )}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

