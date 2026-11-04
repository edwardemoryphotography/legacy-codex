/** @vitest-environment jsdom */
import { render, screen, fireEvent } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ControlsTab from './ControlsTab'

const MODE_KEY = 'nd_manual_mode_v1'

vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    auth: { getSession: async () => ({ data: { session: null }, error: null }) },
    from: () => ({ select: () => ({ eq: async () => ({ data: [], error: null }) }) }),
  },
}))

beforeEach(() => {
  localStorage.clear()
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 404, text: async () => '', json: async () => ({}) })))
})
afterEach(() => vi.unstubAllGlobals())

const modeSelect = () => screen.getByLabelText('Effective mode') as HTMLSelectElement

describe('Controls effective mode: the person chooses; missing readings never pick it', () => {
  it('respects a saved manual choice when no reading is loaded', async () => {
    localStorage.setItem(MODE_KEY, JSON.stringify('recovery'))
    render(<ControlsTab />)
    expect(await screen.findByText(/No live data/)).toBeTruthy()
    expect(modeSelect().value).toBe('recovery')
  })

  it('respects a choice made now', async () => {
    render(<ControlsTab />)
    expect(await screen.findByText(/No live data/)).toBeTruthy()
    fireEvent.change(modeSelect(), { target: { value: 'admin_light' } })
    expect(modeSelect().value).toBe('admin_light')
    expect(localStorage.getItem(MODE_KEY)).toBe(JSON.stringify('admin_light'))
  })


  it('offers an explicit opaque-surfaces preference', async () => {
    render(<ControlsTab />)
    expect(await screen.findByText(/No live data/)).toBeTruthy()
    const opaque = screen.getByLabelText('Opaque surfaces') as HTMLInputElement
    expect(document.documentElement.getAttribute('data-glass-opaque')).toBe('false')
    fireEvent.click(opaque)
    expect(document.documentElement.getAttribute('data-glass-opaque')).toBe('true')
  })

  it('falls back to the existing default Deep Build', async () => {
    render(<ControlsTab />)
    expect(await screen.findByText(/No live data/)).toBeTruthy()
    expect(modeSelect().value).toBe('deep_build')
  })
})
