"use client"

import type React from "react"

import { createContext, useContext, useEffect, useState } from "react"
import type { User } from "@supabase/supabase-js"
import { supabase } from "@/lib/supabase"

interface AuthContextType {
  user: User | null
  profile: any | null
  loading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
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

  useEffect(() => {
    let isMounted = true

    // Load from localStorage for immediate UI hydration
    let cachedProfileObj = null
    const cachedStr = typeof window !== 'undefined' ? localStorage.getItem("bizimee_user") : null
    if (cachedStr) {
      try {
        cachedProfileObj = JSON.parse(cachedStr)
        setProfile(cachedProfileObj)
      } catch (e) {
        console.error("Failed to parse cached profile", e)
      }
    }

    const getInitialSession = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession()

        if (!isMounted) return

        if (session?.user) {
          setUser(session.user)
          // Only fetch fresh profile if we don't have a valid cache for THIS user
          if (!cachedProfileObj || cachedProfileObj.id !== session.user.id) {
            await fetchProfile(session.user.id)
          }
        } else {
          setUser(null)
          setProfile(null)
          localStorage.removeItem("bizimee_user")
        }
      } catch (error) {
        console.error("Session error:", error)
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    getInitialSession()

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return

      if (session?.user) {
        setUser(session.user)
        // Refresh profile on explicit sign in
        if (event === 'SIGNED_IN') {
           await fetchProfile(session.user.id)
        }
      } else if (event === 'SIGNED_OUT') {
        setUser(null)
        setProfile(null)
        localStorage.removeItem("bizimee_user")
      }
      setLoading(false)
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [])

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).single()

      if (error) {
        console.error("Error fetching profile:", error)
        return
      }

      setProfile(data)
      localStorage.setItem("bizimee_user", JSON.stringify(data))
    } catch (error) {
      console.error("Error fetching profile:", error)
    }
  }

  const signOut = async () => {
    try {
      await supabase.auth.signOut()
      localStorage.removeItem("bizimee_user")
      setUser(null)
      setProfile(null)
    } catch (error) {
      console.error("Error signing out:", error)
    }
  }

  const value = {
    user,
    profile,
    loading,
    signOut,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
