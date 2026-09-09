import { useQuery } from "@tanstack/react-query"
import { apiFetch } from "../api"

export function useAgencyImageQuery(agencyId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ["agencies", agencyId, "image"],
    queryFn: () => apiFetch<{ image: string | null }>(`/api/agencies/${agencyId}/image`),
    enabled: enabled && !!agencyId,
  })
}
