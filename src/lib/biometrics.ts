// Pure functions extracted for testability from BiometricsTab
// Readiness formula weights
export const READINESS_RECOVERY_WEIGHT = 0.48
export const READINESS_FOCUS_WEIGHT = 0.32
export const READINESS_SLEEP_WEIGHT = 0.2
export const SLEEP_SCORE_MULTIPLIER = 12

// Thresholds
export const TARGET_SLEEP_HOURS = 7.7
export const RECOVERY_THRESHOLD = 42
export const ADMIN_THRESHOLD = 58
export const FOCUS_DELTA_THRESHOLD = 12
export const MIN_SLEEP_HOURS = 6

import type { BiometricDay, BiometricSummary, BiometricMode } from '@/types'

export function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(v)))
}

export function avg(values: number[]): number {
  if (!values.length) return 0
  return values.reduce((a, b) => a + b, 0) / values.length
}

export function isValidDay(row: unknown): row is BiometricDay {
  if (!row || typeof row !== 'object') return false
  const r = row as Record<string, unknown>
  return (
    typeof r.date === 'string' &&
    isFinite(Number(r.sleepHours)) &&
    isFinite(Number(r.recoveryScore)) &&
    isFinite(Number(r.focusScore))
  )
}

export function parseTrendPayload(raw: string): { source: string; days: BiometricDay[] } | { error: string } {
  let parsed: unknown

  try {
    parsed = JSON.parse(raw)
  } catch {
    return { error: '/notes/biometric-trends.json is not valid JSON.' }
  }

  let source = 'live bridge'
  let candidate: unknown[] = []

  if (Array.isArray(parsed)) {
    candidate = parsed
    source = 'bare array payload'
  } else if (parsed && typeof parsed === 'object') {
    const record = parsed as Record<string, unknown>
    source = typeof record.source === 'string' ? record.source : 'object wrapper'
    candidate = Array.isArray(record.days) ? record.days : []
  } else {
    return { error: '/notes/biometric-trends.json must be an array or a { source, days } object.' }
  }

  const days = candidate.filter(isValidDay).slice(-30)
  if (!days.length) {
    if (candidate.length) {
      return {
        error: '/notes/biometric-trends.json has rows, but none match { date, sleepHours, recoveryScore, focusScore }.',
      }
    }
    return { error: '/notes/biometric-trends.json contains no day records.' }
  }

  return { source, days }
}

export function summarize(days: BiometricDay[], source: string): BiometricSummary {
  const recent = days.slice(-7)
  const recovery = avg(recent.map(d => Number(d.recoveryScore)))
  const focus = avg(recent.map(d => Number(d.focusScore)))
  const sleep = avg(recent.map(d => Number(d.sleepHours)))
  const readiness = clamp(
    recovery * READINESS_RECOVERY_WEIGHT +
      focus * READINESS_FOCUS_WEIGHT +
      Math.min(100, sleep * SLEEP_SCORE_MULTIPLIER) * READINESS_SLEEP_WEIGHT,
    0,
    100,
  )

  const sleepDebt = Math.max(0, TARGET_SLEEP_HOURS - sleep)
  let mode: BiometricMode = 'deep_build'
  let recommendation = 'Good recovery. Focus on deep work.'

  if (recovery < RECOVERY_THRESHOLD || sleep < MIN_SLEEP_HOURS) {
    mode = 'recovery'
    recommendation = 'Low recovery or sleep. Prioritize rest.'
  } else if (readiness < ADMIN_THRESHOLD) {
    mode = 'admin_light'
    recommendation = 'Moderate readiness. Handle admin and light tasks.'
  } else if (focus > recovery + FOCUS_DELTA_THRESHOLD) {
    mode = 'creative_edit'
    recommendation = 'High focus. Good for creative editing.'
  }

  return {
    readiness,
    recovery,
    focus,
    sleepDebt,
    mode,
    recommendation,
    source,
    days,
  }
}
