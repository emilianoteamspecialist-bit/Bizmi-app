import { useState, type ChangeEvent } from "react"
import { Navigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Camera, Edit } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { useFreelancerLogosQuery, useUpdateProfileMutation, useUploadAvatarMutation } from "@/lib/queries/user"
import { fileToBase64 } from "@/lib/file"

const MAX_AVATAR_BYTES = 5 * 1024 * 1024

function toFormData(profile: any) {
  return {
    full_name: profile?.full_name || "",
    bio: profile?.bio || "",
    location: profile?.location || "",
    phone: profile?.phone || "",
    website: profile?.website || "",
    hourly_rate: profile?.hourly_rate ? String(profile.hourly_rate) : "",
    skills: Array.isArray(profile?.skills) ? profile.skills.join(", ") : "",
    experience_level: profile?.experience_level || "",
  }
}

export default function FreelancerProfile() {
  const { user, profile, refreshProfile } = useAuth()
  const logosQuery = useFreelancerLogosQuery(user?.id ? [user.id] : [])
  const updateProfile = useUpdateProfileMutation()
  const uploadAvatar = useUploadAvatarMutation()

  const [isEditing, setIsEditing] = useState(false)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [formData, setFormData] = useState(toFormData(profile))

  if (profile && profile.account_type !== "freelancer") {
    return <Navigate to="/" replace />
  }

  const startEditing = () => {
    setFormData(toFormData(profile))
    setIsEditing(true)
  }

  const handleAvatarSelect = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (file.size > MAX_AVATAR_BYTES) {
      alert("Image must be 5MB or smaller.")
      return
    }
    const { dataUrl, data, mimeType, fileName } = await fileToBase64(file)
    setAvatarPreview(dataUrl)
    uploadAvatar.mutate(
      { data, fileName, mimeType },
      { onError: () => alert("Error uploading photo") }
    )
  }

  const handleSave = () => {
    updateProfile.mutate(
      {
        full_name: formData.full_name,
        bio: formData.bio || null,
        location: formData.location || null,
        phone: formData.phone || null,
        website: formData.website || null,
        hourly_rate: formData.hourly_rate ? Number.parseInt(formData.hourly_rate, 10) : null,
        skills: formData.skills
          ? formData.skills.split(",").map((s) => s.trim()).filter((s) => s.length > 0)
          : null,
        experience_level: formData.experience_level || null,
      },
      {
        onSuccess: async (result: { success: boolean; error?: string }) => {
          if (!result.success) {
            alert(result.error || "Error saving profile")
            return
          }
          await refreshProfile()
          setIsEditing(false)
        },
        onError: () => alert("Error saving profile"),
      }
    )
  }

  const avatarSrc = avatarPreview ?? logosQuery.data?.logos?.[user?.id ?? ""] ?? undefined
  const skillsList = formData.skills ? formData.skills.split(",").map((s) => s.trim()).filter(Boolean) : []

  return (
    <div className="min-h-screen bg-surface pb-20">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="flex items-center gap-4 min-w-0">
            <div className="relative group shrink-0">
              <Avatar className="h-20 w-20 rounded-2xl border border-border">
                <AvatarImage src={avatarSrc} className="object-cover" />
                <AvatarFallback className="bg-foreground text-white text-2xl font-semibold rounded-2xl">
                  {(formData.full_name?.charAt(0) || "?").toUpperCase()}
                </AvatarFallback>
              </Avatar>
              {isEditing && (
                <label
                  htmlFor="avatar-upload"
                  className="absolute inset-0 bg-foreground/60 rounded-2xl flex items-center justify-center cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Camera className="text-white h-6 w-6" />
                  <input type="file" accept="image/*" onChange={handleAvatarSelect} className="hidden" id="avatar-upload" />
                </label>
              )}
            </div>
            <div className="space-y-1 min-w-0">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Freelancer profile</p>
              <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-foreground truncate">
                {formData.full_name || "Your name"}
              </h1>
              <p className="text-sm text-muted-foreground">{formData.location || "Location not set"}</p>
            </div>
          </div>
          <div className="w-full sm:w-auto sm:shrink-0">
            {!isEditing ? (
              <Button onClick={startEditing} className="h-10 px-4 rounded-lg gap-2 w-full sm:w-auto justify-center">
                <Edit className="h-4 w-4" /> Edit profile
              </Button>
            ) : (
              <div className="flex gap-2 w-full sm:w-auto">
                <Button variant="outline" onClick={() => setIsEditing(false)} className="h-10 px-4 rounded-lg flex-1 sm:flex-none justify-center">
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={updateProfile.isPending} className="h-10 px-4 rounded-lg flex-1 sm:flex-none justify-center">
                  {updateProfile.isPending ? "Saving…" : "Save changes"}
                </Button>
              </div>
            )}
          </div>
        </header>

        <div className="rounded-xl border border-border bg-card">
          <div className="p-6 pb-4">
            <h2 className="text-base font-semibold text-foreground">About</h2>
            <p className="text-sm text-muted-foreground mt-0.5">What agencies see when reviewing your proposals.</p>
          </div>
          <div className="p-6 pt-0 space-y-6">
            <div className="space-y-2">
              <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Bio</Label>
              <Textarea
                rows={6}
                className="min-h-[140px] resize-none"
                placeholder="Tell agencies about your background, expertise, and what you deliver…"
                value={formData.bio}
                onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                disabled={!isEditing}
              />
            </div>

            {isEditing && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
                <div className="space-y-2">
                  <Label htmlFor="full_name" className="text-sm font-medium text-foreground">Full name</Label>
                  <Input id="full_name" value={formData.full_name} onChange={(e) => setFormData({ ...formData, full_name: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="hourly_rate" className="text-sm font-medium text-foreground">Hourly rate (₦)</Label>
                  <Input id="hourly_rate" type="number" value={formData.hourly_rate} onChange={(e) => setFormData({ ...formData, hourly_rate: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="location" className="text-sm font-medium text-foreground">Location</Label>
                  <Input id="location" value={formData.location} onChange={(e) => setFormData({ ...formData, location: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-foreground">Experience level</Label>
                  <Select value={formData.experience_level} onValueChange={(v) => setFormData({ ...formData, experience_level: v })}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select level" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="beginner">Beginner (0–1 yrs)</SelectItem>
                      <SelectItem value="intermediate">Intermediate (2–4 yrs)</SelectItem>
                      <SelectItem value="expert">Expert (5+ yrs)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-sm font-medium text-foreground">Phone</Label>
                  <Input id="phone" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="website" className="text-sm font-medium text-foreground">Website</Label>
                  <Input id="website" value={formData.website} onChange={(e) => setFormData({ ...formData, website: e.target.value })} />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="skills" className="text-sm font-medium text-foreground">Skills</Label>
                  <Textarea
                    id="skills"
                    rows={2}
                    placeholder="React, Node.js, UI design, marketing strategy…"
                    value={formData.skills}
                    onChange={(e) => setFormData({ ...formData, skills: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">Separate with commas.</p>
                </div>
              </div>
            )}

            {!isEditing && (
              <div className="space-y-2">
                <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Skills</Label>
                {skillsList.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {skillsList.map((skill) => (
                      <span key={skill} className="px-3 py-1.5 bg-surface-2 text-foreground text-xs font-medium rounded-md border border-border">
                        {skill}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic">No skills listed yet.</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
