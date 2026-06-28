"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Edit, MapPin, Globe, Phone, Users, Camera } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { useRouter } from "next/navigation"
import { setCachedAvatar } from "@/lib/avatar-cache"
import { getAvatarUrl, resolveAvatar } from "@/lib/avatar-url"
import { useAuth } from "@/contexts/AuthContext"

interface AgencyProfileClientProps {
  initialProfile: any
  initialProfileImage: string
}

export default function AgencyProfileClient({
  initialProfile,
  initialProfileImage,
}: AgencyProfileClientProps) {
  const { user: authUser, loading: authLoading } = useAuth()
  const [profile, setProfile] = useState<any>(initialProfile)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [imagePreview, setImagePreview] = useState<string>(initialProfileImage)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const router = useRouter()

  const [formData, setFormData] = useState({
    full_name: initialProfile?.full_name || "",
    company_name: initialProfile?.company_name || "",
    company_size: initialProfile?.company_size || "",
    bio: initialProfile?.bio || "",
    location: initialProfile?.location || "",
    phone: initialProfile?.phone || "",
    website: initialProfile?.website || "",
  })

  useEffect(() => {
    if (authLoading) return
    if (!authUser?.id) {
      router.push("/login")
    }
  }, [authUser?.id, authLoading, router])

  const loadProfile = async () => {
    try {
      const user = authUser
      if (!user) {
        router.push("/login")
        return
      }

      const { data: profileData } = await supabase.from("profiles").select("*").eq("id", user.id).single()
      if (profileData) {
        setProfile(profileData)
        setFormData({
          full_name: profileData.full_name || "",
          company_name: profileData.company_name || "",
          company_size: profileData.company_size || "",
          bio: profileData.bio || "",
          location: profileData.location || "",
          phone: profileData.phone || "",
          website: profileData.website || "",
        })
      }

      const { data: imageData } = await supabase.from("agency_image").select("image_path, image_data").eq("agency_id", user.id).maybeSingle()
      if (imageData) setImagePreview(resolveAvatar(imageData))
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setSelectedFile(file)
      const reader = new FileReader()
      reader.onload = (e) => setImagePreview(e.target?.result as string)
      reader.readAsDataURL(file)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const user = authUser
      if (!user) return

      const updateData = {
        full_name: formData.full_name || null,
        company_name: formData.company_name || null,
        company_size: formData.company_size || null,
        bio: formData.bio || null,
        location: formData.location || null,
        phone: formData.phone || null,
        website: formData.website || null,
        updated_at: new Date().toISOString(),
      }

      const { error: profileError } = await supabase.from("profiles").update(updateData).eq("id", user.id)
      if (profileError) throw profileError

      if (selectedFile) {
        const ext = selectedFile.name.split(".").pop()?.toLowerCase() || "png"
        const path = `${user.id}/avatar.${ext}`

        const { error: uploadError } = await supabase.storage
          .from("avatars")
          .upload(path, selectedFile, { contentType: selectedFile.type, upsert: true })
        if (uploadError) throw uploadError

        await supabase.from("agency_image").delete().eq("agency_id", user.id)
        await supabase.from("agency_image").insert({
          agency_id: user.id,
          image_path: path,
          file_name: selectedFile.name,
          file_size: selectedFile.size,
          mime_type: selectedFile.type,
        })
        setCachedAvatar(user.id, getAvatarUrl(path))
        window.dispatchEvent(new Event("agency_profile_updated"))
        loadProfile()
      } else {
        window.dispatchEvent(new Event("agency_profile_updated"))
      }
      setIsEditing(false)
      alert("Agency profile updated successfully!")
    } catch (error) {
      console.error(error)
      alert("Error saving profile")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="min-h-screen bg-surface flex items-center justify-center text-sm font-medium text-muted-foreground">Loading profile…</div>
  }

  return (
    <div className="min-h-screen bg-surface pb-20">
      <div className="max-w-6xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-8">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4 sm:gap-5 min-w-0">
            <div className="relative group shrink-0">
              <Avatar className="h-16 w-16 sm:h-20 sm:w-20 rounded-2xl border border-border">
                <AvatarImage src={imagePreview} className="object-cover" />
                <AvatarFallback className="bg-foreground text-white text-xl sm:text-2xl font-semibold uppercase rounded-2xl">
                  {formData.company_name?.charAt(0) || formData.full_name?.charAt(0) || "A"}
                </AvatarFallback>
              </Avatar>
              {isEditing && (
                <label htmlFor="image-upload" className="absolute inset-0 bg-foreground/60 rounded-2xl flex items-center justify-center cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity">
                  <Camera className="text-white h-6 w-6" />
                  <input type="file" accept="image/*" onChange={handleImageSelect} className="hidden" id="image-upload" />
                </label>
              )}
            </div>
            <div className="space-y-1 min-w-0">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Agency profile</p>
              <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-foreground truncate">{formData.company_name || formData.full_name || "New agency"}</h1>
              <p className="text-sm text-muted-foreground flex items-center gap-1.5 min-w-0">
                <MapPin className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{formData.location || "Location not set"}</span>
              </p>
            </div>
          </div>
          <div className="w-full md:w-auto md:shrink-0">
            {!isEditing ? (
              <Button onClick={() => setIsEditing(true)} className="h-10 px-4 rounded-lg gap-2 w-full md:w-auto justify-center">
                <Edit className="h-4 w-4" /> Edit profile
              </Button>
            ) : (
              <div className="flex gap-2 w-full md:w-auto">
                <Button variant="outline" onClick={() => setIsEditing(false)} className="h-10 px-4 rounded-lg flex-1 md:flex-none justify-center">
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={saving} className="h-10 px-4 rounded-lg flex-1 md:flex-none justify-center">
                  {saving ? "Saving…" : "Save changes"}
                </Button>
              </div>
            )}
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Sidebar Info */}
          <div className="space-y-6">
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="px-5 py-4 border-b border-border">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Company overview</p>
              </div>
              <div className="p-5 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-surface-2 flex items-center justify-center shrink-0"><Users className="h-4 w-4 text-muted-foreground" /></div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Team size</p>
                    <p className="text-sm font-medium text-foreground">{formData.company_size || "Not set"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-surface-2 flex items-center justify-center shrink-0"><Globe className="h-4 w-4 text-muted-foreground" /></div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Website</p>
                    <p className="text-sm font-medium text-foreground truncate">{formData.website || "No website"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-surface-2 flex items-center justify-center shrink-0"><Phone className="h-4 w-4 text-muted-foreground" /></div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Contact</p>
                    <p className="text-sm font-medium text-foreground">{formData.phone || "No phone"}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Main Form */}
          <div className="lg:col-span-2 space-y-6">
            <div className="rounded-xl border border-border bg-card">
              <div className="p-6 pb-4">
                <h2 className="text-base font-semibold text-foreground">About agency</h2>
                <p className="text-sm text-muted-foreground mt-0.5">Information visible to freelancers you hire.</p>
              </div>
              <div className="p-6 pt-0 space-y-6">
                <div className="space-y-2">
                  <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Agency bio / about</Label>
                  <Textarea
                    rows={6}
                    className="min-h-[160px] resize-none"
                    placeholder="Describe your company, what you do, and what you look for in talent..."
                    value={formData.bio}
                    onChange={(e) => setFormData({...formData, bio: e.target.value})}
                    disabled={!isEditing}
                  />
                </div>

                {isEditing && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-foreground">Company name</Label>
                      <Input value={formData.company_name} onChange={(e) => setFormData({...formData, company_name: e.target.value})} />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-foreground">Point of contact</Label>
                      <Input value={formData.full_name} onChange={(e) => setFormData({...formData, full_name: e.target.value})} />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-foreground">Location</Label>
                      <Input value={formData.location} onChange={(e) => setFormData({...formData, location: e.target.value})} />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-foreground">Company size</Label>
                      <select
                        className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                        value={formData.company_size}
                        onChange={(e) => setFormData({...formData, company_size: e.target.value})}
                      >
                        <option value="">Select size</option>
                        <option value="1-10">1-10 employees</option>
                        <option value="11-50">11-50 employees</option>
                        <option value="51-200">51-200 employees</option>
                        <option value="200+">200+ employees</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-foreground">Phone</Label>
                      <Input value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-foreground">Website</Label>
                      <Input value={formData.website} onChange={(e) => setFormData({...formData, website: e.target.value})} />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
