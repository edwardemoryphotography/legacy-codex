import type { CaptureItem } from '@/types'

const LEGACY_KEY = 'nd_inbox_v1'
const LEGACY_OWNER_KEY = 'nd_inbox_v1:owner'
export const captureInboxKey = (userId: string | null) => `nd_inbox_v2:${userId ?? 'local'}`

export function readCaptureInbox(userId: string | null): CaptureItem[] {
  try {
    const items: unknown = JSON.parse(localStorage.getItem(captureInboxKey(userId)) ?? '[]')
    return Array.isArray(items) ? items.filter((item): item is CaptureItem => !!item && typeof item.id === 'string' && typeof item.text === 'string') : []
  } catch { return [] }
}

export function writeCaptureInbox(userId: string | null, items: CaptureItem[]): void {
  localStorage.setItem(captureInboxKey(userId), JSON.stringify(items))
}

// Run before an auth transition, while the source identity is still known.
// With no session, quarantine the legacy cache instead of assigning it to the
// next account. Copy before removing the old key; a storage failure blocks auth.
export function preserveLegacyCaptureInbox(userId: string | null): void {
  if (typeof window === 'undefined') return
  try {
    // Keep the first source binding even if an older open tab writes the
    // legacy key again after this browser has switched accounts.
    const sourceId = localStorage.getItem(LEGACY_OWNER_KEY) ?? userId ?? 'unclaimed'
    localStorage.setItem(LEGACY_OWNER_KEY, sourceId)
    const legacy = localStorage.getItem(LEGACY_KEY)
    if (legacy === null) return
    const targetKey = captureInboxKey(sourceId)
    // Preserve the raw legacy record too, including malformed data, for recovery.
    localStorage.setItem(`${targetKey}:legacy`, legacy)
    if (sourceId !== 'unclaimed') {
      const existing = readCaptureInbox(sourceId)
      const old: unknown = JSON.parse(legacy)
      if (!Array.isArray(old)) throw new Error('Invalid legacy inbox')
      const merged = [...existing, ...old.filter(item => item && typeof item.id === 'string' && typeof item.text === 'string'
        && !existing.some(current => current.id === item.id))]
      writeCaptureInbox(sourceId, merged)
    }
    localStorage.removeItem(LEGACY_KEY)
  } catch {
    throw new Error('Could not preserve this browser’s captures. Keep its saved data and retry before switching accounts.')
  }
}
