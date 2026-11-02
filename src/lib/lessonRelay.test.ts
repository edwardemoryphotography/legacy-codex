import { describe, expect, it } from 'vitest'
import { decodeLessonRelay, encodeLessonRelay, LESSON_RELAY_PREFIX, validateLessonRelay } from './lessonRelay'

// These are Eddie's actual words from the June 10, 2021 note and his
// mentoring account, not synthetic user activity or fabricated product data.
const note = {
  rule: 'These cannot be rushed. This only comes from experience.',
  whenToApply: 'Please learn from my mistakes.',
}

describe('explicit lesson relay boundary', () => {
  it('round-trips UTF-8 source words without private project fields', () => {
    const code = encodeLessonRelay(note)
    expect(code.startsWith(LESSON_RELAY_PREFIX)).toBe(true)
    expect(decodeLessonRelay(code)).toEqual({ v: 1, ...note })
    expect(code).not.toContain('missionId')
    expect(code).not.toContain('accountId')
    expect(code).not.toContain('sourceRefs')
  })

  it('round-trips maximum-length multibyte and JSON-escaped lessons as codes and links', () => {
    for (const value of ['界', '\u0001']) {
      const lesson = { rule: value.repeat(1_000), whenToApply: value.repeat(500) }
      const code = encodeLessonRelay(lesson)
      expect(decodeLessonRelay(code)).toEqual({ v: 1, ...lesson })
      expect(decodeLessonRelay(`https://legacy-codex.vercel.app/?relay=${code}`)).toEqual({ v: 1, ...lesson })
      expect(JSON.stringify({ action: 'receive', code: `https://legacy-codex.vercel.app/?relay=${code}`, missionId: '00000000-0000-4000-8000-000000000000', scope: 'mission' }).length).toBeLessThan(17_408)
    }
  })

  it('rejects claims and fields outside the shared two-part lesson', () => {
    expect(validateLessonRelay({ v: 1, ...note, userId: 'private' })).toBeNull()
    expect(validateLessonRelay({ v: 1, ...note, sourceRefs: [] })).toBeNull()
    expect(validateLessonRelay({ v: 1, rule: '', whenToApply: note.whenToApply })).toBeNull()
    expect(decodeLessonRelay('LC-RELAY-1.invalid!')).toBeNull()
    expect(decodeLessonRelay('')).toBeNull()
  })

  it('accepts a first-party URL without accepting a foreign relay URL', () => {
    const code = encodeLessonRelay(note)
    const url = `https://legacy-codex.vercel.app/?relay=${code}`
    expect(decodeLessonRelay(url)).toEqual({ v: 1, ...note })
    expect(decodeLessonRelay(`https://example.com/?relay=${code}`)).toBeNull()
  })
})
