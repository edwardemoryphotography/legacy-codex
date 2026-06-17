'use client'

import { useEffect, useState } from 'react'
import { useLocalStorage } from '@/hooks/useLocalStorage'
import type { UIPrefs, CaptureItem, BiometricMode } from '@/types'
import {
  ActionBtn,
  ActionChip,
  Badge,
  Card,
  Input,
  SectionSubtitle,
  SectionTitle,
} from '@/components/ui'

const PREFS_KEY = 'nd_ux_prefs_v1'
const INBOX_KEY = 'nd_inbox_v1'
const MODE_KEY = 'nd_manual_mode_v1'

const DEFAULT_PREFS: UIPrefs = {
  density: 'comfortable',
  fontScale: 1.0,
  highContrast: false,
  reducedMotion: false,
}

const DEFAULT_INBOX: CaptureItem[] = []

const MODES: BiometricMode[] = ['deep_build', 'creative_edit', 'admin_light', 'recovery']

const MODE_LABELS: Record<BiometricMode, string> = {
  deep_build: 'Deep Build',
  creative_edit: 'Creative Edit',
  admin_light: 'Admin Light',
  recovery: 'Recovery',
}

const MODE_RECS: Record<BiometricMode, string> = {
  deep_build: 'Prioritize Codex automation + sprint tools. Protect focus blocks.',
  creative_edit: 'Surface artistic + neuro sections. Good for client framing work.',
  admin_light: 'Light tasks only. Use Protocols + Constraint Validator.',
  recovery: 'Minimal input. Review Overview metrics. Rest before capture.',
}

export default function ControlsTab() {
  const [prefs, setPrefs] = useLocalStorage<UIPrefs>(PREFS_KEY, DEFAULT_PREFS)
  const [inbox, setInbox] = useLocalStorage<CaptureItem[]>(INBOX_KEY, DEFAULT_INBOX)
  const [manualMode, setManualMode] = useLocalStorage<BiometricMode>(MODE_KEY, 'deep_build')
  const [captureText, setCaptureText] = useState('')
  const [bioSummary, setBioSummary] = useState<{ readiness: number; mode: BiometricMode; source: string } | null>(null)
  const [status, setStatus] = useState('')

  // Apply global CSS vars + data attrs for future tab integration (demo effect)
  useEffect(() => {
    const root = document.documentElement
    root.style.setProperty('--nd-font-scale', String(prefs.fontScale))
    root.setAttribute('data-density', prefs.density)
    root.setAttribute('data-high-contrast', prefs.highContrast ? 'true' : 'false')
    root.setAttribute('data-reduced-motion', prefs.reducedMotion ? 'true' : 'false')
    if (prefs.reducedMotion) {
      root.style.setProperty('--nd-motion', 'none')
    } else {
      root.style.removeProperty('--nd-motion')
    }
  }, [prefs])

  // Load lightweight bio summary (mirrors BiometricsTab contract, real data only)
  useEffect(() => {
    let cancelled = false
    fetch('/notes/biometric-trends.json')
      .then(r => r.ok ? r.json() : Promise.reject('no data'))
      .then((raw: any) => {
        if (cancelled) return
        const days = Array.isArray(raw) ? raw : (raw?.days || [])
        if (!days.length) {
          setBioSummary(null)
          return
        }
        const last = days[days.length - 1]
        const readiness = Math.round(
          (Number(last.recoveryScore) || 0) * 0.48 +
          (Number(last.focusScore) || 0) * 0.32 +
          Math.min(100, (Number(last.sleepHours) || 0) * 12) * 0.2
        )
        // Simple mode inference (same thresholds as BiometricsTab)
        let mode: BiometricMode = 'deep_build'
        if (readiness < 42 || (Number(last.sleepHours) || 0) < 6) mode = 'recovery'
        else if (readiness < 58) mode = 'admin_light'
        else if ((Number(last.focusScore) || 0) > (Number(last.recoveryScore) || 0) + 12) mode = 'creative_edit'
        setBioSummary({ readiness: Math.min(100, Math.max(0, readiness)), mode, source: raw?.source || 'local' })
      })
      .catch(() => {
        if (!cancelled) setBioSummary(null)
      })
    return () => { cancelled = true }
  }, [])

  const effectiveMode = bioSummary ? bioSummary.mode : manualMode
  const rec = MODE_RECS[effectiveMode]

  const densityPadding = prefs.density === 'compact' ? '12px' : '18px'
  const scaleStyle = { fontSize: `${prefs.fontScale}rem` } as const
  const contrastBorder = prefs.highContrast ? 'var(--teal)' : 'var(--line)'

  function applyPreset(preset: 'deep' | 'scan' | 'creative') {
    let next: UIPrefs
    if (preset === 'deep') {
      next = { density: 'compact', fontScale: 1.0, highContrast: false, reducedMotion: true }
    } else if (preset === 'scan') {
      next = { density: 'comfortable', fontScale: 1.05, highContrast: false, reducedMotion: false }
    } else {
      next = { density: 'comfortable', fontScale: 1.12, highContrast: true, reducedMotion: false }
    }
    setPrefs(next)
    setStatus(`Preset "${preset}" applied`)
    setTimeout(() => setStatus(''), 1400)
  }

  function updatePref<K extends keyof UIPrefs>(key: K, value: UIPrefs[K]) {
    setPrefs(prev => ({ ...prev, [key]: value }))
  }

  function handleCapture() {
    const text = captureText.trim()
    if (!text) return
    const item: CaptureItem = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2),
      text,
      timestamp: new Date().toISOString(),
      suggested: text.toLowerCase().includes('client') || text.toLowerCase().includes('shoot') ? 'artistic' :
                 text.toLowerCase().includes('code') || text.toLowerCase().includes('sprint') ? 'automation' : 'personalos',
    }
    setInbox(prev => [item, ...prev].slice(0, 12))
    setCaptureText('')
    setStatus('Captured to inbox')
    setTimeout(() => setStatus(''), 1200)
  }

  function copyItem(item: CaptureItem) {
    navigator.clipboard?.writeText(item.text).then(() => {
      setStatus('Copied')
      setTimeout(() => setStatus(''), 900)
    })
  }

  function removeItem(id: string) {
    setInbox(prev => prev.filter(i => i.id !== id))
  }

  function logToResumptionStub(item: CaptureItem) {
    // Stub: in real would mutate ResumptionLog LS, here just note + copy
    const stub = `Resumption note from Controls: ${item.text}`
    navigator.clipboard?.writeText(stub)
    setStatus('Stub copied for Resumption Log (paste there)')
    setTimeout(() => setStatus(''), 1600)
  }

  function exportInbox() {
    const data = JSON.stringify(inbox, null, 2)
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `legacy-codex-inbox-${new Date().toISOString().slice(0,10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    setStatus('Inbox exported')
    setTimeout(() => setStatus(''), 1200)
  }

  function clearInbox() {
    setInbox([])
    setStatus('Inbox cleared')
    setTimeout(() => setStatus(''), 900)
  }

  return (
    <section className="space-y-6" style={scaleStyle}>
      <div className="space-y-2">
        <SectionTitle>Governor Controls</SectionTitle>
        <SectionSubtitle>
          Sensory prefs, energy mode surface, and quick capture. Local only. Shapes the rest of the dashboard.
        </SectionSubtitle>
      </div>

      {/* Status / live feedback */}
      {status && (
        <div style={{ color: 'var(--success)', fontSize: '0.8rem' }}>{status}</div>
      )}

      {/* Presets - dopamine light, forgiving */}
      <Card>
        <div className="flex flex-wrap gap-2 mb-3">
          <Badge tone="teal">Presets</Badge>
          <ActionChip onClick={() => applyPreset('deep')}>Deep Focus</ActionChip>
          <ActionChip onClick={() => applyPreset('scan')}>Scan / Admin</ActionChip>
          <ActionChip onClick={() => applyPreset('creative')}>Creative Flow</ActionChip>
        </div>
        <p style={{ color: 'var(--text-soft)', fontSize: '0.85rem' }}>
          One-click calm states. Deep = compact + reduced motion for coding or heavy edits. Creative = slightly larger + high contrast for visual work.
        </p>
      </Card>

      {/* Sensory Prefs - customizable core */}
      <Card>
        <SectionTitle>Sensory & Density</SectionTitle>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-dim)', display: 'block', marginBottom: 4 }}>Density</label>
            <select
              value={prefs.density}
              onChange={e => updatePref('density', e.target.value as any)}
              style={{ width: '100%', padding: '8px', borderRadius: 8, background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--line)' }}
            >
              <option value="comfortable">Comfortable (more space)</option>
              <option value="compact">Compact (focus mode)</option>
            </select>
          </div>

          <div>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-dim)', display: 'block', marginBottom: 4 }}>
              Font scale: {prefs.fontScale.toFixed(2)}
            </label>
            <input
              type="range"
              min={0.85}
              max={1.3}
              step={0.05}
              value={prefs.fontScale}
              onChange={e => updatePref('fontScale', parseFloat(e.target.value))}
              style={{ width: '100%' }}
            />
          </div>

          <div className="flex items-center gap-3">
            <label style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>High contrast</label>
            <input
              type="checkbox"
              checked={prefs.highContrast}
              onChange={e => updatePref('highContrast', e.target.checked)}
            />
          </div>

          <div className="flex items-center gap-3">
            <label style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Reduced motion</label>
            <input
              type="checkbox"
              checked={prefs.reducedMotion}
              onChange={e => updatePref('reducedMotion', e.target.checked)}
            />
          </div>
        </div>

        {/* Live preview card that reacts to prefs */}
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginBottom: 6 }}>Live preview (density + scale + contrast)</div>
          <Card style={{ padding: densityPadding, borderColor: contrastBorder }}>
            <div style={{ fontSize: `${0.95 * prefs.fontScale}rem`, lineHeight: 1.45 }}>
              Example content block. This scales and spaces with your prefs. Use for deep work or quick scans without overwhelm.
            </div>
            <div style={{ marginTop: 8, fontSize: '0.7rem', color: 'var(--text-soft)' }}>
              Current: {prefs.density} • scale {prefs.fontScale} • {prefs.highContrast ? 'high contrast' : 'standard'} • {prefs.reducedMotion ? 'reduced motion' : 'motion ok'}
            </div>
          </Card>
        </div>
      </Card>

      {/* Energy / Mode Governor surface */}
      <Card>
        <SectionTitle>Energy Governor (Biometrics + Manual)</SectionTitle>
        <div className="flex flex-wrap gap-2 mb-3">
          {bioSummary ? (
            <>
              <Badge tone="success">Live data</Badge>
              <Badge tone="teal">Readiness: {bioSummary.readiness}</Badge>
              <Badge tone="muted">Source: {bioSummary.source}</Badge>
            </>
          ) : (
            <Badge tone="amber">No live data — using manual</Badge>
          )}
        </div>

        <div className="mb-3">
          <label style={{ fontSize: '0.75rem', color: 'var(--text-dim)', display: 'block', marginBottom: 4 }}>Effective mode</label>
          <select
            value={effectiveMode}
            onChange={e => {
              const m = e.target.value as BiometricMode
              setManualMode(m)
              // If bio present, manual still overrides display here
            }}
            style={{ width: '100%', padding: '8px', borderRadius: 8, background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--line)' }}
          >
            {MODES.map(m => (
              <option key={m} value={m}>{MODE_LABELS[m]}</option>
            ))}
          </select>
        </div>

        <div style={{ padding: '10px 12px', border: '1px solid var(--line)', borderRadius: 10, background: 'var(--surface-soft)' }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>{MODE_LABELS[effectiveMode]}</div>
          <div style={{ color: 'var(--text-soft)', fontSize: '0.9rem', lineHeight: 1.4 }}>{rec}</div>
        </div>

        <p style={{ marginTop: 10, fontSize: '0.8rem', color: 'var(--text-dim)' }}>
          Mode influences future tab highlights and recommendations. Biometrics data (if present) auto-detects; manual override always available.
        </p>
      </Card>

      {/* Quick Capture + Inbox */}
      <Card>
        <SectionTitle>Quick Capture (Externalize Now)</SectionTitle>
        <SectionSubtitle>Zero-friction inbox. Capture client notes, code ideas, shoot framing, blockers. Process later.</SectionSubtitle>

        <div className="flex gap-2 mb-3">
          <Input
            placeholder="Type thought, task, or note... (e.g. Client lighting reference for portrait)"
            value={captureText}
            onChange={setCaptureText}
          />
          <ActionBtn onClick={handleCapture} disabled={!captureText.trim()}>Capture</ActionBtn>
        </div>

        <div className="flex gap-2 mb-3">
          <ActionChip onClick={exportInbox} disabled={inbox.length === 0}>Export JSON</ActionChip>
          <ActionChip variant="danger" onClick={clearInbox} disabled={inbox.length === 0}>Clear all</ActionChip>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', alignSelf: 'center' }}>{inbox.length} captured</span>
        </div>

        {inbox.length === 0 ? (
          <div style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>Inbox empty. Captures persist locally and survive reloads.</div>
        ) : (
          <div className="space-y-2 max-h-[260px] overflow-auto pr-1">
            {inbox.map(item => (
              <div key={item.id} style={{ border: '1px solid var(--line)', borderRadius: 8, padding: '8px 10px', background: 'var(--surface-soft)' }}>
                <div style={{ fontSize: '0.85rem', marginBottom: 4 }}>{item.text}</div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)', marginBottom: 6 }}>
                  {new Date(item.timestamp).toLocaleString()} • suggested: {item.suggested || 'general'}
                </div>
                <div className="flex gap-1 flex-wrap">
                  <ActionChip onClick={() => copyItem(item)}>Copy</ActionChip>
                  <ActionChip onClick={() => logToResumptionStub(item)}>Log to Resumption (stub)</ActionChip>
                  <ActionChip variant="ghost" onClick={() => removeItem(item.id)}>Remove</ActionChip>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>
        Prefs and inbox live in localStorage on this device only. Apply presets before long sessions. This tab is the seed for adaptive UI across the dashboard.
      </div>
    </section>
  )
}
