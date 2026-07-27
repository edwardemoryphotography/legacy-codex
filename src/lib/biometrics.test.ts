import { describe, it, expect } from 'vitest'
import {
  isValidDay,
  parseTrendPayload,
  summarize,
  clamp,
  avg,
} from './biometrics'
import type { BiometricDay } from '@/types'

describe('biometrics utils', () => {
  it('isValidDay accepts valid row', () => {
    const row = { date: '2025-01-01', sleepHours: 7.5, recoveryScore: 74, focusScore: 68 }
    expect(isValidDay(row)).toBe(true)
  })

  it('isValidDay rejects invalid row', () => {
    expect(isValidDay(null)).toBe(false)
    expect(isValidDay({ date: '2025-01-01' })).toBe(false)
    expect(isValidDay({ date: '2025-01-01', sleepHours: 'bad', recoveryScore: 74, focusScore: 68 })).toBe(false)
  })

  it('parseTrendPayload parses bare array', () => {
    const raw = JSON.stringify([
      { date: '2025-01-01', sleepHours: 7.5, recoveryScore: 74, focusScore: 68 },
    ])
    const result = parseTrendPayload(raw)
    expect('days' in result).toBe(true)
    if ('days' in result) {
      expect(result.days.length).toBe(1)
    }
  })

  it('parseTrendPayload returns error for bad JSON', () => {
    const result = parseTrendPayload('not json')
    expect('error' in result).toBe(true)
  })

  it('summarize computes readiness and mode', () => {
    const days: BiometricDay[] = [
      { date: '2025-01-01', sleepHours: 7.5, recoveryScore: 80, focusScore: 70 },
      { date: '2025-01-02', sleepHours: 7.0, recoveryScore: 75, focusScore: 65 },
    ]
    const summary = summarize(days, 'test')
    expect(summary.readiness).toBeGreaterThan(0)
    expect(summary.mode).toBeDefined()
  })

  it('clamp works', () => {
    expect(clamp(50, 0, 100)).toBe(50)
    expect(clamp(150, 0, 100)).toBe(100)
    expect(clamp(-10, 0, 100)).toBe(0)
  })

  it('avg works', () => {
    expect(avg([1, 2, 3])).toBe(2)
    expect(avg([])).toBe(0)
  })
})
