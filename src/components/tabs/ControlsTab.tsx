'use client'

import { useCallback, useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { useLocalStorage } from '@/hooks/useLocalStorage'
import { useCapture } from '@/hooks/useCapture'
import type { UIPrefs, CaptureItem, BiometricMode } from '@/types'
import { supabase } from '@/lib/supabase/client'
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
const MODE_KEY = 'nd_manual_mode_v1'

const DEFAULT_PREFS: UIPrefs = {
  density: 'comfortable',
  fontScale: 1.0,
  highContrast: false,
  reducedMotion: false,
}

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
  const [manualMode, setManualMode] = useLocalStorage<BiometricMode>(MODE_KEY, 'deep_build')
  const [captureText, setCaptureText] = useState('')
  const [bioSummary, setBioSummary] = useState<{ readiness: number; mode: BiometricMode; source: string } | null>(null)
  const [status, setStatus] = useState('')

  // Supabase hybrid sync state (augments localStorage when keys + migration + auth are present)
  const [supabaseConnected, setSupabaseConnected] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const [authStatus, setAuthStatus] = useState('')

  // Shared capture pipeline (also used by MissionTab's write-only capture)
  const {
    inbox,
    syncedCaptureIds,
    loadCaptures,
    capture: captureIdea,
    removeItem: removeCaptureItem,
    forceSyncItem: forceSyncCaptureItem,
    forceSyncItems: forceSyncCaptureItems,
    exportInbox: exportCaptureInbox,
    clearInbox: clearCaptureInbox,
  } = useCapture(user)

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
    type RawBioDay = { sleepHours?: number; recoveryScore?: number; focusScore?: number }
    fetch('/notes/biometric-trends.json')
      .then(r => r.ok ? r.json() : Promise.reject('no data'))
      .then((raw: unknown) => {
        if (cancelled) return
        const wrapper = raw as { source?: string; days?: RawBioDay[] } | null
        const days: RawBioDay[] = Array.isArray(raw) ? (raw as RawBioDay[]) : (wrapper?.days || [])
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
        setBioSummary({ readiness: Math.min(100, Math.max(0, readiness)), mode, source: wrapper?.source || 'local' })
      })
      .catch(() => {
        if (!cancelled) setBioSummary(null)
      })
    return () => { cancelled = true }
  }, [])

  const loadFromSupabase = useCallback(async (userId: string) => {
    if (!userId) return
    try {
      // Load prefs
      const { data: prefsData } = await supabase
        .from('nd_prefs')
        .select('data')
        .eq('user_id', userId)
        .single()
      if (prefsData?.data) {
        setPrefs(prefsData.data as UIPrefs)
      }

      // Load recent captures as inbox (shared pipeline)
      await loadCaptures(userId)

      setStatus('Loaded from Supabase')
      setTimeout(() => setStatus(''), 800)
    } catch {
      setStatus('Supabase load failed (check RLS / user row)')
      setTimeout(() => setStatus(''), 1400)
    }
  }, [setPrefs, loadCaptures])

  // Auth + Supabase load on mount (hybrid: Supabase source of truth when available, LS fallback)
  useEffect(() => {
    let cancelled = false
    async function initAuthAndLoad() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        const currentUser = session?.user || null
        if (currentUser) {
          setUser(currentUser)
          setSupabaseConnected(true)
          setAuthStatus('Signed in')
          await loadFromSupabase(currentUser.id)
        } else {
          // Check if keys look real (fix: check anon key, not url which is always the project)
          const client = supabase as unknown as { supabaseKey?: string; supabaseUrl?: string }
          const anonKey = client?.supabaseKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
          const url = client?.supabaseUrl || ''
          if (anonKey && !anonKey.includes('your-anon') && url && !url.includes('your-project')) {
            setSupabaseConnected(false) // connected means signed-in for RLS
            setAuthStatus('Keys present — sign in to enable cloud sync (RLS requires auth)')
          } else {
            setSupabaseConnected(false)
            setAuthStatus('Local only (configure real Supabase keys in .env.local)')
          }
        }
      } catch {
        if (!cancelled) {
          setSupabaseConnected(false)
          setAuthStatus('Auth check failed')
        }
      }
    }
    initAuthAndLoad()
    return () => { cancelled = true }
  }, [loadFromSupabase])

  async function signInForSync() {
    setAuthStatus('Signing in...')
    try {
      const { data, error } = await supabase.auth.signInAnonymously()
      if (error) throw error
      const signedUser = data.user
      if (signedUser) {
        setUser(signedUser)
        setSupabaseConnected(true)
        setAuthStatus('Signed in (anon)')
        await loadFromSupabase(signedUser.id)
        setStatus('Cloud sync enabled')
        setTimeout(() => setStatus(''), 1200)
      }
    } catch {
      setAuthStatus('Sign in failed — enable Anonymous provider in Supabase dashboard or use email')
      setTimeout(() => setAuthStatus(''), 3000)
    }
  }

  const effectiveMode = bioSummary ? bioSummary.mode : manualMode
  const rec = MODE_RECS[effectiveMode]

  // Supabase helpers (non-blocking, fall back to localStorage). Now user_id scoped.
  async function syncPrefsToSupabase(next: UIPrefs) {
    if (!user?.id) return
    setIsSyncing(true)
    try {
      await supabase.from('nd_prefs').upsert({ user_id: user.id, data: next })
      setStatus('Prefs synced to Supabase')
      setTimeout(() => setStatus(''), 800)
    } catch {
      setStatus('Supabase sync failed — using local only')
      setTimeout(() => setStatus(''), 1400)
    } finally {
      setIsSyncing(false)
    }
  }

  // Force full sync: pull from Supabase then push local state (last-write wins for prefs, union for inbox)
  async function forceSync() {
    if (!user?.id) {
      await signInForSync()
      return
    }
    setIsSyncing(true)
    setStatus('Force syncing...')
    try {
      // pull first
      await loadFromSupabase(user.id)

      // push current local prefs
      const { error: prefsError } = await supabase
        .from('nd_prefs')
        .upsert({ user_id: user.id, data: prefs })
      if (prefsError) throw prefsError

      // push any local-only captures (those not yet in synced set)
      const localOnly = inbox.filter(item => !syncedCaptureIds.has(item.id))
      await forceSyncCaptureItems(localOnly)

      setStatus('Force sync complete')
    } catch {
      setStatus('Force sync error (see console / RLS policies)')
    } finally {
      setIsSyncing(false)
      setTimeout(() => setStatus(''), 1600)
    }
  }

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
    syncPrefsToSupabase(next)
    setStatus(`Preset "${preset}" applied`)
    setTimeout(() => setStatus(''), 1400)
  }

  function updatePref<K extends keyof UIPrefs>(key: K, value: UIPrefs[K]) {
    const next = { ...prefs, [key]: value }
    setPrefs(next)
    syncPrefsToSupabase(next)
  }

  function handleCapture() {
    const text = captureText.trim()
    if (!text) return
    captureIdea(text)
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
    removeCaptureItem(id)
  }

  function logToResumptionStub(item: CaptureItem) {
    // Stub: in real would mutate ResumptionLog LS, here just note + copy
    const stub = `Resumption note from Controls: ${item.text}`
    navigator.clipboard?.writeText(stub)
    setStatus('Stub copied for Resumption Log (paste there)')
    setTimeout(() => setStatus(''), 1600)
  }

  function exportInbox() {
    exportCaptureInbox()
    setStatus('Inbox exported')
    setTimeout(() => setStatus(''), 1200)
  }

  function clearInbox() {
    clearCaptureInbox()
    setStatus('Inbox cleared')
    setTimeout(() => setStatus(''), 900)
  }

  // Per-item force sync helper
  async function forceSyncItem(item: CaptureItem) {
    if (!user?.id) {
      await signInForSync()
      return
    }
    setIsSyncing(true)
    try {
      await forceSyncCaptureItem(item)
      setStatus('Saved to Supabase')
    } catch {
      setStatus('Capture sync failed (RLS?)')
    } finally {
      setIsSyncing(false)
      setTimeout(() => setStatus(''), 1200)
    }
  }

  return (
    <section className="space-y-6" style={scaleStyle}>
      <div className="space-y-2">
        <SectionTitle>Governor Controls</SectionTitle>
        <SectionSubtitle>
          Sensory prefs, energy mode surface, and quick capture. Hybrid local + Supabase (user_id scoped + RLS). Shapes the rest of the dashboard.
        </SectionSubtitle>
      </div>

      {/* Status / live feedback */}
      {status && (
        <div style={{ color: 'var(--success)', fontSize: '0.8rem' }}>{status}</div>
      )}
      {authStatus && (
        <div style={{ color: 'var(--text-dim)', fontSize: '0.75rem' }}>{authStatus}</div>
      )}

      {/* Supabase hybrid status + Force sync + Auth */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: '0.75rem', flexWrap: 'wrap' }}>
        {user ? (
          <Badge tone="success">Supabase • {user.email || user.id?.slice(0,8)}</Badge>
        ) : supabaseConnected ? (
          <Badge tone="teal">Keys ready</Badge>
        ) : (
          <Badge tone="muted" wrap>Local only (add keys + run migration for sync)</Badge>
        )}
        {isSyncing && <Badge tone="teal">syncing…</Badge>}
        <ActionChip onClick={forceSync} disabled={isSyncing}>
          {user ? 'Force sync' : 'Sign in + Force sync'}
        </ActionChip>
        {!user && (
          <ActionChip onClick={signInForSync}>Sign in (anon) for cloud</ActionChip>
        )}
      </div>

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
            <label htmlFor="control-density" style={{ fontSize: '0.75rem', color: 'var(--text-dim)', display: 'block', marginBottom: 4 }}>Density</label>
            <select
              id="control-density"
              value={prefs.density}
              onChange={e => updatePref('density', e.target.value as UIPrefs['density'])}
              style={{ width: '100%', minHeight: 44, padding: '8px', borderRadius: 8, background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--line)', font: 'inherit' }}
            >
              <option value="comfortable">Comfortable (more space)</option>
              <option value="compact">Compact (focus mode)</option>
            </select>
          </div>
          <div>
            <label htmlFor="control-font-scale" style={{ fontSize: '0.75rem', color: 'var(--text-dim)', display: 'block', marginBottom: 4 }}>
              Font scale: {prefs.fontScale.toFixed(2)}
            </label>
            <input
              id="control-font-scale"
              type="range"
              min={0.85}
              max={1.3}
              step={0.05}
              value={prefs.fontScale}
              onChange={e => updatePref('fontScale', parseFloat(e.target.value))}
              style={{ width: '100%', minHeight: 44, accentColor: 'var(--teal)' }}
            />
          </div>
          <label className="flex min-h-11 items-center gap-3 cursor-pointer" style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
            <input
              type="checkbox"
              checked={prefs.highContrast}
              onChange={e => updatePref('highContrast', e.target.checked)}
              style={{ width: 20, height: 20, accentColor: 'var(--teal)' }}
            />
            High contrast
          </label>
          <label className="flex min-h-11 items-center gap-3 cursor-pointer" style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
            <input
              type="checkbox"
              checked={prefs.reducedMotion}
              onChange={e => updatePref('reducedMotion', e.target.checked)}
              style={{ width: 20, height: 20, accentColor: 'var(--teal)' }}
            />
            Reduced motion
          </label>
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
          <label htmlFor="control-effective-mode" style={{ fontSize: '0.75rem', color: 'var(--text-dim)', display: 'block', marginBottom: 4 }}>Effective mode</label>
          <select
            id="control-effective-mode"
            value={effectiveMode}
            onChange={e => {
              const m = e.target.value as BiometricMode
              setManualMode(m)
              // If bio present, manual still overrides display here
            }}
            style={{ width: '100%', minHeight: 44, padding: '8px', borderRadius: 8, background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--line)', font: 'inherit' }}
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
        <SectionSubtitle>Zero-friction inbox. Capture client notes, code ideas, shoot framing, blockers. Process later. Per-item Supabase status + force sync available.</SectionSubtitle>

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
          <ActionChip onClick={forceSync} disabled={isSyncing || !user}>Force full sync</ActionChip>
        </div>

        {inbox.length === 0 ? (
          <div style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>Inbox empty. Captures persist locally + Supabase (when signed in + RLS allows).</div>
        ) : (
          <div className="space-y-2 max-h-[260px] overflow-auto pr-1">
            {inbox.map(item => (
              <div key={item.id} style={{ border: '1px solid var(--line)', borderRadius: 8, padding: '8px 10px', background: 'var(--surface-soft)' }}>
                <div style={{ fontSize: '0.85rem', marginBottom: 4 }}>{item.text}</div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)', marginBottom: 6 }}>
                  {new Date(item.timestamp).toLocaleString()} • suggested: {item.suggested || 'general'}
                </div>
                <div className="flex gap-1 flex-wrap items-center">
                  <ActionChip onClick={() => copyItem(item)}>Copy</ActionChip>
                  <ActionChip onClick={() => logToResumptionStub(item)}>Log to Resumption (stub)</ActionChip>
                  <ActionChip variant="ghost" onClick={() => removeItem(item.id)}>Remove</ActionChip>
                  {syncedCaptureIds.has(item.id) ? (
                    <Badge tone="success">Supabase synced</Badge>
                  ) : user ? (
                    <ActionChip onClick={() => forceSyncItem(item)}>Sync to Supabase</ActionChip>
                  ) : (
                    <Badge tone="muted">local</Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>
        Hybrid: localStorage + Supabase (user_id + RLS policies). {user ? 'Authenticated sync.' : 'Sign in for cloud (anon supported).'} Force sync merges state. Apply presets before long sessions. This tab seeds adaptive UI.
      </div>
    </section>
  )
}
