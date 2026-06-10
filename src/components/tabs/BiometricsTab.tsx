'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { SectionTitle, SectionSubtitle, ActionBtn } from '@/components/ui'
import type { BiometricDay, BiometricSummary, BiometricMode } from '@/types'

// REAL DATA ONLY. This governor never invents, fabricates, simulates,
// or interpolates biometric values. If a live bridge has not written
// real records to /notes/biometric-trends.json, the UI renders an
// explicit "data required" state with no numeric values and no chart.

const TREND_URL = '/notes/biometric-trends.json'

// Readiness formula weights
const READINESS_RECOVERY_WEIGHT = 0.48
const READINESS_FOCUS_WEIGHT    = 0.32
const READINESS_SLEEP_WEIGHT    = 0.20
const SLEEP_SCORE_MULTIPLIER    = 12

// Thresholds
const TARGET_SLEEP_HOURS     = 7.7
const RECOVERY_THRESHOLD     = 42
const ADMIN_THRESHOLD        = 58
const FOCUS_DELTA_THRESHOLD  = 12
const MIN_SLEEP_HOURS        = 6

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

function summarize(days: BiometricDay[], source: string): BiometricSummary {
  const recent = days.slice(-7)
  const recovery = avg(recent.map(d => Number(d.recoveryScore)))
  const focus    = avg(recent.map(d => Number(d.focusScore)))
  const sleep    = avg(recent.map(d => Number(d.sleepHours)))
  const readiness = clamp(
    recovery * READINESS_RECOVERY_WEIGHT +
    focus    * READINESS_FOCUS_WEIGHT +
    Math.min(100, sleep * SLEEP_SCORE_MULTIPLIER) * READINESS_SLEEP_WEIGHT,
    0, 100,
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

  return { readiness, recovery: clamp(recovery, 0, 100), focus: clamp(focus, 0, 100), sleepDebt, mode, recommendation, source, days }
}

type LoadState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'unavailable'; reason: string }
  | { status: 'available'; summary: BiometricSummary }

export default function BiometricsTab() {
  const [state, setState] = useState<LoadState>({ status: 'idle' })
  const chartRef = useRef<SVGSVGElement>(null)

  const load = useCallback(async () => {
    setState({ status: 'loading' })
    try {
      const res = await fetch(TREND_URL, { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const raw = await res.text()
      if (!raw.trim()) {
        setState({ status: 'unavailable', reason: `${TREND_URL} is empty. Connect a live bridge.` })
        return
      }
      const parsed = JSON.parse(raw)
      const candidate = Array.isArray(parsed) ? parsed : (parsed && typeof parsed === 'object' && Array.isArray((parsed as Record<string, unknown>).days) ? (parsed as Record<string, unknown>).days as unknown[] : [])
      const days: BiometricDay[] = candidate.filter(isValidDay).slice(-30)
      if (!days.length) {
        setState({ status: 'unavailable', reason: `${TREND_URL} contains no valid day records.` })
        return
      }
      const source = typeof parsed?.source === 'string' ? parsed.source : 'live bridge'
      setState({ status: 'available', summary: summarize(days, source) })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setState({ status: 'unavailable', reason: `Could not load ${TREND_URL} (${msg}). Connect a live bridge.` })
    }
  }, [])

  // Auto-load on mount
  useEffect(() => {
    load()
  }, [load])

  // Render chart when data arrives
  useEffect(() => {
    if (state.status !== 'available' || !chartRef.current) return
    renderChart(chartRef.current, state.summary.days)
  }, [state])

  const unavailableReason =
    state.status === 'idle'
      ? `Biometric data required. Load from ${TREND_URL}.`
      : state.status === 'loading'
      ? `Loading from ${TREND_URL}…`
      : state.status === 'unavailable'
      ? `Biometric data required. ${state.reason}`
      : null

  const summary = state.status === 'available' ? state.summary : null

  return (
    <section>
      <SectionTitle>Biometric Governor</SectionTitle>
      <SectionSubtitle>
        WHOOP recovery, Apple Health sleep, and Muse mindful minutes become execution constraints.
      </SectionSubtitle>

      {/* Hero card */}
      <div
        className="grid gap-4 mb-6 p-4 rounded-codex-lg"
        style={{
          border: '1px solid rgba(0, 212, 170, 0.28)',
          background: 'radial-gradient(circle at top left, rgba(0, 212, 170, 0.16), transparent 34%), linear-gradient(180deg, var(--surface-soft), var(--surface))',
          gridTemplateColumns: 'auto 1fr',
          alignItems: 'end',
        }}
      >
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span
              className="inline-flex items-center rounded-full text-xs font-black tracking-widest uppercase px-2.5 py-1.5"
              style={{
                border: '1px solid var(--teal)',
                color: 'var(--teal)',
                background: 'var(--teal-soft)',
              }}
            >
              {summary ? summary.mode.replace('_', ' ') : '—'}
            </span>
            <span className="text-xs px-2.5 py-1.5 rounded-full" style={{ border: '1px solid var(--line-strong)', background: 'var(--surface-soft)', color: 'var(--text-soft)' }}>
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
            {unavailableReason ?? summary?.recommendation}
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Recovery',   value: summary ? `${summary.recovery}%` : '—' },
            { label: 'Focus',      value: summary ? `${summary.focus}%` : '—' },
            { label: 'Sleep debt', value: summary ? `${summary.sleepDebt}h` : '—' },
            { label: 'Window',     value: '30d' },
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

      {/* Chart */}
      <div
        className="p-4 rounded-codex-lg mb-4"
        style={{ border: '1px solid var(--line)', background: 'var(--surface)' }}
      >
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="font-bold" style={{ fontSize: '1.05rem' }}>Trend overlay</h3>
            <p className="text-sm mt-1" style={{ color: 'var(--text-soft)' }}>
              Recovery, focus, and sleep trend lines from live bridge output.
            </p>
          </div>
          <ActionBtn onClick={load} disabled={state.status === 'loading'}>
            {state.status === 'loading' ? 'Loading…' : 'Reload live data'}
          </ActionBtn>
        </div>
        <svg
          ref={chartRef}
          className="biometric-chart"
          viewBox="0 0 720 220"
          role="img"
          aria-label="30-day biometric trend chart"
        />
        <p className="text-sm mt-3" style={{ color: 'var(--text-soft)' }}>
          {summary
            ? `Live data: ${summary.days.length} day record(s) loaded from ${TREND_URL}.`
            : `No live biometric data loaded. The chart will render only when ${TREND_URL} contains real day records.`}
        </p>
      </div>

      {/* Operating rule */}
      <div className="p-4 rounded-codex" style={{ border: '1px solid var(--line)', background: 'var(--surface)' }}>
        <h3 className="font-semibold mb-2" style={{ color: 'var(--amber)', fontSize: '0.95rem' }}>
          Operating rule
        </h3>
        <p className="text-sm mb-3" style={{ color: 'var(--text-soft)', lineHeight: 1.55 }}>
          {summary
            ? `${summary.recommendation} This should inform task ranking before prompts are sent to build agents.`
            : 'Readiness scores and lane recommendations will appear here only when real biometric data is available. Until then the governor abstains rather than guess.'}
        </p>
        <p className="text-sm" style={{ color: 'var(--text-soft)', lineHeight: 1.55 }}>
          Live bridge target: write normalized metrics to{' '}
          <code style={{ color: 'var(--amber)', fontSize: '0.85em' }}>notes/biometric-trends.json</code> or current state to{' '}
          <code style={{ color: 'var(--amber)', fontSize: '0.85em' }}>notes/biometric-state.json</code>. Do not commit raw EEG, raw health exports, or tokens. This dashboard has no mock, fixture, sample, or fallback values.
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
    ['focusScore',    'var(--teal)',    100],
    ['sleepHours',    'var(--amber)',   10],
  ]

  series.forEach(([key, color, maxVal]) => {
    const values = days.map(d => Number(d[key]))
    const min = 0
    const max = maxVal
    const step = 720 / Math.max(1, values.length - 1)
    const width = 720
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
