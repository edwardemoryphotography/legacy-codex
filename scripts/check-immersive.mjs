import { test } from 'node:test'
import assert from 'node:assert/strict'
import { runInNewContext } from 'node:vm'
import { orbPresentation } from '../src/lib/orbPresentation.ts'
import { homeRequest } from '../src/lib/homeRequest.ts'
import { normalizeAppearance, PALETTES, APPEARANCE_BOOT_SCRIPT } from '../src/lib/appearance.ts'

test('actual capture alone enters listening; stopping returns to idle', () => {
  const idle = { cognition: 'insufficient', recording: false, interaction: 'ambient' }
  assert.equal(orbPresentation(idle).state, 'idle')
  assert.equal(orbPresentation({ ...idle, interaction: 'listening' }).state, 'listening')
  assert.equal(orbPresentation(idle).state, 'idle')
})
test('model requests, real operations, answers and failures stay distinct', () => {
  const base = { cognition: 'deriving', recording: false, interaction: 'ambient' }
  assert.equal(orbPresentation(base).state, 'thinking')
  assert.equal(orbPresentation({ ...base, recording: true }).state, 'acting')
  assert.equal(orbPresentation({ ...base, operation: 'Reading saved missions' }).label, 'Reading saved missions')
  assert.equal(orbPresentation({ ...base, cognition: 'settled' }).state, 'ready')
  assert.equal(orbPresentation({ ...base, cognition: 'failed' }).state, 'blocked')
  assert.equal(orbPresentation({ ...base, cognition: 'insufficient' }).state, 'idle')
})
test('a typed question survives every tool selection', () => {
  const question = 'What the fuck is this thing actually doing?'
  for (const tool of [null, 'ask', 'brief', 'triage']) {
    assert.deepEqual(homeRequest(tool, question), { mode: 'question', question, label: 'Ask Codex' })
  }
  assert.equal(homeRequest('prompt', question).question.endsWith(question), true)
  assert.deepEqual(homeRequest('brief', ''), { mode: 'daily_brief', label: 'Daily Brief' })
  assert.deepEqual(homeRequest('triage', '  '), { mode: 'triage', label: 'Triage' })
})
test('appearance validates saved preferences and keeps Ember outside decorative palettes', () => {
  assert.deepEqual(normalizeAppearance({ palette: 'ocean', mode: 'light', glow: 0, motion: 'reduced' }), { palette: 'ocean', mode: 'light', glow: 0, motion: 'reduced' })
  assert.equal(normalizeAppearance({ palette: 'ember', glow: 99 }).palette, 'aurora')
  assert.equal(normalizeAppearance({ glow: 99 }).glow, 1)
  assert.equal(normalizeAppearance({ glow: null }).glow, 0.65)
  assert.deepEqual(Object.keys(PALETTES), ['aurora', 'ocean', 'forest', 'sunset'])
  for (const p of Object.values(PALETTES)) assert.equal([p.primary, p.secondary].some(c => c.toUpperCase() === '#FFB05C'), false)
})

test('the shipped boot script restores stored preferences with the runtime validator', () => {
  for (const saved of [null, { palette: 'ocean', mode: 'light', glow: 0, motion: 'reduced' }, { palette: 'sunset', glow: 2, motion: 'soft' }, { palette: 'ember', glow: null }]) {
    const dataset = {}
    const styles = new Map()
    const root = { dataset, style: { setProperty: (key, value) => styles.set(key, value) } }
    runInNewContext(APPEARANCE_BOOT_SCRIPT, { document: { documentElement: root, querySelector: () => null }, localStorage: { getItem: () => JSON.stringify(saved) } })
    const normalized = normalizeAppearance(saved)
    assert.equal(dataset.palette, normalized.palette)
    assert.equal(dataset.theme === 'light' ? 'light' : 'dark', normalized.mode)
    assert.equal(dataset.motion, normalized.motion)
    assert.equal(Number(styles.get('--ambient-glow')), normalized.glow)
  }
})

test('a historical failure cannot disguise a subsequent real capture', () => {
  const failed = { cognition: 'failed', recording: false, interaction: 'ambient' }
  assert.equal(orbPresentation(failed).state, 'blocked')
  assert.equal(orbPresentation({ ...failed, interaction: 'listening' }).state, 'listening')
  assert.equal(orbPresentation(failed).state, 'blocked')
})
