const KEY_PREFIX = "bizimee_avatar_"

export function getCachedAvatar(userId: string): string {
  if (typeof window === "undefined" || !userId) return ""
  try {
    return sessionStorage.getItem(KEY_PREFIX + userId) || ""
  } catch {
    return ""
  }
}

export function setCachedAvatar(userId: string, data: string): void {
  if (typeof window === "undefined" || !userId) return
  try {
    if (data) {
      sessionStorage.setItem(KEY_PREFIX + userId, data)
    } else {
      sessionStorage.removeItem(KEY_PREFIX + userId)
    }
  } catch {
    // sessionStorage quota exceeded or disabled — degrade silently
  }
}

export function clearAvatarCache(): void {
  if (typeof window === "undefined") return
  try {
    const keys: string[] = []
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i)
      if (k?.startsWith(KEY_PREFIX)) keys.push(k)
    }
    keys.forEach((k) => sessionStorage.removeItem(k))
  } catch {
    // ignore
  }
}
