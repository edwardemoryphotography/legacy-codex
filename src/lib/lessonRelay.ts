/**
 * A portable, opt-in relay contains only the lesson's rule and limits.
 * It is not a signed credential, validated evidence, or access to its author's account.
 * The receiving person must decide whether to carry it into their own work.
 */
export interface LessonRelay {
  v: 1
  rule: string
  whenToApply: string
}

export const LESSON_RELAY_PREFIX = 'LC-RELAY-1.'

export function validateLessonRelay(value: unknown): LessonRelay | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const data = value as Record<string, unknown>
  if (Object.keys(data).sort().join(',') !== 'rule,v,whenToApply' || data.v !== 1 ||
      typeof data.rule !== 'string' || !data.rule.trim() || data.rule.length > 1_000 ||
      typeof data.whenToApply !== 'string' || !data.whenToApply.trim() || data.whenToApply.length > 500) return null
  return { v: 1, rule: data.rule.trim(), whenToApply: data.whenToApply.trim() }
}

export function encodeLessonRelay(input: Pick<LessonRelay, 'rule' | 'whenToApply'>): string {
  const relay = validateLessonRelay({ v: 1, ...input })
  if (!relay) throw new Error('A complete confirmed lesson is required before sharing.')
  const bytes = new TextEncoder().encode(JSON.stringify(relay))
  const base64 = btoa(Array.from(bytes, byte => String.fromCharCode(byte)).join(''))
  return LESSON_RELAY_PREFIX + base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function decodeLessonRelay(value: string): LessonRelay | null {
  if (typeof value !== 'string' || value.length > 4_096) return null
  let code = value.trim()
  // Accept a code pasted directly or the first-party share link containing it.
  if (code.startsWith('https://')) {
    try {
      const url = new URL(code)
      if (!['legacy-codex.vercel.app', 'localhost'].includes(url.hostname) &&
          !url.hostname.endsWith('.vercel.app')) return null
      code = url.searchParams.get('relay') ?? ''
    } catch { return null }
  }
  if (!code.startsWith(LESSON_RELAY_PREFIX)) return null
  const encoded = code.slice(LESSON_RELAY_PREFIX.length)
  if (!encoded || !/^[A-Za-z0-9_-]+$/.test(encoded)) return null
  try {
    const normalized = encoded.replace(/-/g, '+').replace(/_/g, '/')
    const bytes = Uint8Array.from(atob(normalized), char => char.charCodeAt(0))
    const parsed: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
    return validateLessonRelay(parsed)
  } catch { return null }
}
