/** @vitest-environment jsdom */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ControlsTab from './ControlsTab'
import BiometricsTab from './BiometricsTab'

// The production file must contain no fabricated readings. These tests read
// the committed file rather than a fixture so a sample cannot return silently.
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

describe('production biometric source has no fabricated readings', () => {
  it('ships an empty day list, not sample measurements', () => {
    expect(JSON.parse(SHIPPED_FILE)).toEqual([])
  })

  it('Controls reports no live data and shows no readiness number', async () => {
    render(<ControlsTab />)
    expect(await screen.findByText(/No live data/)).toBeTruthy()
    expect(screen.queryByText(/Readiness:/)).toBeNull()
    expect(screen.queryByText(/June 2026/)).toBeNull()
  })

  it('Biometric Governor reports no live records and shows no readings', async () => {
    render(<BiometricsTab />)
    await waitFor(() => expect(screen.getByText('No live biometric records loaded.')).toBeTruthy())
    expect(screen.queryByText(/Readiness:/)).toBeNull()
    expect(screen.queryByText(/June 2026/)).toBeNull()
  })
})
