'use client'

import type React from "react"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Edit, Camera } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { useRouter } from "next/navigation"
import { setCachedAvatar } from "@/lib/avatar-cache"
import { getAvatarUrl } from "@/lib/avatar-url"

export default function FreelancerProfile({
  initialUser,
  initialProfile,
  initialLogo,
}: {
  initialUser: any
  initialProfile: any
  initialLogo: string
}) {
  const [profile, setProfile] = useState<any>(initialProfile)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [logoPreview, setLogoPreview] = useState<string>(initialLogo)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const router = useRouter()

  const [formData, setFormData] = useState({
    full_name: initialProfile?.full_name || "",
    bio: initialProfile?.bio || "",
    location: initialProfile?.location || "",
    phone: initialProfile?.phone || "",
    website: initialProfile?.website || "",
    hourly_rate: initialProfile?.hourly_rate || "",
    skills: Array.isArray(initialProfile?.skills)
      ? initialProfile.skills.join(", ")
      : initialProfile?.skills || "",
    experience_level: initialProfile?.experience_level || "",
  })

  useEffect(() => {
    if (!initialUser) {
      router.push("/login")
    }
  }, [initialUser, router])

  const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setSelectedFile(file)
      const reader = new FileReader()
      reader.onload = (e) => setLogoPreview(e.target?.result as string)
      reader.readAsDataURL(file)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const updateData = {
        full_name: formData.full_name,
        bio: formData.bio || null,
        location: formData.location || null,
        phone: formData.phone || null,
        website: formData.website || null,
        hourly_rate: formData.hourly_rate ? Number.parseInt(formData.hourly_rate) : null,
        skills: formData.skills
          ? formData.skills.split(",").map((s: string) => s.trim()).filter((s: string) => s.length > 0)
          : null,
        experience_level: formData.experience_level || null,
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

        await supabase.from("freelancer_logos").delete().eq("freelancer_id", user.id)
        await supabase.from("freelancer_logos").insert({
          freelancer_id: user.id,
          logo_path: path,
          file_name: selectedFile.name,
          file_size: selectedFile.size,
          mime_type: selectedFile.type,
        })
        setCachedAvatar(user.id, getAvatarUrl(path))
        window.dispatchEvent(new Event("freelancer_profile_updated"))
        router.refresh()
      } else {
        window.dispatchEvent(new Event("freelancer_profile_updated"))
      }
      setIsEditing(false)
      alert("Profile updated successfully!")
    } catch (error) {
      console.error(error)
      alert("Error saving profile")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <p className="eyebrow">Loading profile…</p>
      </div>
    )
  }

  const skillsList = formData.skills
    ? formData.skills.split(",").map((s: string) => s.trim()).filter(Boolean)
    : []

  const metaRows = [
    { eyebrow: "Hourly rate", key: "hourly_rate", value: formData.hourly_rate ? `₦${Number(formData.hourly_rate).toLocaleString()}/hr` : "—", type: "number", input: true },
    { eyebrow: "Experience", key: "experience_level", value: formData.experience_level || "—", input: false },
    { eyebrow: "Location", key: "location", value: formData.location || "—", input: true },
    { eyebrow: "Website", key: "website", value: formData.website || "—", input: true },
    { eyebrow: "Phone", key: "phone", value: formData.phone || "—", input: true },
  ]

  return (
    <div className="min-h-screen bg-surface pb-20">
      {/* Editorial header */}
      <header className="grain border-b border-border surface-paper">
        <div className="editorial-shell section-y">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-8">
            <div className="space-y-3 animate-fade-up">
              <p className="eyebrow">Profile</p>
              <h1 className="display-xl">
                {formData.full_name || "Your name"}
                <span className="italic text-muted-foreground/60">.</span>
              </h1>
              <p className="lede max-w-2xl">
                {formData.bio
                  ? formData.bio.length > 140
                    ? formData.bio.slice(0, 140) + "…"
                    : formData.bio
                  : "Tell agencies who you are, what you do, and where you work."}
              </p>
            </div>
            <div className="animate-fade-up delay-100 shrink-0">
              {!isEditing ? (
                <Button onClick={() => setIsEditing(true)} className="h-11">
                  <Edit className="mr-2 h-4 w-4" />
                  Edit profile
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setIsEditing(false)} className="h-11">
                    Cancel
                  </Button>
                  <Button onClick={handleSave} disabled={saving} className="h-11">
                    {saving ? "Saving…" : "Save changes"}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="editorial-shell section-y">
        <div className="editorial-grid">
          {/* LEFT: Avatar + meta */}
          <aside className="editorial-aside space-y-8 animate-fade-up delay-200">
            <div className="space-y-3">
              <div className="relative inline-block group">
                <Avatar className="h-40 w-40 rounded-lg shadow-[var(--shadow-warm)] border border-border">
                  <AvatarImage src={logoPreview} className="object-cover" />
                  <AvatarFallback className="bg-ink text-white text-4xl font-display rounded-lg">
                    {(formData.full_name?.charAt(0) || "?").toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                {isEditing && (
                  <label
                    htmlFor="logo-upload"
                    className="absolute inset-0 rounded-lg bg-foreground/60 flex items-center justify-center cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Camera className="text-white h-7 w-7" />
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageSelect}
                      className="hidden"
                      id="logo-upload"
                    />
                  </label>
                )}
              </div>
              {isEditing && (
                <p className="caption max-w-[16rem]">Hover the photo to upload. JPG, PNG or WebP.</p>
              )}
            </div>

            <div className="hairline">
              {metaRows.map((row, idx) => (
                <div key={idx} className="py-4 hairline-b">
                  <p className="eyebrow">{row.eyebrow}</p>
                  {isEditing ? (
                    row.key === "experience_level" ? (
                      <select
                        className="mt-1 w-full bg-transparent text-foreground font-medium focus:outline-none border-0 p-0"
                        value={formData.experience_level}
                        onChange={(e) => setFormData({ ...formData, experience_level: e.target.value })}
                      >
                        <option value="">Select level</option>
                        <option value="beginner">Beginner (0–1 yrs)</option>
                        <option value="intermediate">Intermediate (2–4 yrs)</option>
                        <option value="expert">Expert (5+ yrs)</option>
                      </select>
                    ) : (
                      <Input
                        type={(row as any).type || "text"}
                        className="border-0 p-0 h-auto mt-1 bg-transparent focus-visible:ring-0 text-foreground font-medium shadow-none"
                        value={(formData as any)[row.key]}
                        onChange={(e) => setFormData({ ...formData, [row.key]: e.target.value })}
                      />
                    )
                  ) : (
                    <p className="mt-1 text-foreground font-medium capitalize">{row.value}</p>
                  )}
                </div>
              ))}
            </div>

            <p className="marginalia">Last updated · today</p>
          </aside>

          {/* RIGHT: Bio + skills */}
          <section className="editorial-main space-y-10 animate-fade-up delay-300">
            {isEditing && (
              <div className="space-y-3">
                <p className="eyebrow">Full name</p>
                <Input
                  className="bg-transparent border-0 border-b border-border rounded-none focus-visible:ring-0 px-0 text-2xl font-display h-auto py-2 shadow-none"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  placeholder="How you'd like to be addressed"
                />
              </div>
            )}

            <div className="space-y-3">
              <p className="eyebrow">About</p>
              <h2 className="display-md">Your story.</h2>
              {isEditing ? (
                <Textarea
                  rows={8}
                  className="bg-transparent border-0 border-b border-border rounded-none focus-visible:ring-0 px-0 py-3 text-lg leading-relaxed resize-none min-h-[200px] shadow-none"
                  placeholder="Tell agencies about your background, expertise, and what you deliver…"
                  value={formData.bio}
                  onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                />
              ) : (
                <p className="body-lg whitespace-pre-line">
                  {formData.bio || (
                    <span className="text-muted-foreground italic">
                      No bio yet. Click "Edit profile" to add one.
                    </span>
                  )}
                </p>
              )}
            </div>

            <div className="space-y-3">
              <p className="eyebrow">Skills</p>
              {isEditing ? (
                <>
                  <Textarea
                    rows={3}
                    className="bg-transparent border-0 border-b border-border rounded-none focus-visible:ring-0 px-0 py-3 leading-relaxed resize-none shadow-none"
                    placeholder="React, Node.js, UI design, marketing strategy…"
                    value={formData.skills}
                    onChange={(e) => setFormData({ ...formData, skills: e.target.value })}
                  />
                  <p className="caption">Separate with commas.</p>
                </>
              ) : skillsList.length > 0 ? (
                <div className="flex flex-wrap gap-2 pt-1">
                  {skillsList.map((skill: string, i: number) => (
                    <span
                      key={i}
                      className="px-3 py-1.5 bg-paper text-foreground text-xs font-medium rounded-md border border-border"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="body-muted italic">No skills listed yet.</p>
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}
