/** @vitest-environment jsdom */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ControlsTab from './ControlsTab'
import { TREND_SAMPLE_LABEL } from '@/lib/biometrics'

// The committed sample file itself, not a fixture. On its last day it scores
// as "Creative Edit" under the old auto-detect thresholds, so it is the case
// that used to override the person's choice.
const SHIPPED_FILE = readFileSync(path.resolve(__dirname, '../../../public/notes/biometric-trends.json'), 'utf8')
const MODE_KEY = 'nd_manual_mode_v1'

vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    auth: { getSession: async () => ({ data: { session: null }, error: null }) },
    from: () => ({ select: () => ({ eq: async () => ({ data: [], error: null }) }) }),
  },
}))

function serveTrendFile(present: boolean) {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => present && url.includes('biometric-trends.json')
    ? { ok: true, status: 200, json: async () => JSON.parse(SHIPPED_FILE), text: async () => SHIPPED_FILE }
    : { ok: false, status: 404, json: async () => ({}), text: async () => '' }))
}

const modeSelect = () => screen.getByLabelText('Effective mode') as HTMLSelectElement

async function renderWithSampleShown() {
  const view = render(<ControlsTab />)
  expect(await screen.findByText(TREND_SAMPLE_LABEL)).toBeTruthy()
  return view
}

beforeEach(() => localStorage.clear())
afterEach(() => vi.unstubAllGlobals())

describe('Controls effective mode: the person chooses, sample data never does', () => {
  it('respects a saved manual choice while the sample file is shown', async () => {
    localStorage.setItem(MODE_KEY, JSON.stringify('recovery'))
    serveTrendFile(true)
    await renderWithSampleShown()
    expect(modeSelect().value).toBe('recovery')
  })

  it('respects a choice made now, with the sample file shown', async () => {
    serveTrendFile(true)
    await renderWithSampleShown()
    fireEvent.change(modeSelect(), { target: { value: 'admin_light' } })
    expect(modeSelect().value).toBe('admin_light')
    expect(localStorage.getItem(MODE_KEY)).toBe(JSON.stringify('admin_light'))
  })

  it('falls back to the existing default (Deep Build), not a sample-derived mode, when nothing is chosen', async () => {
    serveTrendFile(true)
    await renderWithSampleShown()
    expect(modeSelect().value).toBe('deep_build')
  })

  it('gives the same effective mode with or without the sample file', async () => {
    serveTrendFile(false)
    const without = render(<ControlsTab />)
    expect(await screen.findByText(/No live data/)).toBeTruthy()
    const modeWithout = modeSelect().value
    without.unmount()

    serveTrendFile(true)
    await renderWithSampleShown()
    expect(modeSelect().value).toBe(modeWithout)
  })
})
