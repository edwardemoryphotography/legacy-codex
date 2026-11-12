import { describe, expect, it } from 'vitest'
import { lessonExceptionFields } from './lessonLimits'
import { INCIDENT_CANDIDATES } from './incidentCandidates'
import { decodeLessonRelay, encodeLessonRelay, validateLessonRelay } from './lessonRelay'

// Source-backed IC-001 wording, NOT a confirmed lesson, recipient, or transfer.
const incident = INCIDENT_CANDIDATES.find(candidate => candidate.id === 'IC-001')!
const words = { rule: incident.proposedRule, whenToApply: incident.whenToApply, exceptions: incident.exceptions }

describe('relay preserves the real incident’s limits', () => {
  it('carries the exceptions through a share link and JSON serialization without private provenance', () => {
    const code = encodeLessonRelay(words)
    expect(code.startsWith('LC-RELAY-2.')).toBe(true)
    const received = decodeLessonRelay(`https://legacy-codex.vercel.app/?relay=${code}`)
    expect(received).toEqual({ v: 2, ...words })
    expect(JSON.parse(JSON.stringify(received))).toEqual({ v: 2, ...words })
    expect(Object.keys(received!)).toEqual(['v', 'rule', 'whenToApply', 'exceptions'])
  })

  it('restores exceptions independently of incident origin', () => {
    expect(lessonExceptionFields(JSON.parse(JSON.stringify(words)))).toEqual({ exceptions: incident.exceptions })
    expect(lessonExceptionFields({})).toEqual({})
    expect(() => lessonExceptionFields({ exceptions: null })).toThrow()
  })

  it('accepts the full bounded rule only under the exceptions-aware version', () => {
    expect(validateLessonRelay({ v: 2, ...words })).toEqual({ v: 2, ...words })
    expect(validateLessonRelay({ v: 1, ...words })).toBeNull()
    const code = encodeLessonRelay(words)
    expect(decodeLessonRelay(code.replace('LC-RELAY-2.', 'LC-RELAY-1.'))).toBeNull()
    const withoutExceptions = { rule: words.rule, whenToApply: words.whenToApply }
    expect(validateLessonRelay({ v: 2, ...withoutExceptions })).toBeNull()
  })
})
