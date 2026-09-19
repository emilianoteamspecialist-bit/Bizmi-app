import { useState, type ChangeEvent } from "react"
import { Navigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Camera, Edit, MapPin } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { useAgencyImageQuery } from "@/lib/queries/agencies"
import { useUpdateProfileMutation, useUploadAvatarMutation } from "@/lib/queries/user"
import { fileToBase64 } from "@/lib/file"

const MAX_AVATAR_BYTES = 5 * 1024 * 1024

type AgencyProfileFormData = {
  full_name: string
  company_name: string
  company_size: string
  bio: string
  location: string
  phone: string
  website: string
}

function toFormData(profile: any): AgencyProfileFormData {
  return {
    full_name: profile?.full_name || "",
    company_name: profile?.company_name || "",
    company_size: profile?.company_size || "",
    bio: profile?.bio || "",
    location: profile?.location || "",
    phone: profile?.phone || "",
    website: profile?.website || "",
  }
}

export default function AgencyProfile() {
  const { user, profile, refreshProfile } = useAuth()
  const imageQuery = useAgencyImageQuery(user?.id, !!user?.id)
  const updateProfile = useUpdateProfileMutation()
  const uploadAvatar = useUploadAvatarMutation()

  const [isEditing, setIsEditing] = useState(false)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [formData, setFormData] = useState(toFormData(profile))

  if (profile && profile.account_type !== "agency") {
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
      { onError: () => alert("Error uploading logo") }
    )
  }

  const handleSave = () => {
    updateProfile.mutate(
      {
        full_name: formData.full_name || null,
        company_name: formData.company_name || null,
        company_size: formData.company_size || null,
        bio: formData.bio || null,
        location: formData.location || null,
        phone: formData.phone || null,
        website: formData.website || null,
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

  const avatarSrc = avatarPreview ?? imageQuery.data?.image ?? undefined

  return (
    <div className="min-h-screen bg-surface pb-20">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="flex items-center gap-4 min-w-0">
            <div className="relative group shrink-0">
              <Avatar className="h-20 w-20 rounded-2xl border border-border">
                <AvatarImage src={avatarSrc} className="object-cover" />
                <AvatarFallback className="bg-foreground text-white text-2xl font-semibold uppercase rounded-2xl">
                  {formData.company_name?.charAt(0) || formData.full_name?.charAt(0) || "A"}
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
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Agency profile</p>
              <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-foreground truncate">
                {formData.company_name || formData.full_name || "New agency"}
              </h1>
              <p className="text-sm text-muted-foreground flex items-center gap-1.5 min-w-0">
                <MapPin className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{formData.location || "Location not set"}</span>
              </p>
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
            <h2 className="text-base font-semibold text-foreground">About agency</h2>
            <p className="text-sm text-muted-foreground mt-0.5">Information visible to freelancers you hire.</p>
          </div>
          <div className="p-6 pt-0 space-y-6">
            <div className="space-y-2">
              <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Agency bio / about</Label>
              <Textarea
                rows={6}
                className="min-h-[140px] resize-none"
                placeholder="Describe your company, what you do, and what you look for in talent…"
                value={formData.bio}
                onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                disabled={!isEditing}
              />
            </div>

            {isEditing && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
                <div className="space-y-2">
                  <Label htmlFor="company_name" className="text-sm font-medium text-foreground">Company name</Label>
                  <Input id="company_name" value={formData.company_name} onChange={(e) => setFormData({ ...formData, company_name: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="full_name" className="text-sm font-medium text-foreground">Point of contact</Label>
                  <Input id="full_name" value={formData.full_name} onChange={(e) => setFormData({ ...formData, full_name: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="location" className="text-sm font-medium text-foreground">Location</Label>
                  <Input id="location" value={formData.location} onChange={(e) => setFormData({ ...formData, location: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-foreground">Company size</Label>
                  <Select value={formData.company_size} onValueChange={(v) => setFormData({ ...formData, company_size: v })}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select size" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1-10">1-10 employees</SelectItem>
                      <SelectItem value="11-50">11-50 employees</SelectItem>
                      <SelectItem value="51-200">51-200 employees</SelectItem>
                      <SelectItem value="200+">200+ employees</SelectItem>
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
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
