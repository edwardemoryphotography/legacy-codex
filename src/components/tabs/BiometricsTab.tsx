'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { SectionTitle, SectionSubtitle, ActionBtn } from '@/components/ui'
import type { BiometricDay, BiometricSummary, BiometricMode } from '@/types'

// REAL DATA ONLY. This governor never invents, fabricates, simulates,
// or interpolates biometric values. If a live bridge has not written
// real records to /notes/biometric-trends.json, the UI renders an
// explicit "data required" state with no numeric values and no chart.

const TREND_URL = '/notes/biometric-trends.json'

// Readiness formula weights
const READINESS_RECOVERY_WEIGHT = 0.48
const READINESS_FOCUS_WEIGHT = 0.32
const READINESS_SLEEP_WEIGHT = 0.2
const SLEEP_SCORE_MULTIPLIER = 12

// Thresholds
const TARGET_SLEEP_HOURS = 7.7
const RECOVERY_THRESHOLD = 42
const ADMIN_THRESHOLD = 58
const FOCUS_DELTA_THRESHOLD = 12
const MIN_SLEEP_HOURS = 6

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(v)))
}

function avg(values: number[]): number {
  if (!values.length) return 0
  return values.reduce((a, b) => a + b, 0) / values.length
}

function isValidDay(row: unknown): row is BiometricDay {
  if (!row || typeof row !== 'object') return false
  const r = row as Record<string, unknown>
  return (
    typeof r.date === 'string' &&
    isFinite(Number(r.sleepHours)) &&
    isFinite(Number(r.recoveryScore)) &&
    isFinite(Number(r.focusScore))
  )
}

function formatTimestamp(date: Date): string {
  return date.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function parseTrendPayload(raw: string): { source: string; days: BiometricDay[] } | { error: string } {
  let parsed: unknown

  try {
    parsed = JSON.parse(raw)
  } catch {
    return { error: `${TREND_URL} is not valid JSON.` }
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
    return { error: `${TREND_URL} must be an array or a { source, days } object.` }
  }

  const days = candidate.filter(isValidDay).slice(-30)
  if (!days.length) {
    if (candidate.length) {
      return {
        error: `${TREND_URL} has rows, but none match { date, sleepHours, recoveryScore, focusScore }.`,
      }
    }
    return { error: `${TREND_URL} contains no day records.` }
  }

  return { source, days }
}

function summarize(days: BiometricDay[], source: string): BiometricSummary {
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
  const sleepDebt = Math.round(Math.max(0, TARGET_SLEEP_HOURS - sleep) * 70) / 10

  let mode: BiometricMode = 'deep_build'
  let recommendation = 'Deep-build lane: architecture, implementation, and launch work are appropriate.'

  if (readiness < RECOVERY_THRESHOLD || sleep < MIN_SLEEP_HOURS) {
    mode = 'recovery'
    recommendation = 'Recovery lane: capture ideas, avoid irreversible architecture, and protect sleep.'
  } else if (readiness < ADMIN_THRESHOLD) {
    mode = 'admin_light'
    recommendation = 'Admin-light lane: triage, docs, small deploy checks, and no scope expansion.'
  } else if (focus > recovery + FOCUS_DELTA_THRESHOLD) {
    mode = 'creative_edit'
    recommendation = 'Creative edit lane: shape assets and workshop material while avoiding heavy refactors.'
  }

  return {
    readiness,
    recovery: clamp(recovery, 0, 100),
    focus: clamp(focus, 0, 100),
    sleepDebt,
    mode,
    recommendation,
    source,
    days,
  }
}

export default function BiometricsTab() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'available' | 'unavailable'>('idle')
  const [summary, setSummary] = useState<BiometricSummary | null>(null)
  const [reason, setReason] = useState('')
  const [lastLoadedAt, setLastLoadedAt] = useState<string | null>(null)
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string | null>(null)
  const chartRef = useRef<SVGSVGElement>(null)

  const load = useCallback(async () => {
    const refreshedAt = formatTimestamp(new Date())
    setStatus('loading')
    setLastRefreshedAt(refreshedAt)

    try {
      const res = await fetch(TREND_URL, { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const raw = await res.text()
      if (!raw.trim()) {
        throw new Error(`${TREND_URL} is empty. Connect a live bridge.`)
      }

      const parsed = parseTrendPayload(raw)
      if ('error' in parsed) throw new Error(parsed.error)

      setSummary(summarize(parsed.days, parsed.source))
      setLastLoadedAt(refreshedAt)
      setReason('')
      setStatus('available')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setSummary(null)
      setReason(msg)
      setStatus('unavailable')
    }
  }, [])

  // Auto-load on mount
  useEffect(() => {
    load()
  }, [load])

  // Render chart when data arrives
  useEffect(() => {
    if (!summary || !chartRef.current) return
    renderChart(chartRef.current, summary.days)
  }, [summary])

  const liveStatusLabel =
    status === 'loading'
      ? 'refreshing live data'
      : status === 'available'
      ? 'live data loaded'
      : status === 'unavailable'
      ? 'data required'
      : 'awaiting bridge'

  const statusTone =
    status === 'available'
      ? 'success'
      : status === 'loading' || status === 'idle'
      ? 'amber'
      : 'error'

  const helperText =
    status === 'idle'
      ? `Biometric data required. Load from ${TREND_URL}.`
      : status === 'loading'
      ? `Refreshing live data from ${TREND_URL}…`
      : status === 'unavailable'
      ? `Biometric data required. ${reason}`
      : summary
      ? `${summary.days.length} real record(s) loaded from ${TREND_URL}.`
      : `Biometric data required. Load from ${TREND_URL}.`

  return (
    <section>
      <SectionTitle>Biometric Governor</SectionTitle>
      <SectionSubtitle>
        WHOOP recovery, Apple Health sleep, and Muse mindful minutes become execution constraints.
      </SectionSubtitle>

      {/* Hero card */}
      <div
        className="grid gap-4 mb-4 p-4 rounded-codex-lg"
        style={{
          border: '1px solid rgba(0, 212, 170, 0.28)',
          background:
            'radial-gradient(circle at top left, rgba(0, 212, 170, 0.16), transparent 34%), linear-gradient(180deg, var(--surface-soft), var(--surface))',
          gridTemplateColumns: 'auto 1fr',
          alignItems: 'end',
        }}
      >
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span
              className="inline-flex items-center rounded-full text-xs font-black tracking-widest uppercase px-2.5 py-1.5"
              style={{
                border: `1px solid var(--${statusTone})`,
                color: `var(--${statusTone})`,
                background: `var(--${statusTone}-soft)`,
              }}
            >
              {liveStatusLabel}
            </span>
            <span
              className="text-xs px-2.5 py-1.5 rounded-full"
              style={{
                border: '1px solid var(--line-strong)',
                background: 'var(--surface-soft)',
                color: 'var(--text-soft)',
              }}
            >
              source: {summary ? summary.source : 'awaiting live bridge'}
            </span>
          </div>
          <div
            className="font-black leading-none"
            style={{ fontSize: 'clamp(2.4rem, 13vw, 4.8rem)', letterSpacing: '-0.06em', fontVariantNumeric: 'tabular-nums' }}
          >
            {summary ? String(summary.readiness) : '—'}
          </div>
          <p className="text-sm mt-2" style={{ color: 'var(--text-soft)', lineHeight: 1.55 }}>
            {helperText}
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Recovery', value: summary ? `${summary.recovery}%` : '—' },
            { label: 'Focus', value: summary ? `${summary.focus}%` : '—' },
            { label: 'Sleep debt', value: summary ? `${summary.sleepDebt}h` : '—' },
            { label: 'Window', value: '30d' },
          ].map(kpi => (
            <div
              key={kpi.label}
              className="p-3 rounded-codex"
              style={{
                border: '1px solid var(--line)',
                background: 'rgba(10, 10, 15, 0.32)',
              }}
            >
              <span className="block text-xs uppercase tracking-widest mb-1.5" style={{ color: 'var(--text-dim)' }}>
                {kpi.label}
              </span>
              <strong className="block text-xl" style={{ fontVariantNumeric: 'tabular-nums' }}>
                {kpi.value}
              </strong>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-4 mb-4">
        {[
          { label: 'Status', value: liveStatusLabel },
          { label: 'Source', value: summary ? summary.source : 'awaiting bridge' },
          { label: 'Last refreshed', value: lastRefreshedAt ?? '—' },
          { label: 'Last loaded', value: lastLoadedAt ?? '—' },
        ].map(item => (
          <div
            key={item.label}
            className="p-3 rounded-codex"
            style={{
              border: '1px solid var(--line)',
              background: 'var(--surface)',
            }}
          >
            <div className="text-[10px] uppercase tracking-[0.24em]" style={{ color: 'var(--text-dim)' }}>
              {item.label}
            </div>
            <div className="mt-1 text-sm font-semibold" style={{ color: 'var(--text)' }}>
              {item.value}
            </div>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div
        className="p-4 rounded-codex-lg mb-4"
        style={{ border: '1px solid var(--line)', background: 'var(--surface)' }}
      >
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="font-bold" style={{ fontSize: '1.05rem' }}>
              Trend overlay
            </h3>
            <p className="text-sm mt-1" style={{ color: 'var(--text-soft)' }}>
              Recovery, focus, and sleep trend lines from live bridge output.
            </p>
          </div>
          <ActionBtn onClick={load} disabled={status === 'loading'}>
            {status === 'loading' ? 'Refreshing…' : 'Refresh live data'}
          </ActionBtn>
        </div>

        <div className="relative min-h-[220px]">
          <svg
            ref={chartRef}
            className="biometric-chart"
            viewBox="0 0 720 220"
            role="img"
            aria-busy={status === 'loading'}
            aria-label="30-day biometric trend chart"
          />

          {!summary && (
            <div
              className="absolute inset-0 flex items-center justify-center rounded-codex-lg border border-dashed"
              style={{
                borderColor: 'var(--line-strong)',
                background: 'rgba(10, 10, 15, 0.42)',
                color: 'var(--text-soft)',
              }}
            >
              <div className="max-w-lg px-4 text-center grid gap-2">
                <strong style={{ color: 'var(--text)' }}>No live biometric records loaded.</strong>
                <p className="text-sm" style={{ lineHeight: 1.6 }}>
                  This tab renders only real records from {TREND_URL} in either supported shape: a bare array of days or an object wrapper with {`{ source, days }`}.
                  There are no samples, mock values, interpolations, or fallback numbers.
                </p>
              </div>
            </div>
          )}
        </div>

        <p className="text-sm mt-3" style={{ color: 'var(--text-soft)' }}>
          {summary
            ? `Live data: ${summary.days.length} day record(s) loaded from ${TREND_URL}.`
            : `No live biometric data loaded. The chart will stay empty until ${TREND_URL} contains real day records.`}
        </p>
      </div>

      {/* Operating rule */}
      <div className="p-4 rounded-codex" style={{ border: '1px solid var(--line)', background: 'var(--surface)' }}>
        <h3 className="font-semibold mb-2" style={{ color: 'var(--amber)', fontSize: '0.95rem' }}>
          Operating rule
        </h3>
        <p className="text-sm mb-3" style={{ color: 'var(--text-soft)', lineHeight: 1.55 }}>
          {summary
            ? `${summary.recommendation} Last loaded ${lastLoadedAt ?? '—'}; refreshes use the live file only.`
            : 'Readiness scores and lane recommendations appear only when real biometric data is available. Until then the governor abstains rather than guess.'}
        </p>
        <p className="text-sm" style={{ color: 'var(--text-soft)', lineHeight: 1.55 }}>
          Live bridge target: write normalized metrics to{' '}
          <code style={{ color: 'var(--amber)', fontSize: '0.85em' }}>notes/biometric-trends.json</code>. This tab reads only that file and refuses fixtures, samples, or fallback values.
        </p>
      </div>
    </section>
  )
}

function renderChart(svg: SVGSVGElement, days: BiometricDay[]) {
  svg.innerHTML = ''
  const NS = 'http://www.w3.org/2000/svg'

  // Grid lines
  ;[0, 1, 2, 3].forEach(i => {
    const line = document.createElementNS(NS, 'line')
    const y = String(28 + i * 48)
    line.setAttribute('x1', '0')
    line.setAttribute('x2', '720')
    line.setAttribute('y1', y)
    line.setAttribute('y2', y)
    line.setAttribute('stroke', 'rgba(255,255,255,0.08)')
    svg.appendChild(line)
  })

  const series: [keyof BiometricDay, string, number][] = [
    ['recoveryScore', 'var(--success)', 100],
    ['focusScore', 'var(--teal)', 100],
    ['sleepHours', 'var(--amber)', 10],
  ]

  series.forEach(([key, color, maxVal]) => {
    const values = days.map(d => Number(d[key]))
    const min = 0
    const max = maxVal
    const step = 720 / Math.max(1, values.length - 1)
    const height = 180
    const top = 18

    const d = values
      .map((v, i) => {
        const x = (step * i).toFixed(2)
        const y = Math.max(top, Math.min(top + height, top + height - ((v - min) / (max - min)) * height)).toFixed(2)
        return `${i === 0 ? 'M' : 'L'} ${x} ${y}`
      })
      .join(' ')

    const path = document.createElementNS(NS, 'path')
    path.setAttribute('d', d)
    path.setAttribute('stroke', color)
    svg.appendChild(path)
  })
}
