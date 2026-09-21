import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { apiFetch } from "../api"

export type CreditPurchase = {
  id: string
  amount: number
  credits_amount: number
  status: string
  created_at: string
  paystack_reference: string
}

export function useCreditsHistoryQuery() {
  return useQuery({
    queryKey: ["user", "credits", "history"],
    queryFn: () => apiFetch<{ purchases: CreditPurchase[] }>("/api/user/credits/history"),
  })
}

export function useVerifyCreditsMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { reference: string; amount: number }) =>
      apiFetch<{ success: boolean; credits_added?: number; purchase?: CreditPurchase; error?: string }>(
        "/api/user/credits/verify",
        {
          method: "POST",
          body: JSON.stringify(input),
        }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user", "dashboard"] })
      queryClient.invalidateQueries({ queryKey: ["user", "credits", "history"] })
    },
  })
}
