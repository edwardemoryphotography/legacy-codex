/** @vitest-environment jsdom */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ControlsTab from './ControlsTab'
import BiometricsTab from './BiometricsTab'
import { TREND_SAMPLE_LABEL } from '@/lib/biometrics'

// The committed file itself, not a fixture: whatever ships in
// public/notes/biometric-trends.json is what these surfaces must label.
const SHIPPED_FILE = readFileSync(path.resolve(__dirname, '../../../public/notes/biometric-trends.json'), 'utf8')

vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    auth: { getSession: async () => ({ data: { session: null }, error: null }) },
    from: () => ({ select: () => ({ eq: async () => ({ data: [], error: null }) }) }),
  },
}))

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => url.includes('biometric-trends.json')
    ? { ok: true, status: 200, text: async () => SHIPPED_FILE, json: async () => JSON.parse(SHIPPED_FILE) }
    : { ok: false, status: 404, text: async () => '', json: async () => ({}) }))
})

describe('biometric-trends.json is labelled as sample, never live', () => {
  it('Controls labels the readiness as sample data with its dates', async () => {
    render(<ControlsTab />)
    expect(await screen.findByText(TREND_SAMPLE_LABEL)).toBeTruthy()
    expect(screen.getByText('June 2026')).toBeTruthy()
    expect(screen.queryByText(/live data/i)).toBeNull()
    expect(document.body.textContent).not.toMatch(/live data/i)
  })

  it('Biometric Governor labels the same file as sample data with its dates', async () => {
    render(<BiometricsTab />)
    await waitFor(() => expect(document.body.textContent).toContain(TREND_SAMPLE_LABEL))
    expect(document.body.textContent).toContain('June 2026')
    expect(document.body.textContent).not.toMatch(/live data|real record/i)
  })
})
