import { lessonExceptionFields } from './lessonLimits'

/**
 * A portable, opt-in relay contains only the lesson's rule and limits.
 * It is not a signed credential, validated evidence, or access to its author's account.
 * The receiving person must decide whether to carry it into their own work.
 */
interface RelayWords {
  rule: string
  whenToApply: string
}

export type LessonRelay = (RelayWords & { v: 1; exceptions?: never })
  | (RelayWords & { v: 2; exceptions: string })

export const LESSON_RELAY_PREFIX = 'LC-RELAY-1.'
const EXCEPTIONS_RELAY_PREFIX = 'LC-RELAY-2.'
// JSON can expand 2,300 UTF-16 code units to six bytes each before base64.
// Leave space for the first-party link around the resulting code.
export const MAX_RELAY_INPUT_LENGTH = 24_576

export function validateLessonRelay(value: unknown): LessonRelay | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const data = value as Record<string, unknown>
  const keys = Object.keys(data).sort().join(',')
  if (!((data.v === 1 && keys === 'rule,v,whenToApply') ||
        (data.v === 2 && keys === 'exceptions,rule,v,whenToApply')) ||
      typeof data.rule !== 'string' || !data.rule.trim() || data.rule.length > 1_000 ||
      typeof data.whenToApply !== 'string' || !data.whenToApply.trim() || data.whenToApply.length > 500) return null
  const words = { rule: data.rule.trim(), whenToApply: data.whenToApply.trim() }
  if (data.v === 1) return { v: 1, ...words }
  try {
    const { exceptions } = lessonExceptionFields(data)
    return exceptions === undefined ? null : { v: 2, ...words, exceptions }
  } catch { return null }
}

export function encodeLessonRelay(input: RelayWords & { exceptions?: string }): string {
  const { exceptions, ...words } = input
  const relay = validateLessonRelay(exceptions === undefined
    ? { v: 1, ...words } : { v: 2, ...words, exceptions })
  if (!relay) throw new Error('A complete confirmed lesson is required before sharing.')
  const bytes = new TextEncoder().encode(JSON.stringify(relay))
  const base64 = btoa(Array.from(bytes, byte => String.fromCharCode(byte)).join(''))
  return (relay.v === 2 ? EXCEPTIONS_RELAY_PREFIX : LESSON_RELAY_PREFIX) + base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function decodeLessonRelay(value: string): LessonRelay | null {
  if (typeof value !== 'string' || value.length > MAX_RELAY_INPUT_LENGTH) return null
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
  const version = code.startsWith(EXCEPTIONS_RELAY_PREFIX) ? 2
    : code.startsWith(LESSON_RELAY_PREFIX) ? 1 : null
  if (!version) return null
  const encoded = code.slice(version === 2 ? EXCEPTIONS_RELAY_PREFIX.length : LESSON_RELAY_PREFIX.length)
  if (!encoded || !/^[A-Za-z0-9_-]+$/.test(encoded)) return null
  try {
    const normalized = encoded.replace(/-/g, '+').replace(/_/g, '/')
    const binary = atob(normalized)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
    const parsed: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
    const relay = validateLessonRelay(parsed)
    return relay?.v === version ? relay : null
  } catch { return null }
}
