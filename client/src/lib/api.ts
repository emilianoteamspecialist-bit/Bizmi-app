import { supabase } from "./supabase"

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const {
    data: { session },
  } = await supabase.auth.getSession()

  const res = await fetch(`${import.meta.env.VITE_API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
      ...init.headers,
    },
  })

  const body = await res.json()

  if (!res.ok) {
    throw new Error(body.error ?? `Request to ${path} failed with ${res.status}`)
  }

  return body as T
}
