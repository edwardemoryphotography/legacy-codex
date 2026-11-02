'use client'

import { useState } from 'react'
import { APPEARANCE_KEY, PALETTES, normalizeAppearance, applyAppearance, type Appearance } from '@/lib/appearance'

/** Production controls reuse the existing menu; only preferences are persisted. */
export default function ThemeReview() {
  const [prefs, setPrefs] = useState(() => {
    if (typeof window === 'undefined') return normalizeAppearance(null)
    try { return normalizeAppearance(JSON.parse(localStorage.getItem(APPEARANCE_KEY) || 'null')) } catch { return normalizeAppearance(null) }
  })
  const [notice, setNotice] = useState('')
  function choose(patch: Partial<Appearance>) {
    const next = normalizeAppearance({ ...prefs, ...patch })
    applyAppearance(next)
    setPrefs(next)
    try { localStorage.setItem(APPEARANCE_KEY, JSON.stringify(next)); setNotice('') }
    catch { setNotice('Changed for this visit. This browser could not save the preference.') }
  }
  return <details className="appearance">
    <summary>Appearance</summary>
    <fieldset><legend>Palette</legend><div className="appearance-palettes">
      {Object.entries(PALETTES).map(([id, palette]) => <button key={id} type="button" aria-pressed={prefs.palette === id} onClick={() => choose({ palette: id as Appearance['palette'] })}>
        <span className="appearance-swatch" aria-hidden="true" style={{ background: `linear-gradient(135deg, ${palette.primary}, ${palette.secondary})` }} />{palette.label}
      </button>)}
    </div></fieldset>
    <fieldset><legend>Appearance</legend>
      {(['dark', 'light'] as const).map(mode => <button key={mode} type="button" aria-pressed={prefs.mode === mode} onClick={() => choose({ mode })}>{mode === 'dark' ? 'Dark' : 'Light'}</button>)}
    </fieldset>
    <label className="appearance-range">Ambient glow<input aria-label="Ambient glow" type="range" min="0" max="1" step="0.05" value={prefs.glow} onChange={e => choose({ glow: Number(e.target.value) })} /></label>
    <label className="appearance-range">Motion<select aria-label="Motion" value={prefs.motion} onChange={e => choose({ motion: e.target.value as Appearance['motion'] })}>
      <option value="full">Full</option><option value="soft">Gentle</option><option value="reduced">Reduced</option>
    </select></label>
    <p className="glass-note">Your system’s reduced-motion setting always takes priority.</p>
    {notice && <p role="status" className="glass-note">{notice}</p>}
  </details>
}
