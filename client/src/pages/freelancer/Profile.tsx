import { useEffect, useState, type ChangeEvent } from "react"
import { Navigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Camera, MapPin, Pencil } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { useFreelancerLogosQuery, useUpdateProfileMutation, useUploadAvatarMutation } from "@/lib/queries/user"
import { useVerificationQuery } from "@/lib/queries/verification"
import { fileToBase64 } from "@/lib/file"
import { formatMemberSince, formatNaira } from "@/lib/format"
import { PageContainer, Panel, SkillList, TrustBadge } from "@/components/marketplace/primitives"
import { ProfileCompleteness, freelancerCompleteness } from "@/components/marketplace/ProfileCompleteness"

const MAX_AVATAR_BYTES = 5 * 1024 * 1024

const EXPERIENCE_LABELS: Record<string, string> = {
  beginner: "Beginner (0–1 yrs)",
  intermediate: "Intermediate (2–4 yrs)",
  expert: "Expert (5+ yrs)",
}

type FreelancerProfileFormData = {
  full_name: string
  bio: string
  location: string
  phone: string
  website: string
  hourly_rate: string
  skills: string
  experience_level: string
}

function toFormData(profile: any): FreelancerProfileFormData {
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
  const verificationQuery = useVerificationQuery()
  const updateProfile = useUpdateProfileMutation()
  const uploadAvatar = useUploadAvatarMutation()

  const [isEditing, setIsEditing] = useState(false)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [formData, setFormData] = useState(toFormData(profile))

  // AuthContext can resolve `profile` after this page has mounted; re-sync
  // the read-only view when it does (never while the user is editing).
  useEffect(() => {
    if (!isEditing) setFormData(toFormData(profile))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile])

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
    uploadAvatar.mutate({ data, fileName, mimeType }, { onError: () => alert("Error uploading photo") })
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
  const identityVerified = verificationQuery.data?.status === "verified"
  const rate = formatNaira(formData.hourly_rate)
  const memberSince = formatMemberSince((profile as any)?.created_at)
  const completeness = freelancerCompleteness({
    hasPhoto: !!avatarSrc,
    bio: formData.bio,
    skills: skillsList,
    hourlyRate: formData.hourly_rate,
    location: formData.location,
    identityVerified,
  }).map((item) => (item.action?.to === "/freelancer/profile" ? { ...item, action: { label: item.action.label, onClick: startEditing } } : item))

  return (
    <PageContainer>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 space-y-5">
          {/* Storefront header: how agencies see you */}
          <section className="rounded-lg border border-border bg-card p-5 sm:p-6">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
              <div className="relative shrink-0">
                <Avatar className="h-20 w-20 border border-border">
                  <AvatarImage src={avatarSrc} className="object-cover" alt="" />
                  <AvatarFallback className="bg-foreground text-2xl font-semibold text-background">{(formData.full_name?.charAt(0) || "?").toUpperCase()}</AvatarFallback>
                </Avatar>
                {isEditing && (
                  <label
                    htmlFor="avatar-upload"
                    className="absolute -bottom-1 -right-1 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-border bg-card text-foreground shadow-sm hover:bg-surface-2"
                    title="Change photo"
                  >
                    <Camera className="h-4 w-4" />
                    <span className="sr-only">Change photo</span>
                    <input type="file" accept="image/*" onChange={handleAvatarSelect} className="sr-only" id="avatar-upload" />
                  </label>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <h1 className="truncate font-heading text-2xl font-semibold tracking-tight text-foreground">{formData.full_name || "Your name"}</h1>
                    <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" aria-hidden />
                        {formData.location || "Location not set"}
                      </span>
                      {memberSince && <span>{memberSince}</span>}
                    </p>
                    <div className="mt-2">{identityVerified ? <TrustBadge kind="identity" /> : <span className="text-xs text-muted-foreground">Identity not yet verified</span>}</div>
                  </div>
                  {!isEditing ? (
                    <Button variant="outline" onClick={startEditing} className="shrink-0">
                      <Pencil /> Edit profile
                    </Button>
                  ) : (
                    <div className="flex shrink-0 gap-2">
                      <Button variant="outline" onClick={() => setIsEditing(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleSave} disabled={updateProfile.isPending}>
                        {updateProfile.isPending ? "Saving…" : "Save changes"}
                      </Button>
                    </div>
                  )}
                </div>

                {!isEditing && (
                  <dl className="mt-4 grid grid-cols-2 gap-4 border-t border-border pt-4 text-sm sm:grid-cols-3">
                    <div>
                      <dt className="text-xs text-muted-foreground">Hourly rate</dt>
                      <dd className="font-semibold tabular-nums text-foreground">{rate ? `${rate}/hr` : "Not set"}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Experience</dt>
                      <dd className="font-semibold text-foreground">{EXPERIENCE_LABELS[formData.experience_level] ?? "Not set"}</dd>
                    </div>
                    {formData.website && (
                      <div className="col-span-2 min-w-0 sm:col-span-1">
                        <dt className="text-xs text-muted-foreground">Website</dt>
                        <dd className="truncate font-semibold text-foreground">{formData.website}</dd>
                      </div>
                    )}
                  </dl>
                )}
              </div>
            </div>
          </section>

          {isEditing ? (
            <Panel title="Edit profile">
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <div className="space-y-1.5 md:col-span-2">
                  <Label htmlFor="bio">Bio</Label>
                  <Textarea
                    id="bio"
                    rows={6}
                    placeholder="What you do, who you've done it for, and what agencies can expect working with you"
                    value={formData.bio}
                    onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="full_name">Full name</Label>
                  <Input id="full_name" value={formData.full_name} onChange={(e) => setFormData({ ...formData, full_name: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="hourly_rate">Hourly rate (₦)</Label>
                  <Input id="hourly_rate" type="number" inputMode="numeric" value={formData.hourly_rate} onChange={(e) => setFormData({ ...formData, hourly_rate: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="location">Location</Label>
                  <Input id="location" value={formData.location} onChange={(e) => setFormData({ ...formData, location: e.target.value })} placeholder="e.g. Lagos, Nigeria" />
                </div>
                <div className="space-y-1.5">
                  <Label>Experience level</Label>
                  <Select value={formData.experience_level} onValueChange={(v) => setFormData({ ...formData, experience_level: v })}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select level" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(EXPERIENCE_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="phone">Phone</Label>
                  <Input id="phone" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="website">Website</Label>
                  <Input id="website" value={formData.website} onChange={(e) => setFormData({ ...formData, website: e.target.value })} />
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <Label htmlFor="skills">Skills</Label>
                  <Textarea id="skills" rows={2} placeholder="React, Node.js, UI design, marketing strategy" value={formData.skills} onChange={(e) => setFormData({ ...formData, skills: e.target.value })} />
                  <p className="text-xs text-muted-foreground">Separate skills with commas. Agencies search by these.</p>
                </div>
              </div>
            </Panel>
          ) : (
            <>
              <Panel title="Overview">
                {formData.bio ? (
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{formData.bio}</p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Agencies read your bio before your proposal.{" "}
                    <button onClick={startEditing} className="font-medium text-primary hover:underline">
                      Write one
                    </button>
                  </p>
                )}
              </Panel>
              <Panel title="Skills">
                {skillsList.length > 0 ? <SkillList skills={skillsList} max={40} /> : <p className="text-sm text-muted-foreground">No skills listed yet.</p>}
              </Panel>
            </>
          )}
        </div>

        <aside className="space-y-5" aria-label="Profile strength">
          <ProfileCompleteness items={completeness} />
          <p className="px-1 text-xs text-muted-foreground">Agencies see this profile when you send a proposal and when they search for talent.</p>
        </aside>
      </div>
    </PageContainer>
  )
}
