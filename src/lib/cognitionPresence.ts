/**
 * What the cognition field is allowed to react to.
 *
 * Presence is classified from a real DOM event or from a save/read that
 * the caller has already decided to perform. It never invents work, and it
 * never reports progress — only that something the user did, or a write
 * that is actually in flight, is happening.
 */

export type FieldActivity = 'typing' | 'navigating' | 'mission'

export const FIELD_WORK_EVENT = 'codex-field-work'

export type FieldWorkPhase = 'start' | 'end'

const TEXT_ENTRY_TYPES = new Set([
  '',
  'text',
  'search',
  'email',
  'url',
  'tel',
  'password',
  'number',
])

let lastNavigationAt = 0

function isTextEntry(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  if (target instanceof HTMLTextAreaElement) return true
  if (target instanceof HTMLInputElement) return TEXT_ENTRY_TYPES.has(target.type)
  return false
}

/** Classify one user event. Anything that is not a real text entry, a
 *  mission select, or a tab/sheet navigation is ignored. */
export function presenceForDomEvent(event: Event): FieldActivity | null {
  if (event.type === 'input' && isTextEntry(event.target)) return 'typing'
  if (event.type === 'change' && event.target instanceof HTMLSelectElement) return 'mission'
  if (event.type === 'click' && event.target instanceof Element) {
    if (event.target.closest('[role="tab"], [data-more-item]')) return 'navigating'
  }
  return null
}

export function markNavigation(now = Date.now()): void {
  lastNavigationAt = now
}

/** Milliseconds since the last real tab/sheet navigation, or null when
 *  this document has not navigated yet. The field reads this on mount
 *  because leaving Mission unmounts the orb before the click's presence
 *  can be seen. */
export function navigationAge(now = Date.now()): number | null {
  if (lastNavigationAt === 0) return null
  return now - lastNavigationAt
}

export function clearNavigationMark(): void {
  lastNavigationAt = 0
}

export function beginFieldWork(): void {
  if (typeof document === 'undefined') return
  document.dispatchEvent(new CustomEvent(FIELD_WORK_EVENT, { detail: { phase: 'start' satisfies FieldWorkPhase } }))
}

export function endFieldWork(): void {
  if (typeof document === 'undefined') return
  document.dispatchEvent(new CustomEvent(FIELD_WORK_EVENT, { detail: { phase: 'end' satisfies FieldWorkPhase } }))
}
