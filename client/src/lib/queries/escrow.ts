import { useEffect } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { apiFetch } from "../api"
import { supabase } from "../supabase"

// Phase 4 (escrow v2) client hooks. All amounts from the API are integer kobo;
// convert only for display with formatKobo.

export type EscrowStatus = "pending" | "awaiting" | "funded" | "released" | "paid_out" | "refunded" | "disputed" | "cancelled"

export const formatKobo = (kobo: number | null | undefined) =>
  `₦${((Number(kobo) || 0) / 100).toLocaleString("en-NG", { maximumFractionDigits: 2 })}`

export type Payout = {
  id?: string
  escrow_id?: string
  status: "pending" | "processing" | "success" | "failed" | "reversed"
  net_amount_kobo: number
  gross_amount_kobo?: number
  platform_fee_kobo?: number
  requested_at?: string
  completed_at?: string | null
  failure_reason?: string | null
}

export type MyEscrow = {
  id: string
  job_id: string
  agency_id: string
  freelancer_id: string | null
  amount_kobo: number
  status_v2: EscrowStatus
  created_at: string
  funded_at: string | null
  released_at: string | null
  paid_out_at: string | null
  refunded_at: string | null
  disputed_at: string | null
  role: "agency" | "freelancer"
  job_title: string | null
  agency_name: string | null
  freelancer_name: string | null
  submission_status: "draft" | "submitted" | "changes_requested" | "approved" | null
  open_dispute_id: string | null
  latest_payout: Payout | null
}

export function useMyEscrowsQuery() {
  return useQuery({
    queryKey: ["escrow", "mine"],
    queryFn: () => apiFetch<{ escrows: MyEscrow[] }>("/api/escrow/mine"),
  })
}

export function useJobEscrowQuery(jobId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ["escrow", "job", jobId],
    queryFn: () => apiFetch<{ escrow: { id: string; status_v2: EscrowStatus; amount_kobo: number } | null }>(`/api/escrow/job/${jobId}`),
    enabled: !!jobId && enabled,
  })
}

export function useInitializeEscrowMutation() {
  return useMutation({
    mutationFn: (proposalId: string) =>
      apiFetch<{ success: boolean; escrow_id: string; authorization_url: string; reference: string; resumed?: boolean }>(
        "/api/escrow/initialize",
        { method: "POST", body: JSON.stringify({ proposalId }) }
      ),
  })
}

export function useVerifyEscrowMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (reference: string) =>
      apiFetch<{ success: boolean; status: EscrowStatus; already_processed?: boolean }>(
        `/api/escrow/verify?reference=${encodeURIComponent(reference)}`
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["escrow"] }),
  })
}

// ── Workspace ──────────────────────────────────────────────────────────────

export type Submission = {
  id: string
  job_id: string
  freelancer_id: string
  agency_id: string
  submission_type: "tech" | "design" | "writing" | "general"
  content: { github_url?: string; figma_url?: string; drive_link?: string; notes?: string }
  status: "draft" | "submitted" | "changes_requested" | "approved"
  submitted_at: string | null
  updated_at: string
}

export type Workspace = {
  role: "agency" | "freelancer"
  job: { id: string; title: string; description: string | null } | null
  escrow: { id: string; status: EscrowStatus; amount_kobo: number }
  submission: Submission | null
}

export type SubmissionComment = {
  id: string
  sender_id: string
  message: string
  created_at: string
  sender?: { full_name: string | null } | null
}

export function useWorkspaceQuery(jobId: string | undefined) {
  return useQuery({
    queryKey: ["workspace", jobId],
    queryFn: () => apiFetch<Workspace>(`/api/submissions?jobId=${encodeURIComponent(jobId!)}`),
    enabled: !!jobId,
  })
}

export function useSubmitWorkMutation(jobId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { submission_type: Submission["submission_type"]; content: Submission["content"] }) =>
      apiFetch<{ success: boolean; submission: Submission }>("/api/submissions", {
        method: "POST",
        body: JSON.stringify({ job_id: jobId, ...input }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["workspace", jobId] }),
  })
}

export function useSubmissionCommentsQuery(submissionId: string | undefined) {
  return useQuery({
    queryKey: ["submission-comments", submissionId],
    queryFn: () => apiFetch<{ comments: SubmissionComment[] }>(`/api/submissions/${submissionId}/comments`),
    enabled: !!submissionId,
  })
}

export function usePostCommentMutation(submissionId: string, jobId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { message: string; is_revision_request?: boolean }) =>
      apiFetch<{ success: boolean }>(`/api/submissions/${submissionId}/comments`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["submission-comments", submissionId] })
      queryClient.invalidateQueries({ queryKey: ["workspace", jobId] })
    },
  })
}

export function useApproveSubmissionMutation(jobId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (submissionId: string) =>
      apiFetch<{ success: boolean; status: EscrowStatus }>(`/api/submissions/${submissionId}/approve`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspace", jobId] })
      queryClient.invalidateQueries({ queryKey: ["escrow"] })
    },
  })
}

// ── Payouts ────────────────────────────────────────────────────────────────

export type BankDetails = { account_number: string; bank_code: string; account_name: string; bank_name: string | null }

export function useBanksQuery(enabled = true) {
  return useQuery({
    queryKey: ["payouts", "banks"],
    queryFn: () => apiFetch<{ banks: { name: string; code: string }[] }>("/api/payouts/banks"),
    staleTime: 60 * 60 * 1000,
    enabled,
  })
}

export function useBankDetailsQuery() {
  return useQuery({
    queryKey: ["payouts", "bank-details"],
    queryFn: () => apiFetch<{ bankDetails: BankDetails | null }>("/api/payouts/bank-details"),
  })
}

export function useSaveBankDetailsMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { account_number: string; bank_code: string }) =>
      apiFetch<{ success: boolean; bankDetails: BankDetails }>("/api/payouts/bank-details", {
        method: "PUT",
        body: JSON.stringify(input),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["payouts", "bank-details"] }),
  })
}

export function useRequestPayoutMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (escrowId: string) =>
      apiFetch<{ success: boolean; payout: Payout }>("/api/payouts/request", {
        method: "POST",
        body: JSON.stringify({ escrowId }),
      }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["escrow", "mine"] }),
  })
}

// ── Disputes ───────────────────────────────────────────────────────────────

export type DisputeType = "quality" | "non_delivery" | "client_abandonment" | "extra_work"

export const DISPUTE_TYPE_LABELS: Record<DisputeType, string> = {
  quality: "Quality of work",
  non_delivery: "Work not delivered",
  client_abandonment: "Client abandoned the job",
  extra_work: "Work beyond the agreed scope",
}

export type Dispute = {
  id: string
  job_id: string
  initiator_id: string
  respondent_id: string
  dispute_type: DisputeType
  status: "in_platform_review" | "admin_intervention" | "resolved"
  resolution_outcome: "full_release" | "partial_release" | "refund" | "none" | null
  amount_disputed: number
  description: string
  created_at: string
  job?: { title: string } | null
  initiator?: { full_name: string | null } | null
  respondent?: { full_name: string | null } | null
}

export type DisputeMessage = {
  id: string
  dispute_id: string
  sender_id: string
  message: string
  created_at: string
  sender?: { full_name: string | null } | null
}

export function useOpenDisputeMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { job_id: string; dispute_type: DisputeType; description: string }) =>
      apiFetch<{ success: boolean; dispute: { id: string } }>("/api/disputes", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["escrow"] }),
  })
}

export function useDisputeQuery(disputeId: string | undefined) {
  return useQuery({
    queryKey: ["dispute", disputeId],
    queryFn: () => apiFetch<{ dispute: Dispute; messages: DisputeMessage[] }>(`/api/disputes/${disputeId}`),
    enabled: !!disputeId,
  })
}

export function usePostDisputeMessageMutation(disputeId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (message: string) =>
      apiFetch<{ message: DisputeMessage }>(`/api/disputes/${disputeId}/messages`, { method: "POST", body: JSON.stringify({ message }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["dispute", disputeId] }),
  })
}

// Live dispute chat: refetch (to pick up sender names) when the other party
// posts. RLS on dispute_messages limits the stream to participants.
export function useRealtimeDisputeMessages(disputeId: string | undefined) {
  const queryClient = useQueryClient()
  useEffect(() => {
    if (!disputeId) return
    const channel = supabase
      .channel(`dispute_messages:${disputeId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "dispute_messages", filter: `dispute_id=eq.${disputeId}` },
        () => queryClient.invalidateQueries({ queryKey: ["dispute", disputeId] })
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [disputeId, queryClient])
}

// ── Admin ──────────────────────────────────────────────────────────────────

export type AdminTransaction = {
  id: string
  job_id: string
  agency_id: string
  freelancer_id: string | null
  amount_kobo: number
  status_v2: EscrowStatus
  paystack_reference: string | null
  created_at: string
  job_title: string | null
  agency_name: string | null
  freelancer_name: string | null
  payouts: Payout[]
}

export type AdminTransactionTotals = {
  funded_kobo: number
  released_kobo: number
  paid_out_kobo: number
  refunded_kobo: number
  in_escrow_kobo: number
  fees_kobo: number
}

export type EscrowEvent = {
  id: string
  type: string
  from_status: EscrowStatus | null
  to_status: EscrowStatus
  amount_kobo: number | null
  actor_type: "agency" | "freelancer" | "admin" | "system"
  created_at: string
}

export function useAdminTransactionsQuery() {
  return useQuery({
    queryKey: ["admin", "transactions"],
    queryFn: () => apiFetch<{ totals: AdminTransactionTotals; transactions: AdminTransaction[] }>("/api/admin/transactions"),
  })
}

export function useAdminEscrowEventsQuery(escrowId: string | null) {
  return useQuery({
    queryKey: ["admin", "transactions", escrowId, "events"],
    queryFn: () => apiFetch<{ events: EscrowEvent[] }>(`/api/admin/transactions/${escrowId}/events`),
    enabled: !!escrowId,
  })
}

export type AdminAnalytics = {
  topFreelancers: { id: string; name: string; email: string | null; earned_kobo: number; paid_jobs: number }[]
  topAgencies: { id: string; name: string; email: string | null; funded_kobo: number; funded_jobs: number }[]
}

export function useAdminAnalyticsQuery() {
  return useQuery({
    queryKey: ["admin", "analytics"],
    queryFn: () => apiFetch<AdminAnalytics>("/api/admin/analytics"),
  })
}

export function useAdminDisputesQuery() {
  return useQuery({
    queryKey: ["admin", "disputes"],
    queryFn: () => apiFetch<{ disputes: Dispute[]; messagesByDispute: Record<string, DisputeMessage[]> }>("/api/admin/disputes"),
  })
}

export function useResolveDisputeMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ disputeId, outcome }: { disputeId: string; outcome: "full_release" | "refund" }) =>
      apiFetch<{ success: boolean }>(`/api/admin/disputes/${disputeId}/resolve`, {
        method: "POST",
        body: JSON.stringify({ resolution_outcome: outcome }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "disputes"] })
      queryClient.invalidateQueries({ queryKey: ["admin", "transactions"] })
    },
  })
}
