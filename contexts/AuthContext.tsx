"use client"

import type React from "react"

import { createContext, useContext, useEffect, useState } from "react"
import type { User } from "@supabase/supabase-js"
import { supabase } from "@/lib/supabase"
import { clearAvatarCache } from "@/lib/avatar-cache"

interface AuthContextType {
  user: User | null
  profile: any | null
  loading: boolean
  refreshProfile: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  refreshProfile: async () => {},
  signOut: async () => {},
})

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single()
    if (error) {
      console.error("Error fetching profile:", error)
      return
    }
    setProfile(data)
  }

  useEffect(() => {
    let isMounted = true

    const init = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!isMounted) return

      if (session?.user) {
        setUser(session.user)
        await fetchProfile(session.user.id)
      }
      setLoading(false)
    }

    init()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return

      if (session?.user) {
        setUser(session.user)
        if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
          await fetchProfile(session.user.id)
        }
      } else if (event === "SIGNED_OUT") {
        setUser(null)
        setProfile(null)
        clearAvatarCache()
      }
      setLoading(false)
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [])

  const refreshProfile = async () => {
    if (user?.id) await fetchProfile(user.id)
  }

  const signOut = async () => {
    // Clear local UI state first so logout feels instant, then drop the session
    // locally. `scope: 'local'` skips the global server-side revoke round-trip
    // (which is slow — and stalls/errors when the refresh token is already
    // stale), and never let a failure block the redirect that follows.
    clearAvatarCache()
    setUser(null)
    setProfile(null)
    try {
      await supabase.auth.signOut({ scope: "local" })
    } catch {
      /* session already gone locally — nothing to do */
    }
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, refreshProfile, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}
