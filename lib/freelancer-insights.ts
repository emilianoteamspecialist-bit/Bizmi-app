// Shared derivations used across the freelancer ecosystem.
// Keep deterministic — never fabricate numbers from random.

export interface ProfileLike {
  full_name?: string | null
  bio?: string | null
  skills?: string[] | null
  location?: string | null
  hourly_rate?: number | string | null
  experience_level?: string | null
  logo?: string | null
}

export const PROFILE_FIELDS = [
  { key: "full_name", label: "display name" },
  { key: "bio", label: "a professional bio" },
  { key: "skills", label: "your skills" },
  { key: "location", label: "your location" },
  { key: "hourly_rate", label: "an hourly rate" },
  { key: "experience_level", label: "experience level" },
] as const

export type ProfileField = (typeof PROFILE_FIELDS)[number]

export function getProfileCompletion(profile?: ProfileLike | null) {
  const completed = PROFILE_FIELDS.filter((f) => {
    const v = (profile as any)?.[f.key]
    return Array.isArray(v) ? v.length > 0 : !!v
  })
  const percentage = Math.round((completed.length / PROFILE_FIELDS.length) * 100)
  const missing = PROFILE_FIELDS.filter((f) => !completed.find((c) => c.key === f.key))
  return {
    percentage,
    missing,
    completed,
    completedCount: completed.length,
    totalFields: PROFILE_FIELDS.length,
  }
}

export function calcMatch(jobSkills?: string[] | null, userSkills?: string[] | null) {
  if (!jobSkills?.length) return 55
  if (!userSkills?.length) return 30
  const lower = userSkills.map((s) => s.toLowerCase())
  const overlap = jobSkills.filter((s) => lower.includes(s.toLowerCase())).length
  return Math.max(35, Math.min(99, Math.round((overlap / jobSkills.length) * 70 + 30)))
}

export function competitionLevel(count: number) {
  if (count < 5) return { label: "Low competition", tone: "text-success" as const, level: "low" as const }
  if (count < 12) return { label: "Moderate", tone: "text-warning" as const, level: "moderate" as const }
  return { label: "Crowded", tone: "text-muted-foreground" as const, level: "high" as const }
}

export function isFresh(createdAt: string | Date) {
  const date = typeof createdAt === "string" ? new Date(createdAt) : createdAt
  return (Date.now() - date.getTime()) / 86400000 < 2
}

export function getMatchScore(profile?: ProfileLike | null) {
  const { percentage } = getProfileCompletion(profile)
  const skillsBonus = profile?.skills?.length ? Math.min(15, profile.skills.length * 2) : 0
  return Math.min(99, Math.max(35, percentage + skillsBonus))
}

export function aheadOfPercent(profile?: ProfileLike | null) {
  const { percentage } = getProfileCompletion(profile)
  return Math.min(95, Math.max(20, Math.round(percentage * 0.85)))
}

export function greetingFor(date = new Date()) {
  const h = date.getHours()
  if (h < 12) return "Good morning"
  if (h < 17) return "Good afternoon"
  return "Good evening"
}
